# EVT-17 — Organizer event update API with reminder recalculation and safe capacity changes

## Status
Ready

## Priority
P1

## Depends on
- EVT-3
- EVT-6
- EVT-7
- EVT-8

## Goal

Add an organizer-only backend API to update an existing event.

This task must introduce:

- `PATCH /api/v1/events/:eventId`
- partial update semantics for event basics;
- safe capacity-limit update behavior;
- reminder recalculation when event start time changes;
- strict test-first coverage for DTO validation and DB-backed integration behavior.

This is a **backend-only** task.

Do **not** change the mobile app in `EVT-17`.

---

## Why this task exists now

The organizer can already:

- create events;
- view events;
- view attendees;
- manage reminders;
- create/reuse invite links.

But the organizer still cannot correct an event after creation.

That is a core missing organizer capability.

We need a safe update API before building the mobile edit-event flow.

---

## Fixed implementation decisions for this task

These decisions are mandatory.

1. The update endpoint must be:
   - `PATCH /api/v1/events/:eventId`
2. The endpoint must be organizer-only and use the existing dev auth approach:
   - `x-dev-user-id`
3. The endpoint must update only organizer-owned events.
4. The request body must support partial updates.
5. The only editable fields are:
   - `title`
   - `description`
   - `location`
   - `startsAt`
   - `timezone`
   - `capacityLimit`
6. `description` and `location` must support explicit clearing.
7. `capacityLimit` must support explicit clearing via `null`.
8. When `startsAt` changes, existing reminders must be recalculated transactionally using their stored `offsetMinutes`.
9. If recalculated reminders would become invalid, the update must fail with `400` and no partial changes.
10. Capacity-limit changes must never silently demote already-confirmed attendees in this task.
11. If reducing capacity below current confirmed going count would be required, return `400`.
12. Increasing capacity or clearing capacity must promote waitlisted going attendees when appropriate.
13. No new database migration is expected in this task.

---

## Out of scope

The following are explicitly out of scope for `EVT-17`:

- mobile UI changes;
- auth providers;
- deleting events;
- editing invite links;
- comments/chat;
- plus-ones;
- payments;
- recurring events;
- public event discovery;
- push/email delivery logic;
- attendee manual status edits by organizer;
- demoting already-confirmed attendees when reducing capacity.

If any of the above appears, it is over-implementation.

---

## API contract

## Endpoint

`PATCH /api/v1/events/:eventId`

Organizer-only.

Requires:

- `x-dev-user-id` header in development/test flows

### Success response

HTTP `200`

Return the same response shape as the existing organizer event read endpoint:

```json
{
  "id": "evt_123",
  "title": "Friday Board Games",
  "description": "Bring drinks",
  "location": "Prospekt Mira 10",
  "startsAt": "2026-03-20T16:30:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8,
  "organizerUserId": "organizer-1",
  "createdAt": "2026-03-10T12:00:00.000Z",
  "updatedAt": "2026-03-18T10:00:00.000Z"
}
```

### Error responses

- `400` for invalid payload or unsafe update rules
- `401` for missing/unknown dev auth header
- `404` when event does not exist or is not owned by the organizer

---

## Request body semantics

The body is partial.

Omitted fields mean: **leave unchanged**.

### Allowed request fields

- `title?: string`
- `description?: string | null`
- `location?: string | null`
- `startsAt?: string`
- `timezone?: string`
- `capacityLimit?: number | null`

### Validation and normalization rules

Use the existing create-event rules as the base where applicable.

#### `title`
- optional in PATCH;
- if provided, must be a string;
- trim surrounding whitespace;
- must not be blank after trimming;
- same max length policy as the create-event DTO.

#### `description`
- optional in PATCH;
- if provided as string, trim surrounding whitespace;
- blank string becomes `null`;
- explicit `null` is allowed.

#### `location`
- optional in PATCH;
- if provided as string, trim surrounding whitespace;
- blank string becomes `null`;
- explicit `null` is allowed.

#### `startsAt`
- optional in PATCH;
- if provided, must be a valid ISO datetime string;
- must be stored the same way as the existing create flow.

#### `timezone`
- optional in PATCH;
- if provided, must be a valid IANA timezone string;
- reuse the existing timezone validation approach from create-event.

#### `capacityLimit`
- optional in PATCH;
- allowed values:
  - `null` (explicitly clear limit / unlimited)
  - integer from `1` to `10000`
- reject `0`, negatives, floats, strings, and invalid shapes.

#### Unknown fields
- must still be rejected with `400` by the existing global validation configuration.

---

## Business rules

## 1) Organizer ownership

The endpoint must update only events owned by `currentUser.id`.

Non-owner access must behave the same as existing organizer event read routes:

- return `404`

---

## 2) Partial update behavior

Only fields present in the request body may change.

Examples:

- send only `{ "title": "New title" }` → only title changes
- send only `{ "description": null }` → description is cleared
- send only `{ "capacityLimit": null }` → capacity becomes unlimited

Do not require the whole event payload.

---

## 3) Reminder recalculation when `startsAt` changes

If `startsAt` changes, existing reminders must be recalculated.

The system already stores reminders with:

- `offsetMinutes`
- `sendAt`

When `startsAt` changes:

1. load existing reminders for the event;
2. preserve their `offsetMinutes` values;
3. recalculate `sendAt` using the new `startsAt` and existing helper logic;
4. update all affected reminder rows in the same transaction as the event update.

### Important rule

If any recalculated reminder would become invalid, the entire update must fail with `400`.

Examples of invalid recalculation:

- new start time makes reminder `sendAt` occur in the past;
- new start time otherwise violates existing reminder scheduling rules.

### Transactionality requirement

If reminder recalculation fails:

- event row must stay unchanged;
- reminder rows must stay unchanged.

No partial update is allowed.

---

## 4) Capacity-limit update behavior

This task must keep capacity changes safe and predictable.

### Definitions

- **confirmed going** = attendees with `responseStatus = GOING` and `waitlistPosition = null`
- **waitlisted going** = attendees with `responseStatus = GOING` and `waitlistPosition != null`

### Rule A — unchanged or omitted capacity

If `capacityLimit` is omitted, do not rebalance attendees.

If it is present but equal to the current value, do not rebalance attendees.

### Rule B — increasing capacity

If the new numeric `capacityLimit` is greater than the current capacity behavior and more confirmed seats are available:

- promote the earliest waitlisted going attendees to confirmed;
- preserve waitlist order for the remaining waitlisted attendees;
- compact remaining `waitlistPosition` values to `1..N` with no gaps.

Promotion order must be deterministic:

1. smallest current `waitlistPosition`
2. tie-break by `createdAt` ASC
3. final tie-break by `id` ASC

### Rule C — clearing capacity (`capacityLimit = null`)

When capacity is explicitly cleared to unlimited:

- all `GOING` attendees must become confirmed;
- all `waitlistPosition` values for `GOING` attendees must become `null`.

`MAYBE` and `NOT_GOING` attendees remain unchanged.

### Rule D — reducing capacity

If the new numeric capacity would be **less than current confirmed going count**, reject the update with `400`.

Do not demote confirmed attendees in this task.

This rule is mandatory.

### Rule E — reducing capacity but still valid

If the new numeric capacity is less than or equal to the old capacity but still **greater than or equal to current confirmed going count**, the update may succeed.

In that case:

- confirmed attendees stay confirmed;
- existing waitlisted attendees remain waitlisted;
- waitlist is compacted if needed;
- no confirmed attendee is demoted.

---

## 5) Existing attendee summary and attendee-list routes must remain coherent

After a successful update:

- `GET /api/v1/events/:eventId/attendees` must reflect the new capacity behavior correctly;
- RSVP summaries must remain correct;
- reminder GET results must reflect recalculated send times if `startsAt` changed.

You do not need to change those route contracts, but the updated data must be observable through them.

---

## Required tests first

Before production implementation, add these tests.

## A) DTO/unit validation test

Create a new test file:

- `apps/api/test/update-event.dto.spec.ts`

It must cover at least:

1. valid partial title update
2. `description` blank string → normalized to `null`
3. `location` blank string → normalized to `null`
4. `capacityLimit: null` is allowed
5. invalid `capacityLimit` values are rejected
6. invalid timezone is rejected
7. invalid `startsAt` is rejected
8. unknown field is rejected through the existing validation path if the DTO test structure supports it, otherwise cover it in integration

## B) DB-backed integration test

Create a new integration test file:

- `apps/api/test/events-update.integration-spec.ts`

It must cover at least these scenarios:

1. organizer updates basic fields successfully
2. missing header → `401`
3. unknown user → `401`
4. non-owner update → `404`
5. partial update changes only provided fields
6. updating `startsAt` recalculates existing reminder `sendAt` values
7. updating `startsAt` in a way that makes a reminder invalid returns `400` and keeps old event/reminders unchanged
8. increasing capacity promotes the earliest waitlisted going attendee(s)
9. clearing capacity (`capacityLimit: null`) confirms all waitlisted going attendees
10. reducing capacity below current confirmed going count returns `400` and preserves attendee placement

You may add one or two extra relevant assertions if they directly support these rules, but do not add speculative coverage.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow strict red → green.

Because this task changes existing backend behavior, the required process is:

1. add/update the DTO and integration tests first;
2. run the smallest relevant commands to prove red state;
3. only then implement production code;
4. rerun targeted tests and broader affected suites to prove green.

### Required red-state commands

At minimum, run commands equivalent to:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/update-event.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-update.integration-spec.ts
```

The initial red-state failure must be caused by unimplemented update behavior, missing DTO/module, or failing assertions corresponding to this task.

### Required green-state commands

After implementation, run at minimum:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/update-event.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-update.integration-spec.ts
pnpm --filter @event-app/api typecheck
```

Then run the broader relevant backend verification set.

---

## Detailed implementation requirements

## 1) Controller

Update the events controller to expose:

- `PATCH /api/v1/events/:eventId`

Requirements:

- protected by the existing dev auth guard;
- Swagger docs added for:
  - dev header
  - request body
  - success response
  - `400/401/404`
- follow existing controller conventions used by current organizer event routes.

---

## 2) DTO

Add a dedicated patch DTO in the events DTO area.

Requirements:

- partial-field semantics;
- normalization rules described above;
- reuse existing validation style and helpers where appropriate;
- keep DTO focused and not over-abstracted.

Do not modify the create-event DTO in unrelated ways.

---

## 3) Service

Add a service method for updating organizer-owned events.

Requirements:

- find organizer-owned event first;
- compute update plan;
- execute event update + any attendee/reminder side effects in a transaction;
- return the standard event response shape.

### Reminder recalculation implementation guidance

Prefer reusing the existing reminder scheduling helper rather than duplicating date math.

Suggested pattern:

1. load existing reminders ordered deterministically;
2. build a recalculated plan from their `offsetMinutes` against the new `startsAt`;
3. update `sendAt` values in the same transaction.

### Capacity rebalance implementation guidance

Use deterministic attendee ordering and existing waitlist semantics from EVT-6.

At the end of any capacity-affecting update:

- confirmed going attendees must have `waitlistPosition = null`
- waitlisted going attendees must have compacted positions `1..N`
- maybe/not_going must not gain waitlist positions

Keep implementation minimal and explicit.

---

## 4) No schema changes unless truly necessary

This task should not need a schema migration.

Do not add a migration unless you discover a real blocking schema gap.

If you unexpectedly need one, explain exactly why.

---

## 5) Raw SQL in tests must respect current DB constraints

Existing integration tests already showed that raw SQL inserts must explicitly satisfy non-null columns such as `updated_at`.

If you seed via raw SQL in the new integration test, ensure inserted rows include all required non-null fields.

Do not leave the test suite flaky or dependent on missing default values.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `PATCH /api/v1/events/:eventId` exists and is organizer-only.
2. Partial updates work correctly for event basics.
3. `description` and `location` can be cleared.
4. `capacityLimit` can be set to a number or cleared to `null`.
5. Invalid payloads return `400`.
6. Non-owner access returns `404`.
7. Missing/unknown dev auth returns `401`.
8. Changing `startsAt` recalculates reminder `sendAt` values.
9. If recalculated reminders become invalid, update fails with `400` and no partial mutation occurs.
10. Increasing capacity promotes earliest waitlisted going attendees.
11. Clearing capacity confirms all waitlisted going attendees.
12. Reducing capacity below current confirmed going count returns `400`.
13. New DTO/unit test is green.
14. New integration suite is green.
15. Existing relevant backend tests remain green.
16. No mobile files are changed.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:migrate:test
pnpm --filter @event-app/api db:seed:dev-user

pnpm --filter @event-app/api test -- --runTestsByPath test/update-event.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-update.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Then manually verify with HTTP requests.

### Example manual flow

1. Create an event.
2. Add reminders.
3. Add enough RSVP rows to create at least one waitlisted attendee.
4. Patch event title/description/location.
5. Patch event `startsAt` and verify reminders change.
6. Patch `capacityLimit` upward and verify waitlist promotion via attendee list.
7. Patch `capacityLimit` to `null` and verify all waitlisted going attendees become confirmed.
8. Attempt to patch `capacityLimit` below current confirmed going count and verify `400`.

You may use PowerShell `Invoke-RestMethod` or any equivalent local HTTP client, but document exact commands in the final report.

---

## Implementation notes and guardrails

- Keep changes focused on events update behavior.
- Do not refactor unrelated modules.
- Do not modify README.md.
- Do not modify anything under `tasks/`.
- Reuse existing helpers where practical.
- Prefer explicit transactional logic over clever abstractions.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-17` must explicitly include:

1. exact PATCH request examples used for manual/local verification;
2. whether reminder recalculation is triggered only on `startsAt` change or in any broader case;
3. the exact behavior when `capacityLimit` is set to `null`;
4. the exact behavior when attempting to reduce capacity below current confirmed going count.

---

## Definition of done

`EVT-17` is done when an organizer can safely patch an existing event, reminder schedules stay coherent after start-time changes, unsafe reminder/capacity changes are rejected transactionally, and attendee placement remains consistent with the waitlist rules already established in the project.

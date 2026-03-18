# EVT-6 — Capacity-aware RSVP placement and automatic waitlist promotion

## Status
Ready

## Priority
P0

## Depends on
- EVT-5

## Goal

Implement capacity-aware RSVP behavior so public RSVP submissions correctly place guests into either:

- a confirmed going seat; or
- the waitlist when the event is already full.

This task must also implement automatic promotion from the waitlist when a confirmed seat becomes free.

The feature must work through the already existing public RSVP endpoint and the already existing organizer attendee-list endpoint.

This is a backend/domain task. Do not add mobile UI in this task.

---

## Why this task exists now

The project already supports:

- public invite resolution;
- public RSVP submission;
- organizer attendee listing;
- RSVP summaries.

However, the core product requirement is not just RSVP collection — it is RSVP collection **with event capacity and waitlist behavior**.

After this task is done, the backend must correctly answer:

- who is actually confirmed;
- who is waitlisted;
- what the current waitlist order is;
- whether the event is full;
- who should be auto-promoted when a seat opens.

This is one of the central product mechanics and must be implemented before reminders, organizer tooling, or mobile feature screens.

---

## Fixed implementation decisions for this task

These decisions are mandatory for `EVT-6`.

1. Event capacity applies only to attendees whose RSVP `status` is `going` **and** who are not waitlisted.
2. `maybe` attendees do **not** consume capacity.
3. `not_going` attendees do **not** consume capacity.
4. Waitlist is only for attendees whose RSVP `status` is `going`.
5. A waitlisted attendee remains `status = going`; they are not converted to `maybe`.
6. Waitlist order is FIFO based on server-side placement order.
7. When a confirmed seat becomes free, the earliest waitlisted attendee must be auto-promoted immediately.
8. Promotion must happen synchronously in the same server-side write flow that frees the seat.
9. This task must use a **real DB-backed concurrency-safe approach** for seat assignment.
10. This task must add a **new Prisma migration**.
11. Do **not** add organizer manual override endpoints in this task.
12. Do **not** add notifications/reminders in this task.
13. Do **not** add plus-one seat accounting in this task. `allowPlusOnes` remains unrelated here.
14. Do **not** add per-event hidden reserve seats or soft-cap logic.
15. Keep the public RSVP route path unchanged:
    - `POST /api/v1/invite-links/:token/rsvp`
16. Keep the organizer attendee-list route path unchanged:
    - `GET /api/v1/events/:eventId/attendees`

---

## Out of scope

The following are explicitly out of scope for `EVT-6`:

- organizer manually moving attendees between confirmed and waitlist;
- organizer manually reordering the waitlist;
- editing event capacity after attendees already exist;
- plus-one seat counting;
- attendee deletion endpoint;
- reminder scheduling;
- email or push notifications;
- auth provider work;
- mobile UI work;
- analytics/reporting beyond the summaries defined here;
- public attendee list pages.

If any of the above appears, it is over-implementation and must be removed.

---

## Existing behavior that must remain compatible

The project already has public RSVP submission and organizer attendee listing.

This task must **extend** those flows rather than replacing them.

These existing expectations must remain true:

- public invite-link lookup is still unauthenticated;
- RSVP still uses guest name + guest email + status;
- organizer attendee list is still organizer-scoped;
- missing/unknown dev auth header for organizer routes still returns `401`;
- unknown or unauthorized event access for organizer routes still returns `404`;
- missing/inactive/expired invite token for public routes still returns `404`;
- invalid payloads still return `400`.

---

## Required DB/model changes

This task must add the minimum schema required to support waitlist placement.

### Required schema change

Add a nullable integer field to the attendee model/table:

- Prisma field name: `waitlistPosition`
- DB column name: `waitlist_position`

This field means:

- `NULL` when the attendee is **not** currently on the waitlist;
- positive integer `1..N` when the attendee is currently on the waitlist.

### Required uniqueness rule

Within a single event, two attendees must never share the same non-null waitlist position.

Implement a DB-level uniqueness guarantee for waitlist order within an event.

Because this is PostgreSQL and partial indexes are appropriate here, it is acceptable and encouraged to implement this with raw SQL inside the migration if Prisma schema DSL alone is insufficient.

### Existing uniqueness rule

The existing uniqueness rule preventing duplicate attendee rows per `(event_id, guest_email)` must remain intact.

### Important modeling rule

Do **not** introduce a second RSVP-status enum for this task.

Use the existing RSVP `status` plus `waitlistPosition` to derive the attendee placement state.

That means:

- `status = going` and `waitlistPosition = null` => confirmed going attendee
- `status = going` and `waitlistPosition != null` => waitlisted attendee
- `status = maybe` or `not_going` => not confirmed and not waitlisted

This is required to keep the model simple.

---

## Derived placement state contract

Although only `waitlistPosition` is stored, API responses in this task must expose a derived field:

- `attendanceState`

Allowed response values:

- `confirmed`
- `waitlisted`
- `not_attending`

Derivation rules:

- `going + waitlistPosition = null` => `confirmed`
- `going + waitlistPosition = number` => `waitlisted`
- `maybe` or `not_going` => `not_attending`

This derived field must be used consistently in:

1. public RSVP response;
2. organizer attendee list response.

---

## Concurrency and transaction requirements

This task must be safe under concurrent RSVP submissions for the same event.

### Mandatory rule

Seat placement and waitlist assignment must be computed inside a transaction that serializes competing writes for the same event.

### Required implementation approach

Use PostgreSQL row-level locking on the event row, or an equivalent per-event serialization mechanism, inside the transaction.

A straightforward acceptable approach is:

1. begin DB transaction;
2. lock the event row for the target event (`SELECT ... FOR UPDATE` or equivalent);
3. load the current attendee rows needed for placement decisions;
4. apply the RSVP upsert/change;
5. compute any waitlist compaction or auto-promotion;
6. commit.

### Why this is mandatory

Without serialization, two concurrent `going` submissions could both think the last seat is free and both become confirmed.

That would violate the product behavior.

### Forbidden shortcuts

Do not rely only on app-memory locks.
Do not rely only on optimistic assumptions without a DB lock.
Do not defer promotion to a background job.

---

## Endpoint behavior changes required in this task

## 1) Public RSVP endpoint

Keep this route:

- `POST /api/v1/invite-links/:token/rsvp`

### Request body contract

The request body contract remains:

```json
{
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going"
}
```

Allowed `status` values remain:

- `going`
- `maybe`
- `not_going`

### Required placement behavior

#### Case A — first RSVP to a not-full event
If the attendee submits `status = going` and confirmed seats are still available:

- attendee must be stored with `status = going`
- `waitlistPosition` must be `null`
- `attendanceState` in the response must be `confirmed`

#### Case B — first RSVP to a full event
If the attendee submits `status = going` and the event is already full:

- attendee must be stored with `status = going`
- attendee must get the next waitlist position
- `attendanceState` in the response must be `waitlisted`

#### Case C — attendee already exists and updates RSVP
The existing attendee row must still be updated idempotently by `(eventId, guestEmail)`.

If an attendee already exists and changes RSVP:

- name updates should still persist
- status updates should still persist
- placement must be recalculated correctly

#### Case D — attendee changes from `going` confirmed to `maybe` or `not_going`
This frees one confirmed seat.

Required result:

- this attendee must no longer be waitlisted
- this attendee must have `waitlistPosition = null`
- the earliest current waitlisted attendee, if any, must be auto-promoted
- the promoted attendee must become:
  - `status = going`
  - `waitlistPosition = null`
  - `attendanceState = confirmed`

#### Case E — attendee changes from `going` waitlisted to `maybe` or `not_going`
Required result:

- this attendee must leave the waitlist
- `waitlistPosition` must become `null`
- remaining waitlist positions must be compacted to stay contiguous starting from `1`
- no confirmed-seat promotion is needed unless a confirmed seat also became free in the same operation

#### Case F — attendee changes from `maybe` or `not_going` to `going`
Required result:

- if seats are available, become confirmed;
- otherwise, join the end of the waitlist.

### Response contract

Return the attendee payload with the existing fields plus the new placement fields.

Required response shape:

```json
{
  "attendeeId": "att_123",
  "eventId": "evt_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "attendanceState": "confirmed",
  "waitlistPosition": null,
  "createdAt": "2026-03-20T10:00:00.000Z",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

Example waitlisted response:

```json
{
  "attendeeId": "att_124",
  "eventId": "evt_123",
  "guestName": "Charlie",
  "guestEmail": "charlie@example.com",
  "status": "going",
  "attendanceState": "waitlisted",
  "waitlistPosition": 1,
  "createdAt": "2026-03-20T10:05:00.000Z",
  "updatedAt": "2026-03-20T10:05:00.000Z"
}
```

### Status codes

Keep the existing behavior:

- `201` when a new attendee row is created;
- `200` when an existing attendee row is updated.

### Validation behavior

Existing validation/normalization behavior from `EVT-5` must remain intact.

---

## 2) Public invite-link resolution endpoint

Keep this route:

- `GET /api/v1/invite-links/:token`

It already returns the event payload and RSVP summary.

### Required summary extension

Extend the existing `rsvpSummary` object to include the capacity/waitlist fields below.

Required `rsvpSummary` shape after this task:

```json
{
  "going": 5,
  "maybe": 1,
  "notGoing": 2,
  "total": 8,
  "confirmedGoing": 4,
  "waitlistedGoing": 1,
  "capacityLimit": 4,
  "remainingSpots": 0,
  "isFull": true
}
```

### Field meanings

- `going` = attendees whose RSVP status is `going` regardless of waitlist state
- `maybe` = attendees whose RSVP status is `maybe`
- `notGoing` = attendees whose RSVP status is `not_going`
- `total` = all attendee rows for the event
- `confirmedGoing` = attendees with `status = going` and `waitlistPosition = null`
- `waitlistedGoing` = attendees with `status = going` and `waitlistPosition != null`
- `capacityLimit` = event capacity from the event record
- `remainingSpots` = `max(capacityLimit - confirmedGoing, 0)`
- `isFull` = `remainingSpots === 0`

These exact field names are required.

---

## 3) Organizer attendee-list endpoint

Keep this route:

- `GET /api/v1/events/:eventId/attendees`

### Organizer auth behavior

Keep the existing organizer-only behavior unchanged:

- missing/unknown dev auth => `401`
- event not found or not owned by organizer => `404`

### Required attendee object shape

Each attendee item in the response must now include:

- `attendanceState`
- `waitlistPosition`

Required attendee item shape:

```json
{
  "attendeeId": "att_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "attendanceState": "confirmed",
  "waitlistPosition": null,
  "createdAt": "2026-03-20T10:00:00.000Z",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

### Required summary shape

The organizer response `summary` object must match the same shape as the public `rsvpSummary` described above:

```json
{
  "going": 5,
  "maybe": 1,
  "notGoing": 2,
  "total": 8,
  "confirmedGoing": 4,
  "waitlistedGoing": 1,
  "capacityLimit": 4,
  "remainingSpots": 0,
  "isFull": true
}
```

Use these exact field names.

### Required ordering

The attendee list must be deterministic and grouped in the following order:

1. confirmed `going` attendees
2. waitlisted `going` attendees
3. `maybe` attendees
4. `not_going` attendees

Within each group:

- confirmed attendees: sort by `createdAt ASC`, then `id ASC`
- waitlisted attendees: sort by `waitlistPosition ASC`, then `id ASC`
- `maybe` attendees: sort by `createdAt ASC`, then `id ASC`
- `not_going` attendees: sort by `createdAt ASC`, then `id ASC`

This ordering is required so organizer views are stable and useful.

---

## Required reusable domain/helper logic

To avoid duplicated logic across public and organizer responses, extract a small reusable helper module for:

1. deriving `attendanceState` from attendee status + waitlist position;
2. building the summary object shape;
3. optionally sorting attendee response rows according to the required ordering.

Keep this helper small and pure.

This helper is intentionally required so it can be tested independently.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

You may create only the minimum scaffolding needed to add the new migration, helper module, DTO/response mapping, and integration tests.

Do **not** implement the production waitlist behavior before the new tests exist and have been run in a failing state.

### Required tests to add first

Before implementing the feature, add these tests:

1. **Pure helper/unit test**
   - file name suggestion: `apps/api/test/attendance-summary.spec.ts`
   - must cover:
     - `attendanceState` derivation
     - summary calculation including `confirmedGoing`, `waitlistedGoing`, `remainingSpots`, `isFull`
     - any required deterministic attendee ordering helper if you extract it

2. **DB-backed integration test suite**
   - file name suggestion: `apps/api/test/waitlist.integration-spec.ts`
   - must cover the end-to-end HTTP/API behavior defined in this task

You may split the integration coverage into multiple `it(...)` blocks, but keep them focused.

### Minimum integration scenarios that must be covered

The integration suite must cover all of the following:

1. **fill capacity, then waitlist overflow**
   - create event with small capacity (for example 2)
   - RSVP `going` for first guest => confirmed
   - RSVP `going` for second guest => confirmed
   - RSVP `going` for third guest => waitlisted position 1
   - RSVP `going` for fourth guest => waitlisted position 2

2. **waitlisted attendee leaves waitlist**
   - a waitlisted attendee changes status to `maybe` or `not_going`
   - they are removed from waitlist
   - positions compact (e.g. former position 2 becomes 1)

3. **confirmed attendee frees a seat and auto-promotion happens**
   - a confirmed attendee changes to `not_going` or `maybe`
   - earliest waitlisted attendee becomes confirmed automatically
   - promoted attendee now has `waitlistPosition = null`

4. **public invite summary reflects capacity state**
   - `GET /api/v1/invite-links/:token` returns the extended `rsvpSummary`
   - counts must match the final attendee state

5. **organizer attendee list reflects placement state**
   - `GET /api/v1/events/:eventId/attendees` includes:
     - `attendanceState`
     - `waitlistPosition`
     - extended summary
     - required ordering

### Red-state requirement

Before implementing the final production logic, run the smallest relevant commands and confirm the tests fail.

Acceptable red-state reasons include:

- missing helper module;
- missing `waitlistPosition` field;
- response shape missing `attendanceState`;
- no auto-promotion logic yet;
- summary fields missing;
- ordering not implemented yet.

A compile failure due to the not-yet-implemented helper or schema field is acceptable if it clearly corresponds to this task.

### Green-state requirement

After implementation:

- rerun the helper/unit test and make it green;
- rerun the DB-backed integration suite and make it green;
- rerun relevant existing tests that could be affected by this task.

### Forbidden shortcuts

Do not:

- weaken tests to avoid checking waitlist placement;
- skip DB-backed integration assertions;
- fake waitlist state only in the response without persisting it;
- defer auto-promotion to a later task;
- make response fields optional when this task requires them.

---

## Detailed implementation requirements

## 1) Prisma schema and migration

Add the new attendee field and create a new migration.

### Required migration behavior

The migration must:

- add `waitlist_position` as nullable integer to the attendee table;
- preserve existing attendee rows;
- add DB-level protection for unique non-null waitlist positions per event;
- remain compatible with PostgreSQL.

### Migration constraints

- create a **new** migration under the existing migrations directory;
- do not edit old committed migrations;
- keep migration SQL readable and reviewable.

---

## 2) RSVP placement service logic

Extend the existing RSVP service flow to apply capacity-aware placement.

### Required algorithmic behavior

For a target event with capacity `C`:

1. lock the event row inside the transaction;
2. load all attendee rows for that event that are relevant to seat/waitlist calculation;
3. upsert or update the attendee identified by `(eventId, guestEmail)`;
4. apply these rules:

#### If resulting status is `going`
- if attendee already had a confirmed seat and still remains `going`, keep them confirmed;
- otherwise, if confirmed-going count is below capacity, confirm them;
- otherwise place them at the end of the waitlist.

#### If resulting status is `maybe` or `not_going`
- attendee must not be confirmed;
- attendee must not remain waitlisted;
- `waitlistPosition` must be null.

5. if a confirmed seat was freed by this change, auto-promote the earliest waitlisted attendee;
6. compact waitlist positions so the active waitlist positions are exactly `1..N` with no gaps;
7. persist and return the resulting attendee row.

### Important behavioral clarifications

- A waitlisted attendee who resubmits `going` while still full should keep or receive an appropriate waitlist position rather than incorrectly becoming confirmed.
- An already confirmed attendee who updates only their `guestName` while remaining `going` should stay confirmed.
- A waitlisted attendee who updates only their `guestName` while remaining `going` should remain on the waitlist in the correct order.
- If the current attendee leaves the waitlist, positions must compact.
- If a confirmed seat becomes free and at least one waitlisted attendee exists, exactly one attendee is auto-promoted per freed seat.

---

## 3) Public invite summary update

Extend the existing invite-resolution service mapping so `rsvpSummary` matches the exact required shape.

Do not rename the `rsvpSummary` object.

The existing event payload fields should remain intact.

---

## 4) Organizer attendee-list update

Extend the organizer attendee-list response to include:

- `attendanceState`
- `waitlistPosition`
- extended summary fields
- required ordering

Do not create a second organizer endpoint for waitlist. Keep the existing attendee-list endpoint as the single organizer read model in this task.

---

## 5) Swagger / OpenAPI

Update Swagger metadata so the affected routes show the extended response shape.

At minimum, ensure the route descriptions and response DTO/docs do not mislead a developer about the new waitlist fields.

Keep the Swagger work minimal and focused.

---

## 6) Documentation updates

Update `docs/local-development.md` with a focused section for `EVT-6` manual verification.

It must include:

1. how to seed or otherwise obtain a dev organizer user;
2. how to create an event with a small capacity;
3. how to create an invite link;
4. how to submit multiple RSVP requests that overflow capacity;
5. how to verify waitlist position assignment;
6. how to verify auto-promotion after a confirmed attendee changes to `not_going` or `maybe`;
7. how to verify the organizer attendee list;
8. the exact URLs involved.

Use PowerShell-friendly examples.

---

## 7) Response contract details required by this task

These details are mandatory and must be implemented exactly.

### RSVP response fields

Required fields in RSVP response:

- `attendeeId`
- `eventId`
- `guestName`
- `guestEmail`
- `status`
- `attendanceState`
- `waitlistPosition`
- `createdAt`
- `updatedAt`

### Organizer attendee-list response shape

Required top-level shape:

```json
{
  "eventId": "evt_123",
  "summary": {
    "going": 5,
    "maybe": 1,
    "notGoing": 2,
    "total": 8,
    "confirmedGoing": 4,
    "waitlistedGoing": 1,
    "capacityLimit": 4,
    "remainingSpots": 0,
    "isFull": true
  },
  "attendees": [
    {
      "attendeeId": "att_123",
      "guestName": "Nikita",
      "guestEmail": "nikita@example.com",
      "status": "going",
      "attendanceState": "confirmed",
      "waitlistPosition": null,
      "createdAt": "2026-03-20T10:00:00.000Z",
      "updatedAt": "2026-03-20T10:00:00.000Z"
    }
  ]
}
```

### Public invite-resolution summary shape

Required `rsvpSummary` example:

```json
{
  "going": 3,
  "maybe": 1,
  "notGoing": 1,
  "total": 5,
  "confirmedGoing": 2,
  "waitlistedGoing": 1,
  "capacityLimit": 2,
  "remainingSpots": 0,
  "isFull": true
}
```

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. A new Prisma migration exists and adds waitlist support.
2. Attendee rows can persist a nullable waitlist position.
3. Public RSVP submission respects capacity.
4. Overflow `going` RSVPs are placed on the waitlist.
5. Waitlist order is deterministic and gap-free.
6. Existing attendee updates remain idempotent by `(eventId, guestEmail)`.
7. When a confirmed attendee leaves their seat, the earliest waitlisted attendee is auto-promoted immediately.
8. `GET /api/v1/invite-links/:token` returns the extended `rsvpSummary` fields exactly as specified.
9. `GET /api/v1/events/:eventId/attendees` returns attendee placement fields and extended summary exactly as specified.
10. Organizer attendee ordering matches the required ordering rules.
11. The implementation is concurrency-safe for competing RSVPs to the same event.
12. Tests were added first and observed failing before production implementation.
13. The new helper/unit test is green.
14. The new DB-backed integration suite is green.
15. Relevant existing tests affected by this task remain green.
16. No manual organizer override endpoints or notification logic were added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

At minimum, verify with commands equivalent to the following.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api test -- --runTestsByPath test/attendance-summary.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/waitlist.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Then manually verify a flow like this:

1. create an event with capacity `2`;
2. create an invite link;
3. submit RSVP `going` for guest A;
4. submit RSVP `going` for guest B;
5. submit RSVP `going` for guest C;
6. submit RSVP `going` for guest D;
7. confirm C is waitlist position `1` and D is waitlist position `2`;
8. update C to `maybe` and confirm D becomes waitlist position `1`;
9. update A to `not_going` and confirm D is auto-promoted to confirmed;
10. fetch public invite link summary and organizer attendee list and confirm the counts.

Stop infra when done:

```powershell
docker compose down
```

### Bash-friendly flow

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api test -- --runTestsByPath test/attendance-summary.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/waitlist.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

---

## Implementation notes and guardrails

- Keep the diff focused on waitlist/capacity behavior.
- Do not add future reminder/job infrastructure here.
- Do not add organizer mutation endpoints for attendee management.
- Do not change immutable files under `tasks/` or the root `README.md`.
- Prefer a small pure helper for summary/placement derivation rather than duplicating mapping code.
- Be explicit and deterministic in ordering.
- Keep DB writes inside the transaction minimal but correct.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-6` must explicitly include:

1. the exact new migration path;
2. the exact DB-level uniqueness strategy used for waitlist positions;
3. the exact helper/unit tests added;
4. the exact integration scenarios covered;
5. the exact failing command(s) that proved the red state;
6. the exact passing command(s) that proved the green state;
7. the final RSVP response shape including `attendanceState` and `waitlistPosition`;
8. one example organizer attendee-list response body;
9. one example public `rsvpSummary` body;
10. confirmation of how concurrency was handled.

---

## Definition of done

`EVT-6` is done when a developer can start the local stack, create a small-capacity event, overflow it with `going` RSVPs, observe deterministic waitlist positions, change RSVP states to free a seat, and immediately observe correct auto-promotion and updated summaries through the existing API endpoints.

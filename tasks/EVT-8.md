# EVT-8 — Organizer events list API for mobile home screen

## Status
Ready

## Priority
P1

## Depends on
- EVT-3
- EVT-4
- EVT-5
- EVT-6
- EVT-7

## Goal

Add an organizer-facing events list API so the mobile app can load a real home screen without hardcoding event IDs.

This task must add a new authenticated organizer endpoint:

- `GET /api/v1/events`

The endpoint must return the current organizer's events with deterministic ordering, lightweight event-card data, and capacity-aware RSVP summary fields that are already consistent with EVT-6 behavior.

This is a backend task only.
Do not build mobile screens in this task.

---

## Why this task exists now

We already have enough backend primitives to create events, read one event, create invite links, submit RSVP, manage waitlist placement, and configure reminder schedules.

What is still missing is the single most important endpoint needed for a usable organizer home screen:

- “show me my events”

Without this endpoint, the mobile app would have to rely on manually pasted event IDs, which is not a realistic organizer flow.

After this task is done, the next mobile task can build a real organizer home screen against a stable API.

---

## Fixed implementation decisions for this task

These are mandatory.

1. Reuse the existing dev organizer auth header:
   - `x-dev-user-id`
2. Do not introduce pagination yet.
3. Do not introduce search yet.
4. Do not introduce update/delete event endpoints yet.
5. Do not introduce public listing behavior.
6. The list endpoint is organizer-only.
7. Reuse existing RSVP summary logic from EVT-6 rather than re-implementing divergent counting rules.
8. Keep response objects compact and card-friendly.

---

## Out of scope

The following are explicitly out of scope for `EVT-8`:

- mobile screens;
- Expo/React Native changes;
- event editing;
- event deletion/cancellation;
- full-text search;
- pagination/cursoring;
- reminder delivery jobs;
- auth provider work;
- public event discovery;
- comments/chat;
- payments;
- web UI.

If any of these appear, it is over-implementation.

---

## API to add

## 1) Organizer events list

Add:

- `GET /api/v1/events`

This endpoint must:

- require organizer auth via `x-dev-user-id`;
- return only events owned by the current organizer;
- support a small query filter for list scope;
- return deterministic ordering;
- include summary fields useful for mobile event cards.

### Query parameters

Support exactly one optional query parameter:

- `scope`

Allowed values:

- `upcoming`
- `past`
- `all`

Default:

- `upcoming`

Definitions:

- `upcoming` = events where `startsAt >= now`
- `past` = events where `startsAt < now`
- `all` = all organizer events

Use current server time for these comparisons.

### Sorting rules

Sorting must be deterministic.

For `scope=upcoming`:
- sort by `startsAt ASC`
- tie-break by `id ASC`

For `scope=past`:
- sort by `startsAt DESC`
- tie-break by `id DESC`

For `scope=all`:
- sort by `startsAt ASC`
- tie-break by `id ASC`

### Response shape

Return HTTP `200` with JSON in this shape:

```json
{
  "scope": "upcoming",
  "total": 2,
  "events": [
    {
      "id": "evt_123",
      "title": "Friday Board Games",
      "description": "Bring drinks",
      "location": "Prospekt Mira 10",
      "startsAt": "2026-03-20T16:30:00.000Z",
      "timezone": "Europe/Moscow",
      "capacityLimit": 8,
      "summary": {
        "going": 5,
        "maybe": 1,
        "notGoing": 1,
        "total": 7,
        "confirmedGoing": 4,
        "waitlistedGoing": 1,
        "capacityLimit": 8,
        "remainingSpots": 4,
        "isFull": false
      },
      "hasActiveInviteLink": true,
      "activeReminderCount": 3,
      "createdAt": "2026-03-18T10:00:00.000Z",
      "updatedAt": "2026-03-18T10:00:00.000Z"
    }
  ]
}
```

### Field rules

For each event object:

- `id` — string
- `title` — string
- `description` — string or `null`
- `location` — string or `null` (mapped from DB location field)
- `startsAt` — ISO string
- `timezone` — string
- `capacityLimit` — number or `null`
- `summary` — must use the same counting semantics as EVT-6
- `hasActiveInviteLink` — boolean
- `activeReminderCount` — number of currently active reminders for that event
- `createdAt` — ISO string
- `updatedAt` — ISO string

### Meaning of `hasActiveInviteLink`

`hasActiveInviteLink` must be `true` only when at least one invite link for the event is:

- active;
- not expired.

If there is no usable active invite link, it must be `false`.

### Meaning of `activeReminderCount`

Count reminders currently stored for the event.
Do not filter by whether their `sendAt` is in the future.
This field is simply the number of reminder records currently configured for the event.

### Errors

- `401` when organizer auth header is missing or invalid
- no other special error handling is needed for the successful list endpoint

---

## DTO / query validation requirements

Add a query DTO or equivalent validated parsing for `scope`.

Requirements:

- only allow `upcoming`, `past`, `all`;
- default to `upcoming` when omitted;
- reject unsupported values with `400`.

Do not silently coerce invalid scope values.

Examples:

- `GET /api/v1/events` → valid, uses `upcoming`
- `GET /api/v1/events?scope=past` → valid
- `GET /api/v1/events?scope=abc` → `400`

---

## Data access / implementation requirements

Use the existing Prisma-based backend.

### Required behavior

1. Fetch only events for the current organizer.
2. Apply the requested time-based scope.
3. Apply deterministic sorting.
4. Return one summary object per event.
5. Return `hasActiveInviteLink` per event.
6. Return `activeReminderCount` per event.

### Performance guidance for this task

Keep the implementation simple, but avoid obviously wasteful repeated queries if a clean Prisma include/select can achieve the same result.

It is acceptable to:

- fetch organizer events with relation data needed to build the list;
- compute summary fields in memory using the existing helper logic.

Do not add raw SQL or advanced optimization in this task unless absolutely necessary.

### Reuse requirement

Do not create a second competing RSVP-summary implementation.
Reuse the existing attendance summary helper introduced for EVT-6.

If the helper is slightly too narrow for event-list use, extend it carefully rather than duplicating logic elsewhere.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

### Tests to add first

Before implementing production behavior, add these tests:

1. **Query DTO/unit test**
   - verifies default scope behavior or parsing behavior;
   - verifies invalid scope is rejected.

2. **Integration test suite for organizer events list**
   - verifies `GET /api/v1/events` returns only organizer-owned upcoming events by default;
   - verifies `scope=past` returns only past events;
   - verifies `scope=all` returns all organizer-owned events;
   - verifies sorting rules;
   - verifies summary fields are correct;
   - verifies `hasActiveInviteLink` is correct for active vs inactive/expired links;
   - verifies `activeReminderCount` is returned correctly;
   - verifies missing auth returns `401`;
   - verifies unknown `scope` returns `400`.

You may add one small pure helper/unit test if directly useful, but do not expand beyond this task.

### Required red-state commands

Run the smallest relevant commands that prove the new tests fail before production implementation is finished.

Examples:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/events-list.query.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-list.integration-spec.ts
```

### Required green-state commands

After implementation, rerun the same targeted commands and ensure they pass.
Then run the broader affected verification commands.

### Forbidden shortcuts

Do not:

- weaken existing RSVP summary semantics;
- remove fields from EVT-6 summary to make list-building easier;
- skip the integration suite;
- silently accept invalid `scope`;
- return all events regardless of organizer ownership.

---

## Detailed implementation requirements

## 1) Controller changes

Add a list route to the existing events controller:

- `GET /api/v1/events`

Document it with Swagger.

Swagger must include:

- summary/operation text;
- `x-dev-user-id` requirement;
- query parameter documentation for `scope`;
- `200`, `400`, and `401` response documentation.

---

## 2) Service changes

Add an organizer event-list service method.

This method must:

- take `currentUser` and validated `scope`;
- compute `now` once per request;
- apply the correct scope filter;
- apply deterministic sort order;
- build per-event card responses;
- build capacity-aware `summary` using the existing helper;
- determine `hasActiveInviteLink` from active + non-expired invite links;
- count configured reminders.

### Important consistency rule

For `hasActiveInviteLink`, expiration must be evaluated relative to current server time.

That means an invite link counts as active only if:

- `isActive = true`
- and (`expiresAt IS NULL` or `expiresAt > now`)

---

## 3) Integration test scenarios (must cover all)

The integration suite must cover at least these concrete scenarios.

### Scenario A — default scope returns only upcoming organizer events

Seed:
- organizer-1 with at least one upcoming event and one past event;
- organizer-2 with at least one upcoming event.

Assert:
- default endpoint returns only organizer-1 upcoming events;
- organizer-2 events are excluded;
- past organizer-1 events are excluded.

### Scenario B — `scope=past`

Assert:
- only organizer-1 past events are returned;
- sort order is `startsAt DESC`, tie-break `id DESC`.

### Scenario C — `scope=all`

Assert:
- both past and upcoming organizer-1 events are returned;
- organizer-2 events are excluded.

### Scenario D — summary fields

Seed attendees that produce:
- confirmed going;
- waitlisted going;
- maybe;
- not going.

Assert that the summary matches existing EVT-6 semantics exactly.

### Scenario E — invite link status

Seed for different events:
- one usable active invite link;
- one inactive invite link;
- one expired invite link.

Assert `hasActiveInviteLink` is only true for the usable active link case.

### Scenario F — reminders count

Seed reminder rows for one event.

Assert `activeReminderCount` equals the number of stored reminder records.

### Scenario G — auth and validation

Assert:
- missing `x-dev-user-id` => `401`
- unknown `x-dev-user-id` => `401`
- invalid `scope` => `400`

---

## 4) No schema change unless truly required

This task should preferably use the existing schema from EVT-7.

Do not add a new migration unless you discover a real missing field/index that is required for this task and cannot be avoided.

If no schema change is necessary, do not create one.

---

## 5) Documentation updates

Update `docs/local-development.md`.

Add a short EVT-8 section that documents:

- how to seed a dev organizer;
- how to create a few events;
- how to create invite links and reminders;
- how to call:
  - `GET /api/v1/events`
  - `GET /api/v1/events?scope=past`
  - `GET /api/v1/events?scope=all`

Use PowerShell-friendly examples.

---

## 6) Acceptance criteria

This task is complete only if all of the following are true:

1. `GET /api/v1/events` exists and is organizer-authenticated.
2. It supports validated `scope` query values:
   - `upcoming`
   - `past`
   - `all`
3. Invalid `scope` returns `400`.
4. Missing/unknown organizer auth returns `401`.
5. The endpoint returns only organizer-owned events.
6. The default scope is `upcoming`.
7. Sorting matches the required deterministic rules.
8. Each event item includes:
   - core event fields;
   - capacity-aware `summary`;
   - `hasActiveInviteLink`;
   - `activeReminderCount`.
9. RSVP summary semantics remain consistent with EVT-6.
10. Tests were written first, observed failing, then made green.
11. No unrelated refactors or future mobile work were added.

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

pnpm --filter @event-app/api test -- --runTestsByPath test/events-list.query.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-list.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Then verify manually, for example:

```powershell
Invoke-WebRequest -Headers @{ "x-dev-user-id" = "organizer-1" } `
  -Uri "http://localhost:3000/api/v1/events"

Invoke-WebRequest -Headers @{ "x-dev-user-id" = "organizer-1" } `
  -Uri "http://localhost:3000/api/v1/events?scope=past"

Invoke-WebRequest -Headers @{ "x-dev-user-id" = "organizer-1" } `
  -Uri "http://localhost:3000/api/v1/events?scope=all"
```

Stop infra when done:

```powershell
docker compose down
```

---

## Implementation notes and guardrails

- Reuse the existing events module.
- Reuse the existing auth guard.
- Reuse the existing attendance summary logic.
- Keep the response compact for future mobile event cards.
- Do not start building mobile UI yet.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-8` must explicitly include:

1. the exact response shape returned by `GET /api/v1/events`;
2. the exact `scope` rules implemented;
3. the exact tests added for query validation and integration behavior;
4. the exact failing red-state commands;
5. the exact passing green-state commands;
6. whether a DB migration was needed or not, and why.

---

## Definition of done

`EVT-8` is done when the backend exposes a stable organizer events list endpoint that can directly power a future mobile home screen without hardcoded event IDs.

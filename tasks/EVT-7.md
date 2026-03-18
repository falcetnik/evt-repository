# EVT-7 — Organizer reminder schedule API and reminder-plan persistence

## Status
Ready

## Priority
P0

## Depends on
- EVT-1
- EVT-2
- EVT-3
- EVT-4
- EVT-5
- EVT-6

## Goal

Implement the **backend reminder-schedule foundation** for events.

After this task, an organizer must be able to:

- configure reminder offsets for their own event;
- replace the full reminder schedule in one request;
- clear the reminder schedule;
- read back the computed reminder plan for an event.

This task is about **reminder planning and persistence only**.

It must **not** send email reminders yet.
It must **not** enqueue BullMQ jobs yet.
It must **not** add push notifications yet.

The output of this task is a correct, validated, deterministic API + DB representation of reminder schedules so the next task can focus only on reminder execution/delivery.

---

## Why this task exists now

We already have:

- organizer event creation/read;
- invite links;
- RSVP submission;
- capacity-aware placement;
- waitlist behavior.

The next missing MVP backend piece is the ability to define **when reminders should be sent**.

We should separate this into two layers:

1. **schedule definition** — what reminders exist for the event;
2. **reminder execution** — actually sending due reminders.

This task implements only layer 1.

That separation is intentional because it keeps the current task small, testable, and reviewable.

---

## Fixed implementation decisions for this task

These decisions are mandatory for EVT-7:

1. Reminder schedules are configured **per event**.
2. A reminder is represented by an **offset in minutes before `startsAt`**.
3. The organizer updates the reminder schedule using **replace semantics**:
   - the submitted array becomes the full active reminder schedule for that event;
   - omitted reminders are removed;
   - new reminders are created.
4. Reminder rows stored by this task represent the **active plan only**.
   - no historical audit table;
   - no sent/failed delivery state yet;
   - no queue/job table yet.
5. Reminder planning must be **owner-only**.
6. Use existing dev organizer auth conventions already established in the repository.
7. This task must not introduce reminder delivery workers or background processing.
8. This task must not modify mobile code except for harmless env/docs changes if absolutely necessary.
9. This task must remain backend-focused.

---

## Out of scope

The following are explicitly out of scope for EVT-7:

- actual reminder sending;
- BullMQ job creation or processing;
- email templates;
- Mailpit integration tests;
- push notifications;
- SMS;
- user notification preferences;
- recurring events;
- event editing beyond reminder schedule endpoints;
- public guest-facing reminder APIs;
- attendee-specific reminder opt-outs;
- plus-one reminder logic;
- auth provider work;
- mobile screens.

If any of the above is implemented, that is over-scope and should be removed.

---

## Required API surface

Implement these organizer-only endpoints:

### 1) Replace reminder schedule

`PUT /api/v1/events/:eventId/reminders`

Auth:
- required;
- same dev organizer auth rules as current organizer endpoints.

Behavior:
- verifies the authenticated organizer owns the event;
- replaces the entire active reminder schedule for that event;
- returns the resulting normalized reminder plan.

### 2) Read reminder schedule

`GET /api/v1/events/:eventId/reminders`

Auth:
- required;
- same dev organizer auth rules as current organizer endpoints.

Behavior:
- verifies organizer ownership;
- returns the current active reminder plan for that event.

No public reminder endpoints in this task.

---

## Data model requirements

Add a new Prisma model and migration for event reminder plans.

### Required table/model

Create `event_reminders` with fields equivalent to:

- `id` — string/cuid primary key
- `event_id` — FK to `events.id`
- `offset_minutes` — integer
- `send_at` — timestamp
- `created_at`
- `updated_at`

Use snake_case database mapping conventions consistent with the existing schema.

### Required constraints/indexes

At minimum:

- FK from reminder to event;
- unique constraint on active reminder offset per event:
  - `(event_id, offset_minutes)`;
- index suitable for future due-reminder lookup:
  - e.g. on `send_at` or `(event_id, send_at)`.

### Relation rules

- deleting an event must delete its reminders;
- reminder rows belong to exactly one event.

### Important simplicity rule

For EVT-7, reminder rows represent only the **current active schedule**.

That means:
- replacing a schedule may delete obsolete rows;
- clearing a schedule may delete all reminder rows for the event.

Do **not** add soft-delete/history/state columns in this task.

---

## Reminder schedule rules

The organizer sends a list of offsets in minutes before the event start.

### Request body contract

The replace endpoint must accept exactly this top-level shape:

```json
{
  "offsetsMinutes": [1440, 120, 30]
}
```

### Validation rules

`offsetsMinutes`:

- required;
- must be an array;
- may be empty (`[]`) to clear the schedule;
- every item must be an integer;
- no duplicates;
- allowed minimum: `5` minutes;
- allowed maximum: `10080` minutes (7 days);
- maximum array length: `5` reminders.

### Time validity rules

For every offset:

- `sendAt = startsAt - offsetMinutes`;
- `sendAt` must be **strictly before** event `startsAt`;
- `sendAt` must be **strictly after** the current server time at save-time.

If any submitted offset resolves to a time in the past or at/after event start, the request must fail with `400`.

### Normalization rules

The stored/output reminder plan must be normalized as follows:

- unique offsets only;
- reminders ordered by `sendAt ASC` in responses;
- if two offsets somehow produce ambiguity, ordering still must be deterministic by `sendAt ASC`, then `id ASC`.

### Replace semantics

`PUT /events/:eventId/reminders` is a full replace operation:

- existing active reminders for the event are removed;
- submitted offsets become the new schedule;
- empty array clears all reminders.

This operation must be transactional.

---

## Response contract requirements

### `GET /api/v1/events/:eventId/reminders`

Response status:
- `200` on success.

Response JSON shape:

```json
{
  "eventId": "evt_123",
  "startsAt": "2026-03-25T18:00:00.000Z",
  "timezone": "Europe/Moscow",
  "reminders": [
    {
      "reminderId": "rem_123",
      "offsetMinutes": 1440,
      "sendAt": "2026-03-24T18:00:00.000Z"
    },
    {
      "reminderId": "rem_124",
      "offsetMinutes": 120,
      "sendAt": "2026-03-25T16:00:00.000Z"
    }
  ],
  "total": 2
}
```

### `PUT /api/v1/events/:eventId/reminders`

Response status:
- `200` on success.

Response body must use the **same shape** as the GET endpoint.

### Error behavior

Use the same conventions already established in the backend:

- `401` when organizer header is missing/invalid/unknown;
- `404` when event does not exist or is not owned by the organizer;
- `400` for validation failures or invalid reminder timing.

Do not leak another organizer’s event existence.

---

## Required test-first workflow for EVT-7

This task must follow red -> green.

### Tests to add first

Before production implementation, add these tests:

1. **Reminder schedule validation/helper unit test**
   - recommended file name:
     - `apps/api/test/event-reminders.schedule.spec.ts`
   - verify:
     - duplicate offsets are rejected;
     - offsets outside allowed bounds are rejected;
     - valid offsets produce correctly computed `sendAt` values;
     - output ordering is deterministic.

2. **Reminder schedule integration test**
   - recommended file name:
     - `apps/api/test/event-reminders.integration-spec.ts`
   - verify at minimum:
     - organizer can replace reminder schedule for own event;
     - organizer can read reminder schedule for own event;
     - empty array clears reminders;
     - non-owner gets `404`;
     - missing/unknown organizer gets `401`;
     - duplicate offsets rejected with `400`;
     - past reminder offsets rejected with `400`;
     - persisted reminders are returned ordered by `sendAt ASC`.

You may update existing tests only if the API contracts they already cover are intentionally affected by this task. Do not perform broad unrelated rewrites.

### Required red-state proof

Before implementing final production behavior, run the smallest relevant targeted commands and observe failure.

Acceptable examples:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/event-reminders.schedule.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/event-reminders.integration-spec.ts
```

The initial red state must correspond to genuinely missing behavior, such as:

- reminder module/helper does not exist yet;
- new endpoints not implemented yet;
- schema missing reminder table;
- validation/timing rules not implemented yet.

### Forbidden shortcuts

Do not:

- weaken assertions to avoid implementing the rules;
- skip the new integration suite;
- remove existing integration coverage;
- fake reminder behavior in controller-only code without persistence;
- silently ignore invalid offsets.

---

## Detailed implementation requirements

## 1) Prisma schema + migration

Add the `EventReminder` model and create a new migration.

Requirements:

- follow existing naming/mapping conventions;
- keep IDs as cuid strings if that is the established project pattern;
- add relation from `Event` to reminders;
- add the DB unique constraint on `(event_id, offset_minutes)`;
- ensure migration is additive and reviewable;
- do not edit old migrations.

Also ensure Prisma Client is updated so the new model is available to API code and tests.

---

## 2) Reminder planning helper/service

Implement a small pure helper or service-level utility that:

- accepts `startsAt`, offsets, and a `now` timestamp;
- validates offset bounds and duplicate values;
- computes `sendAt` for each offset;
- rejects offsets whose `sendAt` is not in the future;
- returns normalized reminder plan entries sorted by `sendAt ASC`.

Keep this logic deterministic and directly unit-testable.

This helper must not depend on Nest request context.

---

## 3) Organizer-only reminder schedule endpoints

Add a new module/controller/service or extend the events module cleanly.

### Organizer ownership rule

For both endpoints, the caller must be the organizer of the event.

If not:
- return `404 Event not found` (or the repository’s established equivalent) rather than leaking ownership details.

### Replace endpoint behavior

`PUT /api/v1/events/:eventId/reminders`

Required steps:

1. authenticate organizer via existing dev organizer auth mechanism;
2. verify organizer owns event;
3. validate/normalize requested offsets;
4. transactionally delete existing reminder rows for the event;
5. insert the normalized reminder rows;
6. return the final normalized schedule shape.

This replace operation must be atomic.

### Read endpoint behavior

`GET /api/v1/events/:eventId/reminders`

Required steps:

1. authenticate organizer;
2. verify organizer owns event;
3. read current reminder rows;
4. return normalized shape ordered by `sendAt ASC`.

---

## 4) Swagger / OpenAPI

Document both endpoints in Swagger.

Requirements:

- include the organizer header requirement consistent with other organizer endpoints;
- include request body schema for `offsetsMinutes`;
- include success response shape;
- include relevant `400` / `401` / `404` response documentation.

Do not auto-generate extra public APIs not required by this task.

---

## 5) Environment/config constraints

This task should not require any new runtime secrets.

Do not add SMTP, mail, or queue env variables in EVT-7 unless they are already present for unrelated reasons.

No new env variables are required for reminder planning only.

If you add nothing to env examples, that is acceptable for this task.

---

## 6) Documentation updates

Update `docs/local-development.md`.

Add a concise section for EVT-7 manual verification that includes:

1. creating/seeding a dev organizer if needed;
2. creating an event with a future `startsAt`;
3. replacing reminder schedule with multiple offsets;
4. reading the schedule back;
5. clearing the schedule with an empty array;
6. rerunning integration tests.

Keep examples PowerShell-friendly.

---

## 7) Quality constraints

- no background jobs;
- no delivery side effects;
- no email sending;
- no new external services;
- keep code small and explicit;
- prefer transactional persistence over clever abstractions;
- do not refactor unrelated modules.

If existing integration infrastructure needs a tiny follow-up adjustment to stay green, keep it minimal and explain it.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. A new Prisma model/table exists for active event reminder plans.
2. A new migration exists and is committed.
3. Organizers can replace reminder schedules through:
   - `PUT /api/v1/events/:eventId/reminders`
4. Organizers can read reminder schedules through:
   - `GET /api/v1/events/:eventId/reminders`
5. Reminder offsets are validated for:
   - integer values;
   - min/max bounds;
   - duplicates;
   - future `sendAt` before event start.
6. Replace operation is transactional.
7. Empty array clears the reminder schedule.
8. Responses are ordered by `sendAt ASC`.
9. Swagger documents the new endpoints.
10. Unit test for reminder planning exists and passes.
11. Integration test for reminder planning exists and passes locally.
12. Existing unit/e2e/integration tests remain green locally.
13. No email sending, no BullMQ queueing, and no out-of-scope delivery logic were added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly verification flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:migrate:test
pnpm --filter @event-app/api db:seed:dev-user

pnpm --filter @event-app/api test -- --runTestsByPath test/event-reminders.schedule.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/event-reminders.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api test:e2e
pnpm --filter @event-app/api start:dev
```

Then manually verify with a future event.

Example create event:

```powershell
$headers = @{ "x-dev-user-id" = "organizer-1"; "Content-Type" = "application/json" }

$eventBody = @{
  title = "Friday Board Games"
  description = "Bring snacks"
  location = "Prospekt Mira 10"
  startsAt = "2026-03-25T18:00:00.000Z"
  timezone = "Europe/Moscow"
  capacityLimit = 8
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/events" -Headers $headers -Body $eventBody
```

Then replace reminder schedule:

```powershell
$reminderBody = @{
  offsetsMinutes = @(1440, 120, 30)
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/v1/events/<EVENT_ID>/reminders" -Headers $headers -Body $reminderBody
```

Then read it back:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/v1/events/<EVENT_ID>/reminders" -Headers $headers
```

Then clear it:

```powershell
$clearBody = @{
  offsetsMinutes = @()
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/v1/events/<EVENT_ID>/reminders" -Headers $headers -Body $clearBody
```

Expected after clear:
- `total = 0`
- `reminders = []`

Stop local services when done:

```powershell
docker compose down
```

---

## Final report requirements for EVT-7

In addition to the global run prompt requirements, the final report for EVT-7 must explicitly include:

1. the exact request/response contract for `PUT /events/:eventId/reminders`;
2. the exact request/response contract for `GET /events/:eventId/reminders`;
3. the reminder bounds you enforced (`min`, `max`, `max array length`);
4. the exact red-state commands and why they failed initially;
5. the exact green-state commands;
6. the new migration path;
7. confirmation that no delivery/queueing was added in this task.

---

## Definition of done

EVT-7 is done when an organizer can create a future event, configure a deterministic reminder schedule through the API, read it back, clear it, and all related unit/integration checks pass locally without introducing actual reminder delivery logic.

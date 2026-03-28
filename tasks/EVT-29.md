# EVT-29 — Backend support for plus-ones in events and RSVP

## Status
Ready

## Priority
P1

## Depends on
- EVT-3
- EVT-5
- EVT-6
- EVT-7
- EVT-8
- EVT-17
- EVT-22
- EVT-23
- EVT-25
- EVT-27

## Goal

Add backend support for **plus-ones** so an organizer can explicitly allow guests to come with extra people, and the system can correctly:

- store that event setting;
- accept plus-one counts in public RSVP;
- show plus-one counts back to organizer and public invite consumers;
- use total headcount when deciding confirmed seats vs waitlist.

This task is **backend-only**.
Do not change `apps/mobile` in this task.

A later task will add the mobile UI on top of this backend behavior.

---

## Why this task exists now

Right now the app already supports:

- event creation and editing;
- public RSVP;
- capacity limits;
- waitlist;
- reminders;
- organizer attendee list.

But one important product behavior from the original idea is still missing:

- “can guests bring friends / a plus-one?”

The database shape already has room for this concept. We now need to make it a real backend feature instead of dead fields.

---

## Product rules for this task

These rules are mandatory.

### Rule 1 — Event setting
Each event has a boolean organizer-controlled setting:

- `allowPlusOnes`

Meaning:

- `false` => guests may not RSVP with extra people;
- `true` => guests may include extra people in their RSVP.

### Rule 2 — RSVP plus-one count
Public RSVP may include:

- `plusOnesCount`

Rules:

- integer only;
- minimum `0`;
- maximum `5`;
- optional in the request body;
- if omitted, treat it as `0`;
- if event does not allow plus-ones, any value greater than `0` must return `400`.

### Rule 3 — Capacity uses **headcount**, not just attendee rows
For capacity and waitlist placement, each `GOING` attendee consumes:

- `1 + plusOnesCount`

Examples:

- guest alone => consumes `1`;
- guest with one extra => consumes `2`;
- guest with two extras => consumes `3`.

`MAYBE` and `NOT_GOING` do not consume seats.

### Rule 4 — Waitlist placement remains deterministic
When capacity is limited, the system must still place `GOING` attendees in a deterministic order.

Use the existing deterministic attendee ordering already used by the current rebalance logic:

- `createdAt ASC`
- then `id ASC`

Walk attendees in that order and confirm as many as fit into remaining capacity by **headcount**.
If the next attendee no longer fits, that attendee and all later `GOING` attendees become waitlisted in order.

### Rule 5 — Unlimited events confirm all GOING attendees
If `capacityLimit = null`, all `GOING` attendees must be confirmed, regardless of plus-one counts.

### Rule 6 — Organizer cannot disable plus-ones while existing attendees already use them
If an event currently has any attendee with:

- `plusOnesCount > 0`

then PATCH that tries to set:

- `allowPlusOnes = false`

must return `400`.

This avoids silently rewriting guest data.

---

## Out of scope

Do not do any of the following in this task:

- mobile UI changes;
- auth changes;
- payments;
- comments/chat;
- recurring events;
- public event discovery/feed;
- image uploads;
- changing audit action names from earlier tasks unless strictly required by this task;
- changing invite token format;
- changing reminder behavior unrelated to plus-one capacity usage.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red -> green.

## Tests to add or update first

### Unit tests
Add or update unit tests for DTO/validation and summary/headcount logic.

At minimum:

1. `apps/api/test/create-event.dto.spec.ts`
   - create DTO accepts `allowPlusOnes`;
   - defaults/normalization are correct.

2. `apps/api/test/update-event.dto.spec.ts`
   - update DTO accepts optional `allowPlusOnes`;
   - validation is correct.

3. `apps/api/test/submit-rsvp.dto.spec.ts`
   - public RSVP DTO accepts optional `plusOnesCount`;
   - rejects invalid types/ranges.

4. `apps/api/test/attendance-summary.spec.ts`
   - updated to verify headcount-aware behavior where applicable.

### Integration tests
Add or update DB-backed integration coverage.

At minimum:

1. `apps/api/test/events.integration-spec.ts`
   - create/read event includes `allowPlusOnes`.

2. `apps/api/test/events-update.integration-spec.ts`
   - update event includes `allowPlusOnes`;
   - disabling plus-ones with existing plus-one attendees returns `400`.

3. `apps/api/test/invite-links.integration-spec.ts`
   - public invite payload includes `allowPlusOnes`;
   - RSVP accepts `plusOnesCount` when enabled;
   - RSVP rejects `plusOnesCount > 0` when disabled.

4. `apps/api/test/waitlist.integration-spec.ts`
   - capacity and waitlist now use headcount, not only attendee row count.

You may add one extra test file if needed, but keep scope tight.

## Required red-state proof
Before production implementation is complete, run the smallest relevant commands and confirm they fail for the expected reason.

## Required green-state proof
After implementation, rerun the affected tests and confirm they pass.

---

## Detailed implementation requirements

## 1) Event DTOs and event responses

### Create event DTO
Extend create-event behavior to support:

- `allowPlusOnes?: boolean`

Rules:

- optional;
- default to `false` if omitted.

### Update event DTO
Extend PATCH event behavior to support:

- `allowPlusOnes?: boolean`

Rules:

- optional;
- only update if provided.

### Organizer event response
Ensure organizer event responses include:

- `allowPlusOnes`

This applies to at least:

- create event response;
- get event by id response;
- list events response;
- update event response.

### Public invite payload
Ensure public invite event payload includes:

- `allowPlusOnes`

This allows clients to know whether the public RSVP form should expose plus-one UI later.

---

## 2) Public RSVP DTO and service behavior

Extend public RSVP request shape to support:

- `plusOnesCount?: number`

Rules:

- if omitted => treat as `0`;
- integer only;
- `0..5` inclusive;
- if event does not allow plus-ones and `plusOnesCount > 0` => `400`.

### RSVP persistence
Store plus-one count on attendee rows using the existing attendee field.

### RSVP response
Public RSVP success response must include:

- `plusOnesCount`

alongside the existing RSVP response fields.

---

## 3) Organizer attendee list response

Organizer attendee rows must include:

- `plusOnesCount`

This is required so organizer clients can render “Guest +1”, “Guest +2”, etc.

Do not remove existing fields.

---

## 4) Summary behavior

The current summary shape already exists. Extend it with headcount fields rather than replacing existing ones.

### Existing fields must remain
Keep current fields such as:

- `going`
- `maybe`
- `notGoing`
- `total`
- `confirmedGoing`
- `waitlistedGoing`
- `capacityLimit`
- `remainingSpots`
- `isFull`

### New fields to add
Add these new fields to RSVP summary responses where summary already exists:

- `confirmedHeadcount`
- `waitlistedHeadcount`
- `goingHeadcount`

Definitions:

- `confirmedHeadcount` = total heads for confirmed `GOING` attendees
- `waitlistedHeadcount` = total heads for waitlisted `GOING` attendees
- `goingHeadcount` = total heads for all `GOING` attendees regardless of placement

### Remaining spots semantics
`remainingSpots` must now be based on **headcount capacity usage**, not just attendee row count.

Examples:
- capacity `5`, confirmed heads `3` => remainingSpots `2`
- capacity `5`, confirmed heads `5` => remainingSpots `0`
- capacity `null` => remainingSpots `0` and `isFull = false`

Keep the API deterministic and documented by tests.

---

## 5) Waitlist and rebalance logic

Wherever current code decides attendee placement for `GOING` attendees, update it to use headcount.

This applies to:
- public RSVP create/update;
- event capacity change rebalances;
- unlimited capacity clears.

### Deterministic placement algorithm
For limited capacity:

1. collect all `GOING` attendees;
2. sort by `createdAt ASC`, then `id ASC`;
3. track used capacity in heads;
4. each attendee consumes `1 + plusOnesCount`;
5. confirm attendee only if they fully fit;
6. otherwise assign waitlist positions `1..N`.

Do not partially confirm a group.
An attendee plus their extra people move together.

### Unlimited capacity
If `capacityLimit = null`, every `GOING` attendee must be confirmed with:

- `waitlistPosition = null`

### Capacity decrease safety
When PATCH reduces capacity, reject if current **confirmed headcount** would exceed the new limit.

Do not use only attendee row count for this safety rule.

---

## 6) Update-event rule for disabling plus-ones

When PATCH contains:

- `allowPlusOnes: false`

the service must first check whether any attendee on the event currently has:

- `plusOnesCount > 0`

If yes:
- return `400`.

Error message should be clear, for example:
- `allowPlusOnes cannot be disabled while attendees have plus ones`

Do not silently zero out guest data.

---

## 7) Audit behavior

Do not invent a brand-new audit subsystem.
Reuse the audit foundation already in the project.

If audit is already written for RSVP create/update and attendance rebalances, extend the metadata only if needed for this feature.

### Safe metadata rule
Do not write raw invite token, raw invite URL, guest name, or guest email into audit metadata.

If you add plus-one-related metadata, keep it small and safe.

Examples of acceptable keys:
- `plusOnesCount`
- `confirmedHeadcountAfter`
- `waitlistedHeadcountAfter`

Only add audit metadata if truly needed by the changed domain action.

---

## 8) DB / Prisma expectations

Use the existing schema fields if they already exist.

Only create a new migration if this task truly requires a schema change.
Do not add a migration just to rename or reshuffle code.

If Prisma client types change, regenerate client as required.

---

## API contracts required after this task

## Create / read / update event
Organizer event payloads must include:

```json
{
  "id": "evt_123",
  "title": "Board Games",
  "description": "Bring snacks",
  "location": "Mira 10",
  "startsAt": "2026-04-10T19:00:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8,
  "allowPlusOnes": true,
  "organizerUserId": "user_1",
  "createdAt": "2026-04-01T10:00:00.000Z",
  "updatedAt": "2026-04-01T10:00:00.000Z"
}
```

## Public invite resolve
Public invite payload’s `event` section must include:

```json
{
  "title": "Board Games",
  "description": "Bring snacks",
  "location": "Mira 10",
  "startsAt": "2026-04-10T19:00:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8,
  "allowPlusOnes": true
}
```

## Public RSVP request
Request body must support:

```json
{
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "plusOnesCount": 1
}
```

## Public RSVP response
Response must include:

```json
{
  "attendeeId": "att_123",
  "eventId": "evt_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "plusOnesCount": 1,
  "attendanceState": "confirmed",
  "waitlistPosition": null,
  "createdAt": "2026-04-01T10:00:00.000Z",
  "updatedAt": "2026-04-01T10:00:00.000Z"
}
```

## Organizer attendee list response
Each attendee item must include plus-one count:

```json
{
  "attendeeId": "att_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "plusOnesCount": 1,
  "attendanceState": "confirmed",
  "waitlistPosition": null,
  "createdAt": "2026-04-01T10:00:00.000Z",
  "updatedAt": "2026-04-01T10:00:00.000Z"
}
```

## Summary example
Example summary shape after this task:

```json
{
  "going": 3,
  "maybe": 1,
  "notGoing": 0,
  "total": 4,
  "confirmedGoing": 2,
  "waitlistedGoing": 1,
  "goingHeadcount": 5,
  "confirmedHeadcount": 3,
  "waitlistedHeadcount": 2,
  "capacityLimit": 4,
  "remainingSpots": 1,
  "isFull": false
}
```

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. Event create/read/update/list responses include `allowPlusOnes`.
2. Public invite payload includes `allowPlusOnes`.
3. Public RSVP accepts optional `plusOnesCount`.
4. RSVP rejects `plusOnesCount > 0` when `allowPlusOnes = false`.
5. Organizer attendee list includes `plusOnesCount`.
6. Capacity/waitlist logic uses total headcount of `1 + plusOnesCount` for `GOING` attendees.
7. Rebalance on capacity updates respects headcount.
8. Disabling `allowPlusOnes` with existing plus-one attendees returns `400`.
9. Summary responses include the new headcount fields.
10. Existing tests still pass after updates.
11. New/updated tests were written first, failed, then made green.

---

## Required verification commands

### PowerShell-friendly
```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test

pnpm --filter @event-app/api test -- --runTestsByPath test/create-event.dto.spec.ts test/update-event.dto.spec.ts test/submit-rsvp.dto.spec.ts test/attendance-summary.spec.ts

pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events.integration-spec.ts test/events-update.integration-spec.ts test/invite-links.integration-spec.ts test/waitlist.integration-spec.ts

pnpm --filter @event-app/api typecheck

docker compose down
```

### Bash-friendly
```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test

pnpm --filter @event-app/api test -- --runTestsByPath test/create-event.dto.spec.ts test/update-event.dto.spec.ts test/submit-rsvp.dto.spec.ts test/attendance-summary.spec.ts

pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events.integration-spec.ts test/events-update.integration-spec.ts test/invite-links.integration-spec.ts test/waitlist.integration-spec.ts

pnpm --filter @event-app/api typecheck

docker compose down
```

---

## Implementation notes and guardrails

- Keep the diff focused on plus-one support.
- Do not rewrite unrelated audit or observability code.
- Do not change immutable files.
- If current helper names are too narrow, rename carefully and update tests.
- Prefer small deterministic pure helpers for headcount and placement logic.
- Keep responses backward-compatible where possible by adding fields instead of removing them.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report must explicitly include:

1. whether a new migration was needed or not;
2. exact request/response examples for plus-one RSVP;
3. exact summary fields added;
4. exact rule used for waitlist placement by headcount;
5. exact commands run locally to prove green state.

---

## Definition of done

`EVT-29` is done when the backend truly understands plus-ones as part of event RSVP and capacity math, organizers can see plus-one counts, public invite consumers know whether plus-ones are allowed, and all updated tests are green.

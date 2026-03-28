# EVT-25 — Complete audit coverage for public RSVP writes and attendee placement changes

## Status
Ready

## Priority
P1

## Depends on
- EVT-23
- EVT-24

## Goal

Extend the backend audit system so that the remaining important attendee-affecting write operations are also recorded.

After this task:
- public RSVP creation must write an audit row;
- public RSVP update must write an audit row;
- organizer capacity changes that rebalance attendee placement must write an audit row summarizing what changed;
- clearing capacity to unlimited and confirming all waitlisted GOING attendees must also write an audit row summarizing the outcome;
- audit metadata must stay safe (no raw invite token, no invite URL, no guest name, no guest email).

This task is backend-only.

---

## Why this task exists now

We already have:
- request IDs;
- logs;
- metrics;
- audit rows for organizer event create/update/reminders/invite-link actions.

What is still missing is audit coverage for the last important write-side domain mutations:
- guest RSVP submissions;
- attendee placement changes caused by organizer capacity edits.

Without this, the audit trail is incomplete for the flows that most directly affect who is coming to an event.

---

## In scope

1. Audit rows for public RSVP create/update.
2. Audit rows for attendee placement rebalancing triggered by event capacity update.
3. Integration tests for the new audit rows.
4. Safe metadata rules.

---

## Out of scope

- mobile changes;
- audit read API;
- admin UI for audit logs;
- exporting logs;
- payments;
- auth provider implementation;
- push/email reminder delivery.

---

## Required audit action names

Use these exact action names:

- `event.rsvp.created`
- `event.rsvp.updated`
- `event.attendance.rebalanced`

Do not invent alternative names.

---

## Safe metadata rules (mandatory)

Audit metadata for this task must NOT contain:
- raw invite token;
- invite URL;
- guest name;
- guest email.

Allowed metadata examples:
- `attendeeId`
- `eventId`
- `status`
- `attendanceState`
- `waitlistPosition`
- `created` / `updated`
- counts such as `confirmedGoing`, `waitlistedGoing`, `promotedCount`
- `capacityBefore`, `capacityAfter`

Metadata must be useful but privacy-safe.

---

## Behavior requirements

## 1) Public RSVP audit

When `POST /api/v1/invite-links/:token/rsvp` creates a new attendee row:
- write one audit row with action `event.rsvp.created`.

When the same endpoint updates an existing attendee row:
- write one audit row with action `event.rsvp.updated`.

### RSVP audit metadata requirements

Store safe metadata including:
- `attendeeId`
- `status` (`going | maybe | not_going` API shape is acceptable, or internal enum if consistent)
- `attendanceState` (`confirmed | waitlisted | maybe | not_going` as already used in API responses)
- `waitlistPosition` (`number | null`)

### Actor fields for public RSVP audit

For public RSVP audit rows:
- `actorUserId` must be `null`
- `entityType` must be `event`
- `entityId` must be the affected event ID
- `requestId` must be populated from the current request context

---

## 2) Capacity-rebalance audit

When organizer `PATCH /api/v1/events/:eventId` changes capacity in a way that causes attendee placement changes, write one audit row with action:
- `event.attendance.rebalanced`

This applies when:
- capacity increases and waitlisted GOING attendees are promoted;
- capacity is cleared to unlimited and waitlisted GOING attendees become confirmed.

If the PATCH changes event fields but does not actually change attendee placement, do NOT write `event.attendance.rebalanced`.

If the PATCH fails and is rolled back, do NOT write `event.attendance.rebalanced`.

### Rebalance metadata requirements

Store safe summary metadata including:
- `capacityBefore`
- `capacityAfter`
- `confirmedGoingBefore`
- `confirmedGoingAfter`
- `waitlistedGoingBefore`
- `waitlistedGoingAfter`
- `promotedCount`

Do not store guest names/emails.

---

## 3) Transaction rules

Audit rows for RSVP writes and rebalancing must be written in a way that matches the final committed outcome.

Meaning:
- if the main DB mutation fails, no misleading audit row should remain;
- if the mutation succeeds, the audit row must exist.

You may accomplish this by writing audit rows inside the same transaction where appropriate, or by ensuring equivalent transactional correctness.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red -> green.

### Tests to add first

Add/update these tests before implementation:

1. `apps/api/test/audit-log.integration-spec.ts`
   - extend it to cover:
     - `event.rsvp.created`
     - `event.rsvp.updated`
     - `event.attendance.rebalanced` on capacity increase
     - `event.attendance.rebalanced` on capacity clear to unlimited
     - metadata safety assertions (no token/url/name/email)

2. If a small pure helper is introduced for rebalance metadata shaping, add a focused unit test for it.
   - only if such helper actually exists
   - do not invent speculative helpers just to add tests

### Required red-state command

Run the smallest relevant command that executes the new/updated audit integration coverage first, for example:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/audit-log.integration-spec.ts
```

Observe it failing before production changes are complete.

### Required green-state commands

After implementation, rerun:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/audit-log.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck
```

---

## Implementation hints

- Existing audit infrastructure from EVT-23/24 should be reused.
- Prefer keeping audit action creation close to the write-side domain logic so the recorded result matches the actual committed change.
- Be careful not to duplicate audit writes when the same request goes through code paths that already write a different audit action.
- `event.updated` and `event.attendance.rebalanced` may both exist for the same PATCH request if both are legitimately true.

---

## Acceptance criteria

This task is done only if all of the following are true:

1. Public RSVP create writes `event.rsvp.created`.
2. Public RSVP update writes `event.rsvp.updated`.
3. Capacity increase that promotes attendees writes `event.attendance.rebalanced`.
4. Clearing capacity to unlimited and confirming waitlisted GOING attendees writes `event.attendance.rebalanced`.
5. Failed/rolled-back mutations do not leave misleading audit rows.
6. New audit metadata contains no raw invite token, no invite URL, no guest name, and no guest email.
7. Audit integration tests are green locally.
8. Full backend integration suite remains green locally.

---

## Local verification commands (PowerShell-friendly)

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/audit-log.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck

docker compose down
```

---

## Final report requirements for this task

In addition to the global run prompt, the final report must explicitly list:

1. which new audit action rows were added;
2. exact metadata keys written for each new action;
3. explicit confirmation that token/url/name/email are absent from metadata;
4. the exact test command used for the red state;
5. the exact green commands run locally.


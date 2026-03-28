# EVT-27 — Organizer delete event API

## Status
Ready

## Priority
P1

## Depends on
- EVT-17
- EVT-22
- EVT-23
- EVT-25

## Goal

Add a safe organizer-only **delete event** backend API.

After this task:
- the organizer can delete their own event with `DELETE /api/v1/events/:eventId`;
- related event-owned data is removed together with the event;
- public invite links for that event stop working immediately;
- organizer-only event endpoints for that event return `404` after deletion;
- an audit row is written for the deletion.

This task is **backend only**.
Do not add mobile UI in this task.

---

## Why this task exists now

Right now the organizer can:
- create an event;
- update an event;
- manage reminders;
- manage invite links.

But there is still no way to remove an event entirely.
That is an important missing organizer action.

We already have logging, metrics, and audit infrastructure. This task should use that infrastructure instead of inventing a separate path.

---

## In scope

- new organizer-only endpoint:
  - `DELETE /api/v1/events/:eventId`
- service logic for deleting an owned event
- safe deletion of related data
- invalidation of public invite usage after delete
- audit write for event deletion
- integration tests
- small doc update if needed

---

## Out of scope

Do **not** add any of the following in EVT-27:

- mobile delete button / delete screen
- soft-delete / archived events
- recovery / undo delete
- bulk delete
- account delete
- auth provider work
- payments
- background jobs
- extra refactors not needed for this task

---

## API contract

## Route

`DELETE /api/v1/events/:eventId`

## Auth

Use the existing organizer dev auth flow:
- header: `x-dev-user-id`

## Responses

### Success
- status: `204 No Content`
- body: empty

### Errors
- `401` if organizer header is missing or unknown
- `404` if event does not exist or is not owned by the current organizer

---

## Required behavior

### 1) Ownership rules

The endpoint must delete **only** an event owned by the current organizer.

If:
- the event does not exist, or
- the event belongs to another organizer,

return:
- `404 Event not found`

Keep the same ownership semantics already used by existing organizer event endpoints.

### 2) Deletion semantics

Deletion must remove the event and make it unavailable everywhere.

After successful deletion:
- `GET /api/v1/events/:eventId` returns `404`
- `GET /api/v1/events/:eventId/attendees` returns `404`
- `GET /api/v1/events/:eventId/reminders` returns `404`
- `GET /api/v1/events/:eventId/invite-link` returns `404`
- organizer event list no longer includes the event

### 3) Related data cleanup

Deleting an event must also remove all event-owned rows for that event.
At minimum this includes:
- `event_attendees`
- `invite_links`
- `event_reminders`

How this is achieved is up to the implementation:
- if existing foreign keys already cascade, use that;
- if not, delete transactionally or add a new migration to enforce the correct cascade behavior.

Do **not** edit existing migrations.
If schema changes are required, add a **new** migration only.

### 4) Public invite invalidation

If a deleted event had invite links, public invite endpoints must stop working for those tokens.

After delete, a previously valid token for that event must return:
- `404 Invite link not found`

### 5) Audit write

On successful delete, write one audit row with action:
- `event.deleted`

The audit row must be written in the same transactional outcome as the deletion.
That means:
- if delete succeeds, the audit row exists;
- if delete fails, do not write a fake success audit row.

### 6) Audit metadata rules

Audit metadata for `event.deleted` must include only safe summary fields.

Required safe metadata keys:
- `attendeeCount`
- `inviteLinkCount`
- `reminderCount`
- `capacityLimit`
- `startsAt`
- `timezone`

Do **not** include any of the following in audit metadata:
- invite token
- invite URL
- guest email
- guest name

### 7) Repeat delete behavior

If the organizer deletes an event successfully and then calls delete again for the same event, the second call must return:
- `404`

This is the simplest and most predictable behavior for this API.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow strict red -> green.

### Tests to add first

Add a new backend integration suite:
- `apps/api/test/events-delete.integration-spec.ts`

You may update existing audit integration coverage if needed, but the main task coverage must live in the new delete-event integration suite.

### Required red-state scenarios

Before final implementation, the new integration suite must fail for the expected reasons, such as:
- delete endpoint missing
- delete logic not implemented
- related rows not removed
- public token still usable
- audit row not written

### Green-state requirement

After implementation, run the targeted integration suite and then the full backend integration suite.

---

## Required integration coverage

The new integration suite must cover at least all of these cases.

### A. Delete owned event successfully
- create event as organizer-1
- call delete as organizer-1
- expect `204`

### B. Deleted event is gone from organizer read APIs
After delete:
- `GET /api/v1/events/:eventId` => `404`
- `GET /api/v1/events/:eventId/attendees` => `404`
- `GET /api/v1/events/:eventId/reminders` => `404`
- `GET /api/v1/events/:eventId/invite-link` => `404`

### C. Deleted event is gone from organizer event list
- create event
- verify it exists in `GET /api/v1/events?scope=all`
- delete it
- verify it no longer exists in the list

### D. Public invite token becomes invalid after delete
- create event
- create invite link
- verify public resolve works before delete
- delete event
- verify `GET /api/v1/invite-links/:token` => `404`

### E. Missing organizer header returns 401
- delete without `x-dev-user-id`
- expect `401`

### F. Unknown organizer returns 401
- delete with unknown organizer header
- expect `401`

### G. Non-owner returns 404
- organizer-2 tries to delete organizer-1 event
- expect `404`

### H. Missing event returns 404
- delete a nonexistent id
- expect `404`

### I. Second delete returns 404
- delete once => `204`
- delete again => `404`

### J. Audit row is written on successful delete
- verify one `event.deleted` row exists
- verify metadata includes required safe keys
- verify metadata does **not** include token/url/email/name

### K. Related rows are gone
Before delete, create at least:
- attendees
- reminders
- invite links

After delete, verify those rows for the event are removed.

---

## Detailed implementation requirements

## 1) Controller

Add a new route to the existing events controller:
- `DELETE /api/v1/events/:eventId`

Requirements:
- organizer auth must apply
- Swagger docs must include `x-dev-user-id`
- Swagger docs must describe `204`, `401`, `404`
- successful response must not return JSON body

## 2) Service

Add organizer-owned delete logic in `EventsService`.

Implementation requirements:
- verify ownership first
- gather safe summary data needed for audit metadata
- perform deletion transactionally
- ensure related data cleanup happens
- write `event.deleted` audit row inside the successful transaction path

If a dedicated helper for event-owned delete is useful, keep it small and local to this task.

## 3) Schema / migration rules

First inspect whether current schema already supports correct cleanup.

If delete works correctly because event-owned relations already cascade, do **not** add a migration.

If event-owned relations do **not** cascade and cleanup is not reliably enforced, add a new Prisma migration.

Allowed migration purpose for this task:
- add or fix `ON DELETE CASCADE` for event-owned child tables only if actually necessary

Do not add unrelated schema changes.

## 4) Audit

Use the existing audit service and transaction-safe audit path already introduced in prior tasks.

`event.deleted` metadata must use safe summary values only.

Recommended shape:

```json
{
  "attendeeCount": 3,
  "inviteLinkCount": 1,
  "reminderCount": 2,
  "capacityLimit": 8,
  "startsAt": "2026-04-01T18:00:00.000Z",
  "timezone": "UTC"
}
```

Exact ordering of keys is not important.
Field names are important.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `DELETE /api/v1/events/:eventId` exists.
2. It returns `204` for owned events.
3. It returns `401` for missing/unknown organizer.
4. It returns `404` for missing or non-owned events.
5. Deleted events disappear from organizer reads.
6. Deleted events disappear from organizer list.
7. Related attendees/invite links/reminders are removed.
8. Public invite tokens for deleted events return `404`.
9. A successful delete writes `event.deleted` audit row.
10. Audit metadata contains required safe keys and excludes token/url/name/email.
11. The new integration suite is green.
12. Full backend integration suite remains green.

---

## Required commands for local verification

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test

pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-delete.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck

docker compose down
```

---

## Final report requirements for this task

In addition to the standard run prompt, the final report must explicitly include:

1. whether a schema migration was needed or not;
2. if a migration was needed, why;
3. the exact audit metadata keys written for `event.deleted`;
4. confirmation that token/url/name/email were excluded from delete audit metadata;
5. exact targeted integration command used for the new delete suite.

---

## Definition of done

EVT-27 is done when an organizer can delete an event, all event-owned data is gone, public invite tokens stop resolving, and the deletion is captured in audit with safe metadata — all covered by green integration tests.

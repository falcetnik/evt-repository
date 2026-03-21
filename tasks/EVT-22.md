# EVT-22 — Organizer revoke current invite link API

## Status
Ready

## Priority
P1

## Depends on
- EVT-4
- EVT-18

## Goal

Add an organizer-only backend endpoint that revokes the **current usable invite link** for an event.

After this task:
- organizers can explicitly disable the currently active invite link for an event;
- revoked invite links stop resolving on the public endpoint;
- the endpoint is idempotent and safe to call multiple times;
- the existing “current invite link” selection rules stay deterministic and reusable.

This is a **backend-only** task.
Do not modify mobile code in EVT-22.

---

## Why this task exists now

We already have:
- organizer create/reuse invite link;
- organizer get current invite link;
- public invite resolution;
- mobile details screen that loads/shares the current invite link.

What is still missing is organizer control to **revoke** a link that should no longer work.

This matters for real use cases:
- the organizer accidentally shared the wrong event link;
- the organizer wants to stop new RSVPs temporarily;
- the organizer wants to invalidate a leaked link before generating a new one.

Without revoke, the organizer only has “create/reuse”, not “disable”.

---

## Scope

Implement exactly this backend capability:

- `DELETE /api/v1/events/:eventId/invite-link`

Behavior:
- organizer-only via existing dev auth conventions;
- resolves the event by organizer ownership;
- finds the **current usable invite link** using the exact same selection semantics as `GET /api/v1/events/:eventId/invite-link`;
- if a current usable link exists, mark it inactive;
- if no current usable link exists, still succeed idempotently;
- return HTTP `204 No Content`.

Also ensure:
- revoked token no longer resolves on public invite lookup;
- later create/reuse flow does not reuse the revoked row as a usable link.

---

## Out of scope

Do **not** implement any of the following in EVT-22:

- mobile UI for revoke;
- deleting invite-link rows from the database;
- schema migrations;
- event deletion/cancellation;
- bulk revoke of all historical links;
- link expiration editing;
- auth-provider work;
- background jobs;
- notifications;
- analytics.

This task only revokes the one currently selected usable link for the given organizer-owned event.

---

## API contract

## New endpoint

### `DELETE /api/v1/events/:eventId/invite-link`

### Auth
Use the existing organizer-only dev auth mechanism.

### Success response
- status: `204 No Content`
- body: empty

### Error responses
- `401` if organizer header is missing or unknown
- `404` if event does not exist or is not owned by the organizer

### Idempotency rules
- If the event has a current usable invite link, revoke it and return `204`.
- If the event has **no** current usable invite link, still return `204`.

No `409`, no `200`, no body.

---

## Current usable invite-link selection rules

This task must reuse the exact same “current usable invite link” semantics already used by:
- `GET /api/v1/events/:eventId/invite-link`
- any internal helper that selects the current usable link

A link is usable if:
- `isActive = true`
- and (`expiresAt IS NULL` or `expiresAt > now`)

When multiple usable links exist, select deterministically by:
1. `createdAt DESC`
2. `id DESC`

Revocation must target **that selected current usable link only**.

Important consequence:
- if two usable links exist, revoking the newest one should make the older usable one become the new “current usable link” afterward.

---

## Persistence rules

Do not delete rows.

Revocation must update the selected row so it is no longer usable:
- set `isActive` to `false`
- preserve token/history row
- allow public resolution to stop working because the row is no longer usable

Use the existing Prisma model and current schema.
No migration is needed.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red -> green strictly.

### Tests to add first

Add a new DB-backed integration suite:

- `apps/api/test/events-revoke-invite-link.integration-spec.ts`

You may update an existing integration test only if absolutely necessary, but prefer a new focused file.

### Required scenarios

The integration suite must cover **all** of these:

1. organizer revokes current usable link and receives `204`
2. after revoke, `GET /api/v1/events/:eventId/invite-link` returns `inviteLink: null` when there was only one usable link
3. revoked token returns `404` on public invite resolution
4. deleting when there is no usable link still returns `204`
5. deleting when only inactive link exists still returns `204`
6. deleting when only expired link exists still returns `204`
7. when multiple usable links exist, only the selected current usable link is revoked; the next usable link becomes current
8. `401` for missing organizer header
9. `401` for unknown organizer header
10. `404` for non-owner
11. `404` for missing event
12. after revoke, calling existing create/reuse endpoint creates or returns a usable link that is **not** the revoked current one

### Red-state command

Before implementation, run:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-revoke-invite-link.integration-spec.ts
```

The initial failure should be caused by the missing endpoint / missing implementation.

### Green-state commands

After implementation, rerun:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-revoke-invite-link.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck
```

---

## Implementation requirements

## 1) Controller

Add organizer-only endpoint to `EventsController`:

- `DELETE /api/v1/events/:eventId/invite-link`

Requirements:
- use the existing organizer auth/decorator conventions already used by other organizer event endpoints;
- return `204` with no response body;
- add Swagger metadata:
  - header requirement for `x-dev-user-id`
  - `204`, `401`, `404` response docs

---

## 2) Service logic

Add service method in `EventsService`, for example:

- `revokeCurrentInviteLink(currentUser, eventId)`

Requirements:
- verify organizer ownership using the existing event ownership path;
- determine `now` once inside the method;
- select the current usable link using the same deterministic rules as current-link lookup;
- if found, mark it inactive;
- if not found, do nothing;
- always return successfully for owned events.

Do **not** duplicate fragile selection logic in multiple places if the project already has a helper that can be reused or extracted safely.

Minimal, obvious reuse is preferred.

---

## 3) Public resolution consistency

After a link is revoked:
- `GET /api/v1/invite-links/:token` must stop resolving that token and return `404`.

This should happen naturally if public resolution already requires `isActive = true` plus non-expired semantics.

Do not add special-case hacks just for the tests.

---

## 4) Existing create/reuse consistency

After revoke, the existing organizer create/reuse flow must continue to behave correctly.

Required behavior:
- revoked rows are not considered usable;
- create/reuse must not return the revoked current row as if it were still active;
- if another older usable row still exists, create/reuse may reuse that usable row;
- if none exists, create/reuse should create a new usable row.

The important part is correctness with current usable-link semantics.

---

## Files expected to change

At minimum, expect changes in files such as:

- `apps/api/src/events/events.controller.ts`
- `apps/api/src/events/events.service.ts`
- optionally a shared invite-link selection/mapper file if minimal reuse is needed
- `apps/api/test/events-revoke-invite-link.integration-spec.ts`

Do not modify unrelated mobile files.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `DELETE /api/v1/events/:eventId/invite-link` exists and is organizer-only.
2. Owned event + usable current link => `204` and link becomes inactive.
3. Owned event + no usable current link => `204`.
4. Missing/unknown organizer header => `401`.
5. Missing event or non-owner => `404`.
6. Revoked token no longer resolves publicly.
7. Multiple usable links follow deterministic current-link selection; revoking current reveals the next usable one if present.
8. Existing create/reuse flow remains correct after revoke.
9. New integration suite is added first and passes green locally.
10. No schema migration is introduced.
11. No mobile code is changed.

---

## Local verification commands

### PowerShell-friendly

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-revoke-invite-link.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck
```

### Manual API verification sequence

1. Seed or use an organizer user.
2. Create an event.
3. Create/reuse invite link for that event.
4. Confirm `GET /api/v1/events/:eventId/invite-link` returns a non-null inviteLink.
5. Call:

```http
DELETE /api/v1/events/:eventId/invite-link
x-dev-user-id: organizer-1
```

6. Confirm status is `204`.
7. Confirm `GET /api/v1/events/:eventId/invite-link` now returns:

```json
{ "eventId": "...", "inviteLink": null }
```

8. Confirm `GET /api/v1/invite-links/:token` now returns `404` for the revoked token.

---

## Final report requirements for EVT-22

In addition to the global run prompt requirements, the final report must explicitly include:

1. the exact revoke endpoint signature;
2. whether the implementation deactivates or deletes rows (it must deactivate);
3. the exact red-state integration command;
4. the exact green-state integration command(s);
5. a short note confirming behavior when multiple usable links exist.

---

## Definition of done

EVT-22 is done when an organizer can revoke the current usable invite link for an event, public resolution of that token stops working immediately, repeated revoke calls remain safely idempotent, and the new integration suite is green locally.

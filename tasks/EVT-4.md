# EVT-4 — Organizer invite-link creation and public invite resolution API

## Status
Ready

## Priority
P0

## Depends on
- EVT-1
- EVT-2
- EVT-3

## Goal

Implement the first shareable public surface for the product:

- an organizer-only endpoint to create or fetch the active invite link for an event;
- a public endpoint that resolves an invite token into a safe public event payload;
- strict test-first coverage proving the invite-link lifecycle works;
- deterministic local verification steps for Windows 11.

This task is the bridge between organizer-only event management and the later guest RSVP flow.

---

## Why this task exists now

We already have:

- the repository/workspace foundation;
- PostgreSQL + Prisma core schema;
- a temporary development/test auth shim;
- organizer event creation and organizer event read.

We do **not** yet have a shareable link that another person can open.

Before implementing RSVP, waitlist behavior, or mobile event screens, we need:

1. a server-generated invite token;
2. a stable API for organizers to fetch/share that token;
3. a public read endpoint that works without organizer auth;
4. a narrow public payload that does not leak organizer-private information.

After this task is done, an organizer should be able to:

1. create an event;
2. request its invite link;
3. copy the returned URL;
4. open that URL without auth;
5. see the public event details resolved by token.

---

## Fixed implementation decisions for this task

These decisions are mandatory for this task:

1. The organizer invite-link endpoint must be:
   - `POST /api/v1/events/:eventId/invite-link`
2. The public invite-resolution endpoint must be:
   - `GET /api/v1/invite-links/:token`
3. The organizer endpoint must be protected by the existing development/test auth shim from `EVT-3`.
4. The public invite-resolution endpoint must require **no auth**.
5. Invite tokens must be generated **server-side only**.
6. Invite tokens must be **unguessable** and created from a cryptographically secure random source.
7. This task must use the existing `InviteLink` Prisma model from `EVT-2`.
8. The organizer endpoint must be **idempotent for the active link**:
   - if a currently usable active invite link already exists for the event, return it;
   - do **not** create a second active link for the same event in the normal happy path.
9. Invite links created in this task must be non-expiring by default:
   - `expiresAt = null`
10. Do **not** add RSVP, attendee mutation, waitlist logic, link rotation UI, mobile UI, or real auth providers in this task.

---

## Out of scope

The following are explicitly out of scope for `EVT-4`:

- attendee RSVP submission;
- guest creation or guest identity flows;
- waitlist logic;
- invite-link revocation/rotation endpoint;
- event update/delete endpoints;
- organizer event listing;
- comments/chat;
- reminder scheduling;
- payments/deposits;
- Google / Apple / VK / Yandex auth;
- mobile feature screens;
- Android/iOS release work.

If any of the above appears, it is over-implementation and should be removed.

---

## Required API behavior

## 1) Organizer invite-link endpoint

### Route

- `POST /api/v1/events/:eventId/invite-link`

### Auth

- must require the existing `x-dev-user-id` development/test auth mechanism from `EVT-3`

### Organizer access rules

This is an organizer-scoped endpoint.

- the organizer who owns the event may create/fetch its active invite link;
- a different authenticated user must not be able to do this;
- for privacy consistency with `EVT-3`, non-owner access must return:
  - `404 Not Found`
  - not `403`

Use a stable error message such as:

- `Event not found`

### Behavior

When the authenticated organizer calls this endpoint for an event they own:

- if the event has no currently usable active invite link, create one;
- if the event already has a currently usable active invite link, return the existing one;
- the client must not send the token;
- the server must generate the token;
- the response must include a shareable URL built from backend config.

### Definition of "currently usable active invite link"

For this task, a link is currently usable when:

- `isActive = true`, and
- `expiresAt IS NULL` **or** `expiresAt` is in the future.

If a link is inactive or already expired, it must **not** be treated as the active share link.

### HTTP status rules

For `POST /api/v1/events/:eventId/invite-link`:

- new active invite link created -> `201 Created`
- existing currently usable active invite link returned -> `200 OK`
- missing `x-dev-user-id` -> `401 Unauthorized`
- unknown `x-dev-user-id` -> `401 Unauthorized`
- event not found for that organizer -> `404 Not Found`

### Response contract

Response JSON must have this exact top-level shape:

```json
{
  "eventId": "ckxxxxxxxxxxxxxxxxxxxxxxx",
  "token": "7gl4r0V4J8m5Qk2g8H1k2fJ6t7J7n6fVQb1gI5lM2nQ",
  "url": "http://localhost:3000/api/v1/invite-links/7gl4r0V4J8m5Qk2g8H1k2fJ6t7J7n6fVQb1gI5lM2nQ",
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-03-17T12:00:00.000Z"
}
```

Field rules:

- `eventId` -> string, the owned event ID
- `token` -> string, generated by the server
- `url` -> absolute URL string built from config + token
- `isActive` -> boolean, expected `true`
- `expiresAt` -> `null` in the normal path for this task
- `createdAt` -> ISO string

Do **not** include organizer profile data, auth identity data, attendee data, or private counts.

---

## 2) Public invite-resolution endpoint

### Route

- `GET /api/v1/invite-links/:token`

### Auth

- no auth required

### Behavior

When the token corresponds to a currently usable active invite link, the endpoint must return public event details.

When the token is:

- unknown,
- inactive,
- expired,
- or points to a missing event,

return:

- `404 Not Found`

Use a stable message such as:

- `Invite link not found`

### Public response contract

Response JSON must have this exact top-level shape:

```json
{
  "token": "7gl4r0V4J8m5Qk2g8H1k2fJ6t7J7n6fVQb1gI5lM2nQ",
  "url": "http://localhost:3000/api/v1/invite-links/7gl4r0V4J8m5Qk2g8H1k2fJ6t7J7n6fVQb1gI5lM2nQ",
  "expiresAt": null,
  "event": {
    "title": "Friday Board Games",
    "description": "Bring drinks if you want",
    "location": "Prospekt Mira 10",
    "startsAt": "2026-03-20T16:30:00.000Z",
    "timezone": "Europe/Moscow",
    "capacityLimit": 8,
    "allowPlusOnes": false
  }
}
```

### Public field rules

Top-level fields:

- `token` -> string
- `url` -> absolute URL string
- `expiresAt` -> `null` or ISO string

Nested `event` fields:

- `title` -> string
- `description` -> string or `null`
- `location` -> string or `null`
- `startsAt` -> ISO string
- `timezone` -> string
- `capacityLimit` -> integer or `null`
- `allowPlusOnes` -> boolean

### Privacy rules

The public endpoint must **not** expose:

- `organizerUserId`
- auth identities
- internal user rows
- attendee rows
- RSVP summaries
- private notes
- created/updated audit metadata that is not needed publicly

Keep the public payload intentionally small.

---

## Config and URL-building requirements

This task must add and validate a backend environment variable:

- `PUBLIC_INVITE_BASE_URL`

### Required meaning

`PUBLIC_INVITE_BASE_URL` is the absolute base URL used to build invite URLs.

For this task, the expected example value is:

```text
http://localhost:3000/api/v1/invite-links
```

The final invite URL returned by the API must be:

```text
${PUBLIC_INVITE_BASE_URL}/${token}
```

### Validation requirements

`PUBLIC_INVITE_BASE_URL` must:

- be required at runtime for the API app;
- be a valid absolute URL;
- support path segments;
- produce valid invite URLs when joined with the token.

It is acceptable to normalize a trailing slash away either in config parsing or in the invite URL builder.

### Example env files

Update at least:

- `apps/api/.env.example`
- `apps/api/.env.test.example`

Add sensible non-secret placeholders only.

---

## Token generation requirements

Invite tokens must:

- be generated only on the server;
- be created from a cryptographically secure random source;
- be URL-safe;
- be opaque to clients;
- not embed the event ID or organizer ID in a reversible way;
- not be sequential or guessable.

### Minimum token requirements

The implementation must satisfy all of the following:

- token length must be at least `32` characters;
- token must match the URL-safe character class:
  - `^[A-Za-z0-9_-]+$`
- token generation must not depend on timestamps, incremental counters, or plain Prisma IDs alone.

A Node.js `crypto`-based implementation is appropriate.

---

## Persistence requirements

Use the existing Prisma schema from `EVT-2`.

This task is expected to work with the existing `InviteLink` model fields:

- `id`
- `eventId`
- `token`
- `isActive`
- `expiresAt`
- `createdAt`

### Schema rule

Prefer using the existing schema exactly as-is.

Only add a new Prisma migration if a truly minimal schema adjustment is strictly required by the current repository state.

If a migration is required:

- create a **new** migration under `apps/api/prisma/migrations/`
- do **not** edit previous committed migrations
- keep the change additive and minimal

The most likely correct implementation of this task should require **no schema change**.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Because this task depends on existing DB-backed event/auth behavior, you may create the minimum route/service/helper scaffolding needed for the tests to compile. However, do **not** implement the final endpoint behavior before the tests exist and have been run in a failing state.

### Required tests to add first

Add these tests before implementing the final production behavior:

1. `apps/api/test/invite-link-url.spec.ts`
   - unit test for the invite URL builder/helper;
   - must verify at least:
     - base URL + token are joined correctly;
     - a trailing slash in the base URL does not produce a double slash;
     - the resulting URL is exactly what the API should return.

2. `apps/api/test/invite-links.integration-spec.ts`
   - DB-backed integration/e2e-style tests for the real HTTP endpoints;
   - must verify at least:
     - organizer can create an invite link for their own event -> `201`;
     - a second call reuses the existing currently usable active link -> `200` and same token;
     - only one active invite link exists for the event in the normal happy path after repeated create calls;
     - missing `x-dev-user-id` -> `401` on the organizer endpoint;
     - unknown `x-dev-user-id` -> `401` on the organizer endpoint;
     - another organizer gets `404` for someone else’s event;
     - public `GET /api/v1/invite-links/:token` resolves a valid active link -> `200`;
     - unknown token -> `404`;
     - inactive token -> `404`;
     - expired token -> `404`.

You may add one tiny supporting unit test if truly needed, but do not add speculative coverage.

### Required red-state evidence

Before implementing the final behavior, run the smallest relevant failing commands.

At minimum, run a targeted red-state command for the invite URL unit test, for example:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/invite-link-url.spec.ts
```

If local PostgreSQL is available, also run the integration spec in a red state, for example:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/invite-links.integration-spec.ts
```

Acceptable red-state reasons include:

- invite URL builder not implemented yet;
- config variable not supported yet;
- organizer invite-link endpoint not implemented yet;
- public invite-resolution endpoint not implemented yet;
- idempotent active-link reuse not implemented yet.

### Required green-state evidence

After implementing the code, rerun:

- the invite URL unit test;
- the DB-backed integration spec;
- relevant typecheck commands for the affected package.

### Forbidden shortcuts

Do not:

- weaken or remove assertions to get green;
- bypass the existing organizer auth shim;
- allow clients to submit their own token;
- generate guessable tokens;
- silently create a new active link on every repeated request when an existing usable active link already exists;
- claim the task is done if the local DB-backed integration tests were never actually green on a real machine with Docker/PostgreSQL.

If the Codex runtime lacks Docker, report that limitation honestly, but the implementation itself must still be complete and locally verifiable.

---

## Detailed implementation requirements

## 1) Organizer invite-link creation/fetch endpoint

Implement:

- `POST /api/v1/events/:eventId/invite-link`

### Required logic

1. authenticate using the existing `x-dev-user-id` mechanism;
2. verify the event exists and belongs to the authenticated organizer;
3. search for the newest currently usable active invite link for that event;
4. if found:
   - return it unchanged;
   - respond with `200 OK`;
5. if not found:
   - generate a secure token;
   - create a new invite-link row with:
     - `eventId`
     - `token`
     - `isActive = true`
     - `expiresAt = null`
   - return it;
   - respond with `201 Created`.

### Returned URL

The endpoint must return a `url` field built from:

- validated `PUBLIC_INVITE_BASE_URL`
- the invite token

Do not hardcode the full URL inline in controller logic if a small helper/mapper would make the behavior clearer.

### Swagger / OpenAPI

Document the route in Swagger.

At minimum:

- the route appears in `/api/docs`;
- the `x-dev-user-id` requirement is visible;
- the response shape is documented.

---

## 2) Public invite-resolution endpoint

Implement:

- `GET /api/v1/invite-links/:token`

### Required logic

1. look up the invite link by token;
2. ensure it is active and not expired;
3. load the related event;
4. return the public payload only;
5. do not require auth.

### Expiry rule

A link is expired when:

- `expiresAt` is not null, and
- `expiresAt <= now`

Expired links must behave the same as unknown links from the client perspective:

- `404 Not Found`

### Privacy rule

The public endpoint must not leak organizer-private data even if such data is easy to fetch from the relation.

---

## 3) Code organization

Keep the implementation tidy but not over-abstracted.

A good minimal outcome would include some or all of:

- invite-links controller or routes inside the existing events module
- invite-links service or clearly-scoped event service methods
- small invite URL builder/helper
- public response mapper/serializer (optional)

Do not introduce a generic link-management framework.

---

## 4) Documentation updates

Update `docs/local-development.md` so a Windows 11 developer can manually verify this task.

Add at least:

1. how to ensure `.env` and `.env.test` contain `PUBLIC_INVITE_BASE_URL`;
2. how to start Docker Compose;
3. how to seed the development user from `EVT-3`;
4. how to create a test event;
5. how to request the organizer invite link;
6. how to open the public invite URL in the browser or call it from PowerShell;
7. how to test inactive/expired cases if documented manually.

Use PowerShell-friendly examples.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `POST /api/v1/events/:eventId/invite-link` exists and is organizer-scoped.
2. The organizer endpoint requires `x-dev-user-id` and uses the existing dev/test auth shim.
3. The organizer endpoint returns `201` when it creates a new active invite link.
4. The organizer endpoint returns `200` and the same token when called again for an event that already has a currently usable active invite link.
5. The invite token is generated server-side and is URL-safe and unguessable.
6. The response includes a `url` built from `PUBLIC_INVITE_BASE_URL`.
7. `GET /api/v1/invite-links/:token` exists and requires no auth.
8. The public endpoint returns the required safe public payload for a valid active invite link.
9. Unknown, inactive, and expired invite tokens all return `404 Not Found`.
10. The public payload does not expose organizer-private information.
11. Automated tests were written first, observed failing, then made green.
12. Local documentation was updated for Windows 11 verification.
13. No RSVP, waitlist, comments, or real auth-provider work was added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

At minimum, verify the task with commands equivalent to these.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user

pnpm --filter @event-app/api test -- --runTestsByPath test/invite-link-url.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/invite-links.integration-spec.ts
pnpm --filter @event-app/api typecheck

pnpm --filter @event-app/api start:dev
```

Then manually:

1. create an event via the existing `POST /api/v1/events` endpoint;
2. call `POST /api/v1/events/:eventId/invite-link` with `x-dev-user-id`;
3. call it a second time and confirm the same token/url come back;
4. open the returned `url` in a browser or call it via PowerShell;
5. confirm the public payload matches the task contract.

### Example PowerShell requests

Assuming:

- API at `http://localhost:3000`
- `DEV_USER_ID` copied from the seed script output

Create event:

```powershell
$headers = @{ 'x-dev-user-id' = '<DEV_USER_ID>' }
$body = @{
  title = 'Friday Board Games'
  description = 'Bring drinks if you want'
  location = 'Prospekt Mira 10'
  startsAt = '2026-03-20T16:30:00.000Z'
  timezone = 'Europe/Moscow'
  capacityLimit = 8
} | ConvertTo-Json

$event = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/events' -Headers $headers -ContentType 'application/json' -Body $body
$event
```

Create/fetch invite link:

```powershell
$invite = Invoke-RestMethod -Method Post -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) -Headers $headers
$invite
```

Resolve public invite:

```powershell
Invoke-RestMethod -Method Get -Uri $invite.url
```

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

pnpm --filter @event-app/api test -- --runTestsByPath test/invite-link-url.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/invite-links.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

---

## Implementation notes and guardrails

- Reuse the existing dev/test auth shim from `EVT-3`; do not redesign auth.
- Prefer the smallest clear implementation.
- Avoid adding future RSVP or guest-submission abstractions.
- Do not add link-rotation behavior in this task.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- Keep the diff tightly focused on invite-link creation/resolution.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-4` must explicitly include:

1. the exact tests added for the red -> green workflow;
2. the exact failing command(s) that proved the red state;
3. the exact passing command(s) that proved the green state;
4. the exact `PUBLIC_INVITE_BASE_URL` example value used for manual verification;
5. one sample organizer invite-link response body;
6. one sample public invite-resolution response body.

---

## Definition of done

`EVT-4` is done when a developer can create an event as the seeded organizer, request a shareable invite link for that event, open the returned public URL without auth, receive the safe public event payload, and verify through automated tests that valid, unknown, inactive, and expired link paths behave exactly as specified.

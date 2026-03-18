# EVT-3 — Development auth shim and organizer event create/read API

## Status
Ready

## Priority
P0

## Depends on
- EVT-1
- EVT-2

## Goal

Implement the first real domain API for the product:

- a **development/test-only request auth shim** so protected backend work can start before real auth providers are implemented;
- `POST /api/v1/events` for organizers to create events;
- `GET /api/v1/events/:eventId` for organizers to read their own events by ID;
- a tiny local dev seed workflow so manual verification is practical on Windows 11.

This task is the first backend feature task. It must stay small, strict, and test-first.

---

## Why this task exists now

We already have:

- the monorepo foundation;
- the Nest backend shell;
- Prisma/PostgreSQL foundation and the initial core schema.

We do **not** yet have real authentication.

To keep the project moving, we need a safe temporary mechanism that allows protected event endpoints to exist in `development` and `test` environments only. That gives us a clean way to build event functionality now and replace the temporary auth layer later with real login/session flows.

After this task is done, we should be able to:

1. create a deterministic local development user;
2. call protected event endpoints with that user's ID via a dev-only header;
3. persist an event in PostgreSQL;
4. read that event back as its organizer;
5. reject access when the event belongs to a different user.

---

## Fixed implementation decisions for this task

These decisions are mandatory for this task:

1. The temporary auth mechanism must be **development/test only**.
2. The temporary auth header name must be exactly:
   - `x-dev-user-id`
3. The event endpoints added in this task must be:
   - `POST /api/v1/events`
   - `GET /api/v1/events/:eventId`
4. These endpoints are **organizer-scoped**, not public.
5. Use the existing Prisma/PostgreSQL foundation from `EVT-2`.
6. Use the existing `User` and `Event` models from `EVT-2`, extending the schema only if required by the exact payload/response contract below.
7. Do **not** add real auth providers yet.
8. Do **not** add invite links, attendee RSVP, waitlist behavior, reminders, comments, payments, or mobile UI work in this task.
9. Keep startup and runtime behavior small and explicit. Do not introduce speculative abstractions.

---

## Out of scope

The following are explicitly out of scope for `EVT-3`:

- Google / Apple / VK / Yandex auth;
- email magic-link or OTP auth;
- session refresh flows;
- public event pages;
- invite link generation or resolution;
- attendee RSVP creation;
- waitlist or capacity enforcement beyond storing `capacityLimit` on the event;
- event updates or deletion;
- organizer dashboards/lists;
- reminders/jobs;
- mobile screens beyond what already exists;
- EAS / release work;
- CI/CD.

If any of the above appears, it is over-implementation and should be removed.

---

## Required API behavior

This task introduces the first organizer event API.

### Protected endpoints in this task

- `POST /api/v1/events`
- `GET /api/v1/events/:eventId`

Both endpoints must require the temporary development/test auth mechanism described below.

### Temporary auth mechanism rules

The temporary auth mechanism must:

1. Be active only when `APP_ENV` is one of:
   - `development`
   - `test`
2. Read the request header:
   - `x-dev-user-id`
3. Load the matching user from the database.
4. Expose the authenticated user to controller/service code through a typed mechanism.
   - A custom decorator like `@CurrentUser()` is acceptable.
   - A request property is acceptable if it is typed properly.
5. Reject requests when the header is missing.
6. Reject requests when the user does not exist.
7. Reject all use of this mechanism outside `development` and `test`.

### Required error behavior for temporary auth

For the event endpoints added in this task:

- missing `x-dev-user-id` header -> `401 Unauthorized`
- unknown `x-dev-user-id` user -> `401 Unauthorized`
- use of the dev auth mechanism outside development/test -> the request must **not** be allowed through

The exact message text may vary slightly, but it must be clear and deterministic.

---

## Event data contract for this task

This task defines the **minimum event shape** needed for organizer creation and organizer read.

### Request contract: `POST /api/v1/events`

Request body must accept this shape:

```json
{
  "title": "Friday Board Games",
  "description": "Bring drinks if you want",
  "location": "Prospekt Mira 10",
  "startsAt": "2026-03-20T16:30:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8
}
```

### Validation rules

Apply these exact rules:

#### `title`
- required
- string
- trim leading/trailing whitespace
- minimum length after trim: `1`
- maximum length: `120`

#### `description`
- optional
- string when provided
- trim leading/trailing whitespace
- blank string should be normalized to `null`
- maximum length: `2000`

#### `location`
- optional
- string when provided
- trim leading/trailing whitespace
- blank string should be normalized to `null`
- maximum length: `240`

#### `startsAt`
- required
- must be a valid ISO-8601 date-time string
- persist as a timestamp/datetime in the database

#### `timezone`
- required
- string
- must be a valid IANA timezone identifier
- examples of valid values:
  - `Europe/Moscow`
  - `UTC`
  - `America/New_York`

#### `capacityLimit`
- optional
- when provided, must be an integer
- minimum value: `1`
- maximum value: `10000`
- when omitted, persist as `null`

### Unknown fields

Request validation must reject unexpected extra fields for this endpoint.

---

## Response contract for both endpoints in this task

Both `POST /api/v1/events` and `GET /api/v1/events/:eventId` must return the same JSON shape.

Required response shape:

```json
{
  "id": "ckxxxxxxxxxxxxxxxxxxxxxxx",
  "title": "Friday Board Games",
  "description": "Bring drinks if you want",
  "location": "Prospekt Mira 10",
  "startsAt": "2026-03-20T16:30:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8,
  "organizerUserId": "ckyyyyyyyyyyyyyyyyyyyyyyy",
  "createdAt": "2026-03-17T12:00:00.000Z",
  "updatedAt": "2026-03-17T12:00:00.000Z"
}
```

Response field rules:

- all timestamps must be serialized as ISO strings;
- `description` may be `null`;
- `location` may be `null`;
- `capacityLimit` may be `null`;
- `organizerUserId` must be the ID of the current authenticated organizer.

Keep the response minimal. Do **not** add attendee counts, invite URLs, RSVP summaries, or organizer profile objects in this task.

---

## Organizer access rules

For `GET /api/v1/events/:eventId`:

- the organizer who created the event can read it -> `200 OK`
- a different authenticated user must **not** be allowed to read it
- for organizer privacy, return:
  - `404 Not Found`
  - not `403`

Use a stable message such as `Event not found`.

---

## Schema and persistence requirements

Use the Prisma schema introduced in `EVT-2`.

### Required stored event fields for this task

The event record must be able to persist at least:

- `id`
- `title`
- `description`
- `location`
- `startsAt`
- `timezone`
- `capacityLimit`
- organizer/owner user relation
- `createdAt`
- `updatedAt`

If the current schema from `EVT-2` already contains equivalent fields, reuse them.

If one or more of these fields are missing, add the **smallest possible** Prisma schema change and generate a **new migration** under:

- `apps/api/prisma/migrations/`

Rules:

- do **not** edit the existing committed migration from `EVT-2`;
- do **not** rename equivalent existing columns unless strictly necessary;
- prefer additive/minimal changes.

### Organizer relation

The event must be linked to the current authenticated user as organizer/owner.

Use the existing relation from `EVT-2` if present.

If the existing schema does not yet model this relation cleanly, add the minimum schema change required to do so.

### Things not to persist yet

Do **not** create or mutate in this task:

- attendee rows for the organizer;
- invite link rows;
- reminder rows;
- payment rows;
- derived counters.

This task is only about storing the event record and reading it back by organizer.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Because this task depends on the DB-backed schema from `EVT-2`, it is acceptable to create the minimum DTO/controller/service scaffolding required for the tests to compile. However, do **not** implement the final endpoint behavior before the tests exist and have been run in a failing state.

### Required tests to add first

Add these tests before implementing the final production behavior:

1. `apps/api/test/create-event.dto.spec.ts`
   - covers payload validation rules for the create-event request DTO/input layer;
   - must verify at least:
     - valid payload passes;
     - blank optional strings normalize as intended or are rejected according to the chosen validation layer design;
     - invalid timezone is rejected;
     - invalid `capacityLimit` is rejected.

2. `apps/api/test/events.integration-spec.ts`
   - DB-backed integration/e2e-style tests for the real HTTP endpoints;
   - must verify at least:
     - create event success with a valid `x-dev-user-id`;
     - `401` when the header is missing;
     - `401` when the header references a nonexistent user;
     - `400` on invalid payload;
     - organizer can fetch own event by ID;
     - different user gets `404` for another user's event.

You may add one tiny supporting unit test if truly needed, but do not add speculative coverage.

### Required red-state evidence

Before implementing the final behavior, run the smallest relevant failing commands.

At minimum, run a targeted red-state command for the DTO validation test, for example:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/create-event.dto.spec.ts
```

If local PostgreSQL is available, also run the integration spec in a red state, for example:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events.integration-spec.ts
```

Acceptable red-state reasons include:

- create-event DTO not implemented yet;
- validation rules not implemented yet;
- event routes not implemented yet;
- temporary dev auth not implemented yet;
- organizer scoping not implemented yet.

### Required green-state evidence

After implementing the code, rerun:

- the DTO test;
- the DB-backed integration spec;
- relevant typecheck/lint commands for the affected package.

### Forbidden shortcuts

Do not:

- loosen or remove assertions to get green;
- skip DB-backed tests merely because the endpoint is hard to wire;
- bypass organizer authorization checks;
- silently allow missing auth headers;
- silently allow invalid timezones;
- claim the task is done if the local DB-backed tests were never actually green on a real machine with Docker/PostgreSQL.

If the execution environment used by Codex lacks Docker, report that limitation honestly, but the implementation itself must still be complete and locally verifiable.

---

## Detailed implementation requirements

## 1) Development/test auth shim

Implement a temporary auth layer for protected backend work.

### Required behavior

- only active in `APP_ENV=development` and `APP_ENV=test`;
- reads `x-dev-user-id` from the request;
- finds the user in PostgreSQL using Prisma;
- makes that user available to controller/service code in a typed way;
- used by the event endpoints in this task.

### Design constraints

- keep the implementation small and explicit;
- a Nest guard is acceptable;
- a small auth module is acceptable;
- a custom decorator such as `@CurrentUser()` is recommended but not mandatory;
- do not introduce JWT, sessions, cookies, OAuth, Passport strategies, or refresh tokens.

### Security requirement

Outside `development` and `test`, the dev auth pathway must not grant access.

It is acceptable to reject requests with `401`, `403`, `500`, or `501` outside those environments as long as access is clearly denied and the behavior is explicit. Do **not** silently fall back to anonymous access.

## 2) Dev seed script for manual verification

Add a tiny local development seed path so a developer can create a deterministic organizer user without manually editing the database.

### Required script

Add a backend package script with this intent:

- `db:seed:dev-user`

### Required behavior

The script must:

- connect to the database using the backend Prisma setup;
- upsert exactly one deterministic local development user;
- print the resulting user ID clearly to stdout.

Recommended output style:

```text
DEV_USER_ID=<generated-user-id>
```

### Recommended seeded user properties

Use simple deterministic placeholder data such as:

- display name: `Local Organizer`
- email: `local-organizer@example.com`

Do **not** create fake auth provider identities yet unless absolutely required by the current schema.

Keep this script small and obviously development-oriented.

## 3) Request validation hardening for this endpoint

If not already enabled, add or update Nest request validation so this endpoint gets strict payload handling.

Desired behavior for this task:

- transform payloads where appropriate;
- whitelist known fields;
- reject unknown fields;
- return `400` on invalid input.

Use the repository's existing validation approach if one already exists. Keep it consistent.

## 4) `POST /api/v1/events`

Implement organizer event creation.

### Route

- `POST /api/v1/events`

### Auth

- protected by the temporary dev/test auth shim from this task

### Behavior

When the request is valid and the organizer is authenticated:

- create a new event row in PostgreSQL;
- associate it with the current organizer user;
- normalize blank optional strings to `null`;
- persist `capacityLimit` as `null` when omitted;
- return `201 Created` with the required response body.

### Validation behavior

- invalid body -> `400 Bad Request`
- missing `x-dev-user-id` -> `401 Unauthorized`
- unknown `x-dev-user-id` -> `401 Unauthorized`

### Swagger / OpenAPI

Document the route and payload/response shape in Swagger.

At minimum:

- route appears in `/api/docs`;
- required fields are visible;
- optional fields are visible;
- dev auth header requirement is discoverable in some reasonable way.

## 5) `GET /api/v1/events/:eventId`

Implement organizer read-by-id.

### Route

- `GET /api/v1/events/:eventId`

### Auth

- protected by the temporary dev/test auth shim from this task

### Behavior

When the organizer owns the event:

- return `200 OK`
- return the exact response shape defined above

When the event does not exist **or** belongs to another user:

- return `404 Not Found`
- use a stable message such as `Event not found`

### Path param validation

Validate the `eventId` path parameter reasonably.

It is acceptable to treat any non-matching ID as simply not found. Do not over-engineer this.

## 6) Code organization

Keep the implementation tidy but not over-abstracted.

A good minimal outcome would include some or all of:

- `events` module
- `events` controller
- `events` service
- create-event DTO/input type
- event response mapper/serializer (optional)
- dev auth guard/module/decorator

Do not create a large generic architecture framework in this task.

## 7) Documentation updates

Update `docs/local-development.md` so a Windows 11 developer can manually verify this task.

Add at least:

1. how to copy `.env` and `.env.test` files;
2. how to start Docker Compose;
3. how to run Prisma generation/migrations if required by the repo;
4. how to run `db:seed:dev-user`;
5. how to call the create-event endpoint with `x-dev-user-id`;
6. how to call the read-event endpoint with `x-dev-user-id`.

Use PowerShell-friendly examples.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. A temporary request auth mechanism exists for backend development/testing.
2. The temporary auth mechanism uses exactly `x-dev-user-id`.
3. The temporary auth mechanism loads a real user from PostgreSQL.
4. Missing or unknown `x-dev-user-id` is rejected with `401` on the event endpoints.
5. `POST /api/v1/events` exists and returns `201` on valid input.
6. `POST /api/v1/events` persists the event with the current organizer user linked.
7. `GET /api/v1/events/:eventId` exists and returns the required response shape.
8. The organizer can fetch their own event.
9. A different authenticated user receives `404` for another user's event.
10. Strict validation rejects invalid payloads and unknown fields with `400`.
11. The event endpoints are visible in Swagger.
12. A tiny dev seed script exists and prints the created/upserted dev user ID.
13. Required tests were written first and observed failing before the final implementation.
14. DB-backed tests for the new endpoint behavior are locally green on a machine with Docker/PostgreSQL.
15. No invite-link logic, RSVP logic, waitlist logic, or real auth provider code was added.

---

## Required manual verification steps

Document the exact commands you actually ran in the final report.

At minimum, local verification should look equivalent to this.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user

pnpm --filter @event-app/api test -- --runTestsByPath test/create-event.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events.integration-spec.ts
pnpm --filter @event-app/api typecheck

pnpm --filter @event-app/api start:dev
```

Then, after `db:seed:dev-user`, copy the printed `DEV_USER_ID` value and run a manual create request.

Example PowerShell request:

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

$response = Invoke-RestMethod -Method POST `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body

$response
```

Then fetch the created event:

```powershell
Invoke-RestMethod -Method GET `
  -Uri ("http://localhost:3000/api/v1/events/{0}" -f $response.id) `
  -Headers $headers
```

Then verify unauthorized behavior:

```powershell
Invoke-RestMethod -Method POST `
  -Uri 'http://localhost:3000/api/v1/events' `
  -ContentType 'application/json' `
  -Body $body
```

Expected result: `401 Unauthorized`.

Stop when finished:

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

pnpm --filter @event-app/api test -- --runTestsByPath test/create-event.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

---

## Implementation notes and guardrails

- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- Do not edit existing committed migrations.
- If a new migration is needed, add a new one only.
- Keep the diff focused on dev auth + event create/read.
- Prefer small explicit code over generic frameworks.
- Keep any seeded data obviously fake and development-only.
- If you need helper utilities for tests, keep them local to the backend test area.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-3` must explicitly include:

1. the exact test files added/updated first;
2. the exact red-state command(s) run before the final implementation;
3. the exact green-state command(s) run after implementation;
4. whether a new Prisma migration was needed and, if yes, its path;
5. the exact local command used to seed the dev user;
6. one example successful create-event request and one example successful get-event request;
7. confirmation that another user's event returns `404`.

---

## Definition of done

`EVT-3` is done when a developer on Windows 11 can start local infra, seed a local organizer user, call `POST /api/v1/events` with `x-dev-user-id`, receive a persisted event back, fetch it again via `GET /api/v1/events/:eventId`, and observe that another user cannot read it — with automated tests proving the core behavior first.

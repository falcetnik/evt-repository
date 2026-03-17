# EVT-2 — Prisma/PostgreSQL foundation and initial core schema

## Status
Ready

## Priority
P0

## Depends on
- EVT-1

## Goal

Introduce persistent storage into `apps/api` by adding Prisma + PostgreSQL foundation, the first committed database migration, and automated tests that prove the initial core schema works.

This task must create:

- Prisma setup inside `apps/api`;
- the first committed migration for the core relational schema;
- a Nest-integrated `PrismaService` / database module;
- backend env validation extended for database configuration;
- isolated integration tests proving the schema and relations work;
- local developer commands and docs for generating the client, applying migrations, and inspecting the database.

This is still a **foundation task**. It is not yet an API feature task.

---

## Why this task exists now

The project now has a workspace shell, a bootable API, and local infrastructure.

Before we build event creation, invite links, RSVP flows, or auth providers, we need:

- a real database access layer;
- an explicit, reviewable schema baseline;
- deterministic migrations checked into Git;
- a safe local workflow for Windows 11 + Docker Desktop;
- automated proof that the schema can persist the first core entities.

After this task, later feature tasks should be able to build on top of stable data models instead of inventing schema ad hoc.

---

## Fixed implementation decisions for this task

These decisions are mandatory for this task.

1. Use **Prisma** in `apps/api`.
2. Use **PostgreSQL** as the only database provider.
3. Keep Prisma files inside:
   - `apps/api/prisma/schema.prisma`
   - `apps/api/prisma/migrations/...`
4. Commit a real Prisma migration. Do **not** rely on `prisma db push` as the primary schema-management mechanism.
5. Use **string IDs generated with Prisma `cuid()`** for the initial schema.
   - This is intentional for local simplicity and to avoid DB-extension requirements at this stage.
6. Use **camelCase** in Prisma model fields and map to **snake_case** database columns/tables with `@map` / `@@map`.
7. Add a reusable Nest database module and `PrismaService`, but do **not** add repository/service layers for domain logic yet.
8. Keep the existing health endpoint independent from DB readiness for now.
9. Do **not** add auth flows, sessions, seeding, reminder jobs, or event API endpoints in this task.
10. Keep the implementation minimal, explicit, and easy to review.

---

## Out of scope

The following are explicitly out of scope for `EVT-2`:

- sign-in / sign-up flows;
- Google / Apple / VK / Yandex auth implementation;
- auth sessions / refresh-token logic;
- passwordless email auth;
- event creation endpoints;
- invite-link public API;
- RSVP endpoint behavior;
- waitlist logic;
- reminder scheduling;
- payments;
- audit-log implementation;
- seed scripts for demo data;
- Prisma Studio automation;
- mobile feature work;
- UI/UX work.

If any of the above is added, it is over-implementation and should be removed.

---

## Required deliverables

At the end of this task, the repository must include at least the following new backend pieces (exact filenames may vary slightly, but the structure and intent must exist):

```text
apps/api/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
│     └─ <timestamp>_init_core_schema/
│        └─ migration.sql
├─ src/
│  └─ database/
│     ├─ prisma.module.ts
│     └─ prisma.service.ts
├─ test/
│  ├─ database-env.validation.spec.ts   # or equivalent
│  └─ prisma-core-schema.integration-spec.ts
├─ .env.example
└─ .env.test.example
```

It is acceptable if supporting files are added around this, but the above concepts must exist.

---

## Required database schema for this task

Add the initial core relational schema for the project.

This task must create these Prisma enums:

1. `AuthProvider`
   - `EMAIL`
   - `GOOGLE`
   - `APPLE`
   - `YANDEX`
   - `VK`

2. `EventVisibility`
   - `PRIVATE`
   - `PUBLIC`

3. `AttendeeResponseStatus`
   - `GOING`
   - `MAYBE`
   - `NOT_GOING`
   - `WAITLIST`

### Required Prisma models

#### `User`
Required minimum fields:

- `id`
- `displayName` (nullable)
- `createdAt`
- `updatedAt`

Required relations:

- one-to-many with `AuthIdentity`
- one-to-many with organized `Event`
- one-to-many with `EventAttendee`

DB table name must be `users`.

---

#### `AuthIdentity`
Required minimum fields:

- `id`
- `userId`
- `provider`
- `providerSubject`
- `providerEmail` (nullable)
- `createdAt`
- `updatedAt`

Required constraints:

- relation to `User`
- unique `(provider, providerSubject)`
- index on `userId`

DB table name must be `auth_identities`.

---

#### `Event`
Required minimum fields:

- `id`
- `organizerUserId`
- `title`
- `description` (nullable)
- `startsAt`
- `endsAt` (nullable)
- `timezone`
- `locationName` (nullable)
- `locationAddress` (nullable)
- `capacityLimit` (nullable)
- `allowPlusOnes` (boolean, default false)
- `visibility` (default `PRIVATE`)
- `createdAt`
- `updatedAt`

Required constraints:

- relation to organizer `User`
- index on `organizerUserId`

DB table name must be `events`.

---

#### `InviteLink`
Required minimum fields:

- `id`
- `eventId`
- `token`
- `isActive` (boolean, default true)
- `expiresAt` (nullable)
- `createdAt`

Required constraints:

- relation to `Event`
- unique `token`
- index on `eventId`

DB table name must be `invite_links`.

---

#### `EventAttendee`
Required minimum fields:

- `id`
- `eventId`
- `userId` (nullable)
- `guestName` (nullable)
- `guestEmail` (nullable)
- `responseStatus`
- `plusOnesCount` (default 0)
- `createdAt`
- `updatedAt`

Required constraints:

- relation to `Event`
- optional relation to `User`
- index on `eventId`
- index on `userId`
- unique composite constraint on `(eventId, userId)`
  - this is intended to prevent duplicate user-attendance rows per event
  - `userId` remains nullable for guest/link-based responses

DB table name must be `event_attendees`.

---

## Schema constraints and conventions

These conventions are mandatory:

1. Use `createdAt` with `@default(now())` on all models listed above.
2. Use `updatedAt` with Prisma `@updatedAt` where listed.
3. Use `@map` / `@@map` so SQL identifiers are snake_case.
4. Keep the schema minimal.
5. Do **not** add speculative fields such as:
   - session tokens
   - moderation flags
   - payment state
   - reminder delivery state
   - event questions
   - RSVP notes
   - analytics counters
6. Do **not** add soft-delete columns in this task.
7. Do **not** add database triggers, stored procedures, or custom extensions in this task.

One or two extra pragmatic indexes are acceptable **only if** they directly support the required constraints above.

---

## Backend configuration requirements

Extend backend env validation so the API runtime validates database configuration.

At minimum, the backend env layer must now support and validate:

- `DATABASE_URL`

The validation must ensure:

- the variable exists;
- the value is a valid PostgreSQL connection string;
- clearly invalid values are rejected.

Accepted protocols should include:

- `postgresql://`
- `postgres://`

Continue supporting the existing app variables from `EVT-1`.

---

## Environment example files

Update:

- `apps/api/.env.example`

Create:

- `apps/api/.env.test.example`

### Required backend example env content

`apps/api/.env.example` must include at least:

- `NODE_ENV=development`
- `APP_ENV=development`
- `API_HOST=0.0.0.0`
- `API_PORT=3000`
- `APP_DISPLAY_NAME=Event App`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/event_app?schema=public`

`apps/api/.env.test.example` must include at least:

- `NODE_ENV=test`
- `APP_ENV=test`
- `API_HOST=127.0.0.1`
- `API_PORT=3001`
- `APP_DISPLAY_NAME=Event App Test`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/event_app?schema=test`

These values are local-development placeholders only.

No secrets. No production credentials.

---

## Prisma/Nest integration requirements

Create a reusable database module for Nest.

### Required behavior

1. Add a `PrismaService` that owns a Prisma client instance.
2. The service must connect cleanly on app startup/module init.
3. The service must disconnect cleanly on shutdown/module destroy.
4. The module should be importable by later feature modules.
5. Keep it small. No repositories, no business services, no custom query helpers yet.

### Important constraint

Do **not** inject Prisma into the health endpoint yet.

The existing health route must remain an application-shell health response, not a DB readiness endpoint.

---

## Required npm/pnpm scripts in `apps/api`

`apps/api/package.json` must include scripts equivalent to this intent:

- `db:generate` → generate Prisma client
- `db:migrate:dev` → run Prisma dev migration workflow
- `db:migrate:deploy` → apply committed migrations
- `db:studio` → open Prisma Studio
- `test:integration` → run DB integration tests in a deterministic way

Do not remove the scripts created in `EVT-1` unless they are being improved.

Use PowerShell-friendly commands.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

You may add the **minimum scaffolding required to run Prisma-related tests** before the first red state is observed. Allowed examples:

- Prisma dependencies
- Prisma config files
- test script wiring
- test env loading helpers
- integration test bootstrap helpers

However, you must **not** implement the final schema/migration/Prisma runtime behavior before the tests exist and have been run in a failing state.

### Required tests to add first

Before implementing the production behavior, add these tests in `apps/api`:

1. **Database env validation test**
   - verifies a valid PostgreSQL `DATABASE_URL` is accepted;
   - verifies missing `DATABASE_URL` is rejected;
   - verifies an obviously invalid/non-Postgres URL is rejected.

2. **Core schema integration test**
   - verifies the Prisma client can connect using the test DB env;
   - creates a `User`;
   - creates an `Event` linked to that organizer;
   - creates an `InviteLink` linked to that event;
   - creates an `EventAttendee` linked to that event and organizer user;
   - reads the event back with relations and verifies the relation graph.

3. **Unique invite token integration test**
   - verifies a second `InviteLink` with the same `token` is rejected by the DB / Prisma constraint.

You may add one tiny extra helper test if it directly supports this task, but do not add speculative coverage.

### Red-state requirement

Run the smallest relevant test command(s) and confirm the new tests fail before implementing the final production behavior.

Acceptable red-state reasons include:

- missing Prisma schema/client;
- missing database env validation;
- migration/table/model not implemented yet;
- required relation/unique constraint not implemented yet.

A compile failure caused by the not-yet-implemented Prisma/database code is acceptable **only if** it clearly corresponds to the missing task behavior.

### Green-state requirement

After implementation, rerun the same relevant tests and ensure they pass.

### Forbidden shortcuts

Do not:

- weaken assertions;
- skip tests;
- replace DB integration tests with mocks;
- remove unique-constraint assertions;
- claim test-first without actually observing the red state.

---

## Integration test isolation requirements

The integration tests must be safe for local development.

Requirements:

1. Integration tests must **not** require destructive resets of the developer's normal `public` schema.
2. Use an isolated test DB target.
   - Preferred: `.env.test` with a separate schema such as `schema=test`
   - Equivalent alternatives are acceptable if they are deterministic and safe
3. The test setup/teardown must leave the developer's main local dev data alone.
4. The task should remain friendly to Windows 11 + Docker Desktop.

Do not rely on hidden manual setup.

---

## Detailed implementation requirements

## 1) Add Prisma to `apps/api`

Install and configure the Prisma toolchain for the backend app.

Requirements:

- add Prisma CLI and client dependencies in the appropriate place;
- create `apps/api/prisma/schema.prisma`;
- configure the datasource for PostgreSQL via `DATABASE_URL`;
- configure the Prisma client generator;
- ensure local commands work from the workspace.

Keep the Prisma setup conventional and easy to understand.

---

## 2) Commit the first migration

Generate and commit the first Prisma migration for the required core schema.

Requirements:

- the migration must be checked into Git;
- the migration must create the required tables, enums, indexes, and constraints;
- the migration must be reviewable as SQL;
- do not handwave the migration by only changing `schema.prisma`.

The migration name should clearly indicate initial core schema intent, for example:

- `init_core_schema`

A timestamped Prisma migration directory is expected.

---

## 3) Add Nest database module

Create a small database integration layer in `apps/api/src`.

Recommended location:

- `src/database/prisma.module.ts`
- `src/database/prisma.service.ts`

Requirements:

- export a Nest module;
- expose an injectable Prisma service;
- connect/disconnect cleanly;
- do not create business logic here.

Keep the code intentionally boring.

---

## 4) Extend env validation

Update the existing backend config/env validation so the runtime validates `DATABASE_URL`.

Requirements:

- the validation logic remains testable in isolation;
- invalid DB URLs fail fast with a clear error;
- test and development env files remain simple.

Do not silently coerce broken values.

---

## 5) Keep the API shell working

After Prisma is introduced:

- the API must still start;
- the existing `GET /api/v1/health` route must still return `200`;
- Swagger must still be reachable at `/api/docs`.

This task must not regress the shell created in `EVT-1`.

---

## 6) Documentation updates

Update `docs/local-development.md`.

It must now include at least:

1. how to copy `apps/api/.env.example` to `.env`;
2. how to copy `apps/api/.env.test.example` to `.env.test`;
3. how to start Docker services;
4. how to generate Prisma client;
5. how to apply committed migrations locally;
6. how to run the DB integration tests;
7. how to open Prisma Studio;
8. a reminder that the test env uses an isolated schema/database target.

Do not modify `README.md`.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `apps/api` contains a working Prisma setup targeting PostgreSQL.
2. A real Prisma migration is committed under `apps/api/prisma/migrations/`.
3. The committed migration creates all required enums, tables, indexes, and constraints.
4. `DATABASE_URL` validation exists and is covered by automated tests.
5. The required database integration tests exist and pass.
6. The integration tests prove the schema can persist and read back:
   - a user,
   - an event,
   - an invite link,
   - an attendee.
7. The integration tests prove duplicate invite tokens are rejected.
8. The tests were written first, observed failing, then made green.
9. The API still starts in development mode.
10. `GET /api/v1/health` still returns `200`.
11. Swagger still works at `/api/docs`.
12. `apps/api/.env.example` and `apps/api/.env.test.example` exist and contain no real secrets.
13. `docs/local-development.md` is updated and usable.
14. No auth flows, session logic, event endpoints, or over-implementation were added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

At minimum, verify the task with commands equivalent to these.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test

# mobile env copy is unchanged from EVT-1 if needed locally
if (!(Test-Path apps/mobile/.env)) {
  Copy-Item apps/mobile/.env.example apps/mobile/.env
}

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy

pnpm --filter @event-app/api test -- --runTestsByPath test/database-env.validation.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand
pnpm --filter @event-app/api typecheck

pnpm --filter @event-app/api start:dev
```

Then verify in the browser:

- `http://localhost:3000/api/v1/health`
- `http://localhost:3000/api/docs`
- `http://localhost:8025`

Optional DB inspection:

```powershell
pnpm --filter @event-app/api db:studio
```

Stop local services when done:

```powershell
docker compose down
```

### Bash-friendly flow

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test

if [ ! -f apps/mobile/.env ]; then
  cp apps/mobile/.env.example apps/mobile/.env
fi

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy

pnpm --filter @event-app/api test -- --runTestsByPath test/database-env.validation.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand
pnpm --filter @event-app/api typecheck

pnpm --filter @event-app/api start:dev
```

Then verify:

- `http://localhost:3000/api/v1/health`
- `http://localhost:3000/api/docs`
- `http://localhost:8025`

Optional:

```bash
pnpm --filter @event-app/api db:studio
```

Stop services:

```bash
docker compose down
```

---

## Implementation notes and guardrails

- Keep the diff focused on Prisma/database foundation only.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- Do not add future product behavior “just because the schema exists now”.
- Prefer explicit Prisma relations and constraints over clever abstractions.
- Do not replace migration files with prose or comments.
- Do not leave the migration uncommitted.
- Do not use mocks for the core DB integration tests.
- If a scaffold/tool creates noisy extras, prune what is not needed.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-2` must explicitly include:

1. the exact tests added for the red -> green workflow;
2. the exact failing command(s) that proved the red state;
3. the exact passing command(s) that proved the green state;
4. the migration directory name that was added;
5. the final list of Prisma models and enums created;
6. the exact local commands for:
   - generating Prisma client,
   - applying migrations,
   - running integration tests,
   - opening Prisma Studio.

---

## Definition of done

`EVT-2` is done when a developer can clone the repo, copy the env example files, start Docker Desktop, apply the committed Prisma migration, run the DB integration tests against an isolated test target, start the API, hit `/api/v1/health`, open Swagger, and inspect the database with Prisma Studio — without any hidden setup steps.

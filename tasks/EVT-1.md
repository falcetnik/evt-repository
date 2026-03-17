# EVT-1 — Repository foundation and backend-first workspace bootstrap

## Status
Ready

## Priority
P0

## Depends on
None

## Goal

Create the initial monorepo foundation for the project so all later tasks can be implemented on top of a stable, predictable structure.

This task must create:

- the root workspace and shared tooling foundation;
- `apps/api` as the primary backend application shell;
- `apps/mobile` as a minimal Expo mobile shell;
- `packages/shared` as the first shared package placeholder;
- local infrastructure via Docker Compose for PostgreSQL, Redis, and Mailpit;
- example environment files and local development docs;
- the first automated tests using a strict test-first workflow.

This is a foundation task. It is intentionally **not** a feature task.

---

## Why this task exists now

We need a reliable repository shape before implementing any business logic.

After this task is done, the repo must have:

- a clear monorepo layout;
- deterministic root commands;
- a bootable backend app with a health endpoint;
- a bootable mobile placeholder app;
- local infra services ready for later tasks;
- docs for Windows 11 local development;
- automated tests proving the backend shell works.

This task reduces future drift and makes all later tasks easier for Codex to implement safely.

---

## Fixed implementation decisions for this task

These decisions are mandatory for this task and should not be re-litigated inside the implementation:

1. Use a **pnpm workspace** at the repository root.
2. Use this directory layout:
   - `apps/api`
   - `apps/mobile`
   - `packages/shared`
   - `docs`
   - `tasks`
3. `apps/api` must be a **NestJS + TypeScript** application.
4. `apps/mobile` must be an **Expo + TypeScript** application.
5. `packages/shared` must be a **plain TypeScript workspace package** intended for future cross-app shared code.
6. Docker Compose must define:
   - PostgreSQL
   - Redis
   - Mailpit
7. This task is **backend-first**:
   - the backend shell and its tests are the primary deliverable;
   - the mobile app is only a minimal placeholder shell in this task.
8. Do **not** use Nest monorepo mode. The repository itself is the monorepo; `apps/api` should remain a normal Nest app inside that workspace.
9. Do **not** introduce auth providers, native social login SDKs, Prisma models, migrations, push notifications, or domain logic in this task.
10. Keep the implementation minimal, reviewable, and future-friendly.

---

## Out of scope

The following are explicitly out of scope for `EVT-1`:

- user registration or login;
- Google / Apple / VK / Yandex auth;
- passwordless email auth;
- event domain models;
- database schema/migrations;
- Prisma runtime integration;
- waitlist logic;
- reminders/jobs;
- payments;
- chat/comments;
- real UI/UX styling;
- Android/iOS production builds;
- EAS setup;
- CI/CD pipelines;
- release automation.

If any of the above appears, it is over-implementation and should be removed.

---

## Required resulting repository structure

At the end of this task, the repo must contain at least the following high-level structure (additional small supporting files are expected):

```text
.
├─ apps/
│  ├─ api/
│  └─ mobile/
├─ packages/
│  └─ shared/
├─ docs/
│  └─ local-development.md
├─ tasks/
├─ compose.yaml
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

The exact file list inside each app/package may vary, but the structure above must exist.

---

## Package naming requirements

Use these exact workspace package names:

- `@event-app/api`
- `@event-app/mobile`
- `@event-app/shared`

This is required so later tasks can rely on deterministic filter commands.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Because the repository starts almost empty, you are allowed to create the **minimum scaffolding required to run tests** before the first red state is observed. Examples of allowed scaffolding-before-red:

- root workspace files;
- package manifests;
- tsconfig files;
- jest configuration;
- test bootstrap files.

However, you must **not** implement the actual backend behavior before the new tests exist and have been run in a failing state.

### Required tests to add first

Before implementing the backend behavior, add these tests in `apps/api`:

1. **Health endpoint e2e test**
   - verifies `GET /api/v1/health` returns `200`;
   - verifies the response body shape is correct.

2. **Environment validation test**
   - verifies valid env input is accepted;
   - verifies invalid env input is rejected with a clear failure.

You may add one or two extra tiny tests if they directly support this task, but do not add broad speculative coverage.

### Red-state requirement

Before implementing the final backend behavior, run the smallest relevant test command(s) and confirm the tests fail.

Examples of acceptable red-state reasons:

- health route not implemented yet;
- response shape not implemented yet;
- env validation function/module not implemented yet;
- invalid env is not rejected yet.

A compile failure caused by the not-yet-implemented production module is acceptable **only if** it clearly corresponds to missing task behavior.

### Green-state requirement

After implementing the code, rerun the relevant tests and ensure they pass.

### Forbidden shortcuts

Do not:

- weaken assertions to make tests pass;
- skip tests;
- mark tests todo;
- remove tests after the red state;
- claim test-first without actually running the failing test command(s).

---

## Detailed implementation requirements

## 1) Root workspace foundation

Create a root pnpm workspace with:

- `package.json` marked `private: true`;
- `pnpm-workspace.yaml` including:
  - `apps/*`
  - `packages/*`
- a root `tsconfig.base.json`;
- root scripts for common local workflows;
- a formatting setup suitable for the files created in this task.

Keep tooling simple. Do not introduce unnecessary heavy orchestration tools in this task.

### Root scripts

The root `package.json` must include scripts equivalent to the following intent:

- `dev:api` → start the backend app in development mode
- `dev:mobile` → start the Expo app
- `test` → run workspace tests
- `typecheck` → run workspace typechecks
- `format` → check formatting
- `format:write` → write formatting
- `docker:up` → start local infra with Docker Compose
- `docker:down` → stop local infra

The exact internal commands may vary, but the behavior must match the intent above.

Use cross-platform friendly commands that work on Windows 11 + PowerShell.

---

## 2) `apps/api` — backend shell

Create `apps/api` as a NestJS TypeScript application.

### Backend shell requirements

The backend must include:

- a valid Nest app bootstrap;
- a global API prefix of `/api`;
- URI versioning so the first endpoint is available at:
  - `GET /api/v1/health`
- Swagger/OpenAPI exposed at:
  - `GET /api/docs`
- a small configuration module or equivalent config layer;
- environment validation that fails fast on invalid input;
- a health controller/route;
- at least one e2e test suite;
- backend-specific scripts in `apps/api/package.json`.

### Health endpoint contract

`GET /api/v1/health` must return HTTP `200` with JSON.

The response must include at least:

- `status` — string, expected value: `"ok"`
- `service` — string identifying the API service
- `environment` — string environment name
- `timestamp` — ISO timestamp string

You may include one or two extra harmless fields if useful, but keep the response small.

Example shape:

```json
{
  "status": "ok",
  "service": "event-app-api",
  "environment": "development",
  "timestamp": "2026-03-17T12:00:00.000Z"
}
```

Do not add DB/Redis dependency checks yet. This is an application-shell health endpoint only.

### Env validation requirements

Implement environment validation for the backend shell.

At minimum, the backend env layer must support and validate:

- `NODE_ENV`
- `APP_ENV`
- `API_HOST`
- `API_PORT`
- `APP_DISPLAY_NAME`

It is acceptable to include future-facing variables in the example env files, but only the variables actually needed by this task must be required at runtime.

Validation must reject clearly invalid input such as:

- non-numeric `API_PORT`;
- missing required values;
- unsupported environment values.

Keep validation deterministic and testable.

### Backend scripts

`apps/api/package.json` must include scripts equivalent to this intent:

- `start:dev`
- `build`
- `test`
- `test:e2e`
- `typecheck`

Use the tooling that best fits a standard Nest TypeScript setup.

### Backend quality constraints

- Keep the backend shell small.
- No business modules beyond what is needed for health/config/docs.
- No auth code.
- No database runtime integration.
- No Prisma client usage yet.
- No background jobs.
- No request/response DTO sprawl.

---

## 3) `apps/mobile` — minimal Expo shell

Create `apps/mobile` as a minimal Expo TypeScript application.

This app is only a shell in `EVT-1`. Do not spend time on real UI/UX yet.

### Mobile shell requirements

The mobile app must:

- boot successfully via Expo;
- be TypeScript-based;
- have a minimal home screen / root route;
- display a simple placeholder message indicating the mobile shell is ready;
- include a mobile-specific example env file;
- include package scripts for starting the app.

The placeholder should be intentionally simple, for example:

- project/app name
- one short line such as:
  - `Mobile shell is ready`
  - `Real screens will be added in later tasks`

### Mobile constraints

- no auth flows;
- no native auth SDKs;
- no deep-linking implementation yet beyond what a normal Expo shell already contains;
- no state management libraries unless truly required by the chosen Expo scaffold;
- no design system work yet;
- no pixel-perfect styling work.

### Mobile scripts

`apps/mobile/package.json` must include scripts equivalent to this intent:

- `start`
- `android`
- `web`
- `typecheck`

The exact commands may follow the standard Expo setup.

### Mobile testing

No automated mobile tests are required in this task.

This is intentional.

The test-first requirement for `EVT-1` is satisfied by the backend tests. The mobile app only needs to be scaffolded and bootable in this task.

---

## 4) `packages/shared` — shared package placeholder

Create `packages/shared` as a very small TypeScript workspace package.

Purpose:

- establish the package for future shared DTOs, schemas, and utilities;
- prove the monorepo package layout exists from day one.

### Shared package requirements

The package must include:

- its own `package.json`;
- a TypeScript entry point;
- a `typecheck` script;
- at least one tiny exported type or constant.

Examples of acceptable placeholder exports:

- `export type ISODateString = string`
- `export const SHARED_PACKAGE_READY = true`

Keep this package platform-neutral. Do not add Node-only or React Native-only code here.

It does **not** need to be consumed by other apps yet in this task.

---

## 5) Local infrastructure via Docker Compose

Create `compose.yaml` at the repository root.

It must define these services:

1. `postgres`
2. `redis`
3. `mailpit`

### Compose requirements

- use named volumes where appropriate;
- expose ports suitable for local development;
- include basic healthchecks when practical;
- keep service config simple and readable;
- avoid production tuning in this task.

Recommended local ports:

- PostgreSQL: `5432`
- Redis: `6379`
- Mailpit SMTP: `1025`
- Mailpit UI: `8025`

The services do not need to be fully wired into the API runtime yet. This task only establishes local infrastructure.

---

## 6) Environment example files

Create example env files so local setup is obvious.

Required files:

- `apps/api/.env.example`
- `apps/mobile/.env.example`

Optional but recommended:

- root `.env.example` for Docker Compose values

### Backend example env

`apps/api/.env.example` should include at least:

- `NODE_ENV=development`
- `APP_ENV=development`
- `API_HOST=0.0.0.0`
- `API_PORT=3000`
- `APP_DISPLAY_NAME=Event App`

You may also include future-facing placeholders such as `DATABASE_URL` and `REDIS_URL`, but do not require them at runtime yet.

### Mobile example env

`apps/mobile/.env.example` should include at least one placeholder for the API base URL, for example:

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`

Add only what is needed for a minimal shell.

### Env constraints

- no real secrets;
- no real credentials;
- use obvious placeholder values only.

---

## 7) Local development documentation

Create:

- `docs/local-development.md`

Because the root `README.md` is immutable, all setup detail must go into `docs/`.

### `docs/local-development.md` must include

1. prerequisites
   - Node
   - pnpm
   - Docker Desktop
2. how to copy env example files
3. how to start local infra
4. how to run backend tests
5. how to start the backend app
6. how to start the mobile app
7. useful local URLs:
   - API health
   - Swagger docs
   - Mailpit UI
8. how to stop local infra

Include commands that are friendly to Windows 11 / PowerShell users.

---

## 8) Formatting and type safety

Use TypeScript across all created packages/apps.

Requirements:

- enable reasonably strict TypeScript settings;
- avoid `any` unless truly unavoidable;
- keep formatting consistent across the repo;
- do not add noisy generated/demo files that are not needed.

If a scaffold generator adds large demo/example files that are irrelevant to this task, prune them.

---

## 9) Acceptance criteria

This task is complete only if all of the following are true:

1. The repository has a functioning pnpm workspace with:
   - `apps/api`
   - `apps/mobile`
   - `packages/shared`

2. Root scripts exist and work for:
   - backend dev
   - mobile dev
   - tests
   - typecheck
   - docker up/down

3. `apps/api` starts successfully in development mode.

4. `GET /api/v1/health` returns `200` and the required JSON shape.

5. Swagger is reachable at `GET /api/docs`.

6. Backend environment validation exists and is covered by automated tests.

7. The required backend tests were written first, observed failing, then made green.

8. `apps/mobile` starts as a minimal Expo shell and shows a placeholder screen/message.

9. `packages/shared` exists as a valid TypeScript workspace package.

10. `compose.yaml` starts PostgreSQL, Redis, and Mailpit successfully.

11. Example env files exist and contain no secrets.

12. `docs/local-development.md` exists and is usable.

13. No auth providers, no domain models, no migrations, and no over-implementation were added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

At minimum, verify the task with commands equivalent to these.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env

docker compose up -d

pnpm --filter @event-app/api test:e2e -- --runInBand
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/shared typecheck

pnpm --filter @event-app/api start:dev
```

Then verify:

- open `http://localhost:3000/api/v1/health`
- open `http://localhost:3000/api/docs`
- open `http://localhost:8025`

Then start the mobile shell:

```powershell
pnpm --filter @event-app/mobile start
```

Optional, only if Android tooling is already installed locally:

```powershell
pnpm --filter @event-app/mobile android
```

Stop infra when done:

```powershell
docker compose down
```

### Bash-friendly flow

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

docker compose up -d

pnpm --filter @event-app/api test:e2e -- --runInBand
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/shared typecheck

pnpm --filter @event-app/api start:dev
```

Then verify:

- `http://localhost:3000/api/v1/health`
- `http://localhost:3000/api/docs`
- `http://localhost:8025`

Then:

```bash
pnpm --filter @event-app/mobile start
docker compose down
```

---

## Implementation notes and guardrails

- The repository-level immutability rules from the run prompt still apply.
- Keep the diff focused.
- Do not add future business logic.
- Do not add speculative abstractions.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- If a scaffold tool adds unnecessary examples or template clutter, remove what is not needed.
- Prefer small, obvious code over clever code.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-1` must explicitly include:

1. the exact tests added for the red -> green workflow;
2. the exact failing command(s) that proved the red state;
3. the exact passing command(s) that proved the green state;
4. the final file tree summary at least for:
   - `apps/api`
   - `apps/mobile`
   - `packages/shared`
   - `docs`
5. the exact local URLs that should work after startup.

---

## Definition of done

`EVT-1` is done when a new developer can clone the repo, install dependencies, start Docker Desktop, run the backend tests, boot the API shell, open Swagger, start the Expo shell, and understand the local workflow from `docs/local-development.md` — without any hidden manual steps.

# EVT-23 — Backend logging, audit trail, and basic metrics foundation

## Status
Ready

## Priority
P0

## Depends on
- EVT-22

## Goal

Add the first real observability foundation to the backend.

After this task:

- every API request must have a request ID;
- the API must emit structured request/error logs that are actually useful locally and later in production;
- the API must expose a basic metrics endpoint;
- important organizer actions must be written to a durable audit log table in PostgreSQL.

This task is intentionally about **foundation**, not about dashboards or external monitoring vendors.

---

## Why this task exists now

The product already has real organizer and guest flows.

That means we now need the minimum backend visibility to answer simple but important questions:

- what request failed?
- which user triggered it?
- how long did it take?
- what action changed event state?
- can we inspect a durable record of important organizer actions later?

The user explicitly wants logging, audit, and metrics to be mandatory. This task introduces the first version of all three.

---

## Scope

This task must implement all of the following:

1. **Request ID foundation**
   - accept incoming `x-request-id` if present and non-empty;
   - otherwise generate a new request ID;
   - expose the final request ID on the response header `x-request-id`;
   - make the request ID available to backend code handling the request.

2. **Structured HTTP logging**
   - log one structured line for completed requests;
   - log one structured line for unhandled errors / error responses;
   - include enough fields to make the logs useful locally.

3. **Basic metrics endpoint**
   - expose `GET /api/v1/metrics`;
   - return Prometheus text format;
   - track basic HTTP request count and duration.

4. **Durable audit trail**
   - add a new DB table for audit logs;
   - write audit rows for selected organizer actions listed below.

This task is backend-only.

Do **not** change mobile code in EVT-23.

---

## Out of scope

The following are explicitly out of scope:

- external logging vendors (Sentry, Datadog, New Relic, etc.);
- external metrics backends / Grafana dashboards / Prometheus server deployment;
- distributed tracing / OpenTelemetry export;
- user-facing audit-log screens;
- background worker metrics;
- guest RSVP audit rows;
- security-event alerting;
- production infra automation.

---

## Required design decisions

These are mandatory for this task:

1. Metrics endpoint path must be:
   - `GET /api/v1/metrics`

2. Metrics response content type must be Prometheus text format.

3. The audit trail must use a **new Prisma model + new migration**.

4. Audit rows must be written only for these organizer actions in this task:
   - event created
   - event updated
   - reminders replaced
   - invite link created/reused
   - current invite link revoked

5. Audit rows must **not** store invite tokens, full invite URLs, or guest PII.

6. The logging output must be structured JSON or JSON-like object logging, not ad-hoc plain English strings.

7. Keep local development simple:
   - logs go to stdout/stderr;
   - metrics are in-process;
   - no extra infrastructure service is required.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red → green.

### Required tests to add first

Add or update tests before production implementation:

1. **Request ID / metrics integration suite**
   - verifies request ID is echoed back when provided;
   - verifies request ID is generated when missing;
   - verifies `GET /api/v1/metrics` returns 200 text/plain-ish output;
   - verifies hitting at least one normal API route causes metrics output to include the expected HTTP metric names.

2. **Audit log integration suite**
   - verifies organizer actions listed in this task create audit rows in DB;
   - verifies rows contain expected action names, actor user id, entity id, request id, and metadata;
   - verifies sensitive values such as invite token / full invite URL are not persisted in metadata.

3. You may add one tiny unit test for helper formatting / sanitization if needed, but keep the emphasis on integration behavior.

### Required red-state commands

Run the smallest relevant commands first and observe failure before production code is implemented.

Examples of acceptable initial failure reasons:

- metrics endpoint does not exist;
- request ID response header does not exist;
- audit log table/model does not exist;
- organizer actions do not write audit rows yet.

### Required green-state commands

After implementation, rerun the targeted tests and then the broader relevant backend test suites.

### Forbidden shortcuts

Do not:

- weaken the assertions to avoid checking request IDs / metrics / audit rows;
- skip DB verification for audit rows;
- store secrets in audit metadata just to satisfy the test;
- implement fake in-memory audit logs.

---

## Detailed implementation requirements

## 1) Request ID foundation

Add a backend mechanism that guarantees every request handled by the API has a request ID.

### Request ID behavior

- If request header `x-request-id` is present and non-empty after trimming, reuse it.
- Otherwise generate a new request ID.
- Put the final value into the response header `x-request-id`.
- Make the value accessible to code during the request lifecycle.

### Constraints

- Keep the implementation framework-native and simple.
- Do not introduce a heavyweight correlation-id package unless absolutely necessary.
- The request ID must work for normal controllers already in the app.

---

## 2) Structured HTTP logging

Add structured request logging for completed requests.

### Required log fields

Every completed request log entry must include at least:

- `type` (or similar fixed field identifying this as HTTP request log)
- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `appEnv`
- `userId` when organizer auth is present, otherwise `null`

### Error logging

Unhandled errors / framework-level error responses must also produce structured logs including at least:

- `type`
- `requestId`
- `method`
- `path`
- `statusCode`
- `errorName`
- `message`

### Logging constraints

- Do not log full request bodies blindly.
- Do not log invite tokens.
- Do not log full guest emails in any new logging code.
- Keep logs human-readable enough in local terminal output, but structured enough to parse later.

---

## 3) Metrics endpoint

Expose a basic in-process metrics endpoint.

### Required endpoint

- `GET /api/v1/metrics`

### Required response behavior

- return `200`;
- return Prometheus text format;
- content type should be appropriate for Prometheus scraping.

### Required metrics

At minimum expose:

1. **HTTP request counter**
   - total number of requests processed
   - labels should include at least method + route/path template + status family or status code

2. **HTTP request duration metric**
   - histogram or equivalent duration metric
   - labels should include at least method + route/path template

Use a simple and standard Node metrics library appropriate for Prometheus exposition.

### Metrics constraints

- No auth required in this task.
- Keep the endpoint local/dev friendly.
- Do not add app-business metrics yet beyond audit write counter if you really want a tiny extra one.

---

## 4) Audit log persistence

Add a new Prisma model and migration for durable audit rows.

### Required new table/model

Create a model like `AuditLog` (exact naming may vary, but keep it obvious).

Required columns/fields:

- `id`
- `actorUserId` (nullable only if absolutely necessary; for this task organizer actions should populate it)
- `action`
- `entityType`
- `entityId`
- `requestId`
- `metadataJson` (JSON / Json field)
- `createdAt`

Use snake_case DB mappings consistent with the existing schema style.

### Indexes

Add practical indexes for at least:

- `actorUserId`
- `entityType + entityId`
- `createdAt`

### Metadata rules

Metadata must be small and safe.

Allowed examples:

- changed field names
- capacity before/after
- reminder offsets count
- invite link action result (`created` vs `reused`)
- event title length / whether description present

Do **not** store:

- invite tokens
- invite URLs
- guest emails
- raw request body dumps

---

## 5) Organizer actions that must write audit rows

Write audit rows for these actions only:

### A) Event create
Action name should clearly communicate event creation, for example:
- `event.created`

Minimum metadata suggestion:
- fields present: title / description / location / startsAt / timezone / capacityLimit
- no raw guest data because none exists here

### B) Event update
Action name example:
- `event.updated`

Minimum metadata suggestion:
- changed field names
- whether startsAt changed
- whether capacityLimit changed
- no full body dump required

### C) Event reminders replace
Action name example:
- `event.reminders.replaced`

Minimum metadata suggestion:
- reminder count
- offsetsMinutes array

### D) Invite link create/reuse
Action name example:
- `event.invite_link.upserted`

Minimum metadata suggestion:
- result: `created` or `reused`
- event id
- do not include token/url

### E) Invite link revoke
Action name example:
- `event.invite_link.revoked`

Minimum metadata suggestion:
- result: `revoked` or `noop`
- event id
- do not include token/url

---

## 6) Code organization expectations

Keep the implementation clean and unsurprising.

Reasonable structure examples:

- `src/observability/...`
- `src/logging/...`
- `src/metrics/...`
- `src/audit/...`

Exact folder names are up to you, but avoid scattering this logic randomly.

Prefer small focused services/helpers over giant utility files.

---

## 7) Acceptance criteria

This task is complete only if all of the following are true:

1. Every API request returns an `x-request-id` header.
2. Supplying an incoming `x-request-id` causes that same value to be echoed back.
3. `GET /api/v1/metrics` returns 200 with Prometheus-style metrics text.
4. After hitting one or more API endpoints, the metrics output includes the configured HTTP metric names.
5. A new audit log table/model exists via Prisma migration.
6. Organizer actions required by this task write audit rows durably to Postgres.
7. Audit metadata excludes invite tokens, invite URLs, and guest emails.
8. Existing backend tests still pass.
9. The new targeted tests are green.
10. No mobile code is changed.

---

## Required manual verification steps

Document the exact commands in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:migrate:test

pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/request-id-metrics.integration-spec.ts test/audit-log.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api test:unit
pnpm --filter @event-app/api test:e2e
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Then manually verify:

1. `GET http://localhost:3000/api/v1/health` returns an `x-request-id` header.
2. `GET http://localhost:3000/api/v1/metrics` returns text with metric names.
3. Sending a custom `x-request-id` keeps the same value in the response header.
4. Creating/updating an event and revoking invite link succeeds normally.
5. Audit rows are present in DB for those actions.

Optional DB inspection:

```powershell
pnpm --filter @event-app/api db:studio
```

Stop infra when done:

```powershell
docker compose down
```

---

## Files expected to be added or changed

The exact list may vary, but expect changes in areas like:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/...`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- new files under observability/logging/metrics/audit folders
- selected event/invite services where audit rows are written
- new integration test files
- `docs/local-development.md`

---

## Final report requirements for this task

In addition to the global run prompt, the final report must explicitly include:

1. the exact metric names introduced;
2. the exact audit action names introduced;
3. an example `x-request-id` round-trip result;
4. a list of organizer actions that now write audit rows;
5. confirmation that invite tokens / URLs are not persisted in audit metadata.

---

## Definition of done

`EVT-23` is done when the backend has visible request IDs, useful structured logs, a scrapeable metrics endpoint, and a durable audit trail for the main organizer mutations already present in the product.

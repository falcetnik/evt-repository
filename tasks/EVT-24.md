# EVT-24 — Fix observability error status reporting for handled HTTP errors

## Status
Ready

## Priority
P0

## Depends on
- EVT-23

## Goal

Fix the new backend observability layer so it reports the **real HTTP status code** for handled application errors.

Right now the project logs and likely records metrics like this for expected application errors:

- `NotFoundException` logged as `statusCode: 500`
- `BadRequestException` logged as `statusCode: 500`
- `UnauthorizedException` may also be logged as `statusCode: 500`

This is wrong.

These are normal handled HTTP errors and must be reported with their real status codes:

- 400
- 401
- 404
- and any other handled `HttpException` status

This task is a focused observability bugfix. It is **not** a product-feature task.

---

## Why this task exists now

The new logging/metrics layer from EVT-23 is now active, and your local test output already shows the bug clearly.

Example of the current wrong behavior:

- `NotFoundException` is emitted in logs as `statusCode: 500`
- `BadRequestException` is emitted in logs as `statusCode: 500`

That makes logs misleading and metrics inaccurate.

Because logging and metrics are mandatory for this project, this bug should be fixed before adding more backend observability features.

---

## Out of scope

Do **not** do any of the following in this task:

- add new business endpoints;
- change domain behavior of existing APIs;
- change audit schema or audit event names;
- add tracing systems or external observability vendors;
- redesign the logger format;
- add frontend/mobile changes;
- change README.md or files under `tasks/`.

This task is only about **correct HTTP status reporting in observability**.

---

## Bug to fix

The current interceptor behavior uses the wrong status code source for handled exceptions during error logging/metrics.

Typical broken behavior:

- request throws `NotFoundException`
- framework eventually returns HTTP 404 to the client
- observability layer logs/records 500 instead of 404

The same problem can happen for 400 and 401.

The fix must ensure:

- if the error is an instance of Nest `HttpException`, observability uses `error.getStatus()`;
- otherwise it may fall back to response status or 500 for truly unexpected failures.

---

## Required implementation

## 1) Extract and centralize status-code resolution

Create or update a small pure helper in the observability layer that resolves the status code used for logging/metrics when an error occurs.

Expected behavior:

1. if `error` is a Nest `HttpException`, return `error.getStatus()`;
2. otherwise, if the current response status is already a valid error code (>= 400), use that;
3. otherwise, return 500.

Keep this logic tiny and obvious.

### Important

Do not duplicate this logic in multiple places. There should be one clear implementation used by the interceptor.

---

## 2) Fix the interceptor

Update the HTTP observability interceptor so that:

- request success logs still behave as before;
- error logs use the resolved status code from the helper;
- metrics also use the same resolved status code;
- the interceptor does not swallow or rewrite the actual exception behavior.

In other words:

- client behavior must remain unchanged;
- only observability correctness is being fixed.

---

## 3) Metrics must reflect the correct status code too

This task is not complete if only logs are fixed.

The Prometheus metrics exposed at `/api/v1/metrics` must also reflect the correct status code labels/counts for handled application errors.

At minimum, after this task:

- a 404 request must increment the metric under 404, not 500;
- a 400 request must increment the metric under 400, not 500;
- a 401 request must increment the metric under 401, not 500.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red -> green.

### Tests to add or update first

Add or update tests that prove the bug and then prove the fix.

Required coverage:

1. **Pure unit test for status resolution helper**
   - handled `NotFoundException` => 404
   - handled `BadRequestException` => 400
   - handled `UnauthorizedException` => 401
   - unexpected non-HTTP error => 500
   - fallback to existing error response status when appropriate

2. **Integration test for observability correctness**
   This test must exercise real endpoints and verify that logs and metrics use the correct status code.

   At minimum verify these real cases:
   - 404 via existing endpoint behavior (for example unknown invite token or unknown event)
   - 400 via existing validation error (for example invalid scope)
   - 401 via existing missing/unknown organizer header behavior

### Red-state requirement

Before fixing the production code, run the smallest relevant test command(s) and confirm failure.

Examples of acceptable red reasons:

- helper returns 500 instead of 404/400/401;
- metrics expose 500 counts where 404/400/401 were expected;
- error log payload contains `statusCode: 500` for handled exceptions.

### Green-state requirement

After implementation, rerun the relevant tests and confirm they pass.

---

## Detailed testing requirements

## 1) Unit test for pure status resolver

Create a new unit test file if needed, for example:

- `apps/api/test/http-error-status.util.spec.ts`

This file should directly test the pure helper without bootstrapping Nest.

Required assertions:

- `new NotFoundException()` resolves to 404
- `new BadRequestException()` resolves to 400
- `new UnauthorizedException()` resolves to 401
- `new Error('boom')` resolves to 500 when no valid error response status exists
- when no `HttpException` exists but `response.statusCode` is already >= 400, that status can be used as fallback

---

## 2) Integration test for logs + metrics

Add a new integration suite or extend the existing `request-id-metrics.integration-spec.ts`.

This integration coverage must verify the real app behavior.

### Required verification strategy

Use existing failing endpoints/flows that already exist in the system.

You may spy on `console.error` and/or `console.log` during the test to inspect structured log payloads.

You must verify that the emitted error log JSON contains the correct status code for:

- 404 case
- 400 case
- 401 case

You must also verify metrics exposition after those requests so the corresponding metric labels/counters reflect the same correct status codes.

### Important

This must be done with real HTTP calls through the app, not by unit-testing the interceptor internals only.

---

## Files likely to change

Most likely files include some subset of:

- `apps/api/src/observability/http-observability.interceptor.ts`
- `apps/api/src/observability/...` helper file for status resolution
- `apps/api/test/request-id-metrics.integration-spec.ts`
- `apps/api/test/http-error-status.util.spec.ts` (new)

Do not change unrelated business modules unless absolutely necessary.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. Handled Nest `HttpException` errors are logged with their real status code.
2. Handled Nest `HttpException` errors are recorded in metrics with their real status code.
3. Existing client-visible API behavior is unchanged.
4. A 404 scenario is observed as 404 in logs/metrics, not 500.
5. A 400 scenario is observed as 400 in logs/metrics, not 500.
6. A 401 scenario is observed as 401 in logs/metrics, not 500.
7. Unexpected non-HTTP errors still resolve to 500.
8. All existing tests remain green.
9. New tests proving the bugfix are added and green.

---

## Local verification commands

Use commands equivalent to these and report what was run.

### PowerShell-friendly

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:test

pnpm --filter @event-app/api test -- --runTestsByPath test/http-error-status.util.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/request-id-metrics.integration-spec.ts

pnpm --filter @event-app/api test:unit
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api test:e2e
pnpm --filter @event-app/api typecheck
```

Then stop infra when done:

```powershell
docker compose down
```

---

## Final report requirements for this task

In addition to the standard report, explicitly include:

1. the exact helper file used for HTTP error status resolution;
2. which 404 case was used in the integration test;
3. which 400 case was used in the integration test;
4. which 401 case was used in the integration test;
5. how logs were asserted;
6. how metrics were asserted.

---

## Definition of done

`EVT-24` is done when your backend no longer lies in logs/metrics about handled HTTP errors, and both unit + integration tests prove that 400/401/404 are reported as 400/401/404 rather than 500.

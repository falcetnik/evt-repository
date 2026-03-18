# EVT-5 — Public RSVP submission and organizer attendee list

## Status
Ready

## Priority
P0

## Depends on
- EVT-2
- EVT-3
- EVT-4

## Goal

Implement the first real RSVP flow for the product.

This task must add:

- a **public RSVP submission endpoint** that works through an invite-link token;
- **idempotent attendee upsert behavior** per event + guest email;
- an **organizer-only attendee list endpoint** for a single event;
- RSVP summary counts that can be shown on the public invite page;
- automated tests proving the behavior through a strict test-first workflow.

This task is the first backend slice that turns invite links into real attendee data.

---

## Why this task exists now

After EVT-4, the system can:

- create organizer-owned events;
- create/reuse invite links;
- resolve a public invite link into a safe event payload.

But the core product is still missing the main action: **a guest must be able to respond to an event**.

EVT-5 adds that missing step and gives organizers their first attendee list and RSVP counts.

---

## Product scope for this task

For EVT-5, RSVP is intentionally limited to a simple, explicit guest flow:

- the guest opens an invite link;
- the guest submits:
  - name,
  - email,
  - RSVP status;
- the backend creates or updates exactly one attendee record for that event + email;
- the organizer can list attendees for their own event;
- the public invite-resolution payload includes RSVP summary counts.

This task does **not** implement capacity enforcement or waitlist logic yet.
Those come later.

---

## Fixed implementation decisions for this task

These decisions are mandatory for EVT-5:

1. Public RSVP submission happens via:
   - `POST /api/v1/invite-links/:token/rsvp`
2. Organizer attendee list happens via:
   - `GET /api/v1/events/:eventId/attendees`
3. Public invite resolution remains:
   - `GET /api/v1/invite-links/:token`
   and must be extended in this task to include RSVP summary counts.
4. Public RSVP for EVT-5 requires **all three** fields:
   - `guestName`
   - `guestEmail`
   - `status`
5. `guestEmail` is required in EVT-5 and is the stable identity used for idempotent upsert **within one event**.
6. `guestEmail` must be normalized to lowercase before persistence and uniqueness checks.
7. RSVP status values exposed at the API boundary must be exactly:
   - `going`
   - `maybe`
   - `not_going`
8. This task must **not** enforce event capacity yet.
   - Even if `capacityLimit` exists on the event, a `going` RSVP is still accepted.
   - No waitlist behavior is allowed in EVT-5.
9. Public RSVP endpoints are **unauthenticated**.
10. Organizer attendee-list endpoints remain protected by the existing development/test auth shim.

---

## Out of scope

The following are explicitly out of scope for EVT-5:

- waitlist logic;
- capacity enforcement;
- plus-ones;
- attendee comments/notes;
- RSVP editing by attendee-specific secret token;
- attendee deletion/cancellation endpoint;
- organizer attendee manual edits;
- guest self-profile system;
- authenticated end-user accounts;
- mobile UI implementation;
- reminder scheduling;
- payments/deposits.

If any of the above appears, it is over-implementation and should be removed.

---

## Required API surface after this task

After EVT-5, the backend must support these routes.

### 1) Public invite resolution

`GET /api/v1/invite-links/:token`

Still public.

It must continue to resolve only active + usable invite links.
For valid links it must now include RSVP summary counts in the response.

### 2) Public RSVP submission

`POST /api/v1/invite-links/:token/rsvp`

Public, no auth header.

Creates or updates the RSVP for exactly one guest identified by event + normalized email.

### 3) Organizer attendee list

`GET /api/v1/events/:eventId/attendees`

Organizer-only via the existing dev/test auth shim.

Returns summary counts plus the attendees list for that event.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Do not implement the final production behavior until the required tests exist and the red state has been observed.

### Required tests to add first

Add these tests before final implementation:

1. **RSVP DTO / validation unit test**
   - validates trim + normalization behavior;
   - validates accepted status values;
   - validates invalid email rejection;
   - validates blank required values rejection.

2. **DB-backed RSVP integration test suite**
   - create RSVP through public invite link;
   - update existing RSVP for the same event + email without creating duplicates;
   - return 404 for missing/inactive/expired invite links;
   - organizer attendee list returns counts and attendees for owner;
   - non-owner organizer gets 404 for attendee list;
   - public invite resolution includes updated RSVP summary counts.

You may add one small extra helper/unit test only if it directly supports this task, but do not add speculative coverage.

### Red-state requirement

Before final production implementation, run the smallest relevant test commands and confirm they fail for expected reasons such as:

- DTO module/validation not implemented yet;
- route not implemented yet;
- RSVP summary not returned yet;
- attendee upsert behavior not implemented yet.

### Green-state requirement

After implementation, rerun the relevant tests and ensure they pass.

### Forbidden shortcuts

Do not:

- weaken assertions;
- skip or todo tests;
- remove the new tests after observing red;
- bypass failures by loosening validation or changing expected behavior away from this spec.

---

## Detailed implementation requirements

## 1) RSVP persistence model

Read the current Prisma schema and existing migration history first.

Implement the RSVP persistence required by this task using the **existing schema if it already supports the contract**.
If it does **not** support the contract, add **one new Prisma migration** with the minimum schema change necessary.

### Required persistence contract

The final data model used by EVT-5 must support all of the following facts:

- an attendee belongs to exactly one event;
- an attendee stores guest name;
- an attendee stores guest email;
- an attendee stores RSVP status;
- one event cannot have duplicate attendee rows for the same normalized guest email;
- attendee records track creation/update timestamps.

### Required uniqueness rule

There must be a database-enforced uniqueness rule equivalent to:

- unique attendee per `eventId + normalized guestEmail`

Use the most minimal schema shape that satisfies this.

### Status values

The domain/persistence layer must support exactly these logical RSVP statuses:

- `going`
- `maybe`
- `not_going`

You may map them to uppercase enum values internally if that matches existing Prisma conventions, but the API surface must use the lowercase snake_case values above.

### Migration rule

If a schema change is needed:

- add a new Prisma migration;
- do not edit existing migrations;
- keep the migration narrow and reviewable.

---

## 2) Public RSVP submission endpoint

Implement:

`POST /api/v1/invite-links/:token/rsvp`

This endpoint is public.
It must **not** require `x-dev-user-id`.

### Request body contract

The request JSON body must be:

```json
{
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going"
}
```

### Required validation rules

#### `guestName`

- required;
- string;
- trim whitespace;
- after trimming must be non-empty;
- max length: 80.

#### `guestEmail`

- required;
- string;
- trim whitespace;
- lowercase before persistence;
- must be a syntactically valid email;
- max length: 320.

#### `status`

- required;
- must be exactly one of:
  - `going`
  - `maybe`
  - `not_going`

#### Unknown fields

Unknown fields must continue to be rejected with `400` by the existing global validation rules.

### Invite-link resolution rules

The endpoint must resolve the invite link using the same safety rules as public invite resolution:

- token must exist;
- link must be active;
- link must not be expired;
- linked event must be usable.

If the link is not usable, return `404` with a safe generic message.

Do not leak whether the token exists but is inactive/expired.

### Upsert behavior

RSVP submission must be idempotent per event + normalized email.

Behavior:

- if no attendee exists yet for this event + normalized email:
  - create attendee;
  - return `201`;
- if attendee already exists for this event + normalized email:
  - update the existing row’s name and status;
  - keep the same attendee identity;
  - return `200`;
- do not create duplicate rows for the same event + normalized email.

### Required response contract

The endpoint must return JSON with at least:

- `attendeeId`
- `eventId`
- `guestName`
- `guestEmail`
- `status`
- `createdAt`
- `updatedAt`

Example created response:

```json
{
  "attendeeId": "att_123",
  "eventId": "evt_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "createdAt": "2026-03-20T10:00:00.000Z",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

Do not include organizer-private fields.

### Swagger/OpenAPI

Document this endpoint in Swagger.

---

## 3) Organizer attendee list endpoint

Implement:

`GET /api/v1/events/:eventId/attendees`

This endpoint must be organizer-only using the existing dev/test auth shim.

### Ownership rules

- if the event does not exist, return `404`;
- if the event exists but is not owned by the current organizer, also return `404`;
- do not leak event existence to non-owners.

### Required response shape

Return JSON with exactly this logical structure:

```json
{
  "eventId": "evt_123",
  "summary": {
    "going": 3,
    "maybe": 1,
    "notGoing": 2,
    "total": 6
  },
  "attendees": [
    {
      "attendeeId": "att_123",
      "guestName": "Nikita",
      "guestEmail": "nikita@example.com",
      "status": "going",
      "createdAt": "2026-03-20T10:00:00.000Z",
      "updatedAt": "2026-03-20T10:00:00.000Z"
    }
  ]
}
```

### Summary rules

The summary object must include exactly:

- `going`
- `maybe`
- `notGoing`
- `total`

Map persistence status values into these API fields consistently.

### Sorting rules

Return attendees in a deterministic order.

Required order:

1. ascending by `createdAt`
2. tie-break by `attendeeId` ascending if needed

Keep the ordering simple and stable.

### Swagger/OpenAPI

Document this endpoint in Swagger, including the required dev auth header.

---

## 4) Extend public invite-resolution response

Update the existing public endpoint:

`GET /api/v1/invite-links/:token`

For a valid invite link, extend the response to include:

```json
"rsvpSummary": {
  "going": 3,
  "maybe": 1,
  "notGoing": 2,
  "total": 6
}
```

### Rules

- keep the endpoint public;
- keep the existing safe event payload behavior;
- do not add organizer-private attendee details here;
- only add the aggregate summary counts.

### Count source of truth

The summary must be computed from stored attendee rows for the linked event.

---

## 5) Validation and mapping details

### DTO normalization

Normalize inputs consistently:

- trim `guestName`;
- trim + lowercase `guestEmail`;
- leave `status` exactly as accepted enum/string values.

### API output mapping

Return these exact API status strings:

- `going`
- `maybe`
- `not_going`

### Timestamp serialization

All timestamps in API responses must be serialized as ISO strings.

### Naming rules

Use `notGoing` only in summary objects.
Use `not_going` for individual attendee RSVP status values.

This distinction is required.

---

## 6) Error behavior

### Public RSVP and public invite resolution

For invalid/missing/inactive/expired invite links:

- return `404`;
- use a safe generic message;
- do not distinguish token states in the response.

### Organizer attendee list

- missing auth header in development/test: `401` via the existing dev auth behavior;
- unknown dev user: `401` via the existing dev auth behavior;
- event not found or not owned by current organizer: `404`.

### Validation errors

Invalid request bodies must return `400`.

Examples:

- invalid email;
- blank name;
- unsupported status;
- unknown request fields.

---

## 7) Required scripts / local workflow support

If the new/updated tests need additional scripts or small helpers, add them.

Keep scripts minimal and consistent with the existing repo.

Do not introduce unrelated tooling.

If seed helpers are needed for integration tests or local manual verification, keep them deterministic and focused.

---

## 8) Documentation updates

Update `docs/local-development.md` with the minimal new information needed for EVT-5.

It must include:

- how to run the new RSVP-related tests;
- how to manually create an event + invite link + RSVP locally;
- how to fetch the organizer attendee list;
- how to verify public invite summary counts.

Use Windows 11 / PowerShell-friendly commands.

Because `README.md` is immutable, do not modify it.

---

## 9) Acceptance criteria

This task is complete only if all of the following are true:

1. A guest can submit a public RSVP through `POST /api/v1/invite-links/:token/rsvp`.
2. The request requires `guestName`, `guestEmail`, and `status`.
3. `guestEmail` is normalized to lowercase.
4. Re-submitting the same email for the same event updates the existing attendee instead of creating a duplicate.
5. Missing/inactive/expired invite links return `404` from the public RSVP endpoint.
6. `GET /api/v1/events/:eventId/attendees` returns organizer-only attendee data.
7. Non-owners receive `404` for organizer attendee list access.
8. The organizer attendee-list response includes the required summary object and attendee list.
9. `GET /api/v1/invite-links/:token` includes `rsvpSummary` counts.
10. Required tests were written first, observed failing, then made green.
11. Any schema change was implemented as a new Prisma migration only if needed.
12. No waitlist/capacity logic was added.
13. No auth-provider work was added.
14. No mobile UI work was added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

At minimum, verify with commands equivalent to the following.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user

pnpm --filter @event-app/api test -- --runTestsByPath test/rsvp.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/rsvp.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Then manually verify with a flow equivalent to:

1. Create an event as the seeded organizer via `POST /api/v1/events`.
2. Create or fetch an invite link via `POST /api/v1/events/:eventId/invite-link`.
3. Resolve the public invite via `GET /api/v1/invite-links/:token` and note the initial `rsvpSummary`.
4. Submit an RSVP via `POST /api/v1/invite-links/:token/rsvp`.
5. Submit again with the same email but a different status and verify update semantics.
6. Call `GET /api/v1/events/:eventId/attendees` as the organizer and verify:
   - summary counts,
   - attendee list,
   - no duplicate rows for the same email.
7. Resolve `GET /api/v1/invite-links/:token` again and verify the updated `rsvpSummary`.

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

pnpm --filter @event-app/api test -- --runTestsByPath test/rsvp.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/rsvp.integration-spec.ts
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

---

## Implementation notes and guardrails

- Reuse the existing invite-link validity logic rather than duplicating inconsistent rules.
- Reuse existing dev auth behavior for organizer-only routes.
- Keep the public RSVP flow intentionally simple.
- Do not introduce attendee-secret management yet.
- Do not introduce capacity checks yet.
- Do not introduce waitlist status yet.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- Keep the diff focused and reviewable.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for EVT-5 must explicitly include:

1. whether a new Prisma migration was needed;
2. the exact uniqueness rule used to prevent duplicate attendee rows;
3. the exact RSVP request body contract;
4. the exact organizer attendee-list response shape;
5. one sample `rsvpSummary` payload;
6. the exact red-state commands and the exact green-state commands.

---

## Definition of done

EVT-5 is done when a public guest can respond to a valid invite link with name + email + status, repeated submissions from the same email update the same attendee record for that event, organizers can list attendees for their own events, and public invite resolution shows accurate RSVP summary counts — all backed by test-first implementation.

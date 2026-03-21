# EVT-19 — Organizer current invite-link read API

## Status
Ready

## Priority
P1

## Depends on
- EVT-4
- EVT-17

## Goal

Add an organizer-only backend endpoint that lets the mobile app read the **current usable invite link** for an event without creating a new token.

This task exists so the mobile event-details screen can later load persisted invite-link state when reopened, instead of always starting from a local idle state.

---

## Why this task exists now

We already have:

- organizer create/reuse invite-link API;
- public invite resolution API;
- mobile invite-link create/share/preview flow.

What is still missing is a safe read endpoint for the organizer to ask:

- “does this event currently have a usable invite link?”
- “if yes, what is the existing token/url I should display?”

Without this, the mobile client cannot restore invite-link state from the backend on a fresh app session or when reopening event details.

---

## Out of scope

The following are explicitly out of scope for EVT-19:

- deactivating invite links;
- rotating/reissuing tokens;
- changing expiry rules;
- invite-link analytics;
- reminder logic;
- RSVP logic;
- mobile UI changes;
- auth provider work;
- migrations or schema changes, unless absolutely required (they should not be required).

This task is backend-only.

---

## Required endpoint

Add a new organizer-only endpoint:

- `GET /api/v1/events/:eventId/invite-link`

This endpoint must:

- require existing dev organizer auth (`x-dev-user-id`);
- verify organizer ownership of the event;
- return the current **usable** invite link for that event, if one exists;
- return a non-error success response when the event exists but no usable invite link is available.

---

## Definition of “current usable invite link”

For EVT-19, a link is considered usable only when:

- `isActive = true`
- and `expiresAt IS NULL OR expiresAt > now`

Important:

- inactive links are **not** usable;
- expired links are **not** usable;
- if multiple usable links somehow exist, choose deterministically:
  - newest `createdAt` first;
  - if tied, highest `id` last tie-break is acceptable, but use a deterministic order.

This endpoint must **not** create a new link.

---

## Response contract

### Success when event exists and organizer owns it

Always return `200 OK`.

Body shape:

```json
{
  "eventId": "evt_123",
  "inviteLink": {
    "eventId": "evt_123",
    "token": "abc123",
    "url": "http://localhost:3000/api/v1/invite-links/abc123",
    "isActive": true,
    "expiresAt": null,
    "createdAt": "2026-03-25T10:00:00.000Z"
  }
}
```

If no usable invite link exists, return:

```json
{
  "eventId": "evt_123",
  "inviteLink": null
}
```

### Error responses

- `401` for missing or unknown `x-dev-user-id`
- `404` if the event does not exist or is not owned by the organizer

Do **not** return `404` merely because there is no current usable invite link. That case must be represented as `200` with `inviteLink: null`.

---

## API behavior requirements

### Organizer ownership

Use the existing owner-only behavior already established for organizer event APIs.

If the event is not owned by the organizer, return:

- `404 Event not found`

### URL generation

The returned `inviteLink.url` must be built consistently with the existing invite-link URL generation logic already used by the create/reuse endpoint.

Do not duplicate a second incompatible URL-building implementation.

### Reuse existing invite-link response shape

The nested `inviteLink` object should reuse the same shape already returned by organizer create/reuse invite-link responses:

- `eventId`
- `token`
- `url`
- `isActive`
- `expiresAt`
- `createdAt`

This keeps backend contracts consistent and will simplify later mobile usage.

---

## Required implementation details

### Controller

Update the appropriate controller so that:

- `GET /api/v1/events/:eventId/invite-link` exists;
- it is protected by the existing dev auth guard;
- Swagger metadata documents:
  - required `x-dev-user-id` header,
  - `200`, `401`, `404` responses.

### Service

Add a dedicated service method for current invite-link lookup.

The service method must:

1. verify organizer ownership of the event;
2. query invite links for that event;
3. select the newest usable link deterministically;
4. return either:
   - `{ eventId, inviteLink }`
   - or `{ eventId, inviteLink: null }`

### Query semantics

You may implement this either by:

- filtering directly in Prisma query (`isActive`, `expiresAt > now OR null`) and ordering;
- or reading a small candidate set then applying logic in service.

Prefer the most direct, readable approach.

### Shared mapping

If invite-link mapping logic already exists for organizer create/reuse responses, reuse it rather than creating a divergent mapper.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red -> green.

### Tests to add first

Add a new DB-backed integration suite:

- `apps/api/test/events-current-invite-link.integration-spec.ts`

This suite must cover at minimum:

1. returns `200` with `inviteLink: null` when owned event has no invite link
2. returns current usable invite link when one exists
3. returns `inviteLink: null` for inactive link
4. returns `inviteLink: null` for expired link
5. returns the newest usable link if multiple usable links exist
6. returns `401` for missing `x-dev-user-id`
7. returns `401` for unknown `x-dev-user-id`
8. returns `404` for event owned by someone else
9. returns `404` for missing event

You may add one tiny helper test if required, but do not broaden scope.

### Required red-state command

Before implementing production code, run at least:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-current-invite-link.integration-spec.ts
```

The initial run must fail for the expected reason that the endpoint/behavior does not yet exist.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-current-invite-link.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck
```

Do not claim completion if the new integration suite is not green locally.

---

## No schema change expected

This task should not require a Prisma schema change or migration.

Use the existing invite-link table/model.

If you believe a migration is necessary, stop and justify it explicitly in the final report.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `GET /api/v1/events/:eventId/invite-link` exists.
2. Endpoint is organizer-only and requires `x-dev-user-id`.
3. Owned event with no usable link returns `200` and `{ eventId, inviteLink: null }`.
4. Owned event with usable link returns `200` and the correct nested invite-link object.
5. Inactive links are treated as unavailable.
6. Expired links are treated as unavailable.
7. If multiple usable links exist, the newest usable one is returned deterministically.
8. Missing/unknown organizer header returns `401`.
9. Non-owned or missing event returns `404`.
10. No new migrations were added.
11. New integration tests were written first, observed failing, then made green.
12. Full API integration suite remains green locally.

---

## Local verification commands (PowerShell-friendly)

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:migrate:test
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/events-current-invite-link.integration-spec.ts
pnpm --filter @event-app/api test:integration
pnpm --filter @event-app/api typecheck
pnpm --filter @event-app/api start:dev
```

Manual HTTP checks after startup:

```powershell
# existing owned event with no usable link
Invoke-WebRequest -Method GET -Headers @{ "x-dev-user-id" = "organizer-1" } http://localhost:3000/api/v1/events/<EVENT_ID>/invite-link

# missing header
Invoke-WebRequest -Method GET http://localhost:3000/api/v1/events/<EVENT_ID>/invite-link
```

---

## Final report requirements for EVT-19

In addition to the normal run prompt report, explicitly include:

1. exact response shape for:
   - event with current usable link
   - event with no usable link
2. how “usable” was implemented
3. the deterministic tie-break rule used when multiple usable links exist
4. exact red-state command
5. exact green-state commands

---

## Definition of done

EVT-19 is done when the organizer backend can read the current usable invite link for an owned event without creating a new token, with a stable `200 + inviteLink: null` response for the “no current link” case, and the new integration suite is green locally.

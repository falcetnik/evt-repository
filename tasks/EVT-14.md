# EVT-14 — Mobile public invite preview and RSVP submission flow

## Status
Ready

## Priority
P1

## Depends on
- EVT-10
- EVT-12
- EVT-13

## Goal

Extend the Expo mobile app so an organizer can open a **public invite preview screen** inside the app and use the existing backend public endpoints to:

- load a public invite by token;
- see the public event/invite summary exactly as a guest would;
- submit a guest RSVP from mobile;
- refetch the public invite after RSVP so summary counts update;
- do all of the above **without** any backend changes.

This task is mobile-only.

---

## Why this task exists now

We already have:

- organizer event list on mobile;
- organizer event details on mobile;
- create event flow;
- invite-link creation/share on mobile;
- reminder editing on mobile;
- backend public invite + public RSVP endpoints.

What is still missing is the first real **guest-side mobile interaction**. This task creates that first mobile guest flow while keeping scope controlled:

- no deep links yet;
- no navigation library yet;
- no auth changes;
- no backend work.

The public invite screen should be reachable from the existing organizer event-details invite-link success state.

---

## Fixed implementation decisions for this task

These decisions are mandatory:

1. This task is **mobile-only**. Do not change backend files unless there is a proven compile/runtime contract mismatch that blocks implementation.
2. Do **not** add a navigation library.
3. Continue using the existing local-state screen switching pattern in `apps/mobile/App.tsx`.
4. The public invite screen must be opened from the existing event-details invite-link section when invite data already exists.
5. Public invite endpoints must be called **without** organizer dev headers.
6. The screen must use the existing backend public endpoints exactly as they already exist:
   - `GET /v1/invite-links/:token`
   - `POST /v1/invite-links/:token/rsvp`
7. Keep UI simple and functional. Do not attempt a visual redesign in this task.

---

## Out of scope

The following are explicitly out of scope:

- backend changes to invite/RSVP contracts;
- deep links / universal links / URL routing;
- opening invite URLs from outside the app;
- social sharing changes;
- attendee editing by organizer;
- auth or guest accounts;
- comments/chat;
- payment/deposit flows;
- React Navigation / Expo Router migration;
- UI screenshot automation.

If any of the above appears, it is over-implementation and should be removed.

---

## Required backend contracts to use (already exist)

## 1) Public invite resolution

Use:

- `GET /v1/invite-links/:token`

Expected response shape already supported by backend:

```json
{
  "token": "abc123",
  "url": "http://localhost:3000/api/v1/invite-links/abc123",
  "expiresAt": null,
  "event": {
    "title": "Friday Board Games",
    "description": "Bring drinks if you want",
    "location": "Prospekt Mira 10",
    "startsAt": "2026-03-20T16:30:00.000Z",
    "timezone": "Europe/Moscow",
    "capacityLimit": 8,
    "allowPlusOnes": false
  },
  "rsvpSummary": {
    "going": 3,
    "maybe": 1,
    "notGoing": 1,
    "total": 5,
    "confirmedGoing": 2,
    "waitlistedGoing": 1,
    "capacityLimit": 2,
    "remainingSpots": 0,
    "isFull": true
  }
}
```

## 2) Public RSVP submission

Use:

- `POST /v1/invite-links/:token/rsvp`

Request body:

```json
{
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going"
}
```

Allowed `status` values:

- `going`
- `maybe`
- `not_going`

Success responses may be `201` for first submit or `200` for update. The mobile code must accept either.

Success response shape already supported by backend:

```json
{
  "attendeeId": "att_123",
  "eventId": "evt_123",
  "guestName": "Nikita",
  "guestEmail": "nikita@example.com",
  "status": "going",
  "attendanceState": "confirmed",
  "waitlistPosition": null,
  "createdAt": "2026-03-20T10:00:00.000Z",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

The mobile app must not assume only `201` or only `200`.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red -> green.

You must add tests first for the new mobile-only modules before implementing production code.

### Required tests to add first

Add these tests before production implementation:

1. `apps/mobile/src/api/public-invite.test.ts`
   - verifies public invite GET path;
   - verifies public RSVP POST path/body;
   - verifies **no dev organizer header** is sent for public endpoints;
   - verifies 200/201 RSVP success responses are both accepted;
   - verifies typed response passthrough.

2. `apps/mobile/src/features/public-invite/public-rsvp-form-model.test.ts`
   - validates trim + normalization;
   - validates required guestName;
   - validates required guestEmail;
   - validates basic email format rejection;
   - validates status must be one of `going | maybe | not_going`;
   - validates optional success-state reset behavior if your model handles it.

Optional but recommended:

3. `apps/mobile/src/features/public-invite/public-invite-model.test.ts`
   - verifies view-model mapping for description/location/capacity fallbacks;
   - verifies summary labels;
   - verifies waitlist/full-state labels if implemented.

### Required red-state command

Before implementation, run at least:

```powershell
pnpm --filter @event-app/mobile test -- src/api/public-invite.test.ts src/features/public-invite/public-rsvp-form-model.test.ts
```

If you add the optional view-model test, include it too.

The initial red state should fail because the modules do not exist yet or behavior is not implemented yet.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/mobile test -- src/api/public-invite.test.ts src/features/public-invite/public-rsvp-form-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

---

## Detailed implementation requirements

## 1) New mobile public invite API helper

Create:

- `apps/mobile/src/api/public-invite.ts`

This module must export typed helpers for:

### `getPublicInvite(token: string)`

Requirements:

- uses existing mobile HTTP wrapper/utilities;
- performs `GET /v1/invite-links/:token`;
- does **not** send organizer dev header;
- returns typed parsed JSON.

### `submitPublicRsvp(token: string, payload)`

Requirements:

- uses existing mobile HTTP wrapper/utilities;
- performs `POST /v1/invite-links/:token/rsvp`;
- sends JSON body;
- does **not** send organizer dev header;
- accepts both HTTP 200 and HTTP 201 success responses;
- returns typed parsed JSON.

The module should define mobile-local TypeScript types for:

- public invite response;
- RSVP submit payload;
- RSVP submit response.

Keep types small and exact.

---

## 2) New public invite view-model mapper

Create:

- `apps/mobile/src/features/public-invite/public-invite-model.ts`

Purpose:

- convert raw API response into UI-ready text/labels;
- centralize fallback text so `App.tsx` stays readable.

Requirements:

- provide fallback label for missing description:
  - `No description`
- provide fallback label for missing location:
  - `Location not set`
- provide fallback label for no capacity limit:
  - `No limit`
- provide readable expiry label:
  - `No expiry` when `expiresAt` is null
- expose summary fields needed by the screen without repeated inline transformations.

Keep this mapper pure.

---

## 3) New public RSVP form parser/validator

Create:

- `apps/mobile/src/features/public-invite/public-rsvp-form-model.ts`

Purpose:

- normalize text input from the mobile form;
- return explicit validation result for UI use.

### Required input fields

- `guestName`
- `guestEmail`
- `status`

### Validation requirements

`guestName`
- trim whitespace;
- required after trim;
- maximum 80 characters.

`guestEmail`
- trim whitespace;
- lowercase after trim;
- required after trim;
- maximum 320 characters;
- reject obviously invalid email format.

`status`
- required;
- must be exactly one of:
  - `going`
  - `maybe`
  - `not_going`

### Result shape

Use the same explicit style as the create-event form model:

- success result with normalized payload;
- failure result with field errors and a top-level message.

Example acceptable shape:

```ts
{ ok: true, payload: { guestName, guestEmail, status } }
```

or

```ts
{
  ok: false,
  message: 'Please fix the highlighted fields',
  fieldErrors: {
    guestName?: string,
    guestEmail?: string,
    status?: string,
  },
}
```

Keep it deterministic and pure.

---

## 4) Extend `apps/mobile/App.tsx` with a new public invite screen

Continue the existing local-state screen pattern.

### Required screen states

Add a new screen/state for public invite preview, for example conceptually:

- list screen
- details screen
- create screen
- public invite screen

Do **not** add a navigation library.

### Entry point into public invite screen

The public invite screen must be reachable from the existing invite-link section on organizer event details.

When invite-link data is present and successful, provide a visible action such as:

- `Preview invite`

Tapping it should open the public invite screen using the current invite token.

### Public invite screen behavior

When opened:

- fetch public invite by token;
- show loading state;
- show retryable error state if request fails;
- show success state with event details + summary + RSVP form.

### Required UI content on success

Display at least:

- event title;
- description with fallback;
- startsAt;
- timezone;
- location with fallback;
- capacity label;
- invite expiry label;
- summary values:
  - going
  - maybe
  - not going
  - total
  - confirmed going
  - waitlisted going
  - remaining spots
  - is full / not full

Do not over-style this. Keep it simple and readable.

---

## 5) Public RSVP form UX in `App.tsx`

Inside the public invite screen, add a simple RSVP form.

### Required fields

- text input: guest name
- text input: guest email
- status control for:
  - Going
  - Maybe
  - Not going

Simple buttons/toggles are acceptable. No third-party UI library is needed.

### Required behavior

- preserve typed values while editing;
- validate locally before submit using the pure form model;
- show field-level error text when validation fails;
- prevent duplicate submit while request is in flight;
- show loading state during submit;
- on success:
  - show a small success message;
  - keep normalized values in form state;
  - refetch the public invite so summary updates;
  - display returned RSVP result summary line including:
    - selected status
    - attendanceState
    - waitlist position if present
- on failure:
  - keep typed values;
  - show retryable error message;
  - do not clear the screen.

### Success message requirements

After successful submit, show a visible compact success block or text line that includes at least:

- submitted guest name/email;
- resulting status;
- attendance state;
- waitlist position if non-null.

Example acceptable copy shape:

- `RSVP saved: going (confirmed)`
- `RSVP saved: going (waitlisted #2)`

Exact wording may vary, but the meaning must be clear.

---

## 6) Back navigation behavior

The new public invite screen must provide a visible back action.

Back behavior:

- returns to the previous organizer event-details screen;
- preserves the already-loaded organizer details screen state if practical;
- does not reset the list scope.

Do not over-engineer this. Keep it consistent with the existing local-state approach.

---

## 7) Error handling requirements

The public invite screen must handle these categories clearly:

1. invite fetch failure;
2. RSVP submit validation failure (local);
3. RSVP submit network failure;
4. RSVP submit HTTP error response;
5. missing token / invalid screen input state if it somehow occurs.

Messages do not need to be beautiful, but they must be understandable and non-technical where possible.

---

## 8) Files expected to change

At minimum, expect changes in files like:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/public-invite.ts`
- `apps/mobile/src/api/public-invite.test.ts`
- `apps/mobile/src/features/public-invite/public-invite-model.ts`
- `apps/mobile/src/features/public-invite/public-rsvp-form-model.ts`
- `apps/mobile/src/features/public-invite/public-rsvp-form-model.test.ts`

Optional additional test file if you split mapper coverage:

- `apps/mobile/src/features/public-invite/public-invite-model.test.ts`

You may adjust the exact file split if it stays small and clear.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. A mobile user can open a public invite preview screen from an existing organizer invite-link success state.
2. The screen fetches public invite data using `GET /v1/invite-links/:token`.
3. Public API calls do not send organizer dev headers.
4. The screen shows event basics and public RSVP summary.
5. A mobile user can enter name/email/status and submit RSVP.
6. The form performs local validation before submit.
7. Duplicate submit is prevented while in flight.
8. After successful RSVP, the screen refetches public invite data and reflects updated summary.
9. Success feedback includes resulting status and attendance state.
10. Errors are shown without clearing user input.
11. Mobile tests added in this task are green.
12. `pnpm --filter @event-app/mobile test` is green.
13. `pnpm --filter @event-app/mobile typecheck` is green.
14. No backend behavior was changed unless a real contract mismatch absolutely required it.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/mobile/.env.example apps/mobile/.env -Force

docker compose up -d

pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api start:dev
```

In another terminal:

```powershell
pnpm --filter @event-app/mobile test -- src/api/public-invite.test.ts src/features/public-invite/public-rsvp-form-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Manual Android verification flow

1. Open the app in Android emulator.
2. Load organizer events list.
3. Open an event details screen.
4. Ensure invite link exists or create it from the existing invite section.
5. Tap `Preview invite`.
6. Verify loading -> success state appears.
7. Verify event basics and summary are visible.
8. Submit invalid RSVP form values and verify local validation errors.
9. Submit valid RSVP values.
10. Verify success message appears.
11. Verify summary refresh occurs after submit.
12. Go back to event details.

---

## Implementation notes and guardrails

- Keep `App.tsx` readable; extract pure helpers instead of piling formatting logic inline.
- Do not add third-party form libraries.
- Do not add a navigation library.
- Do not modify `README.md`.
- Do not modify files under `tasks/`.
- Prefer small, typed helpers over duplicated inline code.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-14` must explicitly include:

1. exact public invite fetch helper shape;
2. exact public RSVP submit payload shape;
3. whether both 200 and 201 RSVP success responses are accepted;
4. the names of the new screen states added to `App.tsx`;
5. the exact test commands used for red -> green proof.

---

## Definition of done

`EVT-14` is done when the Expo app can open a public invite preview from the organizer details invite section, show public event/summary data, submit a guest RSVP from mobile, and refresh the public summary afterward — with green mobile tests and typecheck.

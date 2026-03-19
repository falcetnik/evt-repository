# EVT-11 — Mobile organizer create-event screen and POST integration

## Status
Ready

## Priority
P1

## Depends on
- EVT-9
- EVT-10

## Goal

Implement the first mobile **event creation flow** for organizers inside `apps/mobile`.

After this task, the organizer must be able to:

1. open a create-event screen from the mobile organizer home;
2. fill a minimal event form;
3. submit the form to the existing backend endpoint:
   - `POST /api/v1/events`
4. see loading / validation / submit-error states;
5. on success, land on the already existing mobile event-details screen for the newly created event.

This task is **mobile-only**. The backend create-event API already exists and must be reused as-is.

---

## Why this task exists now

The app can already:

- list organizer events on mobile;
- open mobile event details;
- fetch event data from the API.

The next meaningful vertical slice is letting the organizer create a new event directly from the phone.

This task gives us a complete organizer loop:

- list events;
- create a new event;
- open the new event details.

That is the first truly useful mobile organizer workflow.

---

## Scope

### In scope

- mobile create-event API helper;
- mobile create-event form/view-model helper;
- create-event screen in `apps/mobile/App.tsx`;
- navigation between:
  - organizer list,
  - organizer details,
  - organizer create-event;
- client-side normalization and minimal validation;
- submit loading / error handling;
- success navigation into details screen;
- unit tests for new helper modules;
- mobile docs update.

### Out of scope

- backend API changes;
- database changes;
- auth changes;
- native date/time picker packages;
- React Navigation / Expo Router migration;
- complex form libraries;
- offline support;
- edit-event flow;
- delete-event flow;
- attendee/reminder editing from mobile.

---

## Required implementation decisions

These decisions are mandatory for this task:

1. This task must modify **only** `apps/mobile` and docs unless a tiny shared typing helper is absolutely necessary.
2. Do **not** change backend behavior or contracts.
3. Reuse the existing dev organizer header approach in mobile config/API helpers.
4. Keep navigation local and simple inside `App.tsx`.
5. Do **not** add React Navigation, Expo Router, or any new navigation library in this task.
6. Do **not** add native date/time picker dependencies in this task.
7. Use simple text inputs for the event form.
8. Keep the screen functional and clear, not polished.

---

## Existing backend contract to use

You must use the existing organizer create-event endpoint:

- `POST /api/v1/events`

Expected request body:

```json
{
  "title": "Friday Board Games",
  "description": "Bring drinks if you want",
  "location": "Prospekt Mira 10",
  "startsAt": "2026-03-25T19:30:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8
}
```

Notes:

- `title` is required.
- `startsAt` is required.
- `timezone` is required.
- `description` is optional.
- `location` is optional.
- `capacityLimit` is optional.
- Empty optional text fields should be omitted or sent as `null`-equivalent normalized values that match existing API helper style.

The mobile app must not invent a different contract.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red -> green.

### Tests to add first

Before production implementation, add these test files:

1. `apps/mobile/src/api/create-event.test.ts`
   - verifies request path is `/v1/events`;
   - verifies method is `POST`;
   - verifies payload normalization for optional fields;
   - verifies dev header behavior is preserved.

2. `apps/mobile/src/features/create-event/create-event-form-model.test.ts`
   - verifies field normalization;
   - verifies required-field validation;
   - verifies invalid capacity handling;
   - verifies invalid startsAt ISO handling;
   - verifies empty optional fields become sensible API payload values.

You may add one tiny extra test only if directly necessary.

### Required red-state proof

Run the smallest relevant mobile test command first and confirm failure because the new modules do not exist yet.

Acceptable red-state command:

```bash
pnpm --filter @event-app/mobile test -- src/api/create-event.test.ts src/features/create-event/create-event-form-model.test.ts
```

A missing-module failure is acceptable for red state.

### Required green-state proof

After implementation, run:

```bash
pnpm --filter @event-app/mobile test -- src/api/create-event.test.ts src/features/create-event/create-event-form-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

Do not claim completion without green mobile tests.

---

## Detailed requirements

## 1) Mobile API helper for create-event

Create a new helper module:

- `apps/mobile/src/api/create-event.ts`

This module must:

- use the existing mobile config loader;
- use the existing HTTP wrapper conventions;
- call `POST /v1/events`;
- preserve the dev organizer header strategy already used by list/details API helpers;
- export typed request/response shapes suitable for mobile use.

### Required request input type

Use a clear typed input such as:

- `CreateEventInput`

It must support:

- `title: string`
- `description?: string | null`
- `location?: string | null`
- `startsAt: string`
- `timezone: string`
- `capacityLimit?: number | null`

### Required response handling

The helper must return the created event payload from the backend so that mobile can immediately open the details screen using the new `id`.

At minimum, the returned object must expose:

- `id`
- `title`
- `startsAt`
- `timezone`

You may return the full response body if that is simpler.

---

## 2) Create-event form model helper

Create a pure helper module:

- `apps/mobile/src/features/create-event/create-event-form-model.ts`

This module is responsible for:

- trimming input strings;
- converting empty optional strings to `null` or omitted values consistently;
- validating required fields;
- validating `capacityLimit` if provided;
- validating `startsAt` as a parseable ISO date string;
- preparing the API payload.

This helper must stay framework-light and easy to unit test.

### Required field behavior

#### title
- required;
- trim whitespace;
- reject empty result.

#### description
- optional;
- trim whitespace;
- empty becomes `null` or omitted payload.

#### location
- optional;
- trim whitespace;
- empty becomes `null` or omitted payload.

#### startsAt
- required;
- trim whitespace;
- must parse as a valid date string;
- use the exact text value in payload after trimming if valid.

#### timezone
- required;
- trim whitespace;
- reject empty result.

#### capacityLimit
- optional;
- form input may begin as text;
- empty input becomes `null` or omitted payload;
- if present, must be an integer;
- if present, must be >= 1.

You do **not** need to fully duplicate every backend constraint. Keep client-side validation minimal but useful.

### Required return shape

The helper should return a structure similar to one of these patterns:

- `{ ok: true, payload: CreateEventInput }`
- `{ ok: false, fieldErrors: ... }`

or another similarly explicit typed result.

The helper must make it easy for `App.tsx` to show per-screen error text.

---

## 3) Mobile screen flow in `App.tsx`

Extend `apps/mobile/App.tsx` so the app supports **three** organizer views:

1. event list screen;
2. event details screen;
3. create-event screen.

The current local-state navigation pattern should remain simple.

### Required screen transitions

#### From list -> create
There must be a visible action on the organizer list screen such as:

- `Create event`

Tapping it opens the create screen.

#### From create -> cancel/back
There must be a visible action to return to the list without submitting.

#### From create -> success
On successful creation:

- the app must navigate directly to the mobile event-details screen for the created event;
- the details screen must use the existing event-details fetch flow;
- the organizer must be able to navigate back from details to the list.

#### From details -> list
Existing back behavior must remain working.

---

## 4) Required create screen UI behavior

This screen may stay visually simple, but it must be clear and usable.

### Required inputs

Display inputs for:

- Title
- Description
- Location
- Starts at (ISO text input)
- Timezone
- Capacity limit

### Input hints / placeholders

You must provide useful placeholders or helper text.

Examples:

- Title → `Friday Board Games`
- Starts at → `2026-03-25T19:30:00.000Z`
- Timezone → `Europe/Moscow`
- Capacity limit → `8`

### Required buttons

The screen must include:

- primary submit button, e.g. `Create event`
- secondary cancel/back button

### Required submit states

On submit:

- disable duplicate submission;
- show loading feedback;
- show a useful error message if submission fails;
- keep the form values intact on failure.

### Required validation states

If client-side validation fails:

- do not call the API;
- show a clear validation message on screen.

A single screen-level validation message is acceptable in this task.

Per-field inline error text is optional, not required.

---

## 5) Required success behavior

On successful creation:

1. capture the created event id from API response;
2. switch to the event-details screen using that id;
3. allow the organizer to refresh the details screen using the existing EVT-10 logic;
4. when navigating back to the list, refresh the list so the new event is visible.

The list refresh may happen eagerly on return or after successful create, as long as the newly created event becomes visible without restarting the app.

---

## 6) Error handling requirements

Handle these categories cleanly:

### Config error
If the mobile config is invalid or missing, show the existing mobile error presentation style.

### Network error
Show a retryable submit error message.

### HTTP validation error
If the backend rejects the request with a 400, show a readable submit error message.

### Unexpected error
Show a generic fallback submit error.

Do not crash the app.

---

## 7) Keep the UI intentionally simple

This task is not a design-polish task.

Do:

- use basic React Native components;
- keep spacing readable;
- label sections clearly.

Do not:

- add a design system;
- add animation libraries;
- add native picker packages;
- overengineer styling.

---

## 8) Files expected to be added or changed

At minimum, expect changes in files like:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/create-event.ts`
- `apps/mobile/src/api/create-event.test.ts`
- `apps/mobile/src/features/create-event/create-event-form-model.ts`
- `apps/mobile/src/features/create-event/create-event-form-model.test.ts`
- `docs/local-development.md`

Exact small supporting files may vary.

---

## 9) Acceptance criteria

This task is complete only if all of the following are true:

1. Mobile has a visible organizer action to open a create-event screen.
2. The create screen has inputs for title, description, location, startsAt, timezone, and capacityLimit.
3. Mobile validates required fields before submit.
4. Mobile submits to `POST /v1/events` using the existing config/http/dev-header approach.
5. Submit loading and error states are visible and do not crash the app.
6. On success, the app navigates to the existing details screen for the new event.
7. Navigating back to the list allows the new event to appear after refresh.
8. New unit tests exist for the API helper and form model helper.
9. Mobile test suite is green.
10. Mobile typecheck is green.
11. No backend or DB behavior was changed.

---

## 10) Required manual verification steps

Document the exact commands in the final report.

### PowerShell-friendly local flow

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

In a second terminal:

```powershell
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Android manual flow

1. Launch Android Emulator.
2. Open the app.
3. Verify the organizer list screen loads.
4. Tap `Create event`.
5. Try submitting an empty form and verify validation appears.
6. Fill valid values, for example:
   - Title: `Friday Board Games`
   - Description: `Bring drinks if you want`
   - Location: `Prospekt Mira 10`
   - Starts at: `2099-03-25T19:30:00.000Z`
   - Timezone: `Europe/Moscow`
   - Capacity limit: `8`
7. Submit and verify the app transitions to the details screen.
8. Verify the new event details are shown.
9. Navigate back to the list and verify the new event can be seen after refresh.
10. Stop the backend temporarily and verify submit shows an error instead of crashing.

---

## 11) Final report requirements for this task

In addition to the global run prompt, the final report must include:

1. the exact new mobile test files added;
2. the exact red-state command and failure reason;
3. the exact green-state test commands;
4. the exact create-event request payload shape used by mobile;
5. a short description of success navigation behavior after creation.

---

## Definition of done

`EVT-11` is done when an organizer can open the Android app, create a new event from a simple mobile form, successfully land on the details screen for that event, and all new mobile tests are green.

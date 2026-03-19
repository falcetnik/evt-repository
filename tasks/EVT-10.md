# EVT-10 — Mobile event details screen for organizers

## Status
Ready

## Priority
P1

## Depends on
- EVT-3
- EVT-5
- EVT-6
- EVT-7
- EVT-8
- EVT-9

## Goal

Implement the second real mobile organizer screen in `apps/mobile`: an event details screen that opens from the existing organizer events home screen.

This task must let a developer do the following inside the Expo mobile app:

1. open the organizer events home screen;
2. tap an event card;
3. open a detail screen for that event;
4. load organizer-only event data from the existing backend;
5. see attendees, RSVP summary, and reminders for that event;
6. go back to the list without losing the current scope selection.

This is a **mobile integration task**. It is not an auth task and it is not a design-system task.

---

## Why this task exists now

After EVT-9 we have a useful organizer home screen, but the app still stops at a list of cards.

The next most valuable step is to make those cards actionable and let the organizer inspect one event in detail. That gives us a real mobile flow and makes Android Studio / emulator checks much more meaningful.

Once this task is complete, the mobile app should support this real organizer journey:

- open home screen;
- see event cards;
- choose one event;
- inspect the event;
- inspect attendee state;
- inspect reminder schedule;
- return to the list.

---

## Fixed implementation decisions for this task

These decisions are mandatory for EVT-10:

1. This task is **mobile-first** and should stay primarily inside `apps/mobile`.
2. Reuse the existing backend APIs. Do **not** redesign backend contracts.
3. Do **not** introduce real authentication.
4. Use the existing development header strategy already used by the mobile app for organizer-only endpoints.
5. Keep navigation minimal and focused. Do not introduce large routing rewrites unless absolutely necessary.
6. Preserve the current organizer home screen behavior from EVT-9.
7. Keep styling intentionally simple; do not start UI/UX polishing here.
8. Do not introduce a global state library for this task.
9. Do not migrate the app to Expo Router in this task.
10. Do not add create/edit event flows in this task.

---

## Out of scope

The following are explicitly out of scope for EVT-10:

- Google / Apple / VK / Yandex / email auth;
- push notifications;
- invite-link creation or sharing UI;
- RSVP submission from mobile;
- event creation form;
- event editing;
- comments/chat;
- payments;
- image upload;
- deep-link handling;
- navigation library migration;
- design-system or theme overhaul;
- backend feature additions unrelated to the detail screen.

If any of the above appears, it is over-implementation and should be removed.

---

## Existing backend APIs that must be used

This task must consume the backend endpoints that already exist.

Use these endpoints:

1. `GET /api/v1/events/:eventId`
2. `GET /api/v1/events/:eventId/attendees`
3. `GET /api/v1/events/:eventId/reminders`

The mobile API base URL handling must remain consistent with EVT-9.

All organizer-only requests must include the existing development header when the app is in the dev organizer flow.

Do not invent new backend endpoints for this task.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Because this is a mobile feature task, you do **not** need React Native rendering tests unless the repository already has that test infrastructure. For EVT-10, the required tests are pure unit tests around the new mobile API helpers and mapping/view-model logic.

### Required tests to add first

Add these tests before implementing the production code:

1. `apps/mobile/src/api/event-details.test.ts`
   - verifies event detail API helper request paths;
   - verifies dev header behavior for organizer requests;
   - verifies response decoding / bundling behavior.

2. `apps/mobile/src/features/event-details/event-details-model.test.ts`
   - verifies mapping from backend payloads to UI-ready view model;
   - verifies empty reminders / empty attendees sections;
   - verifies location / description / capacity fallback behavior;
   - verifies waitlist labels / attendance labels / reminder labels.

You may add one extra small helper test if truly necessary, but do not introduce a wide speculative test suite.

### Red-state requirement

Before implementing the production code, run the smallest relevant mobile test command and confirm failure.

Acceptable red-state examples:

- missing `event-details.ts` API helper module;
- missing event details view-model helper;
- request path/header expectations failing because the code does not exist yet.

### Green-state requirement

After implementation, rerun the tests and ensure they pass.

### Forbidden shortcuts

Do not:

- weaken assertions to force green;
- skip tests;
- mark tests todo;
- silently remove failing cases;
- replace task-specific tests with unrelated ones.

---

## Detailed implementation requirements

## 1) Mobile event details data layer

Add a dedicated mobile API helper module for organizer event details.

This helper must fetch and combine the three existing backend endpoints:

- event base data;
- attendee list + summary;
- reminder schedule.

### Required behavior

- Use the existing base URL/config approach from EVT-9.
- Use the existing typed fetch wrapper / normalized error handling style from EVT-9.
- Use the existing development organizer header mechanism from EVT-9.
- Fetch the three requests in a predictable way.
- It is acceptable to use `Promise.all(...)`.
- If any request fails, surface a single normalized mobile error to the screen.

### Expected helper shape

The exact names may vary, but the intent must exist.

Examples of acceptable structure:

- `getOrganizerEventDetails(...)`
- `fetchOrganizerEventBundle(...)`
- `loadEventDetailsBundle(...)`

The helper must return typed data, not `any`.

---

## 2) Event details view-model / mapping layer

Add a pure mapping helper that transforms backend payloads into UI-ready data for the event details screen.

This helper should keep presentation-specific formatting logic out of `App.tsx` as much as reasonably possible.

### The mapped detail screen data must include

#### Event section

- title
- formatted starts-at text
- timezone
- description (or fallback text)
- location (or fallback text)
- capacity text

#### Summary section

Use the existing RSVP summary returned by the backend and expose display-ready fields for:

- total
- going
- maybe
- not going
- confirmed going
- waitlisted going
- remaining spots
- full / not full

#### Attendees section

Each attendee row must expose display-ready data for:

- stable key / attendee id
- guest name
- guest email
- status label
- attendance state label
- waitlist position text when relevant
- created/updated timestamps only if you already need them for display; otherwise do not expose them just because they exist

#### Reminders section

Each reminder row must expose display-ready data for:

- stable key / reminder id
- offset label
- sendAt label

### Fallback rules

Use clear fallback display values instead of blank strings.

At minimum:

- no description -> `No description`
- no location -> `Location not set`
- no capacity -> `No limit`
- no reminders -> empty-state message
- no attendees -> empty-state message

Keep fallback text simple and English-only for now.

---

## 3) Mobile screen behavior

Update `apps/mobile/App.tsx` so the app supports two organizer views:

1. organizer home screen (existing EVT-9 list)
2. organizer event details screen (new)

### Navigation requirement

Keep navigation intentionally minimal.

A simple local state pattern is acceptable, for example:

- `selectedEventId: string | null`
- `null` => show list screen
- non-null => show detail screen

This is enough for this task.

Do **not** add React Navigation or Expo Router unless absolutely necessary.

### Required interaction flow

- tapping an event card on the home screen opens that event details screen;
- the detail screen shows a back action;
- pressing back returns to the home screen;
- the previously selected scope on the home screen must remain preserved;
- returning to the home screen must not silently reset the list state.

### Detail screen loading states

The detail screen must support these states:

- loading
- error
- success

The error state must include a retry action.

### Refresh behavior

The detail screen must include a manual refresh action.

A simple button is enough.

### Empty state behavior

Even when the detail screen loads successfully, sections may be empty.

Required empty section behavior:

- no attendees => show a short empty-state message in the attendees section;
- no reminders => show a short empty-state message in the reminders section.

Do not treat empty sections as an error.

---

## 4) Required detail screen content

The event details screen must visibly include all of the following:

### A) Top event block

- title
- startsAt
- timezone
- location
- description
- capacity

### B) RSVP summary block

Display the main summary metrics in a readable way.

At minimum, the screen must show:

- going
- maybe
- not going
- confirmed going
- waitlisted going
- remaining spots
- full / not full

The exact visual arrangement is flexible, but the information must be present.

### C) Attendees block

Display the attendee list returned by the organizer attendees endpoint.

Required per-row information:

- guest name
- guest email
- status label
- attendance state label
- waitlist position when present

Use the backend ordering as returned; do not reimplement a second ordering policy on the mobile side.

### D) Reminders block

Display reminder rows returned by the reminders endpoint.

Required per-row information:

- offset label
- sendAt label

If there are no reminders, display an explicit empty-state message.

---

## 5) Error handling requirements

The screen must handle network/API failures cleanly.

### Required error cases

At minimum, the mobile screen must surface a readable error state for:

- network failure;
- non-200 backend response;
- config/base-URL error.

Use the same normalized error approach already introduced in EVT-9.

Do not expose raw JS stack traces to the UI.

---

## 6) Styling constraints

Keep styling simple and consistent with EVT-9.

Requirements:

- no design-system rewrite;
- no pixel-perfect work;
- no custom fonts;
- no animation work;
- no dark-mode system in this task.

The screen must simply be readable and easy to manually verify on Android.

---

## 7) Files expected to change

The exact final list may vary, but EVT-10 will likely touch files similar to:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/event-details.ts`
- `apps/mobile/src/api/event-details.test.ts`
- `apps/mobile/src/features/event-details/event-details-model.ts`
- `apps/mobile/src/features/event-details/event-details-model.test.ts`
- `docs/local-development.md`

It is acceptable if a couple of small supporting files are added, but keep the diff focused.

---

## 8) Acceptance criteria

This task is complete only if all of the following are true:

1. Tapping an event card on the existing organizer home screen opens an event details screen.
2. The detail screen loads data from the existing backend event/attendees/reminders endpoints.
3. The detail screen supports loading, error, retry, and success states.
4. The detail screen shows:
   - event basics,
   - RSVP summary,
   - attendee rows,
   - reminder rows.
5. Empty attendees and empty reminders are rendered as section-level empty states, not as failures.
6. Returning from the detail screen preserves the current list scope and does not reset the home screen unexpectedly.
7. New mobile tests were written first and observed failing before implementation.
8. `pnpm --filter @event-app/mobile test` is green.
9. `pnpm --filter @event-app/mobile typecheck` is green.
10. No auth/provider work, no event creation flow, and no unrelated navigation rewrite were added.

---

## Manual verification requirements

Document the exact commands run in the final report.

At minimum, verify this flow on a local Android Emulator or Android device.

### PowerShell-friendly setup

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/mobile/.env.example apps/mobile/.env -Force

# If test DB commands are needed for backend readiness in your local setup
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force

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

### Android manual verification flow

1. Launch Android Emulator from Android Studio.
2. Open the mobile app.
3. Verify the organizer home screen still loads upcoming events by default.
4. Change the scope at least once and verify the list reloads.
5. Tap one event card.
6. Verify the detail screen opens.
7. Verify the detail screen shows event basics, summary, attendees, and reminders.
8. Trigger manual refresh on the detail screen.
9. Turn off the backend temporarily or use a bad base URL to verify the error state and retry behavior.
10. Go back to the list screen and verify the previously selected scope is still preserved.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for EVT-10 must explicitly include:

1. the exact new mobile tests added first;
2. the exact red-state test command and why it failed;
3. the exact green commands used after implementation;
4. the exact backend endpoints consumed by the mobile detail screen;
5. the exact manual Android verification flow that was executed.

---

## Definition of done

EVT-10 is done when a developer can launch the Android emulator, open the organizer event list, tap an event, inspect the event detail screen with attendees and reminders, refresh it, and return to the original list state without hidden setup steps.

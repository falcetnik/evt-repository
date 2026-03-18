# EVT-9 — Mobile organizer home screen with backend events list

## Status
Ready

## Priority
P1

## Depends on
- EVT-1
- EVT-3
- EVT-4
- EVT-5
- EVT-6
- EVT-7
- EVT-8

## Goal

Implement the first real mobile screen in `apps/mobile` that connects to the existing backend and lets a development organizer view their events from the API.

This task must turn the current Expo placeholder shell into a minimal but real organizer home screen that:

- calls the existing backend `GET /api/v1/events` endpoint;
- supports `scope=upcoming | past | all` from the mobile UI;
- renders a deterministic list of event cards;
- handles loading, empty, error, and refresh states;
- uses the existing backend dev-auth shim via `x-dev-user-id` in development only;
- remains intentionally simple and not yet “final design”.

This is the first backend-to-mobile integration task.

---

## Why this task exists now

The backend now exposes enough event functionality to support the first useful mobile screen.

After this task, we should be able to:

- boot the Expo app in Android Studio / Android Emulator;
- point it at the local backend;
- see real organizer events from the API;
- change scope between upcoming, past, and all;
- verify that mobile and backend are correctly linked before adding create/detail/RSVP flows.

This task is intentionally focused on **integration and baseline UX**, not polished design.

---

## Fixed implementation decisions for this task

These decisions are mandatory for `EVT-9`.

1. Keep `apps/mobile` as the existing Expo TypeScript app.
2. Do **not** migrate to Expo Router in this task.
3. Do **not** introduce React Navigation in this task.
4. Keep this task to a **single-screen app** rooted in `App.tsx`.
5. Use the built-in `fetch` API for networking. Do not add Axios or other HTTP clients.
6. Use `EXPO_PUBLIC_API_BASE_URL` as the backend API base URL.
7. Use `EXPO_PUBLIC_DEV_USER_ID` as the development organizer identity sent through the existing `x-dev-user-id` header.
8. Send `x-dev-user-id` only in development-oriented mobile flows. No real auth provider work belongs in this task.
9. Do not add production auth, token storage, secure storage, or session refresh logic.
10. Do not do final UI/UX polish yet. The screen should be clean and usable, but intentionally simple.
11. The mobile app must continue to typecheck cleanly.
12. This task must still follow test-first. Because the current mobile package has no test setup, adding a minimal mobile unit-test setup is part of this task.

---

## Out of scope

The following are explicitly out of scope:

- real login / logout;
- Google / Apple / VK / Yandex / email auth;
- event detail screen;
- event create screen;
- RSVP submission from mobile;
- invite-link creation from mobile;
- reminders editing from mobile;
- deep links / universal links;
- design system / component library;
- dark mode;
- offline cache / persistence;
- push notifications;
- EAS / release builds;
- Expo Router migration;
- React Navigation setup.

If any of the above appears, it is over-implementation and should be removed.

---

## Required user-visible result

At the end of this task, opening the mobile app should show a single organizer home screen with:

1. app title / simple header;
2. current backend connection context (at least implicitly via successful fetch, optionally with a tiny environment label);
3. scope controls for:
   - Upcoming
   - Past
   - All
4. loading state while fetching;
5. retryable error state if the backend is unreachable or misconfigured;
6. empty state when no events match the selected scope;
7. list of cards for returned events.

Each event card must show at least:

- title;
- startsAt;
- timezone;
- location if present;
- capacityLimit if present;
- RSVP summary snippet (minimum: total/going/maybe/not going, or a clearly useful subset);
- whether an active invite link exists;
- active reminder count.

The goal is not pixel perfection; it is a clean, understandable, verifiable first mobile screen.

---

## Backend contract this task must consume

This task must consume the existing organizer endpoint:

- `GET /api/v1/events`
- `GET /api/v1/events?scope=upcoming`
- `GET /api/v1/events?scope=past`
- `GET /api/v1/events?scope=all`

The request must include the existing development header:

- `x-dev-user-id: <EXPO_PUBLIC_DEV_USER_ID>`

Use the response shape already implemented by the backend. Do not change the backend API in this task unless a tiny bug fix is absolutely required for the mobile integration and is clearly documented.

---

## Android emulator requirement

This task must explicitly support local Android Emulator development.

Because Android Emulator cannot reach the host machine through plain `localhost`, the docs and mobile env examples must clearly support the standard emulator host mapping:

- `http://10.0.2.2:3000/api`

This must be documented for Windows 11 / Android Studio usage.

Do **not** hardcode `10.0.2.2` in production code. It belongs in env config and docs.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must still follow red -> green.

Because the mobile package currently has no tests, you must first create the **minimum** mobile unit-test setup needed for this task.

### Required tests to add first

Add the following tests before implementing the final mobile behavior:

1. **API URL / request helper test**
   - verifies scope query handling;
   - verifies base URL joining is correct;
   - verifies dev header construction behavior.

2. **Event card model / presentation helper test**
   - verifies backend event payload is transformed into the small UI-facing card model the screen needs;
   - verifies handling of nullable fields like location/capacityLimit;
   - verifies invite/reminder summary helpers.

These tests must be pure unit tests. Do not add React Native rendering tests in this task.

### Red-state requirement

Run the smallest relevant targeted test command(s) and confirm they fail before the production implementation is complete.

Acceptable red-state examples:

- missing API helper module;
- missing event-card mapping helper;
- wrong scope serialization;
- incomplete card transformation.

### Green-state requirement

After implementing the mobile code, rerun the relevant tests and ensure they pass.

### Forbidden shortcuts

Do not:

- skip mobile tests;
- mark tests todo;
- weaken assertions to avoid implementing behavior;
- claim success without actually running the failing then passing test commands.

---

## Detailed implementation requirements

## 1) Mobile env and config

Add a small mobile config layer.

### Required env variables

`apps/mobile/.env.example` must include at least:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api
EXPO_PUBLIC_DEV_USER_ID=dev-organizer-1
```

You may keep comments or nearby docs explaining:

- Android Emulator should usually use `10.0.2.2`;
- Expo web / desktop development may use `http://localhost:3000/api` instead.

### Config requirements

Create a tiny config module that:

- reads `EXPO_PUBLIC_API_BASE_URL`;
- reads `EXPO_PUBLIC_DEV_USER_ID`;
- normalizes the base URL so path joining is safe;
- exposes a typed config object for the rest of the mobile app.

If required env config is missing, the app must render a **clear developer-facing configuration error state** instead of crashing obscurely.

---

## 2) Mobile API client

Create a small API helper layer under `apps/mobile/src/`.

Suggested structure (exact file names may vary slightly):

```text
apps/mobile/src/
  api/
    config.ts
    http.ts
    events.ts
  features/
    events-list/
      event-card-model.ts
  utils/
```

### API client requirements

Implement a tiny, typed `fetch` wrapper or helper that:

- builds URLs from the base API URL;
- supports query params;
- sets `Accept: application/json`;
- sets `Content-Type: application/json` when appropriate;
- sends `x-dev-user-id` when calling organizer endpoints in this mobile dev flow;
- throws a typed or at least normalized error object/message on non-2xx responses;
- handles network failures cleanly.

Do not over-abstract this layer. Keep it small and readable.

### Events API helper

Implement a helper for the organizer events list endpoint that:

- accepts scope: `upcoming | past | all`;
- calls `GET /api/v1/events` with the query param when needed;
- returns typed data aligned to the backend contract.

---

## 3) Event list presentation model

Add a small pure transformation/helper layer that converts the raw backend event item into a mobile-card-friendly view model.

This layer should be responsible for things like:

- choosing display strings/fallbacks for nullable fields;
- creating concise RSVP summary labels;
- producing invite/reminder chips or labels;
- keeping the screen component simple.

Keep this transformation pure and unit-testable.

Do not introduce premature design-system abstractions.

---

## 4) Single-screen organizer home UI

Implement the first real mobile screen in `App.tsx` (or tiny local components imported into it).

### Required behavior

The screen must:

- fetch organizer events on initial mount;
- default to `upcoming` scope;
- allow switching between `upcoming`, `past`, and `all`;
- refetch when the scope changes;
- support manual refresh;
- render loading / error / empty / success states.

### Recommended UI structure

Keep the UI simple and clear. A structure like this is sufficient:

1. header/title;
2. short subtitle or environment hint;
3. scope segmented controls / pills / simple buttons;
4. refresh button or pull-to-refresh;
5. main content area with one of:
   - loading text/spinner;
   - error block with retry button;
   - empty-state message;
   - `FlatList` of cards.

### Event card requirements

Each card must show at least:

- title;
- startsAt;
- timezone;
- location or a clear fallback when absent;
- capacity information when present;
- summary data based on backend values;
- active invite link indicator;
- reminder count.

Cards do not need to be clickable yet.

### UX constraints

- Keep layout clean and readable.
- Avoid over-styling.
- Avoid heavy nesting.
- Prefer built-in React Native primitives.
- No external UI library.

---

## 5) Error handling requirements

The screen must make common failure modes understandable during development.

At minimum distinguish between:

1. **config error**
   - missing env values;
   - malformed base URL.

2. **network/backend error**
   - backend not running;
   - invalid host/port;
   - server returned non-2xx.

Provide a visible retry action for runtime fetch failures.

Do not silently swallow errors.

---

## 6) Mobile test setup

Because `apps/mobile` currently lacks tests, add the minimum setup needed for pure unit tests.

### Requirements

- add a test runner configuration suitable for simple TypeScript unit tests in `apps/mobile`;
- add a `test` script in `apps/mobile/package.json`;
- ensure `pnpm --filter @event-app/mobile test` works;
- keep this setup as small as possible.

Do not add snapshot tests or full component rendering tests in this task.

---

## 7) Package scripts

`apps/mobile/package.json` must include scripts equivalent to:

- `start`
- `android`
- `typecheck`
- `test`

Keep existing scripts working.

---

## 8) Documentation updates

Update `docs/local-development.md`.

Add a clear EVT-9 section including:

1. copying `apps/mobile/.env.example` to `apps/mobile/.env`;
2. Windows 11 + Android Studio note about `10.0.2.2` for emulator access to local backend;
3. starting Docker + backend;
4. starting the mobile app;
5. opening Android Emulator;
6. verifying the organizer events list screen;
7. verifying scope changes;
8. verifying retry/error state by temporarily stopping the backend.

Keep the docs PowerShell-friendly.

---

## 9) Acceptance criteria

This task is complete only if all of the following are true:

1. `apps/mobile` has a minimal mobile test setup.
2. Mobile unit tests were written first, observed red, then made green.
3. `pnpm --filter @event-app/mobile test` passes.
4. `pnpm --filter @event-app/mobile typecheck` passes.
5. The Expo app starts successfully.
6. The app fetches organizer events from the backend using `EXPO_PUBLIC_API_BASE_URL`.
7. The app uses the dev organizer header from `EXPO_PUBLIC_DEV_USER_ID`.
8. The app defaults to `upcoming` scope.
9. Scope switching works for `upcoming`, `past`, and `all`.
10. The app shows a loading state.
11. The app shows a retryable error state when backend fetch fails.
12. The app shows an empty state when no events are returned.
13. The app renders clean event cards with the required fields.
14. `docs/local-development.md` is updated with Android Emulator instructions using `10.0.2.2`.
15. No auth provider SDKs, no navigation stack, and no unrelated UI polish were added.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/mobile/.env.example apps/mobile/.env -Force

# Use Android Emulator host mapping in the mobile env file:
# EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api
# EXPO_PUBLIC_DEV_USER_ID=organizer-1

# Start infra + backend

docker compose up -d
pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api start:dev

# In another terminal
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

Then:

1. Start Android Emulator in Android Studio.
2. Open the Expo app on Android.
3. Verify the screen loads organizer events.
4. Switch between Upcoming / Past / All and verify the list changes.
5. Stop the backend temporarily and verify the mobile screen shows a retryable error state.
6. Start the backend again and verify retry works.

Optional if the project uses native run flow locally:

```powershell
pnpm --filter @event-app/mobile android
```

---

## Implementation notes and guardrails

- Keep the mobile implementation simple.
- Do not convert the app to a different routing approach yet.
- Do not add a global state library.
- Do not add TanStack Query in this task.
- Do not add AsyncStorage persistence.
- Do not add React Navigation.
- Do not modify backend behavior unless a tiny blocker fix is absolutely required.
- Do not change README.md.
- Do not change files under `tasks/`.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-9` must explicitly include:

1. the exact mobile tests added;
2. the exact red-state command(s) run before implementation;
3. the exact green-state mobile test and typecheck commands;
4. the exact env values used locally for Android Emulator backend access;
5. the exact file paths added/changed under `apps/mobile`;
6. a concise explanation of how the app handles:
   - missing mobile env config,
   - backend/network failure,
   - empty list,
   - scope switching.

---

## Definition of done

`EVT-9` is done when the Android Emulator can open the Expo app, the screen can fetch organizer events from the local backend, the user can switch scope between upcoming/past/all, and the mobile package has green test/typecheck coverage for the pure helper logic introduced by this task.

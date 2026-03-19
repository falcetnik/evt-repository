# EVT-13 — Mobile organizer reminder editor on event details

## Status
Ready

## Priority
P1

## Depends on
- EVT-7
- EVT-10
- EVT-12

## Goal

Add a reminder editing flow to the mobile organizer event-details screen so the organizer can:

- see the current reminder schedule;
- open an editor;
- replace the reminder schedule using the existing backend API;
- clear all reminders by saving an empty schedule;
- recover cleanly from validation or network errors.

This task is **mobile-only**. It must reuse the existing backend reminders API that already exists in `apps/api`.

---

## Why this task exists now

The backend already supports reading and replacing event reminders.
The mobile app can already:

- list organizer events;
- open event details;
- create events;
- create/reuse invite links.

The next missing organizer action is editing reminders directly from the phone.

After this task, the organizer mobile flow should cover:

- create event;
- open details;
- create/share invite link;
- edit reminder schedule.

---

## Fixed implementation decisions for this task

These decisions are mandatory for EVT-13:

1. This task is **mobile-only**.
   - Do not change backend behavior unless a real contract mismatch is discovered.
   - If a backend mismatch is discovered, stop and report it instead of silently changing API contracts.

2. Do **not** add a navigation library.
   - Continue using the existing `App.tsx` local-screen-state approach.

3. The editor must live on the existing organizer event-details screen.

4. Reminder editing will use **one simple text input** containing comma-separated offsets in minutes.
   - Example valid input: `1440, 120, 30`

5. Saving an empty input must mean **clear all reminders**.
   - The app must send `offsetsMinutes: []`.

6. The mobile layer must perform lightweight local validation before sending the request.

7. The app must still rely on the backend as the final source of truth.
   - Backend `400` responses must still be surfaced clearly.

8. Keep the UI intentionally simple.
   - No new design system.
   - No bottom sheets.
   - No modal library.
   - No form library.

---

## Out of scope

The following are out of scope for EVT-13:

- backend reminders logic changes;
- reminder delivery / workers / queues;
- push notifications;
- local notifications;
- calendar integration;
- recurring reminders;
- timezone conversion UX beyond what already exists in backend responses;
- drag-and-drop reminder chips;
- React Navigation / Expo Router migration;
- React Native Testing Library UI tests.

---

## Required behavior

## 1) New mobile API helper

Create a typed mobile API helper for replacing event reminders.

Recommended path:

- `apps/mobile/src/api/event-reminders.ts`

It must export a function equivalent in intent to:

- `replaceEventReminders(eventId, offsetsMinutes, options)`

It must:

- call `PUT /v1/events/:eventId/reminders`;
- send JSON body:
  - `{ offsetsMinutes: number[] }`
- use the existing mobile HTTP wrapper;
- use the existing mobile config/dev-header behavior;
- include `x-dev-user-id` only when the mobile config says dev organizer header usage is enabled.

### Required response type

The helper must return the typed backend success payload shape:

```json
{
  "eventId": "evt_123",
  "startsAt": "2026-03-20T18:30:00.000Z",
  "timezone": "Europe/Moscow",
  "reminders": [
    {
      "reminderId": "rem_1",
      "offsetMinutes": 1440,
      "sendAt": "2026-03-19T18:30:00.000Z"
    }
  ],
  "total": 1
}
```

Do not invent a new contract.

---

## 2) Pure reminder editor model helper

Create a pure helper module for parsing and validating the comma-separated reminder input.

Recommended path:

- `apps/mobile/src/features/event-details/reminder-editor-model.ts`

This helper must be framework-agnostic and easy to unit-test.

### Required responsibilities

It must accept a raw input string and produce either:

- a valid normalized `number[]` payload; or
- a structured validation result for the UI.

### Required rules

The editor rules must match backend expectations as closely as possible:

1. Empty string after trim means:
   - valid;
   - normalized result is `[]`.

2. Otherwise, split by comma.

3. Each segment must be trimmed.

4. Empty segments are invalid.
   - Example invalid inputs:
     - `,`
     - `5,`
     - `5,,10`

5. Every value must be an integer.

6. Every value must be between `5` and `10080` inclusive.

7. Duplicates are invalid.

8. Maximum count is `5` reminders.

9. The normalized array must preserve the user-entered order after trimming/parsing.
   - Do not sort in the editor helper.
   - Let backend sorting remain the source of truth for returned reminder order.

### Required result shape

Use a deterministic result shape such as:

```ts
{ ok: true; offsetsMinutes: number[] }
```

or

```ts
{ ok: false; message: string }
```

You may include one small extra field if useful, but keep it simple.

### Required error messages

The exact wording may vary slightly, but the UI-visible messages must clearly cover:

- invalid empty segment / malformed comma list;
- non-integer values;
- out-of-range values;
- duplicate values;
- too many reminders.

---

## 3) Event-details screen UX

Extend the existing mobile event-details screen in `apps/mobile/App.tsx`.

### Required default behavior

When the details screen first opens:

- existing details data continues to load as it does now;
- the reminder section initially shows the current reminders in read-only mode;
- the reminder editor is closed by default.

### Required reminder section behavior

The details screen must include a reminder section that supports these states:

1. **Read-only state**
   - shows the existing reminders summary/list already available from details data;
   - shows a visible button/action such as `Edit reminders`.

2. **Editing state**
   - shows a text input labeled clearly, for example:
     - `Reminder offsets (minutes, comma separated)`
   - pre-fills the input from the currently loaded reminders using a deterministic string.
   - Required prefill format example:
     - `1440, 120, 30`
   - show buttons/actions:
     - `Save reminders`
     - `Cancel`

3. **Saving state**
   - disable duplicate submit taps;
   - disable or ignore repeated save presses while request is in flight;
   - keep the typed value visible.

4. **Success behavior**
   - after successful save, refetch event details;
   - exit editing mode;
   - show the updated reminder list from the fresh server response;
   - clear any previous editor error state.

5. **Failure behavior**
   - if local validation fails, do not send the request;
   - show a visible validation message;
   - keep the typed input unchanged;
   - if the API request fails, stay in edit mode;
   - keep the typed input unchanged;
   - show a visible request error message;
   - allow retry.

### Required clear behavior

If the organizer clears the input entirely and saves:

- the app must send `offsetsMinutes: []`;
- after successful save and refetch, the reminders section must show the existing empty-state label.

### Required cancel behavior

When the organizer taps `Cancel`:

- exit editing mode;
- discard unsaved input changes;
- remove editor-local validation error text;
- return to read-only reminder display.

### Required empty-state label

When no reminders are scheduled, show a clear human-readable fallback such as:

- `No reminders scheduled.`

### Required helper text

The editor should display one small helper line telling the organizer the accepted format.

Example acceptable helper text:

- `Use comma-separated minutes, for example: 1440, 120, 30`

---

## 4) Reminder display mapping helper

If the current details screen already has pure formatting helpers, extend them minimally.
If not, add a small pure mapping helper near the details feature.

The reminder display logic must support:

- existing reminder rows from backend data;
- empty fallback label;
- editor prefill string generation from current reminders.

You may either:

- extend the existing details model file; or
- add a dedicated helper file such as:
  - `apps/mobile/src/features/event-details/reminder-display-model.ts`

Keep it small and testable.

Do not add unnecessary abstractions.

---

## 5) Error handling requirements

The mobile app must distinguish these error categories well enough for the organizer:

1. **Local validation error**
   - shown immediately without network request.

2. **HTTP 400**
   - shown as a user-facing failure from backend validation/scheduling rules.
   - If the backend returns a useful message through the existing HTTP wrapper, surface it.

3. **Network/unreachable backend**
   - show a generic retryable message.

4. **Unexpected failure**
   - show a generic safe error message.

Do not crash the screen.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

### Required tests to add first

Add these tests before implementing production code:

1. `apps/mobile/src/api/event-reminders.test.ts`
   - verifies request method/path/body;
   - verifies dev header behavior;
   - verifies returned typed payload handling.

2. `apps/mobile/src/features/event-details/reminder-editor-model.test.ts`
   - valid comma-separated input parses correctly;
   - empty input becomes `[]`;
   - duplicate values are rejected;
   - invalid integer input is rejected;
   - out-of-range values are rejected;
   - malformed empty segments are rejected;
   - more than 5 values are rejected.

You may add one more tiny pure-model test if directly useful for the reminder display/prefill behavior, but keep scope tight.

### Required red-state command

Before implementing the new modules, run a targeted command such as:

```powershell
pnpm --filter @event-app/mobile test -- src/api/event-reminders.test.ts src/features/event-details/reminder-editor-model.test.ts
```

It must fail first because the new modules/behavior do not exist yet.

### Required green-state commands

After implementation, rerun at least:

```powershell
pnpm --filter @event-app/mobile test -- src/api/event-reminders.test.ts src/features/event-details/reminder-editor-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

Do not claim completion without those green checks.

---

## Files expected to change

At minimum, expect changes in files like:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/event-reminders.ts`
- `apps/mobile/src/api/event-reminders.test.ts`
- `apps/mobile/src/features/event-details/reminder-editor-model.ts`
- `apps/mobile/src/features/event-details/reminder-editor-model.test.ts`

Possibly one additional small view-model helper file if truly needed.

Do not modify backend files unless you discover and clearly report a real API contract mismatch.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. The mobile details screen has a visible reminder section with read-only and edit modes.

2. The organizer can open the editor, change the input, and save.

3. Saving sends `PUT /v1/events/:eventId/reminders` with the correct JSON body.

4. Empty input clears all reminders by sending `offsetsMinutes: []`.

5. Local validation blocks malformed input before network request.

6. On success, the screen refetches details and shows the updated reminders.

7. On failure, the screen stays usable and preserves the typed input.

8. Cancel exits edit mode and discards unsaved changes.

9. No backend code is changed unless a real mismatch is found and reported.

10. The required mobile unit tests were added first, observed failing, then made green.

11. `pnpm --filter @event-app/mobile test` is green.

12. `pnpm --filter @event-app/mobile typecheck` is green.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

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
pnpm --filter @event-app/mobile test -- src/api/event-reminders.test.ts src/features/event-details/reminder-editor-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Android manual verification

1. Launch Android Emulator.
2. Open the app.
3. Open an existing event from the organizer list.
4. Verify current reminders are visible.
5. Tap `Edit reminders`.
6. Verify the input is prefilled from current reminders.
7. Change value to something valid such as:
   - `1440, 120, 30`
8. Save and verify the screen refreshes and shows the updated reminder list.
9. Re-open edit mode and clear the field entirely.
10. Save and verify the empty reminder state appears.
11. Re-open edit mode and enter an invalid value such as:
   - `5, 5`
12. Verify local validation blocks submit and shows an error.
13. Enter a malformed value such as:
   - `5, , 10`
14. Verify local validation blocks submit and shows an error.
15. Stop the backend temporarily or break network reachability.
16. Attempt save and verify the screen shows a retryable error while keeping the typed input.

---

## Implementation guardrails

- Keep the diff focused.
- Do not add a navigation library.
- Do not introduce global state management.
- Do not add backend refactors.
- Do not add UI animation libraries.
- Do not add new screens beyond the existing local-screen-state pattern.
- Prefer small pure helpers over large abstractions.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report must include:

1. The exact reminder editor input rules implemented.
2. The exact API helper function added and the endpoint it calls.
3. The exact red-state command run before implementation.
4. The exact green-state commands run after implementation.
5. The final mobile reminder save request payload shape.
6. A short description of success, cancel, clear, and error behaviors on the details screen.

---

## Definition of done

EVT-13 is done when the organizer can open an event on Android, edit reminder offsets in a simple text field, save or clear them through the existing backend API, and the details screen reliably refreshes to reflect the new reminder schedule without losing control of errors or form state.

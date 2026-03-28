# EVT-28 — Mobile delete-event flow from organizer event details

## Status
Ready

## Priority
P1

## Depends on
- EVT-27 must already be implemented in the repository
- Existing mobile event-details flow in `apps/mobile/App.tsx`

## Goal
Add a complete **mobile organizer delete-event flow** on the event details screen.

After this task, an organizer using the mobile app must be able to:
- open an event details screen;
- tap a delete action;
- see an explicit confirmation step;
- confirm deletion;
- have the app call the existing backend `DELETE /v1/events/:eventId` endpoint;
- return to the organizer events list after success;
- see that the deleted event is gone from the list.

This task is **mobile-only**. The backend delete endpoint already exists from EVT-27 and must be reused as-is.

---

## Why this task exists now

Right now the backend can delete an event, but the organizer mobile flow is incomplete because the user cannot perform that action directly from the app.

This task closes that gap and makes event lifecycle management feel complete on mobile:
- create event;
- view event;
- edit event;
- delete event.

---

## Fixed implementation decisions

These decisions are mandatory for this task:

1. Do **not** add a navigation library.
   - Continue using the existing local screen-state approach in `apps/mobile/App.tsx`.

2. Do **not** change backend code.
   - Reuse the existing organizer-only backend endpoint:
     - `DELETE /v1/events/:eventId`

3. Do **not** add React Native render tests or end-to-end UI automation in this task.
   - Use the same style as the current mobile test suite:
     - pure API helper tests;
     - pure view-model / state-model tests.

4. Keep the flow simple and explicit.
   - A delete action must require a confirmation step.
   - No silent delete.
   - No optimistic “pretend success before server confirms”.

5. On successful deletion, the app must navigate back to the organizer list screen and refresh that list.

---

## Out of scope

The following are explicitly out of scope:
- backend API changes;
- database changes;
- undo / restore deleted event;
- soft delete;
- bulk delete;
- archive feature;
- native alerts/modals libraries;
- push notifications;
- analytics vendors;
- redesign of the whole event details screen.

If any of the above appears, it is over-implementation.

---

## Read this project context before implementing

At minimum, read these existing files before making changes:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/http.ts`
- `apps/mobile/src/api/update-event.ts`
- `apps/mobile/src/api/revoke-invite-link.ts`
- `apps/mobile/src/features/edit-event/edit-event-form-model.ts`
- `apps/mobile/src/features/event-details/revoke-invite-link-model.ts`
- `docs/local-development.md`

The new code should match the patterns already used for:
- organizer dev-header behavior;
- no-content API handling;
- local screen-state transitions;
- small pure UI/state helpers.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red → green strictly.

### Tests to add first

Add these tests before production code:

1. `apps/mobile/src/api/delete-event.test.ts`
   Cover at least:
   - request method is `DELETE`;
   - request path is `/v1/events/:eventId`;
   - dev header is included when development organizer mode is enabled;
   - dev header is omitted when that mode is disabled;
   - `204 No Content` is treated as success.

2. `apps/mobile/src/features/event-details/delete-event-model.test.ts`
   Cover at least:
   - default idle state labels;
   - confirmation-visible state labels;
   - loading state disables repeated destructive action intent;
   - fallback error message behavior.

You may add one or two tiny extra tests if they directly support this task, but do not add speculative coverage.

### Required red-state command

Run a targeted mobile test command before implementation, for example:

```powershell
pnpm --filter @event-app/mobile test -- src/api/delete-event.test.ts src/features/event-details/delete-event-model.test.ts
```

It must fail first because the new production modules do not exist yet.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/mobile test -- src/api/delete-event.test.ts src/features/event-details/delete-event-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

---

## Detailed implementation requirements

## 1) New mobile API helper

Create:
- `apps/mobile/src/api/delete-event.ts`

### Requirements

Add a typed helper that calls:
- `DELETE /v1/events/:eventId`

The helper must:
- reuse the existing HTTP wrapper patterns from the mobile app;
- reuse the existing organizer dev-header behavior (`x-dev-user-id`) when enabled;
- treat `204 No Content` as success;
- return `Promise<void>`.

### Exact API behavior expected by the mobile helper

Success:
- `204 No Content`

Error cases to support through existing HTTP error handling:
- `401` organizer header missing or unknown;
- `404` event missing or not owned;
- network failure;
- invalid/unexpected response handling through the existing shared HTTP layer.

Do **not** add a new backend wrapper layer beyond what is needed for this helper.

---

## 2) New pure delete-event state/view model helper

Create:
- `apps/mobile/src/features/event-details/delete-event-model.ts`

This file must be pure and must not depend on React.

### Goal

Keep the delete section labels and simple state derivation out of `App.tsx`.

### Required user-facing strings

Use these exact strings:

- Action button label:
  - `Delete event`
- Confirmation text:
  - `Delete this event? This cannot be undone.`
- Confirm button label:
  - `Confirm delete`
- Cancel button label:
  - `Cancel`
- Loading label/message (if needed by the state helper):
  - `Deleting event...`
- Fallback error message:
  - `Could not delete event.`

### Model requirements

The pure helper should make it easy for UI code to derive:
- whether confirmation is hidden or visible;
- whether delete is currently loading;
- whether the confirm action should be disabled;
- which error message to show.

Keep this helper small and deterministic.

---

## 3) Integrate delete flow into `apps/mobile/App.tsx`

Update the organizer event details screen.

### Required behavior

When an organizer is on event details:

1. A visible delete action must be available:
   - `Delete event`

2. First tap must **not** immediately delete.
   - It must reveal an explicit confirmation state.

3. The confirmation state must show:
   - `Delete this event? This cannot be undone.`
   - `Confirm delete`
   - `Cancel`

4. If the user taps `Cancel`:
   - hide the confirmation state;
   - clear local delete error state;
   - keep the user on the details screen.

5. If the user taps `Confirm delete`:
   - call the new mobile API helper;
   - block duplicate delete submissions while the request is in flight;
   - show a loading state/message suitable for the current UI structure.

6. On successful delete:
   - clear the selected event details screen state;
   - navigate back to the organizer list screen;
   - refresh the organizer list using the current scope;
   - ensure the deleted event no longer appears in the list.

7. On failed delete:
   - stay on the details screen;
   - keep the confirmation UI visible or otherwise keep the user in an understandable delete state;
   - show `Could not delete event.` for unexpected failure if no more specific message exists;
   - do not clear the currently loaded event details.

### State reset requirements on success

After successful delete, clear the deleted-event-specific local state that is no longer relevant, including at least:
- selected event id;
- delete confirmation visibility;
- delete error state;
- details-local transient state that would incorrectly survive into the next selected event.

Do this carefully and minimally.

### Important UX constraints

- Do not auto-delete without confirmation.
- Do not navigate to a blank broken details screen after deletion.
- Do not leave stale deleted-event data visible after success.
- Do not add modal packages or new navigation dependencies.

---

## 4) Error handling requirements

The delete flow must handle these categories cleanly:

1. Validation / HTTP failure from backend
   - For example 401/404
   - Surface an understandable error state
   - Keep the user on details

2. Network failure
   - Show a useful failure state
   - Keep details loaded

3. Unexpected decode / runtime failure
   - Show fallback `Could not delete event.`

Use existing mobile error-handling patterns where possible.

---

## 5) No backend changes in this task

This is important.

Do **not** modify:
- `apps/api/**`
- Prisma schema
- migrations
- backend tests

This task is purely about using the backend delete endpoint that already exists.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. A new mobile helper exists for `DELETE /v1/events/:eventId`.
2. A new pure delete-event model/helper exists and is tested.
3. The event details screen shows `Delete event`.
4. Delete requires explicit confirmation.
5. `Cancel` exits confirmation without deleting.
6. Successful delete returns the user to the organizer events list.
7. The list refreshes and the deleted event is gone.
8. Failed delete keeps the user on the details screen and shows an error message.
9. Duplicate delete submissions are prevented while in flight.
10. No backend files were changed.
11. Targeted tests, full mobile tests, and mobile typecheck are green.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

pnpm --filter @event-app/mobile test -- src/api/delete-event.test.ts src/features/event-details/delete-event-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Android manual verification

Use this exact flow locally:

1. Start the backend and mobile app as usual.
2. Open organizer events list.
3. Open an existing event details screen.
4. Tap `Delete event`.
5. Confirm that the confirmation text appears.
6. Tap `Cancel`.
7. Confirm the event is still present and details remain visible.
8. Tap `Delete event` again.
9. Tap `Confirm delete`.
10. Confirm the app returns to the events list.
11. Confirm the deleted event is no longer present.
12. Simulate backend failure or disconnect network.
13. Attempt delete again on another event.
14. Confirm the app stays on details and shows an error message.

---

## Implementation notes and guardrails

- Keep the diff small and focused.
- Reuse existing mobile API/config patterns.
- Reuse existing local state patterns in `App.tsx`.
- Do not introduce a navigation library.
- Do not redesign unrelated UI sections.
- Do not change README.md.
- Do not change task files.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for EVT-28 must explicitly include:

1. the exact delete-event API helper path and function name;
2. the exact user-facing delete confirmation strings used;
3. the exact targeted red-state command;
4. the exact targeted green-state command;
5. a brief explanation of what happens after successful delete in the mobile app.

---

## Definition of done

EVT-28 is done when an organizer can open event details in the mobile app, explicitly confirm deletion, have the server delete the event, automatically return to the refreshed events list, and see that the deleted event is gone — while all mobile tests remain green.

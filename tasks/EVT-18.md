# EVT-18 — Mobile edit-event flow on organizer event details

## Status
Ready

## Priority
P1

## Depends on
- EVT-10
- EVT-11
- EVT-13
- EVT-17

## Goal

Add a mobile organizer edit-event flow on top of the existing backend PATCH API from `EVT-17`.

This task must introduce:

- a typed mobile API helper for `PATCH /v1/events/:eventId`;
- a pure edit-event form model for validation + normalization;
- an edit mode/screen reachable from organizer event details;
- prefilled event values from the already loaded details data;
- save / cancel / retry behavior;
- correct details refresh and list refresh after successful save.

This is a **mobile-only** task.

Do **not** change backend files in `EVT-18` unless an obvious contract mismatch is discovered; if such a mismatch exists, stop and report it instead of inventing new backend behavior.

---

## Why this task exists now

The organizer can already:

- see the events list;
- open event details;
- create events;
- manage reminders from mobile;
- create/share invite links;
- preview public invite flows;
- open public invite screens from deep links.

The missing organizer capability on mobile is editing an existing event after creation.

The backend PATCH API already exists from `EVT-17`, so the next step is wiring that capability into the mobile app.

---

## Fixed implementation decisions for this task

These decisions are mandatory.

1. This task is **mobile-only**.
2. Reuse the existing single-file local-state navigation approach in `apps/mobile/App.tsx`.
3. Do **not** add React Navigation or any other navigation library.
4. Do **not** add state-management libraries.
5. The mobile flow must use the existing event details data as the source for initial form values.
6. The mobile edit form must edit only the basic event fields handled by the backend PATCH endpoint:
   - `title`
   - `description`
   - `location`
   - `startsAt`
   - `timezone`
   - `capacityLimit`
7. Reminder editing is already handled elsewhere and must remain separate.
8. Invite-link editing is out of scope.
9. Validation/normalization on mobile must be explicit and deterministic.
10. Successful save must refresh details and ensure the organizer events list is refreshed when returning to list.

---

## Out of scope

The following are explicitly out of scope for `EVT-18`:

- backend changes;
- deleting events;
- editing attendees manually;
- payments;
- recurring events;
- plus-ones UI;
- image uploads;
- auth-provider work;
- design-system overhaul;
- React Navigation;
- offline queueing.

If any of the above appears, it is over-implementation.

---

## Existing backend contract to use

Use the existing organizer-only endpoint:

`PATCH /v1/events/:eventId`

Use the same development organizer header behavior already used by the mobile organizer API helpers.

### Request body shape

The helper must send a partial JSON payload containing only these fields:

- `title?: string`
- `description?: string | null`
- `location?: string | null`
- `startsAt?: string`
- `timezone?: string`
- `capacityLimit?: number | null`

### Success response shape

The helper must expect the same shape returned by organizer event read:

```json
{
  "id": "evt_123",
  "title": "Friday Board Games",
  "description": "Bring drinks",
  "location": "Prospekt Mira 10",
  "startsAt": "2026-03-20T16:30:00.000Z",
  "timezone": "Europe/Moscow",
  "capacityLimit": 8,
  "organizerUserId": "organizer-1",
  "createdAt": "2026-03-10T12:00:00.000Z",
  "updatedAt": "2026-03-18T10:00:00.000Z"
}
```

Treat the backend as the source of truth for the saved result.

---

## Required mobile API helper

Create a new typed helper, in the existing API-layer style, for example:

- `apps/mobile/src/api/update-event.ts`

It must:

1. build the correct `PATCH /v1/events/:eventId` request;
2. use the shared HTTP wrapper already used by the other mobile helpers;
3. include `x-dev-user-id` only in the same development flow style already used by organizer helpers;
4. return a typed response object;
5. avoid any UI logic inside the API layer.

### Helper tests required

Add test-first coverage for at least:

- correct path and method;
- correct request body passthrough;
- dev header included when enabled;
- dev header omitted when disabled;
- typed response passthrough.

---

## Required pure edit form model

Create a pure helper module, for example:

- `apps/mobile/src/features/edit-event/edit-event-form-model.ts`

This module must handle:

1. building initial form values from loaded event details;
2. validating user input;
3. normalizing optional values;
4. building the PATCH payload to send.

This module must stay UI-framework-agnostic.

### Required editable fields in the form model

- `title`
- `description`
- `location`
- `startsAt`
- `timezone`
- `capacityLimit`

### Validation / normalization rules

Mirror the backend rules closely enough to prevent obvious bad requests.

#### `title`
- required;
- trim surrounding whitespace;
- reject blank after trim;
- keep max-length check aligned with existing create form logic.

#### `description`
- optional;
- trim surrounding whitespace;
- blank string normalizes to `null`.

#### `location`
- optional;
- trim surrounding whitespace;
- blank string normalizes to `null`.

#### `startsAt`
- required;
- must be a valid ISO datetime string input for this simplified MVP;
- reject blank or invalid datetime strings.

#### `timezone`
- required;
- trim surrounding whitespace;
- reject blank.

#### `capacityLimit`
- optional text input in the UI;
- blank input normalizes to `null`;
- otherwise must parse as integer;
- must be `>= 1`;
- reject floats, negatives, zero, malformed strings.

### Form-model output shape requirement

Use an explicit result shape similar to your create-event form helper, for example:

- success: `{ ok: true, payload }`
- failure: `{ ok: false, fieldErrors, message }`

Keep error reporting deterministic and field-oriented.

### Form-model tests required

Add test-first coverage for at least:

- initial value mapping from event details;
- trim/normalization behavior;
- blank optional strings → `null`;
- required-field validation;
- invalid ISO datetime rejection;
- invalid capacityLimit rejection;
- blank capacityLimit → `null`;
- success payload shape.

---

## Required App.tsx behavior

Extend the current local-state app flow to support a new organizer edit-event screen/state.

This task may keep everything inside `App.tsx`, consistent with the current project style.

### Navigation/state requirements

Add a new screen/state, for example:

- `edit-event`

Flow requirements:

1. Organizer opens event details.
2. A visible `Edit event` action is available on the details screen.
3. Pressing it opens the edit form prefilled from the current details data.
4. `Cancel` returns to details without saving.
5. Successful save returns to details and shows refreshed data.
6. Returning from details to list must continue to refresh the list so the updated card data appears.

### Edit screen UI requirements

Provide a simple MVP edit form with text inputs for:

- Title
- Description
- Location
- Starts at (ISO)
- Timezone
- Capacity limit

Also include:

- primary `Save changes` action;
- secondary `Cancel` action;
- loading state while saving;
- duplicate-submit prevention while request is in flight;
- field-level validation errors;
- a general submit error area for API/network/unexpected failures.

No styling overhaul is needed. Keep the UI consistent with the current simple MVP look.

---

## Save behavior requirements

When user presses `Save changes`:

1. run local form validation first;
2. if invalid, stay on the edit screen and show field/general errors;
3. if valid, call the new PATCH helper;
4. disable repeated submit while request is in flight;
5. on success:
   - update the selected event ID/details flow using fresh backend data;
   - leave edit mode;
   - show refreshed details;
   - ensure the list refreshes when returning to organizer list;
6. on failure:
   - stay in edit mode;
   - keep typed values intact;
   - show a user-visible error message.

### Failure-mode expectations

At minimum handle these categories separately enough for the UI:

- local validation failure;
- network failure;
- HTTP 400 / 401 / 404 / other non-2xx API failure;
- unexpected decode/runtime failure.

You do not need perfect design copy, but the messages must be understandable.

---

## Important data-refresh rules

After successful save:

- event details shown on screen must reflect the saved backend response;
- if the user goes back to organizer list, the list must refresh so the updated event title/time/etc. appear;
- do not require a full app restart to see the update.

The task does **not** require optimistic updates.

A simple refetch-based flow is preferred.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

Before implementing production code, add the new tests first.

### Required tests to add first

1. API helper tests:
   - request path/method/body;
   - dev-header behavior;
   - typed response passthrough.

2. Form-model tests:
   - initial mapping;
   - validation/normalization;
   - payload building.

No React Native rendering tests are required in this task.

### Required red-state proof

Before implementing the production modules, run the smallest targeted mobile test command and confirm failure because the new modules do not exist yet or the required behavior is not implemented yet.

Example acceptable command:

```powershell
pnpm --filter @event-app/mobile test -- src/api/update-event.test.ts src/features/edit-event/edit-event-form-model.test.ts
```

### Required green-state proof

After implementation, rerun:

- the targeted tests;
- the full mobile test suite;
- mobile typecheck.

### Forbidden shortcuts

Do not:

- weaken tests to make them pass;
- skip tests;
- silently change unrelated mobile flows;
- add backend changes “just in case”.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. Mobile has a typed PATCH helper for event updates.
2. Mobile has a pure edit-event form model with deterministic validation/normalization.
3. Organizer event details screen has a visible `Edit event` entry point.
4. Edit screen is prefilled from current event details.
5. Save calls the backend PATCH endpoint correctly.
6. Cancel returns to details without saving.
7. Success refreshes details and later list state.
8. Failure keeps typed values and shows an error.
9. Targeted mobile tests were written first and observed red before implementation.
10. Full mobile tests are green.
11. Mobile typecheck is green.
12. No backend files were changed unless an actual contract mismatch forced a minimal fix (which must be explicitly reported).

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install
pnpm --filter @event-app/mobile test -- src/api/update-event.test.ts src/features/edit-event/edit-event-form-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Manual mobile verification

With backend already running locally:

1. Open organizer home.
2. Open an event details screen.
3. Tap `Edit event`.
4. Confirm form is prefilled with the current event data.
5. Change only the title and save.
6. Confirm details screen shows updated title.
7. Go back to list and confirm the card reflects the updated title.
8. Re-open edit screen and test cancel without saving.
9. Enter invalid inputs (blank title, invalid capacity, invalid startsAt) and confirm validation messages.
10. Stop backend and confirm save failure keeps typed values and shows a clear error.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-18` must explicitly include:

1. the exact API helper request/response types used;
2. the exact edit-form validation result shape;
3. the exact red-state command and failure reason;
4. the exact green-state commands run;
5. the list of changed mobile files;
6. a short note explaining how details refresh and list refresh are triggered after successful save.

---

## Definition of done

`EVT-18` is done when the organizer can open an existing event on mobile, edit the basic event fields, save them through the existing PATCH backend API, see refreshed details immediately, and later see refreshed list data — with mobile tests and typecheck green.

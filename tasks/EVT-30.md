# EVT-30 — Mobile organizer support for plus-ones on create/edit/details

## Status
Ready

## Priority
P1

## Depends on
- EVT-11
- EVT-18
- EVT-21
- EVT-29

## Goal
Add mobile organizer-side support for the already-implemented backend `allowPlusOnes` event setting.

After this task:
- organizer can enable or disable plus-ones when creating an event;
- organizer can edit the plus-ones setting on an existing event;
- event details clearly show whether plus-ones are allowed;
- attendee rows clearly show each guest's `plusOnesCount` when greater than zero.

This is a **mobile-only** task.
Do not change backend files in this task.

---

## Why this task exists now

EVT-29 added backend support for plus-ones:
- event payloads include `allowPlusOnes`;
- RSVP payload/response include `plusOnesCount`;
- backend capacity and waitlist logic now understands headcount.

However, the organizer still cannot control this feature from the mobile app.
That leaves the feature incomplete from a real user point of view.

This task closes the organizer half of the plus-one feature on mobile.
The guest RSVP UI for entering `plusOnesCount` will be handled in a later task.

---

## Strict scope

### In scope
- mobile API type updates needed to carry `allowPlusOnes` and `plusOnesCount`;
- create-event form support for `allowPlusOnes`;
- edit-event form support for `allowPlusOnes`;
- event details view-model support for displaying whether plus-ones are allowed;
- attendee row display support for showing `plusOnesCount` when > 0;
- small UI changes in `App.tsx` to expose and use the above.

### Out of scope
- backend changes;
- migrations;
- public RSVP form support for entering plus-ones;
- changing waitlist logic;
- changing audit behavior;
- navigation library work;
- styling overhaul;
- push notifications.

---

## Required mobile behavior

## 1) Create-event screen

The organizer create-event screen must include a simple control for whether guests may bring additional people.

### Required field behavior
- field name in local form state: `allowPlusOnes`
- default value: `false`
- when enabled, the payload sent to create-event API must include:
  - `allowPlusOnes: true`
- when disabled, payload must include:
  - `allowPlusOnes: false`

### UI requirement
Keep the UI simple and implementation-friendly.
A toggle, switch, segmented control, or button pair is acceptable.

Required visible label text:
- `Allow plus-ones`

Required helper text:
- `Guests can bring additional people.`

Do not over-design this.

---

## 2) Edit-event screen

The organizer edit-event screen must support reading and changing `allowPlusOnes`.

### Required behavior
- initial form value must come from loaded event details;
- if event details say `allowPlusOnes: true`, the edit screen must show enabled state;
- saving the edit screen must include the chosen `allowPlusOnes` value in PATCH payload;
- existing validation behavior for the rest of the form must stay intact.

### Important note
Do **not** implement a duplicate frontend validation that blocks disabling plus-ones when attendees already have plus ones.
That rule already exists on backend.
If backend rejects the PATCH with 400, the existing general error flow is enough for this task.

---

## 3) Event details screen

The organizer event details screen must clearly show whether plus-ones are allowed.

### Required visible text
When allowed:
- `Plus-ones: allowed`

When not allowed:
- `Plus-ones: not allowed`

This may be shown near other event basics.
Keep the placement simple and consistent with the existing details screen.

---

## 4) Attendee rows on details screen

Attendee rows must show extra headcount information when applicable.

### Required behavior
If `plusOnesCount === 0`:
- no extra plus-one text is required.

If `plusOnesCount === 1`:
- row must show: `+1`

If `plusOnesCount > 1`:
- row must show: `+<N>`
  - example: `+3`

This is display-only in this task.
Do not add editing of attendee plus-ones here.

---

## 5) API/helper/type updates required

You must update the relevant mobile API types so the app can actually use the backend fields added in EVT-29.

At minimum, check and update these files if needed:
- `apps/mobile/src/api/create-event.ts`
- `apps/mobile/src/api/update-event.ts`
- `apps/mobile/src/api/event-details.ts`
- any shared local response/input types used by these modules
- view-model files under `apps/mobile/src/features/...`

### Required fields to support
On event create/update request types:
- `allowPlusOnes: boolean`

On organizer event details response typing:
- `allowPlusOnes: boolean`

On attendee response typing / local attendee models:
- `plusOnesCount: number`

Do not silently ignore these fields.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

You must follow red -> green.

## Tests to add first

Add/update only the mobile tests directly relevant to this task.

### Required tests
1. `apps/mobile/src/api/create-event.test.ts`
   - verify request payload includes `allowPlusOnes`

2. `apps/mobile/src/api/update-event.test.ts`
   - verify PATCH payload includes `allowPlusOnes`

3. `apps/mobile/src/features/create-event/create-event-form-model.test.ts`
   - verify default `allowPlusOnes` is false
   - verify payload builder includes chosen boolean

4. `apps/mobile/src/features/edit-event/edit-event-form-model.test.ts`
   - verify initial form reads `allowPlusOnes`
   - verify payload builder includes changed boolean

5. `apps/mobile/src/features/event-details/event-details-model.test.ts`
   - verify details model exposes human-readable plus-ones label

6. `apps/mobile/src/features/event-details/attendee-row-model.test.ts`
   - verify `plusOnesCount` display rules:
     - 0 => no `+N`
     - 1 => `+1`
     - N => `+N`

### Acceptable red-state reasons
- missing type fields;
- helper/model functions not updated;
- payload builders not including `allowPlusOnes`;
- attendee row mapper not exposing plus-one label.

### Green-state requirement
After implementation, all targeted tests, full mobile tests, and mobile typecheck must pass.

---

## Required implementation notes

## Create-event form model

Update the form model to include:
- `allowPlusOnes: boolean`

The payload builder must include it explicitly.

## Edit-event form model

Update the initial mapper and payload builder to include:
- `allowPlusOnes: boolean`

## Event details model

Expose a field that the UI can directly render, for example:
- `plusOnesLabel: string`

Expected values:
- `Plus-ones: allowed`
- `Plus-ones: not allowed`

## Attendee row model

Expose a display string or nullable field for attendee plus-ones.
Examples of acceptable outputs:
- `null`
- `+1`
- `+2`

Keep this helper pure and deterministic.

---

## `App.tsx` changes required

You must wire the new model/API fields into the existing screens.

### Required screens to update
- organizer create-event screen
- organizer edit-event screen
- organizer event-details screen

### Required UX behavior
- create/edit forms must keep current validation/submission flows intact;
- new plus-one control must preserve existing field values;
- on successful create/edit, event details/list must reflect the saved `allowPlusOnes` value;
- attendee section must render plus-one text where applicable.

Do not add a navigation library.
Do not refactor the app structure beyond what is necessary.

---

## Acceptance criteria

This task is complete only if all are true:

1. Organizer can enable/disable plus-ones on create screen.
2. Organizer can enable/disable plus-ones on edit screen.
3. Create-event API payload includes `allowPlusOnes`.
4. Update-event API payload includes `allowPlusOnes`.
5. Event details screen shows either:
   - `Plus-ones: allowed`
   - `Plus-ones: not allowed`
6. Attendee rows show `+N` when `plusOnesCount > 0`.
7. No backend files are changed.
8. Targeted mobile tests are added first and shown red before implementation.
9. `pnpm --filter @event-app/mobile test` passes.
10. `pnpm --filter @event-app/mobile typecheck` passes.

---

## Local verification commands (PowerShell-friendly)

```powershell
pnpm install

pnpm --filter @event-app/mobile test -- `
  src/api/create-event.test.ts `
  src/api/update-event.test.ts `
  src/features/create-event/create-event-form-model.test.ts `
  src/features/edit-event/edit-event-form-model.test.ts `
  src/features/event-details/event-details-model.test.ts `
  src/features/event-details/attendee-row-model.test.ts

pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile android
```

### Manual Android verification

Use an already running Android emulator.

1. Open create-event screen.
2. Confirm `Allow plus-ones` is visible and defaults to off.
3. Create one event with plus-ones disabled.
4. Create one event with plus-ones enabled.
5. Open details for both and confirm the details label changes correctly.
6. Open edit screen for an event and flip the setting.
7. Save and confirm details reflect the change.
8. Open an event that has attendee rows with `plusOnesCount > 0` and confirm row text shows `+N`.

---

## Final report requirements

In addition to the standard run prompt, the final report must include:

1. exact files changed;
2. exact targeted red-state command;
3. exact targeted green-state command;
4. confirmation that no backend files were changed;
5. the exact visible strings used for plus-ones in create/edit/details/attendee rows.

---

## Definition of done

`EVT-30` is done when the organizer can control the plus-one setting from the mobile app, event details visibly show whether plus-ones are allowed, attendee rows show `+N` where applicable, and the mobile test suite stays green.

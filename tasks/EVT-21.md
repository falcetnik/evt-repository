# EVT-21 — Mobile organizer attendee section filters on event details

## Status
Ready

## Priority
P1

## Depends on
- EVT-10
- EVT-20

## Goal

Improve the organizer attendee section on the mobile event-details screen so it is actually usable for real event management.

This task must add **client-side attendee filters** and **clear attendee row labels** on top of the existing organizer event-details flow.

The backend already returns attendee data in the details payload flow. This task is **mobile-only** and must not modify backend contracts.

---

## Why this task exists now

The mobile app already has:

- organizer events list;
- organizer event details;
- attendee data in the details response flow;
- invite-link loading;
- reminders editing;
- public invite / RSVP flow;
- event editing.

However, the attendee section is still too raw for real organizer use. Once an event has many attendees, the organizer needs to quickly answer:

- who is confirmed;
- who is waitlisted;
- who is maybe;
- who is not going.

This task adds that organizer usability layer without changing backend APIs.

---

## Fixed implementation decisions for this task

These are mandatory for EVT-21.

1. This task is **mobile-only**.
2. Do **not** change backend code, migrations, DTOs, or API responses.
3. Use the attendee array already available in the existing mobile event-details flow.
4. Filtering must be **purely client-side**. No extra API requests are allowed when switching attendee filters.
5. Keep the current attendee ordering returned by the backend.
   - Do not add client-side sorting.
   - Filtering may hide rows, but must preserve backend order among visible rows.
6. The attendee section must support these exact filter keys:
   - `all`
   - `confirmed`
   - `waitlisted`
   - `maybe`
   - `not_going`
7. Default selected filter is `all`.
8. Filter selection must stay on the event-details screen until the user leaves that screen.
9. Refreshing the event-details screen must keep the currently selected attendee filter.
10. No new navigation library may be added.

---

## Out of scope

The following are explicitly out of scope:

- editing attendee RSVP from organizer side;
- deleting attendees;
- exporting attendees;
- attendee search;
- backend-side filtering;
- pagination;
- attendee avatars;
- push/email functionality;
- auth changes;
- visual design overhauls;
- React Native Testing Library screen tests.

---

## Existing assumptions to preserve

The existing details flow already has attendee objects with fields needed for organizer display, including current RSVP status and attendance placement fields.

Do not change those contracts in this task. Build on top of them.

---

## Required UX behavior

## 1) Attendee filters on event-details screen

Add a filter control inside the attendee section of the organizer event-details screen.

The section must support these filters:

- `All`
- `Confirmed`
- `Waitlisted`
- `Maybe`
- `Not going`

These labels are user-facing and should be shown exactly as above.

### Filter semantics

Use these exact semantics:

- `all`
  - shows every attendee row in backend order.
- `confirmed`
  - shows attendees with organizer-visible attendance state `confirmed`.
- `waitlisted`
  - shows attendees with organizer-visible attendance state `waitlisted`.
- `maybe`
  - shows attendees whose RSVP status is `maybe`.
- `not_going`
  - shows attendees whose RSVP status is `not_going`.

Important distinction:
- `confirmed` and `waitlisted` are based on attendance placement.
- `maybe` and `not_going` are based on RSVP status.

Do not collapse `waitlisted` into `maybe`.

### Empty filter state

If the selected filter has no visible attendees, show a clear empty message inside the attendee section:

- `No attendees in this filter.`

This must not be confused with the broader details-screen loading or error state.

### Filter switching behavior

Switching filters must:

- be instant;
- not trigger network requests;
- not reset the details screen;
- not reset invite/reminder UI states.

---

## 2) Attendee row labels

Each visible attendee row must display at least:

- guest name;
- guest email;
- a concise status label.

Use these exact status-label rules:

- confirmed attendee:
  - `Going · Confirmed`
- waitlisted attendee with position:
  - `Going · Waitlist #<position>`
- maybe attendee:
  - `Maybe`
- not-going attendee:
  - `Not going`

If a waitlisted attendee somehow lacks a numeric position in the input data, fall back to:

- `Going · Waitlisted`

Do not invent any other labels in this task.

### Important row-order rule

The attendee rows must preserve the exact backend order from the details payload.  
The filter only removes rows from view; it must not re-sort them.

---

## 3) Section summary above filters

Keep the existing attendee summary already shown by the details screen.

In addition, the filter control should make it easy to understand counts.

Each filter option must display its own count, derived locally from current attendee data.

Required counts:

- `All` => total attendee rows
- `Confirmed` => visible count for confirmed filter
- `Waitlisted` => visible count for waitlisted filter
- `Maybe` => visible count for maybe filter
- `Not going` => visible count for not_going filter

The exact visual formatting is flexible, but the counts must be present in the UI state model and rendered in the screen.

Examples of acceptable visible formatting:

- `All (6)`
- `Confirmed (3)`
- `Waitlisted (1)`

Do not issue network requests just to compute these counts.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

### Tests to add first

Add these test files first:

1. `apps/mobile/src/features/event-details/attendee-filter-model.test.ts`
2. `apps/mobile/src/features/event-details/attendee-row-model.test.ts`

### Required red-state behavior

Before implementing the production modules, run:

```powershell
pnpm --filter @event-app/mobile test -- src/features/event-details/attendee-filter-model.test.ts src/features/event-details/attendee-row-model.test.ts
```

The initial failure must happen because the new production modules do not exist yet, or because the required behavior is not implemented yet.

### Required green-state behavior

After implementation, rerun:

```powershell
pnpm --filter @event-app/mobile test -- src/features/event-details/attendee-filter-model.test.ts src/features/event-details/attendee-row-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

Do not weaken tests to make them pass.

---

## Required implementation

## 1) New pure attendee-section model helpers

Create pure helpers under:

- `apps/mobile/src/features/event-details/`

You may split them into one or two production files, but the behavior must be testable without React rendering.

### Required pure helper responsibilities

At minimum, the pure model layer must be able to:

1. derive per-filter counts from attendee input;
2. derive visible attendees for a selected filter;
3. map each attendee row to the exact required user-facing status label.

This model layer must be fully deterministic and side-effect free.

### Suggested types

You may choose the exact names, but the model layer should conceptually expose:

- a selected filter type;
- a function to build attendee filter metadata;
- a function to build visible attendee rows;
- a function to map an attendee to its display label.

The returned view-model data should be directly consumable by `App.tsx`.

---

## 2) Integrate attendee filters into `apps/mobile/App.tsx`

Update the existing organizer event-details screen so the attendee section uses the new pure model helpers.

### Required behavior in `App.tsx`

- maintain selected attendee filter in local screen state;
- default to `all` when a details screen is first opened;
- keep selected filter when details data refreshes;
- render filter controls;
- render filtered attendee rows;
- render `No attendees in this filter.` when appropriate.

### Constraints

- do not add a navigation library;
- do not rewrite the whole screen architecture;
- keep changes focused on the attendee section.

---

## 3) Preserve existing behavior

This task must not regress the following existing details-screen capabilities:

- event basics display;
- current invite-link section;
- create/reuse/share/preview invite flow;
- reminders section and reminder editing;
- edit-event entry flow;
- details refresh;
- back navigation.

If the attendee filter implementation interferes with those, it is incorrect.

---

## Test requirements in detail

## `attendee-filter-model.test.ts`

This file must cover at least:

1. counts are derived correctly for all 5 filters;
2. `all` preserves backend order;
3. `confirmed` shows only confirmed attendees;
4. `waitlisted` shows only waitlisted attendees;
5. `maybe` shows only maybe attendees;
6. `not_going` shows only not-going attendees;
7. empty filtered result is supported cleanly.

Use mixed attendee fixtures that include:

- confirmed going;
- waitlisted going with numeric position;
- maybe;
- not-going.

## `attendee-row-model.test.ts`

This file must cover at least:

1. confirmed label => `Going · Confirmed`
2. waitlisted label with numeric position => `Going · Waitlist #N`
3. waitlisted fallback without position => `Going · Waitlisted`
4. maybe label => `Maybe`
5. not-going label => `Not going`

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. Organizer event-details screen displays attendee filter controls.
2. The filter options are exactly:
   - All
   - Confirmed
   - Waitlisted
   - Maybe
   - Not going
3. Each filter shows a derived count.
4. Switching filters is instantaneous and client-side only.
5. Visible attendee rows preserve backend order.
6. Row labels exactly match the required rules.
7. Empty filtered state shows:
   - `No attendees in this filter.`
8. Existing details-screen functionality still works.
9. No backend files are changed.
10. The new targeted mobile tests are added first and pass after implementation.
11. Full mobile test suite is green.
12. Mobile typecheck is green.

---

## Local verification commands (PowerShell-friendly)

```powershell
pnpm install

pnpm --filter @event-app/mobile test -- src/features/event-details/attendee-filter-model.test.ts src/features/event-details/attendee-row-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

---

## Manual verification steps (Android / Expo)

Use an event that already has a mixed attendee set:

- at least one confirmed attendee;
- at least one waitlisted attendee;
- at least one maybe attendee;
- at least one not-going attendee.

Then verify:

1. Open organizer home.
2. Open an event-details screen with attendees.
3. Confirm attendee section shows filter controls with counts.
4. Confirm default filter is `All`.
5. Switch to `Confirmed` and verify only confirmed rows remain.
6. Switch to `Waitlisted` and verify `Going · Waitlist #<position>` labels.
7. Switch to `Maybe` and verify only maybe rows remain.
8. Switch to `Not going` and verify only not-going rows remain.
9. Open a filter with zero rows and verify:
   - `No attendees in this filter.`
10. Refresh details and confirm the selected attendee filter remains selected.
11. Confirm invite/reminder/edit-event functionality still works.

---

## Final report requirements for this task

In addition to the global run prompt, the final report must include:

1. the exact new production files added for attendee filter modeling;
2. the exact targeted red-state command used before implementation;
3. confirmation that no backend files changed;
4. a concise summary of how filter counts and attendee labels are derived.

---

## Definition of done

EVT-21 is done when the organizer can open an event on mobile, switch between attendee filters instantly, understand attendee placement from clear labels, and manage the event without losing existing details-screen functionality.

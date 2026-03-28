# EVT-26 — Mobile revoke current invite link flow on event details

## Status
Ready

## Priority
P1

## Depends on
- EVT-12
- EVT-19
- EVT-20
- EVT-22
- EVT-25

## Goal

Add a complete **mobile organizer flow** for disabling the current active invite link from the event-details screen.

After this task:

- if an event currently has an active invite link, the organizer can disable it from the mobile app;
- the app asks for explicit confirmation before disabling;
- after successful disable, the invite section immediately switches to the existing empty state;
- share / preview actions disappear because the link is no longer active;
- the existing create/reuse action can still be used afterward to create a fresh active link again.

This is a **mobile-only task**. The backend revoke API already exists and must be consumed, not reimplemented.

---

## Why this task exists now

The product already supports:

- showing the current active invite link on event details;
- creating/reusing an invite link;
- previewing the public invite page;
- sharing the invite link;
- backend revoke of the current active invite link.

But the organizer still cannot finish the full invite-link lifecycle from the phone.

This task closes that gap.

---

## In scope

1. Add a typed mobile API helper for:
   - `DELETE /v1/events/:eventId/invite-link`

2. Add a small pure helper/model for local revoke UI state.

3. Update `apps/mobile/App.tsx` event-details invite section so that:
   - when an active link exists, a revoke action is shown;
   - tapping revoke enters a confirmation state;
   - confirming calls the backend;
   - success transitions the section into the existing empty invite state;
   - failure keeps the existing invite visible and shows an error;
   - cancel leaves the current invite visible and clears confirmation state.

4. Add focused mobile unit tests first.

---

## Out of scope

Do **not** do any of the following in EVT-26:

- no backend changes;
- no Prisma changes;
- no migrations;
- no auth changes;
- no redesign of the whole details screen;
- no deep-link work;
- no regeneration endpoint;
- no expiry editing;
- no invite analytics.

Only wire the already-existing revoke backend behavior into the mobile app.

---

## Existing backend contract to use

Use the already-existing organizer endpoint:

- `DELETE /v1/events/:eventId/invite-link`

Expected success behavior:

- HTTP `204 No Content`

Important meaning:

- the backend deactivates the current usable invite link if it exists;
- if there is no usable link, the backend still behaves safely (idempotent no-op);
- after a successful revoke, `GET /v1/events/:eventId/invite-link` should return:
  - `{ eventId, inviteLink: null }`

The mobile app must treat `204` as success with no JSON body.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red -> green.

### Tests to add first

Add these new test files before production implementation:

1. `apps/mobile/src/api/revoke-invite-link.test.ts`
2. `apps/mobile/src/features/event-details/revoke-invite-link-model.test.ts`

### Required red-state command

Run this exact targeted command before implementing the production modules:

```powershell
pnpm --filter @event-app/mobile test -- src/api/revoke-invite-link.test.ts src/features/event-details/revoke-invite-link-model.test.ts
```

Expected initial red reason:

- missing production modules / missing functions.

That is acceptable and expected.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/mobile test -- src/api/revoke-invite-link.test.ts src/features/event-details/revoke-invite-link-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

---

## Detailed implementation requirements

## 1) New mobile API helper

Create:

- `apps/mobile/src/api/revoke-invite-link.ts`

### Required exported function

Export a function with intent equivalent to:

- `revokeCurrentInviteLink(eventId: string): Promise<void>`

### Required behavior

- uses HTTP method `DELETE`
- path: `/v1/events/:eventId/invite-link`
- uses the same API base URL conventions as other organizer mobile helpers
- uses the same development organizer header behavior as other organizer mobile helpers:
  - include `x-dev-user-id` only when the current mobile config says to do so
- treats `204` as success
- should not try to parse JSON on success

### Test coverage expectations

`revoke-invite-link.test.ts` must cover at least:

1. correct HTTP method
2. correct URL path
3. dev header included when enabled
4. dev header omitted when disabled
5. success handling for a no-content response

Do not add network rendering tests. Keep it pure and small.

---

## 2) New pure local revoke-state helper

Create:

- `apps/mobile/src/features/event-details/revoke-invite-link-model.ts`

This helper exists to keep state/labels deterministic and testable outside React UI.

### Required behavior

It must support the event-details invite section local confirmation flow.

At minimum, design it so UI can cleanly represent these states:

- idle success state with current invite visible
- confirm state
- loading state while revoke is in-flight
- error state after failed revoke

You do **not** need a complicated state machine, but the helper must make the labels/messages deterministic.

### Required user-facing strings

Use these exact user-facing texts somewhere in the helper/model-driven flow:

- `Deactivate invite link`
- `Are you sure you want to deactivate this invite link?`
- `This invite link will stop working immediately.`
- `Confirm deactivation`
- `Cancel`
- `Could not deactivate invite link.`

### Test coverage expectations

`revoke-invite-link-model.test.ts` must cover at least:

1. default confirmation-hidden state
2. confirmation-visible state labels
3. loading state labels / disabled behavior intent
4. error message fallback

Keep it pure. No React Native rendering library here.

---

## 3) Update event-details invite section in `App.tsx`

Modify:

- `apps/mobile/App.tsx`

### Current behavior to preserve

Do not break existing invite section behavior:

- auto-load current invite link on entering details
- empty state when no active invite exists
- create/reuse action
- share action
- preview action
- retry current invite load
- refresh details also refreshes current invite

### New required UI behavior

When the current invite section is in **success state** (active invite exists):

1. show a revoke action button with text:
   - `Deactivate invite link`

2. first tap does **not** immediately call the backend;
   instead it opens a local confirmation sub-state showing:
   - `Are you sure you want to deactivate this invite link?`
   - `This invite link will stop working immediately.`
   - button: `Confirm deactivation`
   - button: `Cancel`

3. tapping `Cancel`:
   - closes confirmation state
   - keeps current invite visible
   - clears any revoke-specific error message

4. tapping `Confirm deactivation`:
   - calls the new revoke API helper
   - disables repeated taps while request is in-flight
   - if successful:
     - closes confirmation state
     - clears revoke-specific error
     - updates the current invite section to the existing empty state
     - hides preview/share actions
   - if failed:
     - keeps the existing invite visible
     - keeps the screen usable
     - shows error text:
       - `Could not deactivate invite link.`

### Refresh behavior after revoke success

After successful revoke, one of the following is acceptable:

- optimistic local transition to empty state; or
- immediate refetch of current invite link endpoint and then show empty state.

Preferred approach:

- refetch current invite link after successful revoke, so the mobile state stays aligned with backend truth.

### Required interaction rules

- no duplicate revoke requests while loading
- no auto-open of confirmation state on screen entry
- no revoke action shown when current invite is already empty
- no preview/share action shown after revoke success
- create/reuse action must still be available again after revoke success through the existing empty-state UI

---

## 4) Do not break existing details/local navigation behavior

All of the following must still work after this task:

- details refresh button
- back navigation from details
- organizer list refresh behavior
- public invite preview flow
- standalone public invite entry flow
- deep-link opened public invite flow

This task should be a focused enhancement, not a refactor.

---

## Acceptance criteria

This task is complete only if all are true:

1. A new mobile API helper exists for DELETE current invite link.
2. New targeted test files were added first and red-state was observed.
3. When an event has an active invite link, the details screen shows `Deactivate invite link`.
4. Tapping revoke first opens explicit confirmation UI instead of immediately revoking.
5. Confirming revoke calls the backend once.
6. Revoke loading prevents repeated taps.
7. Successful revoke transitions the section to the existing empty invite state.
8. After successful revoke, preview/share actions are no longer shown.
9. Failed revoke keeps the current invite visible and shows `Could not deactivate invite link.`
10. Existing mobile tests remain green.
11. Mobile typecheck remains green.
12. No backend files were changed.

---

## Local verification steps

Run these locally from the repository root.

### Commands

```powershell
pnpm install
pnpm --filter @event-app/mobile test -- src/api/revoke-invite-link.test.ts src/features/event-details/revoke-invite-link-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Manual Android verification

1. Start backend locally.
2. Start mobile app.
3. Open organizer list.
4. Open an event that already has an active invite link.
5. Verify current invite data is visible.
6. Verify `Deactivate invite link` button is visible.
7. Tap it once.
8. Verify confirmation UI appears with:
   - `Are you sure you want to deactivate this invite link?`
   - `This invite link will stop working immediately.`
   - `Confirm deactivation`
   - `Cancel`
9. Tap `Cancel`.
10. Verify invite remains visible and no revoke happened.
11. Tap `Deactivate invite link` again, then `Confirm deactivation`.
12. Verify the action completes and the section switches to `No active invite link yet.`
13. Verify preview/share are no longer visible.
14. Verify create/reuse action is available again.
15. Simulate backend failure, retry revoke, and verify error text `Could not deactivate invite link.` appears while invite stays visible.

---

## Final report requirements

In addition to the normal run prompt final report, explicitly include:

1. the exact red-state command used;
2. the exact green-state commands used;
3. the exact files added/changed;
4. whether revoke success used optimistic empty-state transition or post-success refetch;
5. confirmation that no backend files were modified.

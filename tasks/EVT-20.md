# EVT-20 — Mobile event-details current invite-link loading and section state integration

## Status
Ready

## Priority
P1

## Depends on
- EVT-10
- EVT-12
- EVT-19

## Goal

Implement automatic loading of the organizer’s current usable invite link on the mobile event-details screen, using the backend endpoint added in EVT-19.

After this task:

- opening an event-details screen must automatically request the current usable invite link;
- the invite-link section must render deterministic loading / empty / error / success states;
- when a current usable link exists, the existing preview/share actions must be available immediately without first pressing “create or reuse invite link”;
- when no usable link exists, the section must clearly show that state and still allow explicit creation;
- refreshing event details must also refresh the invite-link section.

This is a **mobile-only** task.

---

## Why this task exists now

EVT-19 added a dedicated organizer endpoint for “current usable invite link”:

- `GET /api/v1/events/:eventId/invite-link`

The mobile app currently has organizer event-details, explicit invite-link creation/reuse, preview, and share.

However, the event-details invite section still behaves as if no current invite link exists until the user manually triggers creation/reuse. That is now an unnecessary UX gap.

This task closes that gap and makes the event-details screen behave like a real organizer control panel.

---

## Fixed implementation decisions for this task

These decisions are mandatory:

1. This task is **mobile-only**. Do not modify backend code, migrations, Prisma schema, or API contracts.
2. Reuse the backend endpoint from EVT-19:
   - mobile path: `GET /v1/events/:eventId/invite-link`
3. Reuse the existing dev organizer header behavior for organizer endpoints.
4. Do **not** add a navigation library.
5. Do **not** replace the existing explicit create/reuse invite action.
6. Do **not** add clipboard persistence, caching libraries, or global state libraries.
7. Keep all logic in the existing mobile architecture style already used in the repo.

---

## Out of scope

The following are explicitly out of scope:

- backend changes of any kind;
- changing invite-link response contracts;
- changing public invite flow contracts;
- adding QR codes;
- adding clipboard history;
- adding push notifications;
- adding React Navigation / Expo Router migration;
- adding UI snapshot tests or RN render tests.

---

## Existing backend contract to consume

Use the organizer endpoint from EVT-19.

### Request

`GET /v1/events/:eventId/invite-link`

Organizer auth behavior:
- include `x-dev-user-id` only in the existing development organizer flow.

### Success response when usable invite link exists

```json
{
  "eventId": "evt_123",
  "inviteLink": {
    "eventId": "evt_123",
    "token": "abc123",
    "url": "http://localhost:3000/api/v1/invite-links/abc123",
    "isActive": true,
    "expiresAt": null,
    "createdAt": "2026-03-20T10:00:00.000Z"
  }
}
```

### Success response when no usable invite link exists

```json
{
  "eventId": "evt_123",
  "inviteLink": null
}
```

---

## TEST-FIRST PROTOCOL FOR THIS TASK

Follow red -> green.

### Tests to add first

Add these tests before production implementation:

1. `apps/mobile/src/api/event-current-invite-link.test.ts`
   - verifies GET path is `/v1/events/:eventId/invite-link`;
   - verifies request method is GET;
   - verifies dev organizer header is included only when enabled;
   - verifies nullable `inviteLink` response is accepted unchanged.

2. `apps/mobile/src/features/event-details/current-invite-link-model.test.ts`
   - verifies deterministic section-state mapping for:
     - loading;
     - empty response (`inviteLink: null`);
     - success response (`inviteLink` present);
     - error state with fallback/default message.

You may add one very small supporting test only if directly required, but do not add speculative tests.

### Required red-state command

Run:

```powershell
pnpm --filter @event-app/mobile test -- src/api/event-current-invite-link.test.ts src/features/event-details/current-invite-link-model.test.ts
```

The first failing state must happen before the final implementation exists.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/mobile test -- src/api/event-current-invite-link.test.ts src/features/event-details/current-invite-link-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

Do not claim completion without the green-state commands.

---

## Detailed implementation requirements

## 1) Add a typed mobile API helper for current invite-link lookup

Create:

- `apps/mobile/src/api/event-current-invite-link.ts`

### Required exports

Export a typed helper equivalent in behavior to:

- `getCurrentInviteLink(eventId: string): Promise<EventCurrentInviteLinkResponse>`

### Response type

Implement a type equivalent to:

```ts
type EventCurrentInviteLinkResponse = {
  eventId: string;
  inviteLink: OrganizerInviteLink | null;
};
```

You may reuse the existing organizer invite-link type if the current codebase already has one. Prefer reuse over duplication when practical.

### API helper behavior

- use GET;
- call `/v1/events/:eventId/invite-link`;
- include the dev organizer header only when the existing config says to do so;
- use the project’s existing mobile HTTP wrapper conventions;
- return parsed typed JSON;
- do not silently coerce `inviteLink: null` into another shape.

---

## 2) Add a pure current-invite-link section-state helper

Create:

- `apps/mobile/src/features/event-details/current-invite-link-model.ts`

This module must be **pure** and have no React imports.

### Purpose

Its job is to convert raw invite-link loading inputs into a small deterministic state shape that App.tsx can render.

### Required behavior

It must support these conceptual states:

1. **loading**
   - when current invite-link fetch is in flight.

2. **empty**
   - when fetch succeeded and response is `{ inviteLink: null }`.
   - must expose a user-facing message equivalent to:
     - `No active invite link yet.`

3. **success**
   - when fetch succeeded and response contains `inviteLink`.
   - should reuse the existing success mapping for organizer invite-link presentation where practical.

4. **error**
   - when current invite-link fetch failed.
   - must expose a user-facing message.
   - if no explicit error message is available, use a default equivalent to:
     - `Could not load invite link.`

### Constraint

Do not move unrelated UI concerns into this helper.
Its job is only to create deterministic section state.

---

## 3) Integrate current invite-link loading into App.tsx event-details flow

Update:

- `apps/mobile/App.tsx`

### Required behavior on entering event-details screen

When the app opens organizer event-details for a selected event, it must:

1. load the existing event-details bundle as before;
2. also load the current usable invite link via the new GET helper.

These may be loaded sequentially or in parallel, but the final UX must be correct and stable.

### Required invite section states in the UI

The invite-link section on event-details must now support:

#### A) Loading state
Displayed while current invite-link lookup is in progress.

A small loading label/message is sufficient, for example:
- `Loading invite link...`

#### B) Empty state
When response is `{ inviteLink: null }`:
- show a message equivalent to:
  - `No active invite link yet.`
- show the existing primary action to create/reuse invite link.
- do **not** show preview/share actions yet.

#### C) Success state
When a current usable invite link exists:
- show the same URL/token/expiry/status presentation already used for organizer invite success;
- show Preview invite action;
- show Share action;
- no extra manual lookup step should be required.

#### D) Error state
When the current invite-link GET call fails:
- keep the section visible;
- show an error message;
- show a retry action, label equivalent to:
  - `Retry invite link`
- also keep the explicit create/reuse action available.

### Important interaction rule

The existing explicit create/reuse action must still work.

When it succeeds:
- update the section to success state using the returned payload;
- clear any invite-section error state.

### Important refresh rule

When the user triggers the existing details refresh action:
- refresh event details data;
- refresh the current invite-link section as well.

### Important back/navigation rule

Do not change existing back behavior for:
- details -> list;
- public preview -> details;
- standalone invite-entry -> public invite;
- deep-link -> public invite.

This task only changes current invite-link loading on organizer details.

---

## 4) Reuse existing invite success UI where practical

If current code already has a helper such as organizer invite-link view-model mapping, reuse it for the success state rather than duplicating formatting logic.

The goal is that invite-link presentation stays consistent whether the link came from:
- automatic GET current-link lookup;
- explicit create/reuse POST.

---

## 5) Keep state management simple and local

Do not add:
- Redux;
- Zustand;
- React Query;
- Context-based global data stores.

Use the existing local-state approach in `App.tsx`.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. `apps/mobile/src/api/event-current-invite-link.ts` exists and correctly calls `GET /v1/events/:eventId/invite-link`.
2. Nullable `inviteLink` response is supported without coercion.
3. A pure current invite-link section-state helper exists and is tested.
4. Opening organizer event-details automatically attempts to load current invite-link state.
5. Event-details invite section supports loading / empty / success / error states.
6. Empty state clearly indicates no active usable invite link exists.
7. Success state exposes preview/share without requiring manual create first.
8. Error state supports retry and still allows explicit create/reuse.
9. Refreshing details also refreshes current invite-link state.
10. Existing create/reuse invite action still works correctly.
11. Existing public preview/back flows are not broken.
12. Mobile targeted tests, full mobile tests, and mobile typecheck are green.
13. No backend files were modified.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

```powershell
pnpm install

pnpm --filter @event-app/mobile test -- src/api/event-current-invite-link.test.ts src/features/event-details/current-invite-link-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Android manual verification

Using the already-running backend and Android emulator:

1. Open organizer home.
2. Open an event that already has a usable invite link.
3. Confirm the details screen automatically shows invite data without first pressing create/reuse.
4. Confirm Preview invite works.
5. Confirm Share works.
6. Open an event with no usable invite link.
7. Confirm the section shows `No active invite link yet.` and the create/reuse action.
8. Use create/reuse and confirm the section moves to success state.
9. Simulate backend failure for current invite-link GET and confirm error state + retry behavior.
10. Trigger details refresh and confirm invite section refreshes too.

---

## Implementation guardrails

- Do not modify README.md.
- Do not modify files under `tasks/`.
- Do not change backend contracts.
- Do not add a navigation library.
- Do not add persistent caching.
- Keep the diff minimal and focused on EVT-20.

---

## Final report requirements for this task

In addition to the standard run prompt final report, explicitly include:

1. the exact API response type used for current invite-link lookup;
2. the exact section states implemented;
3. whether existing invite create/reuse UI was reused or adjusted;
4. exact targeted red-state and green-state commands;
5. the Android manual verification flow you would use locally.

---

## Definition of done

EVT-20 is done when organizer event-details opens with a truthful invite-link section by default: it auto-loads the current usable invite link, clearly handles empty/error cases, still supports create/reuse, and exposes preview/share immediately when a usable link already exists.

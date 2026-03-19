# EVT-12 — Mobile organizer invite-link section and share action

## Status
Ready

## Priority
P1

## Depends on
- EVT-4
- EVT-10
- EVT-11

## Goal

Extend the existing mobile organizer event-details screen so an organizer can create/reuse an invite link for the selected event, see the resulting URL on screen, and share that URL using the platform share sheet.

This task is **mobile-only**. The backend API required for this feature already exists.

At the end of this task, the mobile app must support this organizer flow:

1. open organizer events list;
2. open event details;
3. tap a button to create or reuse the event invite link;
4. see the invite link URL and basic metadata;
5. tap a button to share the link using the native/system share flow;
6. recover cleanly from loading and API error states.

---

## Why this task exists now

The product is fundamentally about sharing small event invitations.

The backend already supports organizer invite-link creation/reuse, and the mobile app already supports:
- organizer events list;
- organizer event details;
- event creation.

The missing piece is letting the organizer produce and use an invite link directly from the phone.

This task closes that gap without introducing guest RSVP UI yet.

---

## Fixed implementation decisions for this task

These decisions are mandatory:

1. This is a **mobile-only** task.
2. Use the existing backend endpoint:
   - `POST /api/v1/events/:eventId/invite-link`
3. Do **not** change backend contracts unless you discover a real blocker. Assume the existing API is the source of truth.
4. Keep the current no-navigation-library approach in `apps/mobile/App.tsx`.
5. Use React Native’s built-in `Share` API for sharing.
   - Do **not** add clipboard packages or extra native modules in this task.
6. Do **not** auto-create an invite link merely by opening event details.
   - Invite-link creation/reuse must happen only after explicit organizer action.
7. Treat both backend success statuses as valid for the create/reuse action:
   - `201 Created`
   - `200 OK`
8. Do **not** implement guest invite resolution UI in this task.
9. Do **not** implement deep-link handling, universal links, QR codes, or copy-to-clipboard in this task.

---

## Out of scope

The following are explicitly out of scope:

- backend changes for invite-link feature unless absolutely required to fix a real mismatch;
- guest event page UI;
- guest RSVP mobile flow;
- reminder editing;
- attendee editing;
- link expiration management UI;
- clipboard copy;
- QR generation;
- deep-link configuration;
- analytics;
- push notifications.

If any of the above appears, it is over-implementation and must be removed.

---

## Existing backend contract to use

Use the already implemented organizer endpoint:

- `POST /api/v1/events/:eventId/invite-link`

It is organizer-protected and uses the same dev auth shim strategy already used by the mobile app in development.

The mobile API helper must support the existing development header behavior:

- `x-dev-user-id`

Use the same mobile config / HTTP wrapper conventions already established in the repo.

### Expected success response shape

The helper should expect a shape equivalent to:

```json
{
  "eventId": "evt_123",
  "token": "abc123",
  "url": "http://localhost:3000/api/v1/invite-links/abc123",
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-03-20T10:00:00.000Z"
}
```

The exact runtime values differ, but the mobile contract should be typed to this structure.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

You must add/update tests first, run them in a failing state, and only then implement production code.

### Required tests to add first

Add these tests before production implementation:

1. **Invite-link API helper test**
   - file suggestion:
     - `apps/mobile/src/api/invite-link.test.ts`
   - must verify:
     - correct request path for a given event id;
     - HTTP method is `POST`;
     - dev organizer header is included when enabled;
     - success response is returned in typed shape;
     - non-2xx error from HTTP layer is surfaced consistently.

2. **Invite-link view-model / presentation helper test**
   - file suggestion:
     - `apps/mobile/src/features/event-details/invite-link-model.test.ts`
   - must verify:
     - URL and token are mapped to UI-friendly fields;
     - `expiresAt: null` maps to a stable label such as `No expiry`;
     - non-null expiry maps to a displayable string;
     - empty state / not-yet-created state gets deterministic labels;
     - error state helper output is deterministic if you introduce one.

You may add one tiny extra test file only if it directly supports this task. Do not add speculative coverage.

### Required red-state proof

Before final implementation exists, run the smallest relevant test command and confirm failure.

Example acceptable red-state command:

```powershell
pnpm --filter @event-app/mobile test -- src/api/invite-link.test.ts src/features/event-details/invite-link-model.test.ts
```

Acceptable red-state reasons include:
- missing module;
- missing exported function;
- wrong request method/path;
- missing view-model behavior.

### Required green-state proof

After implementation, rerun:
- the targeted test command above;
- full mobile tests;
- mobile typecheck.

### Forbidden shortcuts

Do not:
- weaken assertions to force green;
- skip tests;
- add TODO tests;
- silently remove failing assertions.

---

## Detailed implementation requirements

## 1) Add a typed mobile invite-link API helper

Create a new API module for organizer invite-link creation/reuse.

Suggested file:
- `apps/mobile/src/api/invite-link.ts`

### Helper requirements

Export a function equivalent in intent to:

- `createOrReuseInviteLink(eventId: string): Promise<OrganizerInviteLink>`

It must:

- call `POST /v1/events/:eventId/invite-link`;
- use the existing base URL/mobile config conventions already used by other mobile API helpers;
- use the existing HTTP wrapper abstraction already used in `apps/mobile/src/api/*`;
- include `x-dev-user-id` only through the same dev-config behavior already used elsewhere;
- accept both `200` and `201` as success;
- return parsed typed data.

### Typed response contract

Define a typed response structure with at least:

- `eventId: string`
- `token: string`
- `url: string`
- `isActive: boolean`
- `expiresAt: string | null`
- `createdAt: string`

Keep the helper small and deterministic.

---

## 2) Add a pure invite-link presentation helper

Create a small pure mapping helper for event-details UI.

Suggested file:
- `apps/mobile/src/features/event-details/invite-link-model.ts`

### Purpose

This helper should convert raw invite-link API data into UI-friendly display strings.

### Requirements

The helper must produce stable labels for:

- displayed URL;
- displayed token;
- expiry label;
- invite status label if you choose to expose one;
- empty/not-created-yet state text.

### Label requirements

Use plain English labels consistent with the current placeholder-level app style.

Examples of acceptable labels:
- `Invite link not created yet`
- `No expiry`
- `Active`
- `Expired`

Do not over-design formatting. Keep it simple and readable.

---

## 3) Extend the event-details mobile screen

Update `apps/mobile/App.tsx` so the event-details screen includes an invite-link section.

### Event-details invite section requirements

The section must show one of these states:

1. **Idle / not created yet**
   - shows a message that no invite link is loaded/created yet;
   - shows a button to create/reuse invite link.

2. **Loading**
   - while the create/reuse request is in flight;
   - disable repeated submissions during loading.

3. **Success**
   - show the invite URL;
   - show `expiresAt` display text;
   - show a button to re-run the create/reuse action;
   - show a separate button to share the invite URL.

4. **Error**
   - show a readable error message;
   - show a retry button.

### Important interaction rule

Do **not** fire the invite-link request automatically when the details screen opens.

It should happen only when the organizer taps a visible action button such as:
- `Create invite link`
- `Load invite link`
- `Create or reuse invite link`

Choose one label and keep it consistent.

### State behavior requirements

- Keep invite-link state local to the current details screen session.
- If the organizer leaves details and comes back later, it is acceptable for the invite-link section to start again in the idle state.
- If details refresh happens, do **not** automatically reset an already loaded invite-link success state unless necessary.

---

## 4) Add share action

On successful invite-link load/create, provide a button that shares the link using React Native’s built-in `Share` API.

### Requirements

- Use `Share` from `react-native`.
- The shared content must include the invite URL.
- Keep the share payload simple.
- Do not add external share libraries.

A minimal acceptable share payload is something like:

```ts
Share.share({
  message: invite.url,
  url: invite.url,
});
```

If platform differences require slight adjustment, keep the implementation small and document it.

### Error handling

If share invocation throws, surface a readable UI error message in the invite-link section.
Do not crash the screen.

---

## 5) UI requirements

Keep styling simple and consistent with the current MVP-level app.

The invite-link section should visibly include:

- section title, e.g. `Invite link`;
- current state message;
- URL text when available;
- expiry label when available;
- primary action button;
- share button after success.

### Constraints

- No design-system work.
- No navigation library.
- No advanced animations.
- No custom bottom sheets/modals.

This is a functional MVP screen enhancement.

---

## 6) Error handling requirements

Handle these cases gracefully:

1. Backend/API/network failure while creating/reusing link
   - show readable error text;
   - allow retry.

2. Share API failure
   - show readable error text;
   - keep the invite data on screen.

3. Missing mobile config/dev user problems
   - rely on the existing config and HTTP error behavior already established in mobile layer;
   - do not invent a second config system.

Use the same simple error style already present in the app.

---

## 7) Do not change backend behavior unless strictly necessary

This task should not require backend modifications.

If you discover a real backend mismatch, the preferred approach is:
- first verify whether the existing contract is already sufficient;
- only make the smallest necessary backend change if absolutely blocked;
- explain it clearly in the final report.

In the normal case, this task should remain mobile-only.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. The mobile app event-details screen has a visible invite-link section.
2. The organizer can explicitly trigger create/reuse invite-link from the details screen.
3. The request uses the existing organizer dev-header strategy when configured.
4. A successful response displays the invite URL on screen.
5. A successful response displays expiry information with deterministic fallback for `null` expiry.
6. The organizer can tap a share action that invokes the native share flow with the invite URL.
7. Loading, success, error, and retry states all work.
8. Repeated taps while request is in flight are prevented.
9. Required tests were added first, observed red, then made green.
10. Full mobile tests and mobile typecheck are green.
11. No unnecessary backend/domain changes were introduced.

---

## Required manual verification steps

Document the exact commands run in the final report.

### PowerShell-friendly setup

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
2. Open the mobile app.
3. Confirm organizer events list loads.
4. Open an existing event details screen.
5. Verify invite-link section starts in an idle/not-created-yet state.
6. Tap the invite-link action button.
7. Verify loading state appears and repeat taps are prevented.
8. Verify success state appears with URL and expiry label.
9. Tap share button and confirm the system share UI opens.
10. Simulate backend failure (for example by stopping API) and verify the invite-link section shows error + retry behavior.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for `EVT-12` must explicitly include:

1. the exact mobile invite-link API helper function name and file path;
2. the exact test files added;
3. the exact red-state command run before implementation;
4. the exact green-state commands run after implementation;
5. the final invite-link success response type/shape used by mobile;
6. whether any backend file changed (expected answer: no, unless a real blocker required otherwise).

---

## Definition of done

`EVT-12` is done when an organizer can open event details in the mobile app, explicitly create or reuse an invite link, see the resulting URL, and share it from the phone — with deterministic tests and without introducing unnecessary native dependencies or backend changes.

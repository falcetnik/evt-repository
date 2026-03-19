# EVT-16 — Mobile incoming deep-link handling for public invite screen

## Status
Ready

## Priority
P1

## Depends on
- EVT-14
- EVT-15

## Goal

Add incoming link handling to the Expo mobile app so a user can open the public invite screen directly from an incoming URL while the app is:

- launched from a closed state;
- already running in the foreground;
- already running in the background and brought to the foreground by the link.

This task is **mobile-only**.

It must integrate with the existing local-state navigation in `apps/mobile/App.tsx` and the existing public-invite API/view-model flow from EVT-14 and EVT-15.

---

## Why this task exists now

We already have:

- organizer invite preview inside the app;
- standalone invite entry by token or full URL;
- public invite fetch + RSVP submit flow.

What is still missing is the normal mobile behavior where an incoming link can open the invite directly.

This task closes that gap by allowing the app to react to incoming URLs and navigate into the guest/public-invite experience automatically.

---

## Fixed implementation decisions for this task

These are mandatory for this task:

1. This is a **mobile-only** task. Do not change backend behavior.
2. Use the existing Expo app and local-state navigation pattern in `apps/mobile/App.tsx`.
3. Use Expo/React Native linking support to observe incoming URLs.
4. Support both:
   - app-specific deep-link URLs for development builds;
   - Expo Go style development URLs for local testing.
5. Reuse the existing public invite screen and existing public invite API helper.
6. Do not add a navigation library.
7. Do not add auth/session work.
8. Do not change organizer API flows.

---

## Out of scope

The following are explicitly out of scope for EVT-16:

- backend invite-link contract changes;
- universal links / Android App Links / iOS Universal Links setup;
- web public invite pages;
- changing the organizer share payload;
- push notifications;
- auth;
- deep-link analytics;
- preserving in-progress form drafts across incoming deep-link navigation;
- React Navigation / Expo Router adoption.

If any of the above appears, it is over-implementation.

---

## Required user-visible behavior

### 1) Incoming link opens public invite screen

When the app receives a supported invite-link URL, it must:

1. extract the invite token;
2. switch to the existing `public-invite` screen;
3. fetch the invite data using the existing public invite API helper;
4. show the normal loading / error / success states already used by the public invite flow.

### 2) Supported incoming URL formats

The incoming-link parser for this task must accept all of the following:

#### A. Custom-scheme deep link

```text
eventapp://invite-links/:token
```

Example:

```text
eventapp://invite-links/abc123token
```

#### B. Expo Go development URL with path payload

```text
exp://<host>:<port>/--/invite-links/:token
```

and

```text
exps://<host>:<port>/--/invite-links/:token
```

Examples:

```text
exp://127.0.0.1:8081/--/invite-links/abc123token
exp://192.168.0.10:8081/--/invite-links/abc123token?foo=bar
```

#### C. Absolute HTTP(S) invite URL ending in `/invite-links/:token`

Examples:

```text
https://example.com/invite-links/abc123token
http://localhost:3000/api/v1/invite-links/abc123token
```

This keeps the parser future-friendly and compatible with the existing standalone invite-entry behavior.

### 3) Unsupported URLs must be ignored safely

If the app receives a URL that does not match a supported invite-link pattern, it must:

- not crash;
- not navigate away from the current screen;
- not erase current app state;
- ignore the URL.

### 4) Back behavior from deep-link origin

When the public invite screen was opened by an incoming deep link, pressing Back must return to the standalone invite-entry screen.

This rule is required to keep behavior deterministic and to avoid complicated “return to whatever screen happened to be open before the deep link” logic.

---

## App-config requirement

The Expo app config must define a custom scheme for app deep links.

Use this exact scheme:

```text
eventapp
```

This task must ensure the Expo app config includes that scheme in the existing app config file. If the repository already has an app config file, update it. If not, add the minimum required app config for the scheme.

Do not add production domains or universal-link configuration in this task.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

### Required tests to add first

Add these tests before implementing production logic:

1. `apps/mobile/src/features/public-invite/incoming-invite-link.test.ts`
   - covers supported incoming URL patterns;
   - covers ignored invalid/unrelated URLs;
   - covers query/hash tolerance where appropriate.

2. `apps/mobile/src/features/public-invite/deep-link-navigation-model.test.ts`
   - covers mapping of a valid incoming token into the app’s public-invite navigation intent;
   - covers ignored/invalid links returning no navigation intent;
   - covers deep-link origin marker behavior.

You may add one tiny supporting test if strictly needed, but do not add broad speculative coverage.

### Required red-state command

Run the smallest relevant mobile test command first, before implementing the production modules:

```powershell
pnpm --filter @event-app/mobile test -- src/features/public-invite/incoming-invite-link.test.ts src/features/public-invite/deep-link-navigation-model.test.ts
```

The expected red state is missing module/import failure or equivalent unimplemented-behavior failure.

### Required green-state commands

After implementation, run:

```powershell
pnpm --filter @event-app/mobile test -- src/features/public-invite/incoming-invite-link.test.ts src/features/public-invite/deep-link-navigation-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
```

Do not claim completion without these green results.

---

## Detailed implementation requirements

## 1) Add incoming-link parsing helper

Create a pure helper at:

```text
apps/mobile/src/features/public-invite/incoming-invite-link.ts
```

This helper must expose a pure function that extracts an invite token from an incoming app URL.

Suggested shape:

```ts
export function extractInviteTokenFromIncomingUrl(url: string): string | null
```

### Parser requirements

It must:

- accept the three supported patterns listed above;
- ignore query parameters and URL hash fragments;
- reject empty tokens;
- reject unrelated paths;
- reject malformed URLs;
- never throw for bad input;
- return `null` for unsupported input.

### Important parser notes

- For custom-scheme links, the parser must correctly handle `eventapp://invite-links/:token`.
- For Expo Go links, it must correctly handle the `/--/` segment before the app path.
- For HTTP(S) URLs, it must accept a pathname whose final invite-specific segment is `/invite-links/:token`, including the existing backend-style path like `/api/v1/invite-links/:token`.

Do not accept arbitrary raw tokens here. This helper is only for incoming URLs.

---

## 2) Add pure deep-link navigation intent helper

Create a pure helper at:

```text
apps/mobile/src/features/public-invite/deep-link-navigation-model.ts
```

This helper must convert an incoming URL into the navigation intent required by the local-state app shell.

Suggested shape:

```ts
export type PublicInviteOpenIntent = {
  token: string;
  origin: 'deep-link';
};

export function resolvePublicInviteOpenIntent(url: string): PublicInviteOpenIntent | null
```

### Requirements

- It must use the parser helper above.
- For valid incoming invite URLs, it returns:
  - the token;
  - `origin: 'deep-link'`.
- For invalid/unrelated URLs, it returns `null`.
- It must be pure and deterministic.

Do not mix UI state updates into this helper.

---

## 3) Integrate incoming-link handling into `App.tsx`

Update `apps/mobile/App.tsx` so the app listens for incoming URLs and opens the public invite screen automatically.

### App-level behavior requirements

The app must react to:

- the URL that initially launched the app;
- URLs received while the app is already running.

### Navigation behavior requirements

When a valid incoming invite URL is received:

- switch the screen state to the existing `public-invite` screen;
- set the public invite token from the parsed URL;
- mark the public invite origin as `deep-link`;
- trigger the normal public invite loading flow.

When an invalid/unrelated URL is received:

- do nothing;
- remain on the current screen.

### Repeated-link handling requirement

Add minimal deduplication so that the exact same incoming URL is not processed repeatedly in a tight loop while the app remains mounted.

A simple last-handled-URL ref is sufficient.

### Existing behavior that must remain intact

- organizer preview -> public invite still works;
- standalone invite-entry -> public invite still works;
- back from organizer preview origin still returns to details;
- back from standalone invite-entry origin still returns to invite-entry;
- back from deep-link origin must return to invite-entry.

Do not break existing list/details/create flows.

---

## 4) App-state / screen-origin updates

If needed, extend the existing public invite origin type in `App.tsx` to include:

```ts
'deep-link'
```

Update the back-navigation logic accordingly.

This task must keep the state machine explicit and easy to review.

---

## 5) Expo app config update

Ensure the Expo app config declares:

```json
{
  "expo": {
    "scheme": "eventapp"
  }
}
```

Use the existing app config file if present.

Do not add Android App Links, iOS Universal Links, or production domains in this task.

---

## 6) Documentation update

Update:

```text
docs/local-development.md
```

Add a short EVT-16 section that explains how to manually test incoming links.

### The docs must include both test paths

#### A. Expo Go style local testing

Document a command shaped like:

```powershell
npx uri-scheme open "exp://127.0.0.1:8081/--/invite-links/<TOKEN>" --android
```

with a note to replace host/port with the actual Expo dev URL shown by the running app.

#### B. Custom-scheme development-build testing

Document a command shaped like:

```powershell
npx uri-scheme open "eventapp://invite-links/<TOKEN>" --android
```

with a note that this path requires a development build / installed app that knows the custom scheme.

Keep the docs Windows 11 / PowerShell friendly.

---

## Out-of-scope guardrails for implementation

Do not:

- rewrite existing public invite fetch/submit contracts;
- change backend URL generation;
- change the standalone invite-entry validation rules from EVT-15;
- introduce a routing library;
- add push-notification deep linking;
- add analytics;
- add production web-domain association files.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. The Expo app config includes the custom scheme `eventapp`.
2. The app can parse supported incoming invite URLs into a token.
3. The app ignores unrelated incoming URLs without crashing or navigating.
4. The app can open the public invite screen from:
   - initial app launch URL;
   - runtime URL events.
5. Back from public invite opened via deep link returns to invite-entry.
6. Existing organizer preview and standalone invite-entry flows still work.
7. New targeted tests were added first, observed red, then turned green.
8. `pnpm --filter @event-app/mobile test` is green.
9. `pnpm --filter @event-app/mobile typecheck` is green.
10. No backend files were changed.

---

## Required manual verification steps

Document the exact commands run in the final report.

At minimum, verify with the following.

### PowerShell-friendly flow

```powershell
pnpm install
pnpm --filter @event-app/mobile test -- src/features/public-invite/incoming-invite-link.test.ts src/features/public-invite/deep-link-navigation-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

Then, while the app is running:

#### Expo Go style test

```powershell
npx uri-scheme open "exp://127.0.0.1:8081/--/invite-links/test-token-123" --android
```

Replace the host/port with the actual Expo URL if different.

Expected result:

- app opens or foregrounds;
- public invite screen opens;
- the app attempts to load token `test-token-123`.

#### Custom-scheme test (only if using a development build)

```powershell
npx uri-scheme open "eventapp://invite-links/test-token-123" --android
```

Expected result:

- app opens or foregrounds;
- public invite screen opens;
- the app attempts to load token `test-token-123`.

Also verify an unrelated URL does nothing harmful, for example:

```powershell
npx uri-scheme open "eventapp://not-an-invite/path" --android
```

Expected result:

- app does not crash;
- app does not navigate to public invite.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for EVT-16 must explicitly include:

1. the exact app config file changed for the custom scheme;
2. the exact supported incoming URL shapes implemented;
3. the exact back-navigation behavior for deep-link origin;
4. the exact targeted test command used for the red state;
5. the exact manual link-open command(s) documented for Android.

---

## Definition of done

EVT-16 is done when a developer can run the Expo app, open a supported invite URL, and see the existing public invite screen load automatically without manually typing a token into the app.

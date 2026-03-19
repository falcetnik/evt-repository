# EVT-15 — Mobile public invite entry flow from pasted token or URL

## Status
Ready

## Priority
P1

## Depends on
- EVT-14 completed and green locally
- Existing mobile public invite screen flow already works when opened from organizer preview

## Goal

Add a standalone guest-entry flow in the mobile app so a user can open a public invite by **pasting either**:

- a raw invite token, or
- a full invite URL

This task must make the existing public-invite mobile experience reachable **without** first navigating through organizer event details.

The result should be a simple, local-state mobile flow:

1. user opens a new “Open invite” screen from the app,
2. pastes a token or full URL,
3. app validates/parses the input,
4. app navigates to the existing public-invite screen using the extracted token,
5. existing fetch / RSVP behavior from EVT-14 is reused unchanged.

This task is intentionally **mobile-only**. No backend code or contract changes are allowed.

---

## Why this task exists now

After EVT-14, the mobile app can preview a public invite only from organizer event details.

That is useful for organizer QA, but it is not yet a real guest entry path.

We now need a lightweight standalone entry flow so the app can act like an invite consumer:

- paste a token from chat,
- paste a copied invite URL,
- open the public invite screen,
- submit RSVP.

This is also a safe stepping stone before real deep linking / universal linking.

---

## Fixed implementation decisions for this task

These decisions are mandatory for EVT-15:

1. Do **not** add a navigation library.
   - Continue using the existing local-state screen switching inside `apps/mobile/App.tsx`.

2. Do **not** implement deep linking yet.
   - This task is manual entry only.
   - Real OS-level URL handling belongs to a later task.

3. Do **not** change any backend routes or payload contracts.
   - Reuse the existing public invite APIs from EVT-14 exactly as they already exist.

4. Input must accept both:
   - raw token
   - full URL

5. Parsing/validation logic must live in a pure helper module and be covered by unit tests.

6. Reuse the existing public invite screen state and fetch/RSVP flows where possible.
   - Do not duplicate public invite networking logic.

---

## Out of scope

The following are explicitly out of scope for EVT-15:

- Expo Linking setup
- Android App Links
- iOS Universal Links
- Clipboard auto-read
- camera / QR scanning
- backend invite route changes
- auth changes
- visual redesign / UI polish beyond small necessary controls
- new mobile testing frameworks
- React Navigation / Expo Router migration

If any of the above appears, it is over-implementation and should be removed.

---

## Required user-visible behavior

## 1) New standalone entry point

The mobile app must expose a clear entry action for the standalone invite flow.

This action must be visible from the organizer home/list screen.

Recommended label:

- `Open invite`

Alternative close variants are acceptable if concise and clear.

Tapping this action must open a new local-state screen dedicated to invite entry.

---

## 2) New invite-entry screen

Add a simple screen for entering invite input.

Required elements:

- screen title or obvious heading
- one text input for pasted value
- helper text explaining accepted formats
- primary action button to continue
- back/cancel action
- validation error message area

The helper text should make it obvious that both formats are accepted, for example:

- `Paste an invite token or full invite URL`

The UI may remain minimal and utilitarian.

---

## 3) Accepted input formats

The entry flow must accept these formats:

### A. Raw token

Example:

```text
abc123token
```

### B. Full invite URL

Examples:

```text
http://localhost:3000/api/v1/invite-links/abc123token
https://example.com/api/v1/invite-links/abc123token
```

### C. Same as above with surrounding whitespace

Example:

```text
   https://example.com/api/v1/invite-links/abc123token   
```

The input must be trimmed before validation/parsing.

---

## 4) URL parsing rules

Implement deterministic invite-token extraction with a pure helper.

### Required success cases

The helper must successfully extract the token when:

1. input is a non-empty raw token after trimming
2. input is an absolute `http://` or `https://` URL
3. the URL pathname ends with `/invite-links/:token`
4. query string and hash are ignored if present

### Required rejection cases

The helper must reject input when:

1. input is empty or whitespace only
2. URL is malformed
3. URL does not contain `/invite-links/:token`
4. parsed token is empty
5. input contains spaces in the raw token form after trimming

### Notes

- Keep parsing strict and deterministic.
- Do not try to support every possible URL shape.
- The accepted URL shape should align with the backend invite URL already used by the app.
- It is acceptable to treat any non-URL trimmed string without spaces as a raw token.

---

## 5) Submit behavior on the invite-entry screen

When the user taps the primary action:

### If input is invalid

- stay on the entry screen
- show a local validation error
- preserve the typed input
- do not start network requests

### If input is valid

- extract the token
- navigate to the existing public-invite screen
- trigger the existing public invite fetch flow using that token

Do not auto-submit while typing. Submission must remain explicit.

---

## 6) Reuse the existing public invite screen

The existing public invite screen from EVT-14 must remain the single place that:

- loads the invite data
- shows public event details
- shows RSVP summary
- accepts RSVP submission
- handles loading/error/retry/success

This task must not create a second copy of that screen.

The new entry screen is only responsible for collecting and validating input, then sending the token into the existing public-invite flow.

---

## 7) Back-navigation behavior

The app now has two different ways to open the public-invite screen:

1. organizer preview from event details
2. standalone invite entry screen

Back behavior must respect the origin.

### Required behavior

- If public invite was opened from organizer preview, Back returns to event details.
- If public invite was opened from standalone entry, Back returns to the invite-entry screen.

This origin-tracking logic must be explicit and deterministic.

Do not reset organizer list state or selected scope when returning from these flows.

---

## 8) State preservation requirements

### Invite-entry screen

The invite-entry screen must preserve the typed input while the user is on that screen.

If validation fails:
- keep the input
- show error

If the user successfully navigates into the public invite screen and then taps Back:
- it is acceptable and preferred to keep the last pasted input visible on the entry screen
- clear-only behavior is **not** required

### Public invite screen

Existing EVT-14 behavior should remain intact.

---

## TEST-FIRST PROTOCOL FOR THIS TASK

This task must follow red -> green.

You must add the new tests first, run them in a failing state, then implement production code.

### Tests to add first

Add these new mobile unit test files:

1. `apps/mobile/src/features/public-invite/invite-token-entry-model.test.ts`
2. `apps/mobile/src/features/public-invite/invite-token-parser.test.ts`

You may add one extra tiny test file only if directly needed, but do not add rendering tests or broad speculative tests.

### Required test coverage

#### `invite-token-parser.test.ts`

Cover at minimum:

- raw token success
- full URL success
- full URL with query/hash success
- trimmed input success
- empty input rejection
- malformed URL rejection
- URL without `/invite-links/:token` rejection
- empty token rejection
- raw token with spaces rejection

#### `invite-token-entry-model.test.ts`

Create a small pure helper/model around entry submission and validation.

Cover at minimum:

- valid raw token returns `{ ok: true, token }`
- valid full URL returns `{ ok: true, token }`
- invalid input returns `{ ok: false, message }`
- whitespace-only input returns a user-friendly validation message

### Red-state requirement

Before implementing the production modules, run the smallest relevant test command and confirm failure because the new modules do not exist yet.

Example acceptable red-state command:

```powershell
pnpm --filter @event-app/mobile test -- src/features/public-invite/invite-token-parser.test.ts src/features/public-invite/invite-token-entry-model.test.ts
```

A missing-module failure is acceptable and expected for this task.

### Green-state requirement

After implementation:

- rerun the targeted tests
- rerun all mobile tests
- rerun mobile typecheck

### Forbidden shortcuts

Do not:

- weaken assertions
- skip tests
- remove tests after red state
- add fake no-op parsing that only satisfies one happy-path test

---

## Detailed implementation requirements

## 1) New pure parser helper

Create a new pure helper module under:

```text
apps/mobile/src/features/public-invite/
```

Recommended filename:

- `invite-token-parser.ts`

The helper must expose a function equivalent in intent to:

- `extractInviteToken(input: string)`

The function should return a success/failure result shape rather than throwing for normal invalid user input.

Recommended result shape:

```ts
{ ok: true; token: string }
| { ok: false; message: string }
```

If you choose a slightly different but equally clear typed result shape, keep it small and explicit.

---

## 2) New pure entry-model helper

Create a second pure helper module for entry-form behavior.

Recommended filename:

- `invite-token-entry-model.ts`

Purpose:

- trim raw input
- call the parser
- return a UI-friendly success/failure result

This is intentionally small, but it gives us a stable unit-test target instead of coupling logic to `App.tsx`.

---

## 3) `App.tsx` screen-state changes

Extend the existing local-state screen model.

The app currently already has organizer and public-invite related screen states.

Add a new state equivalent in intent to:

- `public-invite-entry`

Also add explicit origin-tracking for the public invite screen, for example something conceptually like:

- `'details-preview'`
- `'standalone-entry'`

The exact variable names may differ, but the behavior must match the navigation rules described above.

---

## 4) Organizer home action

On the organizer home/list screen, add an action to open the invite-entry screen.

Requirements:

- easy to discover
- does not replace existing organizer actions
- works even when no organizer event is selected

Recommended label:

- `Open invite`

---

## 5) Invite-entry screen UX requirements

The screen must include:

- input field
- helper text
- validation message area
- primary action button
- cancel/back button

Behavior:

- primary action disabled only when already submitting/navigation-lock state is active
- validation should happen on submit, not necessarily on every keystroke
- invalid input must not navigate away

Keep the UI minimal and consistent with the current utilitarian app style.

---

## 6) Public invite screen integration

When a valid token is produced from the entry screen:

- set the selected public token state
- set the public invite origin to standalone entry
- navigate to the existing public-invite screen
- reuse the existing fetch logic already implemented in EVT-14

Do not introduce a duplicate fetch path.

---

## 7) Error-handling requirements

### Entry validation errors

Examples of acceptable user-facing messages:

- `Enter an invite token or full invite URL.`
- `That invite link is not valid.`

Exact wording may differ slightly, but it must be concise and user-friendly.

### Fetch errors on the public invite screen

Existing EVT-14 behavior must continue to work.

If fetch fails after navigating from standalone entry:
- user can still use existing retry behavior
- Back must return to entry screen

---

## 8) No backend changes

This task is mobile-only.

Do not modify:

- `apps/api/**`
- Prisma schema
- migrations
- backend docs unrelated to mobile usage

The only non-mobile file that may be updated is `docs/local-development.md` if needed to describe the new manual verification flow.

---

## Acceptance criteria

This task is complete only if all of the following are true:

1. The mobile app exposes a standalone `Open invite` entry action from the organizer home/list screen.
2. A dedicated invite-entry screen exists.
3. The screen accepts raw token input.
4. The screen accepts full invite URLs.
5. Invalid input is rejected locally with a visible validation message.
6. Valid input navigates into the existing public-invite screen.
7. The existing public invite fetch/RSVP flow continues to work unchanged.
8. Back from public invite returns to the correct previous screen depending on origin.
9. The new parser/model helpers are covered by unit tests.
10. All mobile tests are green.
11. Mobile typecheck is green.
12. No backend files were changed.

---

## Required manual verification steps

Document the exact commands you ran in the final report.

### PowerShell-friendly flow

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
pnpm --filter @event-app/mobile test -- src/features/public-invite/invite-token-parser.test.ts src/features/public-invite/invite-token-entry-model.test.ts
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

### Manual app verification

On Android Emulator or device:

1. Open the organizer home screen.
2. Tap `Open invite`.
3. Verify the entry screen appears.
4. Paste whitespace-only input and confirm a visible validation error appears.
5. Paste a raw token copied from a real invite and confirm navigation to the public-invite screen.
6. Go Back and confirm you return to the entry screen.
7. Paste a full invite URL and confirm navigation to the same public-invite screen.
8. Trigger a public invite fetch error (for example invalid token) and confirm retry works or Back returns to entry screen.
9. Confirm organizer preview from event details still opens public invite and Back still returns to details, not to entry.

Stop services when done:

```powershell
docker compose down
```

---

## Implementation notes and guardrails

- Keep the diff focused.
- Do not refactor the whole app state model.
- Do not introduce a router.
- Do not add Expo Linking.
- Do not add clipboard auto-read.
- Do not add QR scanner support.
- Prefer small pure helpers for parsing and validation.
- Reuse the existing public invite flow instead of copying it.

---

## Final report requirements for this task

In addition to the global run prompt requirements, the final report for EVT-15 must explicitly include:

1. the exact accepted token/URL formats implemented;
2. the exact user-facing validation message(s) used for invalid input;
3. the exact back-navigation behavior for both public-invite origins;
4. the list of files changed;
5. the exact targeted red-state and green-state test commands.

---

## Definition of done

EVT-15 is done when a user can open the mobile app, choose `Open invite`, paste either a raw token or a full invite URL, land on the existing public invite screen, and navigate back correctly — with all mobile tests and typecheck green.

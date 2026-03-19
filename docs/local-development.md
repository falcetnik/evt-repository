# Local Development

## Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop (running)

## Setup environment files
PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/api/.env.test.example apps/api/.env.test -Force
```

Bash:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
```

## Start local infrastructure
```powershell
docker compose up -d
```

## Prisma database workflow
```powershell
pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
```

## Seed deterministic development organizer user
```powershell
pnpm --filter @event-app/api db:seed:dev-user
```

Expected output example:

```text
DEV_USER_ID=local-organizer-dev-user
```

## Run EVT-4 automated checks
```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/invite-link-url.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/invite-links.integration-spec.ts
pnpm --filter @event-app/api typecheck
```

## Start backend app
```powershell
pnpm --filter @event-app/api start:dev
```

## Manual create/read event verification (PowerShell)
Use the seeded `DEV_USER_ID` from `db:seed:dev-user` output.

```powershell
$headers = @{ 'x-dev-user-id' = 'local-organizer-dev-user' }
$body = @{
  title = 'Friday Board Games'
  description = 'Bring drinks if you want'
  location = 'Prospekt Mira 10'
  startsAt = '2026-03-20T16:30:00.000Z'
  timezone = 'Europe/Moscow'
  capacityLimit = 8
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body

$response
```

```powershell
Invoke-RestMethod -Method GET `
  -Uri ("http://localhost:3000/api/v1/events/{0}" -f $response.id) `
  -Headers $headers
```

Request without auth header should be rejected:

```powershell
Invoke-RestMethod -Method POST `
  -Uri 'http://localhost:3000/api/v1/events' `
  -ContentType 'application/json' `
  -Body $body
```

## Useful URLs
- API health: http://localhost:3000/api/v1/health
- Swagger docs: http://localhost:3000/api/docs

## Stop local infrastructure
```powershell
docker compose down
```

## Manual invite-link verification (PowerShell)
Use the seeded `DEV_USER_ID` from `db:seed:dev-user` output. Ensure `PUBLIC_INVITE_BASE_URL=http://localhost:3000/api/v1/invite-links` in both `apps/api/.env` and `apps/api/.env.test`.

```powershell
$headers = @{ 'x-dev-user-id' = 'local-organizer-dev-user' }
$body = @{
  title = 'Friday Board Games'
  description = 'Bring drinks if you want'
  location = 'Prospekt Mira 10'
  startsAt = '2026-03-20T16:30:00.000Z'
  timezone = 'Europe/Moscow'
  capacityLimit = 8
} | ConvertTo-Json

$event = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body

$invite1 = Invoke-RestMethod -Method Post `
  -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) `
  -Headers $headers

$invite2 = Invoke-RestMethod -Method Post `
  -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) `
  -Headers $headers

$invite1
$invite2

Invoke-RestMethod -Method Get -Uri $invite1.url
```

The second invite response should return the same `token` and `url` as the first response.

To simulate inactive/expired links for manual checks, update `invite_links` rows in PostgreSQL and confirm `GET /api/v1/invite-links/:token` returns 404.

## EVT-6 manual waitlist verification (PowerShell)
Use the seeded `DEV_USER_ID` from `pnpm --filter @event-app/api db:seed:dev-user` output.

```powershell
$headers = @{ 'x-dev-user-id' = 'local-organizer-dev-user' }

$eventBody = @{
  title = 'EVT-6 Capacity Test'
  startsAt = '2026-03-20T16:30:00.000Z'
  timezone = 'UTC'
  capacityLimit = 2
} | ConvertTo-Json

$event = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $eventBody

$invite = Invoke-RestMethod -Method Post `
  -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) `
  -Headers $headers

$inviteUrl = "http://localhost:3000/api/v1/invite-links/{0}" -f $invite.token
$rsvpUrl = "http://localhost:3000/api/v1/invite-links/{0}/rsvp" -f $invite.token

$guestA = @{ guestName = 'Guest A'; guestEmail = 'a@example.com'; status = 'going' } | ConvertTo-Json
$guestB = @{ guestName = 'Guest B'; guestEmail = 'b@example.com'; status = 'going' } | ConvertTo-Json
$guestC = @{ guestName = 'Guest C'; guestEmail = 'c@example.com'; status = 'going' } | ConvertTo-Json
$guestD = @{ guestName = 'Guest D'; guestEmail = 'd@example.com'; status = 'going' } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestA
Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestB
Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestC
Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestD

# Verify waitlist positions (C should be 1, D should be 2)
Invoke-RestMethod -Method Get -Uri $inviteUrl
Invoke-RestMethod -Method Get -Uri ("http://localhost:3000/api/v1/events/{0}/attendees" -f $event.id) -Headers $headers

# Remove C from waitlist and verify D compacts to position 1
$guestCMaybe = @{ guestName = 'Guest C'; guestEmail = 'c@example.com'; status = 'maybe' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestCMaybe
Invoke-RestMethod -Method Get -Uri ("http://localhost:3000/api/v1/events/{0}/attendees" -f $event.id) -Headers $headers

# Free confirmed seat (A -> not_going) and verify D auto-promotes to confirmed
$guestANotGoing = @{ guestName = 'Guest A'; guestEmail = 'a@example.com'; status = 'not_going' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $rsvpUrl -ContentType 'application/json' -Body $guestANotGoing

Invoke-RestMethod -Method Get -Uri $inviteUrl
Invoke-RestMethod -Method Get -Uri ("http://localhost:3000/api/v1/events/{0}/attendees" -f $event.id) -Headers $headers
```

URLs used:
- Public invite resolution: `GET http://localhost:3000/api/v1/invite-links/:token`
- Public RSVP submit: `POST http://localhost:3000/api/v1/invite-links/:token/rsvp`
- Organizer attendee list: `GET http://localhost:3000/api/v1/events/:eventId/attendees`

## EVT-7 manual reminder schedule verification (PowerShell)
Use the seeded `DEV_USER_ID` from `pnpm --filter @event-app/api db:seed:dev-user` output.

```powershell
$headers = @{ 'x-dev-user-id' = 'local-organizer-dev-user'; 'Content-Type' = 'application/json' }

$eventBody = @{
  title = 'EVT-7 Reminder Test'
  startsAt = '2026-03-25T18:00:00.000Z'
  timezone = 'Europe/Moscow'
} | ConvertTo-Json

$event = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -Body $eventBody

$replaceBody = @{ offsetsMinutes = @(1440, 120, 30) } | ConvertTo-Json
Invoke-RestMethod -Method Put `
  -Uri ("http://localhost:3000/api/v1/events/{0}/reminders" -f $event.id) `
  -Headers $headers `
  -Body $replaceBody

Invoke-RestMethod -Method Get `
  -Uri ("http://localhost:3000/api/v1/events/{0}/reminders" -f $event.id) `
  -Headers $headers

$clearBody = @{ offsetsMinutes = @() } | ConvertTo-Json
Invoke-RestMethod -Method Put `
  -Uri ("http://localhost:3000/api/v1/events/{0}/reminders" -f $event.id) `
  -Headers $headers `
  -Body $clearBody
```

Expected after clear:
- `total = 0`
- `reminders = []`

Rerun EVT-7 tests:

```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/event-reminders.schedule.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/event-reminders.integration-spec.ts
```

## EVT-8 organizer events list verification (PowerShell)
Use the seeded `DEV_USER_ID` from `pnpm --filter @event-app/api db:seed:dev-user` output.

```powershell
$headers = @{ 'x-dev-user-id' = 'local-organizer-dev-user'; 'Content-Type' = 'application/json' }

$eventBody1 = @{
  title = 'EVT-8 Upcoming Event'
  startsAt = '2099-03-20T16:30:00.000Z'
  timezone = 'UTC'
  capacityLimit = 4
} | ConvertTo-Json

$eventBody2 = @{
  title = 'EVT-8 Past Event'
  startsAt = '2020-03-20T16:30:00.000Z'
  timezone = 'UTC'
} | ConvertTo-Json

$upcomingEvent = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -Body $eventBody1

$pastEvent = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers $headers `
  -Body $eventBody2

# Create an invite link and reminders so list cards include hasActiveInviteLink and activeReminderCount.
$invite = Invoke-RestMethod -Method Post `
  -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $upcomingEvent.id) `
  -Headers @{ 'x-dev-user-id' = 'local-organizer-dev-user' }

$reminderBody = @{ offsetsMinutes = @(1440, 60) } | ConvertTo-Json
Invoke-RestMethod -Method Put `
  -Uri ("http://localhost:3000/api/v1/events/{0}/reminders" -f $upcomingEvent.id) `
  -Headers $headers `
  -Body $reminderBody
```

List endpoint calls:

```powershell
Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/events' `
  -Headers @{ 'x-dev-user-id' = 'local-organizer-dev-user' }

Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/events?scope=past' `
  -Headers @{ 'x-dev-user-id' = 'local-organizer-dev-user' }

Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/events?scope=all' `
  -Headers @{ 'x-dev-user-id' = 'local-organizer-dev-user' }
```

## EVT-9 mobile organizer home screen verification (PowerShell)
1. Copy mobile env file and set Android emulator-safe backend URL:

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env -Force
```

Use these values in `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api
EXPO_PUBLIC_DEV_USER_ID=dev-organizer-1
```

`10.0.2.2` is required from Android Emulator to reach backend running on Windows host.

2. Start Docker + backend:

```powershell
docker compose up -d
pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api start:dev
```

3. In a second terminal, run mobile checks and start Expo:

```powershell
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

4. In Android Studio, boot an Android Emulator and open the Expo app.
5. Verify organizer events list loads on the single Home screen.
6. Verify scope switching updates list for **Upcoming**, **Past**, and **All**.
7. Stop backend temporarily and tap **Retry** in app; verify retryable error state appears.
8. Start backend again and verify **Retry** loads the list successfully.

## EVT-11 mobile create-event flow verification (PowerShell)
1. Copy env files:

```powershell
Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/mobile/.env.example apps/mobile/.env -Force
```

Use these values in `apps/mobile/.env` for Android Emulator:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api
EXPO_PUBLIC_DEV_USER_ID=local-organizer-dev-user
```

2. Start infrastructure and backend:

```powershell
docker compose up -d
pnpm --filter @event-app/api db:generate
pnpm --filter @event-app/api db:migrate:deploy
pnpm --filter @event-app/api db:seed:dev-user
pnpm --filter @event-app/api start:dev
```

3. In a second terminal, run mobile checks and start Expo:

```powershell
pnpm --filter @event-app/mobile test
pnpm --filter @event-app/mobile typecheck
pnpm --filter @event-app/mobile start
```

4. In Android Emulator, open the app and verify:
- Organizer list loads.
- Tap **Create event**.
- Submit empty fields and verify a validation error is shown.
- Submit valid values, for example:
  - Title: `Friday Board Games`
  - Description: `Bring drinks if you want`
  - Location: `Prospekt Mira 10`
  - Starts at: `2099-03-25T19:30:00.000Z`
  - Timezone: `Europe/Moscow`
  - Capacity limit: `8`
- Verify app navigates to event details for the created event.
- Tap **Back to events** and verify the new event appears after refresh.
- Stop backend and submit again from create screen; verify a submit error appears and app does not crash.

## EVT-16 incoming invite deep-link verification (PowerShell)
1. Start the mobile app and keep Expo running:

```powershell
pnpm --filter @event-app/mobile start
```

2. Expo Go-style local URL test (replace host/port with the Expo URL shown in terminal if different):

```powershell
npx uri-scheme open "exp://127.0.0.1:8081/--/invite-links/<TOKEN>" --android
```

3. Custom-scheme test for a development build / installed app that has the `eventapp` scheme:

```powershell
npx uri-scheme open "eventapp://invite-links/<TOKEN>" --android
```

4. Unsupported URL safety check:

```powershell
npx uri-scheme open "eventapp://not-an-invite/path" --android
```

Expected behavior:
- Supported invite links open/foreground the app, navigate to public invite, and load the token.
- Unsupported URLs do not crash the app and do not navigate to public invite.

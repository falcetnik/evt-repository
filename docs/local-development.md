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

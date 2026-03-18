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

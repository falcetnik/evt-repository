# Local Development

## Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop (running)

## Setup environment files
PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Bash:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
cp apps/mobile/.env.example apps/mobile/.env
```

`PUBLIC_INVITE_BASE_URL` must exist in both `apps/api/.env` and `apps/api/.env.test`.
Example value:

```text
http://localhost:3000/api/v1/invite-links
```

## Start local infrastructure
```powershell
docker compose up -d
```

## Prisma database workflow
Generate Prisma Client:

```powershell
pnpm --filter @event-app/api db:generate
```

Apply committed migrations:

```powershell
pnpm --filter @event-app/api db:migrate:deploy
```

Seed the development organizer user from EVT-3:

```powershell
pnpm --filter @event-app/api db:seed:dev-user
```

Open Prisma Studio:

```powershell
pnpm --filter @event-app/api db:studio
```

> The `apps/api/.env.test` file points Prisma integration tests at an isolated schema (`event_app_test`) so test data does not leak into the default local schema.

## Run backend tests
```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/invite-link-url.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/invite-links.integration-spec.ts
pnpm --filter @event-app/api typecheck
```

## Start backend app
```powershell
pnpm --filter @event-app/api start:dev
```

## EVT-4 manual verification (PowerShell)

Assume API is running on `http://localhost:3000` and you seeded the organizer user (`dev-user-1`).

Create event:

```powershell
$headers = @{ 'x-dev-user-id' = 'dev-user-1' }
$body = @{
  title = 'Friday Board Games'
  description = 'Bring drinks if you want'
  location = 'Prospekt Mira 10'
  startsAt = '2026-03-20T16:30:00.000Z'
  timezone = 'Europe/Moscow'
  capacityLimit = 8
} | ConvertTo-Json

$event = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/events' -Headers $headers -ContentType 'application/json' -Body $body
$event
```

Create/fetch invite link:

```powershell
$invite = Invoke-RestMethod -Method Post -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) -Headers $headers
$invite
```

Call it a second time and confirm the same token and URL:

```powershell
$invite2 = Invoke-RestMethod -Method Post -Uri ("http://localhost:3000/api/v1/events/{0}/invite-link" -f $event.id) -Headers $headers
$invite2
```

Resolve public invite (no auth required):

```powershell
Invoke-RestMethod -Method Get -Uri $invite.url
```

Test inactive/expired manually (example SQL via Prisma Studio/query tool):

```sql
UPDATE "invite_links" SET "is_active" = false WHERE "token" = '<token>';
UPDATE "invite_links" SET "is_active" = true, "expires_at" = NOW() - INTERVAL '1 minute' WHERE "token" = '<token>';
```

Both states should return `404` from `GET /api/v1/invite-links/:token`.

## Useful URLs
- API health: http://localhost:3000/api/v1/health
- Swagger docs: http://localhost:3000/api/docs
- Mailpit UI: http://localhost:8025

## Stop local infrastructure
```powershell
docker compose down
```

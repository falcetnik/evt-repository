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

Open Prisma Studio:

```powershell
pnpm --filter @event-app/api db:studio
```

> The `apps/api/.env.test` file points Prisma integration tests at an isolated schema (`event_app_test`) so test data does not leak into the default local schema.

## Run backend tests
```powershell
pnpm --filter @event-app/api test -- --runTestsByPath test/rsvp.dto.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand --runTestsByPath test/rsvp.integration-spec.ts
pnpm --filter @event-app/api test -- --runTestsByPath test/database-env.validation.spec.ts
pnpm --filter @event-app/api test:e2e -- --runInBand
```

## Start backend app
```powershell
pnpm --filter @event-app/api start:dev
```

## RSVP manual verification (PowerShell)
1. Create an organizer event:

```powershell
$event = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/events' -Headers @{ 'x-dev-user-id' = 'dev_user_1' } -ContentType 'application/json' -Body (@{
  title = 'EVT-5 Manual Event'
  startsAt = '2030-06-01T18:00:00.000Z'
  timezone = 'UTC'
} | ConvertTo-Json)
```

2. Create/reuse invite link:

```powershell
$invite = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/events/$($event.eventId)/invite-link" -Headers @{ 'x-dev-user-id' = 'dev_user_1' }
```

3. Check initial public summary:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/v1/invite-links/$($invite.token)"
```

4. Submit RSVP and then update it with the same email:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/invite-links/$($invite.token)/rsvp" -ContentType 'application/json' -Body (@{
  guestName = 'Nikita'
  guestEmail = 'nikita@example.com'
  status = 'going'
} | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/invite-links/$($invite.token)/rsvp" -ContentType 'application/json' -Body (@{
  guestName = 'Nikita Updated'
  guestEmail = 'NIKITA@example.com'
  status = 'not_going'
} | ConvertTo-Json)
```

5. Verify organizer attendee list and summary:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/v1/events/$($event.eventId)/attendees" -Headers @{ 'x-dev-user-id' = 'dev_user_1' }
```

6. Verify updated public invite summary counts:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/v1/invite-links/$($invite.token)"
```

## Start mobile app
```powershell
pnpm --filter @event-app/mobile start
```

## Useful URLs
- API health: http://localhost:3000/api/v1/health
- Swagger docs: http://localhost:3000/api/docs
- Mailpit UI: http://localhost:8025

## Stop local infrastructure
```powershell
docker compose down
```

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
pnpm --filter @event-app/api test -- --runTestsByPath test/database-env.validation.spec.ts
pnpm --filter @event-app/api test:integration -- --runInBand
pnpm --filter @event-app/api test:e2e -- --runInBand
```

## Start backend app
```powershell
pnpm --filter @event-app/api start:dev
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

## EVT-6 manual verification (waitlist + auto-promotion)
1. Seed or create a dev organizer user:

```powershell
pnpm --filter @event-app/api db:seed:dev-user
```

2. Create an event with capacity `2` and an invite token (via your existing dev flow, Prisma Studio, or SQL).
3. Submit RSVPs to overflow capacity:

```powershell
$base = 'http://localhost:3000/api/v1/invite-links/<TOKEN>'

Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest A","guestEmail":"a@example.com","status":"going"}'
Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest B","guestEmail":"b@example.com","status":"going"}'
Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest C","guestEmail":"c@example.com","status":"going"}'
Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest D","guestEmail":"d@example.com","status":"going"}'
```

4. Verify C is waitlist `1` and D is waitlist `2` from RSVP responses.
5. Remove C from waitlist and confirm compaction:

```powershell
Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest C","guestEmail":"c@example.com","status":"maybe"}'
```

6. Free a confirmed seat and verify auto-promotion:

```powershell
Invoke-RestMethod -Method Post -Uri "$base/rsvp" -ContentType 'application/json' -Body '{"guestName":"Guest A","guestEmail":"a@example.com","status":"not_going"}'
```

7. Verify public summary and organizer attendee list:

```powershell
Invoke-RestMethod -Method Get -Uri "$base"
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/v1/events/<EVENT_ID>/attendees' -Headers @{ 'x-dev-user-id' = '<ORGANIZER_USER_ID>' }
```

Relevant URLs:
- `POST http://localhost:3000/api/v1/invite-links/<TOKEN>/rsvp`
- `GET  http://localhost:3000/api/v1/invite-links/<TOKEN>`
- `GET  http://localhost:3000/api/v1/events/<EVENT_ID>/attendees`

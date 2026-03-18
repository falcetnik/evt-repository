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

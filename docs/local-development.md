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
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Bash:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

## Start local infrastructure
```powershell
docker compose up -d
```

## Run backend tests
```powershell
pnpm --filter @event-app/api test:e2e -- --runInBand
pnpm --filter @event-app/api test:unit -- env.validation.spec.ts
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

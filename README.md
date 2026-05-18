# AI Nutrition Backend (NestJS)

Production-ready backend for AI-powered food analysis and nutrition recommendations.

## Architecture

- `auth`: JWT register/login/forgot/reset password
- `users`: profile read/update
- `food`: image and text analysis + history
- `ai`: alias endpoints for suggest/calories
- `ml`: FastAPI wrapper (`POST /predict`)
- `cloudinary`: signed upload helper
- `calories`: BMR/TDEE and daily calories
- `logs`: internal system logs endpoint
- `jobs`: BullMQ processors (email + logging)
- `redis`: caching and queue connection support
- `database`: migration + data-source
- `common`: shared guards/enums/filters/interceptors/utils

## Key Features

- PostgreSQL + TypeORM entities and migration
- Redis cache for duplicate image prediction (24h TTL)
- BullMQ background jobs for email and system logging
- Gemini strict JSON responses for nutrition/calorie advice
- FastAPI ML integration for image label/confidence
- Cloudinary signed upload parameters endpoint
- Unified API response envelope and error format
- Global DTO validation and rate limiting
- Dual route support: root and `/api/v1/*`

## Setup

```bash
pnpm install
cp .env.example .env
```

## Run

```bash
pnpm run start:dev
```

## Migrations

```bash
pnpm run migration:run
pnpm run migration:revert
```

## Tests

```bash
pnpm run test
pnpm run test:e2e
```

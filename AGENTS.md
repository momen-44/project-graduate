# AI Agent Guide: NutriLife (ORM + ML + Flutter)

> **Purpose**: Help AI coding agents understand this NestJS + Python ML + Flutter nutrition tracking application and be immediately productive.

---

## 🏗️ Project Architecture

**Three-tier system**:

- **Backend**: NestJS (`orm/src/`) with PostgreSQL, Redis, TypeORM
- **ML Service**: Python Flask (`ml/app.py`) with MobileNetV2 classifier + local nutrition database
- **Frontend**: Flutter mobile app (`orm/frontend/`)

**Core workflow** (Image Analysis):

1. Flutter app uploads image to NestJS → `/food/image`
2. NestJS checks Redis cache (24h TTL) for duplicate predictions
3. If miss: upload to Cloudinary, call ML service at `http://localhost:5000/predict`
4. Flask returns `{ label, confidence }` + nutrition data from local-nutrition.db
5. NestJS caches result in Redis and stores in PostgreSQL (TypeORM entities)
6. Client receives `{ success: true, data: {...} }` wrapped response

**Key insight**: ML service is stateless and runs independently. NestJS is the integration layer that handles caching, persistence, and orchestration.

---

## 📦 Core Modules (orm/src/)

| Module         | Responsibility                                      | Key Files                                                              |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| **auth**       | JWT register/login/refresh, password reset          | `auth.service.ts`, `auth.controller.ts`                                |
| **users**      | Profile CRUD, validation                            | `users.service.ts`                                                     |
| **food**       | Image/text analysis, caching, history               | `food.service.ts`, `text-analysis.service.ts`, `local-nutrition.db.ts` |
| **ai**         | Gemini API wrapper (nutrition/calories advice)      | `ai.service.ts`, `gemini.service.ts`                                   |
| **ml**         | HTTP client to Flask ML service                     | `ml.service.ts`                                                        |
| **cloudinary** | Image upload & signed parameters                    | `cloudinary.service.ts`                                                |
| **calories**   | BMR/TDEE calculations, daily tracking               | `calories.service.ts`, `daily-calculation.processor.ts`                |
| **redis**      | Connection pooling, BullMQ job queue                | `redis.service.ts`                                                     |
| **jobs**       | Background processors (email, logging, daily calcs) | `*processor.ts`                                                        |
| **logs**       | Event logging with TTL-based cleanup                | `logs.service.ts`                                                      |
| **common**     | Shared: decorators, guards, interceptors, filters   | `decorators/`, `guards/`, `interceptors/`                              |

---

## 🔧 Essential Commands

### Build & Run

```bash
cd orm
pnpm install                    # Install deps
pnpm run start:dev              # Dev server (watch mode, port 4000)
pnpm run start:prod             # Production build + run
pnpm run build && npm run preview  # Dry-run production locally
```

### Test & Lint

```bash
npm run test                    # Jest unit tests
npm run test:watch              # Watch mode
npm run test:cov                # Coverage
npm run test:e2e                # E2E tests (config: test/jest-e2e.json)
npm run lint                    # ESLint with auto-fix
npm run format                  # Prettier format
```

### Database & Migrations

```bash
npm run migration:run           # Apply pending migrations (required in production)
npm run migration:generate src/database/migrations/Auto  # Auto-generate from entities
```

### ML Service (separate process)

```bash
cd ml
pip install -r requirements.txt
python app.py                   # Runs on http://localhost:5000
```

---

## 🎯 Key Patterns & Conventions

### Decorators (Define Access & Context)

```typescript
@Public()              // Skip JWT guard for this route
@CurrentUser()         // Inject JWT payload (extracted from Authorization header)
@UseGuards(JwtAuthGuard)   // Optional: explicit guard (redundant, already global)
```

### Global Guards

- **JwtAuthGuard** (APP_GUARD): Validates JWT, checks `@Public()` metadata
- **InternalApiKeyGuard**: Validates `x-internal-key` header (internal endpoints)
- **ThrottlerGuard**: Rate limiting (60 req/60s)

### Response Format (Standardized by ResponseInterceptor)

```json
{
  "success": true,
  "data": { ... }
}
```

_All HTTP responses follow this envelope. Errors use HttpExceptionFilter for consistent format._

### DTO Validation (Global ValidationPipe)

- `class-validator` decorators on DTO classes
- Options: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` (auto-type conversion)
- Example: `string "123"` → `number 123`

### Database (TypeORM + PostgreSQL)

- Entities auto-discovered (`autoLoadEntities: true`)
- Migrations in `src/database/migrations/` (manually run with `npm run migration:run`)
- **Important**: Use **relative imports** in entities/migrations to avoid TypeORM CLI path resolution errors

### Caching Strategy (Redis)

- **Image analysis**: `image-analysis:<sha256-hash>` (24h TTL)
- **Text nutrition**: `text-analysis:<hash>` (24h TTL)
- **Calories advice**: `calories-advice:<hash>` (24h TTL)
- TTLs configurable via env: `IMAGE_ANALYSIS_CACHE_TTL_SECONDS`, etc.

### ML Service Integration

- **Endpoint**: POST `http://localhost:5000/predict`
- **Input**: `{ image_url: string }` or `{ image_base64, mime_type }`
- **Output**: `{ label, confidence }` + optional `nutrition`, `nutritionSource`
- **Retry logic**: 3 attempts with exponential backoff (configurable)
- **Threshold**: Default 0.6 confidence (configurable via `ML_CONFIDENCE_THRESHOLD`)

---

## ⚠️ Common Pitfalls & Solutions

| Issue                                        | Root Cause                                                  | Solution                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Migration fails with `MODULE_NOT_FOUND`**  | TypeORM CLI can't resolve `src/...` absolute paths          | Use **relative imports** in entity files (e.g., `../../../common/enums`)                           |
| **Local ML predictions fail**                | Flask service not running                                   | Start in separate terminal: `cd ml && python app.py`                                               |
| **Food history delete returns bigint error** | Flutter sends local IDs (e.g., `local_meal_123`) to backend | Guard validates regex `/^\d+$/`; return 400 with message. Flutter must delete local items locally. |
| **Redis operations fail**                    | Redis not running or `REDIS_ENABLED=false`                  | Ensure Redis is running and `REDIS_ENABLED=true` in `.env`                                         |
| **Image cache key mismatch**                 | Old code used `cloudinaryId`; new code uses SHA-256 hash    | All food caching now uses SHA-256 hash of image bytes, not Cloudinary ID                           |
| **Flutter can't reach backend**              | Hardcoded `localhost` on Android emulator                   | Use `10.0.2.2:4000` on emulator; set `FLUTTER_API_BASE_URL` env override or use ngrok tunnel       |
| **ngrok tunnel issues**                      | Upstream reconnection failures to connect.ngrok-agent.com   | Document tunnel URL in `.env`; avoid hardcoding URLs in code                                       |
| **Status code: 500 on validation error**     | Some validation layers return 500 instead of 4xx            | Prefer `class-validator` + ValidationPipe (returns 400 automatically)                              |

---

## 🔐 Critical Environment Variables

Copy this to `.env` in `orm/` and customize:

```bash
# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<your_password>
DB_NAME=nutrilife
DB_SSL=false

# JWT & Auth
JWT_SECRET_KEY=<min_16_chars_random>
JWT_EXPIRES_IN=1h

# Redis
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Gemini AI
GEMINI_API_KEY=<from Google Cloud Console>
GEMINI_MODEL=gemini-2.0-flash

# ML Service
ML_API_BASE_URL=http://localhost:5000
ML_CONFIDENCE_THRESHOLD=0.6
ML_TIMEOUT_MS=10000

# Cloudinary
CLOUDINARY_NAME=<account>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# Email (SMTP)
SMTP_HOST=<your_smtp_host>
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USERNAME=<user>
SMTP_PASSWORD=<pass>
EMAIL_FROM=noreply@example.com

# Other
PORT=4000
NODE_ENV=development
INTERNAL_API_KEY=<min_16_chars>
IMAGE_ANALYSIS_CACHE_TTL_SECONDS=86400
LOG_RETENTION_DAYS=30
```

---

## ✅ Startup Checklist

1. **Install dependencies**

   ```bash
   cd orm && pnpm install
   cd ../ml && pip install -r requirements.txt
   ```

2. **Start services**

   ```bash
   # Terminal 1: PostgreSQL (ensure running)
   # Terminal 2: Redis (ensure running)
   # Terminal 3: ML Flask service
   cd ml && python app.py

   # Terminal 4: NestJS backend
   cd orm && pnpm run start:dev
   ```

3. **Initialize database**

   ```bash
   cd orm && npm run migration:run
   ```

4. **Verify**
   - Backend running: `http://localhost:4000`
   - Swagger API docs: `http://localhost:4000/docs`
   - ML service health: `http://localhost:5000/health`

---

## 📚 Documentation References

- [NestJS Backend README](orm/README.md) — Project overview, API endpoints
- [ML Service README](ml/README.md) — Model details, input/output format
- [Backend Report](orm/NUTRI_LIFE_BACKEND_REPORT.md) — Technical documentation
- [Known Issues & Solutions](orm/PROJECT_ISSUES_SOLUTIONS_OBSTACLES_EN.md) — Documented constraints
- [Swagger API Docs](http://localhost:4000/docs) — Interactive endpoint reference (live)

---

## 🎨 Code Quality

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'`
- **ESLint**: TypeScript v8.20+ with type checking (unsafe rules as warnings)
- **TypeScript**: Strict null checks, decorators enabled, incremental builds
- **No CI/CD**: No GitHub Actions; recommend adding before scaling teams

---

## 🚀 Quick Troubleshooting

| Symptom                  | Check                            | Command                                      |
| ------------------------ | -------------------------------- | -------------------------------------------- |
| Port 4000 already in use | Kill process on 4000             | `lsof -ti:4000 \| xargs kill -9` (Linux/Mac) |
| Database not found       | Run migrations                   | `npm run migration:run`                      |
| JWT validation fails     | Check `JWT_SECRET_KEY` in `.env` | Ensure same value in all environments        |
| ML prediction timeout    | ML service down                  | `curl http://localhost:5000/health`          |
| Cache hit/miss confusion | Check Redis TTL vars             | `redis-cli TTL image-analysis:<hash>`        |

---

## 📝 For New Developers

1. Read this file (you are here!)
2. Clone and follow "Startup Checklist"
3. Open Swagger docs (`/docs`) to explore endpoints
4. Look at `orm/src/food/` module as a reference implementation (handles caching, external APIs, validation)
5. Check [Backend Report](orm/NUTRI_LIFE_BACKEND_REPORT.md) for design decisions
6. Ask in issues/PRs; team familiar with above constraints

---

**Last updated**: May 2026 | Covers: NestJS v10+, TypeORM, Redis caching, MobileNetV2 ML, PostgreSQL

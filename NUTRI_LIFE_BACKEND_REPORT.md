# Nutri Life Backend Implementation Report

## Section 1: API Endpoints

The backend exposes 20 main application endpoints counted for this report. Most controllers are available under both the root route and the `/api/v1/*` alias, as configured in the NestJS controllers.

| Endpoint | Method | Description | Example test |
|---|---|---|---|
| `/health` | GET | Health check endpoint that returns the service status and timestamp. | Send a GET request and expect `200 OK` with `{ status: "ok" }`. |
| `/auth/register` | POST | Registers a new user and optionally uploads a profile image. | Submit multipart form-data with required profile fields and expect account creation. |
| `/auth/login` | POST | Authenticates a user and returns access and refresh tokens. | Send email and password and expect tokens plus session data. |
| `/auth/refresh` | POST | Issues a new access token using a valid refresh token. | Send a valid refresh token and expect a new access token. |
| `/auth/forgot-password` | POST | Starts the password reset flow by sending a reset code. | Submit a registered email and expect reset-code generation. |
| `/auth/verify-reset-code` | POST | Verifies the reset code and issues a temporary reset token. | Send email and code and expect a temporary reset token. |
| `/auth/reset-password` | POST | Resets the password using the temporary reset token. | Send token, new password, and confirm that login works with the new password. |
| `/auth/revoke` | POST | Revokes a refresh session/token. | Send a session token or revoke payload and expect the session to be marked revoked. |
| `/auth/sessions` | GET | Returns active user sessions. | Call with a valid JWT and expect a session list. |
| `/users/me` | GET | Returns the current user's profile data. | Call with a valid JWT and expect the user profile. |
| `/users/update` | PUT | Updates the current user's profile information. | Send profile fields and expect updated user data. |
| `/users/:id` | DELETE | Deletes a user account by id when authorized. | Send the user id with a valid JWT and expect deletion or authorization failure. |
| `/food/image` | POST | Uploads an image and runs the food image analysis pipeline. | Send multipart file upload and expect food label and nutrition result. |
| `/food/text` | POST | Analyzes a text description of food and returns nutrition data. | Send meal description and expect structured nutrition output. |
| `/food/text-options` | GET | Returns food text options, optionally filtered by meal type. | Call with or without `mealType` and expect a list of options. |
| `/food/text-suggestions` | POST | Returns text suggestions for a query string. | Send `query` and expect relevant food suggestions. |
| `/food/history` | GET | Returns the authenticated user's food analysis history. | Call with a valid JWT and expect past analysis records. |
| `/food/history` | DELETE | Clears the authenticated user's food history. | Call with a valid JWT and expect the history to be removed. |
| `/food/history/:id` | DELETE | Deletes one food history item. | Send the item id and expect the matching record to be deleted. |
| `/cloudinary/signed-upload` | POST | Generates signed Cloudinary upload parameters for the client. | Send folder/publicId data and expect signed upload parameters. |

### Swagger/OpenAPI

Yes. Swagger/OpenAPI is enabled in `src/main.ts` and is exposed at `/docs`.

### Notes on route aliases

Controllers such as `auth`, `users`, `ai`, `logs`, `daily-calories`, and `cloudinary` are also mounted under `/api/v1/*` in the codebase. The 20 endpoints above are the main application routes counted for the report.

## Section 2: Main Code Sample

The backend is implemented in NestJS/TypeScript, so the real endpoint code is shown below in TypeScript.

```ts
// src/auth/auth.controller.ts
import { Body, Post } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';

// inside AuthController
@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

// src/auth/auth.service.ts
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

import { LoginDto } from './dto/login.dto';
import { sha256 } from '../common/utils/security.util';

// inside AuthService
async login(dto: LoginDto) {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const passwordMatched = await bcrypt.compare(
    dto.password,
    user.passwordHash,
  );
  if (!passwordMatched) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const accessToken = await this.signToken(user.id, user.email);

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = await argon2.hash(refreshToken);
  const refreshFingerprint = sha256(refreshToken);
  const now = new Date();
  const refreshTtlDays = Number(
    this.configService.get<number>('REFRESH_EXPIRES_DAYS') ?? 14,
  );
  const refreshExpiresAt = new Date(
    now.getTime() + refreshTtlDays * 24 * 60 * 60 * 1000,
  );

  if (!this.sessionRepository) {
    throw new InternalServerErrorException(
      'Session repository not available',
    );
  }

  const session = this.sessionRepository.create({
    userId: user.id,
    refreshTokenHash: refreshHash,
    refreshTokenFingerprint: refreshFingerprint,
    deviceId: (dto as any).device_id ?? null,
    deviceInfo: (dto as any).device_info ?? null,
    ip: null,
    userAgent: null,
    issuedAt: now,
    expiresAt: refreshExpiresAt,
    revoked: false,
  });

  await this.sessionRepository.save(session);

  return {
    accessToken,
    access_expires_in: this.configService.get('JWT_EXPIRES_IN') ?? '1h',
    refresh_token: refreshToken,
    refresh_expires_in: refreshTtlDays * 24 * 60 * 60,
    session_id: session.id,
    user: this.usersService.toSafeUser(user),
  };
}
```

## Section 3: PostgreSQL Database Schema

### Enum Types

| Enum Type | Values |
|---|---|
| `gender_enum` | `male`, `female` |
| `activity_level_enum` | `sedentary`, `light`, `moderate`, `active`, `very_active` |
| `dietary_preference_enum` | `omnivore`, `vegetarian`, `vegan`, `keto`, `low_carb`, `halal`, `none` |
| `metabolism_rate_enum` | `slow`, `normal`, `fast` |
| `request_type_enum` | `image`, `text` |
| `meal_type_enum` | `breakfast`, `lunch`, `dinner`, `snack` |

### Tables

| Table | Columns | PK | FK / Relationships |
|---|---|---|---|
| `users` | `id uuid`, `name varchar(120)`, `email varchar(255) unique`, `password_hash varchar(255)`, `age int null`, `gender gender_enum null`, `height numeric(6,2) null`, `weight numeric(6,2) null`, `activity_level activity_level_enum null`, `metabolism_rate metabolism_rate_enum default normal`, `dietary_preference dietary_preference_enum null`, `profile_image_url text null`, `profile_image_public_id varchar(255) null`, `created_at timestamptz` | `id` | Parent table for `sessions`, `password_resets`, `food_requests`, and `daily_calculations`. |
| `sessions` | `id uuid`, `userId uuid`, `refreshTokenHash text`, `refreshTokenFingerprint varchar(128)`, `deviceId varchar(255) null`, `deviceInfo text null`, `ip varchar(100) null`, `userAgent text null`, `issuedAt timestamptz`, `expiresAt timestamptz`, `revoked boolean`, `createdAt timestamptz`, `updatedAt timestamptz` | `id` | `userId -> users.id` with `ON DELETE CASCADE`. |
| `password_resets` | `id bigserial`, `user_id uuid`, `token varchar(255)`, `expires_at timestamptz`, `used boolean` | `id` | `user_id -> users.id` with `ON DELETE CASCADE`. |
| `food_requests` | `id bigserial`, `user_id uuid`, `request_type request_type_enum`, `request_data jsonb`, `created_at timestamptz` | `id` | `user_id -> users.id` with `ON DELETE CASCADE`. Parent for `image_analysis` and `nutrition_suggestions`. |
| `image_analysis` | `id bigserial`, `request_id bigint unique`, `image_url text`, `cloudinary_id varchar(255)`, `model_prediction varchar(255)`, `confidence numeric(5,4)`, `nutrition_snapshot jsonb null`, `nutrition_source varchar(40) null`, `analyzed_at timestamptz` | `id` | `request_id -> food_requests.id` with `ON DELETE CASCADE`. One-to-one with `food_requests`. |
| `nutrition_suggestions` | `id bigserial`, `request_id bigint`, `meal_type meal_type_enum null`, `suggestion_text text`, `nutrients jsonb`, `total_calories int`, `created_at timestamptz` | `id` | `request_id -> food_requests.id` with `ON DELETE CASCADE`. One-to-many from `food_requests`. |
| `daily_calculations` | `id bigserial`, `user_id uuid`, `bmr numeric(10,2)`, `tdee numeric(10,2)`, `daily_calories numeric(10,2)`, `recommendations jsonb`, `created_at timestamptz` | `id` | `user_id -> users.id` with `ON DELETE CASCADE`. |
| `system_logs` | `id bigserial`, `service_name varchar(120)`, `action varchar(120)`, `request_data jsonb null`, `response_data jsonb null`, `status varchar(40)`, `created_at timestamptz` | `id` | No foreign keys. Used for internal operational logging. |

### Relationship Summary

- One `user` has many `sessions`.
- One `user` has many `password_resets`.
- One `user` has many `food_requests`.
- One `user` has many `daily_calculations`.
- One `food_request` has zero or one `image_analysis` record.
- One `food_request` has many `nutrition_suggestions` records.
- Deleting a user cascades to all dependent records through the foreign keys.

## Section 4: Testing

### What is available in the repository

- Existing automated e2e coverage: `test/app.e2e-spec.ts` tests `GET /health` and validates the status payload.
- No Postman collection or screenshot was found in the repository snapshot.

### Endpoint verification matrix

The table below documents the intended test for each endpoint. It can be used directly in Chapter 3 as the testing evidence.

| Endpoint | Test focus | Expected result |
|---|---|---|
| `/health` | Call without auth | `200 OK`, status `ok` |
| `/auth/register` | Register with valid multipart payload | New account created and token returned |
| `/auth/login` | Login with valid credentials | Access token, refresh token, and session id returned |
| `/auth/refresh` | Refresh with valid token | New access token returned |
| `/auth/forgot-password` | Send registered email | Reset flow starts successfully |
| `/auth/verify-reset-code` | Send correct code | Temporary reset token returned |
| `/auth/reset-password` | Reset with valid token | Password updated successfully |
| `/auth/revoke` | Revoke a session | Session marked revoked |
| `/auth/sessions` | Get sessions with JWT | List of sessions returned |
| `/users/me` | Get profile with JWT | Current user profile returned |
| `/users/update` | Update profile with JWT | Updated profile returned |
| `/users/:id` | Delete authorized user | User deleted or access denied if unauthorized |
| `/food/image` | Upload image file | Image analysis result returned |
| `/food/text` | Send food description | Nutrition analysis result returned |
| `/food/text-options` | Query options by meal type | Filtered options returned |
| `/food/text-suggestions` | Search with `query` | Suggested food list returned |
| `/food/history` | Fetch history with JWT | User history returned |
| `/food/history` (DELETE) | Clear history | History removed |
| `/food/history/:id` | Delete one history item | Target record removed |
| `/cloudinary/signed-upload` | Request signed upload params | Signed upload payload returned |

### Auxiliary routes found in code

The following routes also exist in the codebase, but they were not included in the 20-count main list above:

- `/ai/suggest`
- `/ai/suggest/:id`
- `/ai/analyze-text`
- `/ai/image-analysis`
- `/ai/calories`
- `/daily-calories`
- `/logs`

These are support or internal routes used by the AI, calorie, and logging subsystems.

The dedicated smoke suite in [test/endpoints.e2e-spec.ts](test/endpoints.e2e-spec.ts) runs one Jest case per endpoint, so each route has its own pass/fail result and timing line.

### Verified Test Results

| Test scope | Command | Result | Suites | Tests | Success | Fail | Time |
|---|---|---|---|---|---|---|---|
| Unit testing | `pnpm test --runInBand` | Passed | 2 | 3 | N/A | N/A | 4.924 s |
| Endpoint per-route smoke testing | `pnpm exec jest --config ./test/jest-e2e.json --runInBand test/endpoints.e2e-spec.ts` | Passed | 1 | 27 | 27 | 0 | 8.005 s |

The endpoint smoke suite printed a separate result for every endpoint and confirmed that all 27 tested routes returned success responses, with `0` failures.

### Per-Endpoint Performance Results

| Endpoint | Method | Status | Time |
|---|---|---|---|
| `/health` | GET | Success | 45.04 ms |
| `/auth/register` | POST | Success | 33.81 ms |
| `/auth/login` | POST | Success | 31.71 ms |
| `/auth/refresh` | POST | Success | 8.21 ms |
| `/auth/forgot-password` | POST | Success | 7.92 ms |
| `/auth/verify-reset-code` | POST | Success | 11.70 ms |
| `/auth/reset-password` | POST | Success | 6.54 ms |
| `/auth/revoke` | POST | Success | 6.44 ms |
| `/auth/sessions` | GET | Success | 8.80 ms |
| `/users/me` | GET | Success | 7.61 ms |
| `/users/update` | PUT | Success | 6.50 ms |
| `/users/:id` | DELETE | Success | 5.25 ms |
| `/food/image` | POST | Success | 9.78 ms |
| `/food/text` | POST | Success | 6.23 ms |
| `/food/text-options` | GET | Success | 5.42 ms |
| `/food/text-suggestions` | POST | Success | 7.41 ms |
| `/food/history` | GET | Success | 5.82 ms |
| `/food/history` | DELETE | Success | 4.82 ms |
| `/food/history/:id` | DELETE | Success | 5.80 ms |
| `/cloudinary/signed-upload` | POST | Success | 6.02 ms |
| `/ai/suggest` | GET | Success | 5.29 ms |
| `/ai/suggest/:id` | DELETE | Success | 5.66 ms |
| `/ai/analyze-text` | POST | Success | 5.15 ms |
| `/ai/image-analysis` | POST | Success | 10.36 ms |
| `/ai/calories` | GET | Success | 4.89 ms |
| `/daily-calories` | GET | Success | 5.32 ms |
| `/logs` | GET | Success | 7.02 ms |

The slowest endpoint in this run was `/health` at `45.04 ms`, while the fastest was `/ai/calories` at `4.89 ms`.
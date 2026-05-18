import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppController } from '../src/app.controller';
import { AiController } from '../src/ai/ai.controller';
import { AiService } from '../src/ai/ai.service';
import { CaloriesController } from '../src/calories/calories.controller';
import { CaloriesService } from '../src/calories/calories.service';
import { CloudinaryController } from '../src/cloudinary/cloudinary.controller';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { InternalApiKeyGuard } from '../src/common/guards/internal-api-key.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { LogsController } from '../src/logs/logs.controller';
import { LogsService } from '../src/logs/logs.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { FoodController } from '../src/food/food.controller';
import { FoodService } from '../src/food/food.service';

type RouteCase = {
  endpoint: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  setup?: (req: request.Test) => request.Test;
  expectBody: (body: any) => void;
};

type TimedResult = {
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
  result: 'success' | 'fail';
  error?: string;
};

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requestObject = context.switchToHttp().getRequest();
    requestObject.user = { sub: 'user-1', email: 'user@example.com' };
    return true;
  }
}

class MockInternalApiKeyGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('Backend endpoints smoke test', () => {
  let app: INestApplication;

  const authService = {
    register: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    }),
    login: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refresh_token: 'refresh-token',
      session_id: 'session-1',
    }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'new-access-token' }),
    forgotPassword: jest.fn().mockResolvedValue({ ok: true }),
    verifyResetCode: jest.fn().mockResolvedValue({ resetToken: 'reset-token' }),
    resetPassword: jest.fn().mockResolvedValue({ ok: true }),
    revoke: jest.fn().mockResolvedValue({ revoked: true }),
    listSessions: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
  };

  const usersService = {
    getMe: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'user-1', updated: true }),
    removeById: jest.fn().mockResolvedValue({ deleted: true }),
  };

  const foodService = {
    analyzeImage: jest.fn().mockResolvedValue({ label: 'apple', confidence: 0.98 }),
    analyzeText: jest.fn().mockResolvedValue({ label: 'salad', calories: 180 }),
    getTextOptions: jest.fn().mockResolvedValue(['salad', 'rice', 'chicken']),
    getTextSuggestions: jest.fn().mockResolvedValue(['salad with chicken']),
    getHistory: jest.fn().mockResolvedValue([{ id: 'history-1' }]),
    clearHistory: jest.fn().mockResolvedValue({ cleared: true }),
    deleteHistoryItem: jest.fn().mockResolvedValue({ deleted: true }),
  };

  const aiService = {
    suggest: jest.fn().mockResolvedValue({ suggestion: 'balanced meal' }),
    analyzeText: jest.fn().mockResolvedValue({ label: 'text-analysis' }),
    analyzeImage: jest.fn().mockResolvedValue({ label: 'image-analysis' }),
    calories: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const caloriesService = {
    calculateDailyForUser: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const cloudinaryService = {
    getSignedUploadParams: jest.fn().mockResolvedValue({
      signature: 'signature',
      timestamp: 123,
      apiKey: 'key',
    }),
  };

  const logsService = {
    getLogs: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
  };

  const routeCases: RouteCase[] = [
    {
      endpoint: '/health',
      method: 'get',
      path: '/health',
      expectBody: (body) => {
        expect(body.status).toBe('ok');
      },
    },
    {
      endpoint: '/auth/register',
      method: 'post',
      path: '/auth/register',
      setup: (req) =>
        req
          .field('name', 'Test User')
          .field('email', 'user@example.com')
          .field('password', 'SecurePassword123!')
          .field('age', '25')
          .field('gender', 'male')
          .field('height', '175')
          .field('weight', '70')
          .field('activityLevel', 'moderate')
          .field('dietaryPreference', 'omnivore')
          .attach('profileImage', Buffer.from('fake-image'), 'profile.png'),
      expectBody: (body) => {
        expect(body.accessToken).toBe('access-token');
      },
    },
    {
      endpoint: '/auth/login',
      method: 'post',
      path: '/auth/login',
      setup: (req) => req.send({ email: 'user@example.com', password: 'SecurePassword123!' }),
      expectBody: (body) => {
        expect(body.refresh_token).toBe('refresh-token');
      },
    },
    {
      endpoint: '/auth/refresh',
      method: 'post',
      path: '/auth/refresh',
      setup: (req) => req.send({ refresh_token: 'refresh-token' }),
      expectBody: (body) => {
        expect(body.accessToken).toBe('new-access-token');
      },
    },
    {
      endpoint: '/auth/forgot-password',
      method: 'post',
      path: '/auth/forgot-password',
      setup: (req) => req.send({ email: 'user@example.com' }),
      expectBody: (body) => {
        expect(body.ok).toBe(true);
      },
    },
    {
      endpoint: '/auth/verify-reset-code',
      method: 'post',
      path: '/auth/verify-reset-code',
      setup: (req) => req.send({ email: 'user@example.com', code: '123456' }),
      expectBody: (body) => {
        expect(body.resetToken).toBe('reset-token');
      },
    },
    {
      endpoint: '/auth/reset-password',
      method: 'post',
      path: '/auth/reset-password',
      setup: (req) => req.send({ token: 'reset-token', password: 'NewPassword123!' }),
      expectBody: (body) => {
        expect(body.ok).toBe(true);
      },
    },
    {
      endpoint: '/auth/revoke',
      method: 'post',
      path: '/auth/revoke',
      setup: (req) => req.send({ session_id: 'session-1' }),
      expectBody: (body) => {
        expect(body.revoked).toBe(true);
      },
    },
    {
      endpoint: '/auth/sessions',
      method: 'get',
      path: '/auth/sessions',
      expectBody: (body) => {
        expect(Array.isArray(body)).toBe(true);
      },
    },
    {
      endpoint: '/users/me',
      method: 'get',
      path: '/users/me',
      expectBody: (body) => {
        expect(body.email).toBe('user@example.com');
      },
    },
    {
      endpoint: '/users/update',
      method: 'put',
      path: '/users/update',
      setup: (req) => req.send({ name: 'Updated User' }),
      expectBody: (body) => {
        expect(body.updated).toBe(true);
      },
    },
    {
      endpoint: '/users/:id',
      method: 'delete',
      path: '/users/user-2',
      expectBody: (body) => {
        expect(body.deleted).toBe(true);
      },
    },
    {
      endpoint: '/food/image',
      method: 'post',
      path: '/food/image',
      setup: (req) => req.attach('file', Buffer.from('fake-image'), 'food.jpg'),
      expectBody: (body) => {
        expect(body.label).toBe('apple');
      },
    },
    {
      endpoint: '/food/text',
      method: 'post',
      path: '/food/text',
      setup: (req) => req.send({ description: 'grilled chicken with rice' }),
      expectBody: (body) => {
        expect(body.label).toBe('salad');
      },
    },
    {
      endpoint: '/food/text-options',
      method: 'get',
      path: '/food/text-options?mealType=lunch',
      expectBody: (body) => {
        expect(Array.isArray(body)).toBe(true);
      },
    },
    {
      endpoint: '/food/text-suggestions',
      method: 'post',
      path: '/food/text-suggestions?query=salad',
      expectBody: (body) => {
        expect(Array.isArray(body)).toBe(true);
      },
    },
    {
      endpoint: '/food/history',
      method: 'get',
      path: '/food/history',
      expectBody: (body) => {
        expect(Array.isArray(body)).toBe(true);
      },
    },
    {
      endpoint: '/food/history (DELETE)',
      method: 'delete',
      path: '/food/history',
      expectBody: (body) => {
        expect(body.cleared).toBe(true);
      },
    },
    {
      endpoint: '/food/history/:id',
      method: 'delete',
      path: '/food/history/history-1',
      expectBody: (body) => {
        expect(body.deleted).toBe(true);
      },
    },
    {
      endpoint: '/cloudinary/signed-upload',
      method: 'post',
      path: '/cloudinary/signed-upload',
      setup: (req) => req.send({ folder: 'uploads', publicId: 'image-1' }),
      expectBody: (body) => {
        expect(body.signature).toBe('signature');
      },
    },
    {
      endpoint: '/ai/suggest',
      method: 'get',
      path: '/ai/suggest?mealType=lunch&description=grilled%20chicken&userContext=weight_loss',
      expectBody: (body) => {
        expect(body.suggestion).toBe('balanced meal');
      },
    },
    {
      endpoint: '/ai/suggest/:id',
      method: 'delete',
      path: '/ai/suggest/suggestion-1',
      expectBody: (body) => {
        expect(body.deleted).toBe(true);
      },
    },
    {
      endpoint: '/ai/analyze-text',
      method: 'post',
      path: '/ai/analyze-text',
      setup: (req) => req.send({ description: 'oatmeal with banana' }),
      expectBody: (body) => {
        expect(body.label).toBe('text-analysis');
      },
    },
    {
      endpoint: '/ai/image-analysis',
      method: 'post',
      path: '/ai/image-analysis',
      setup: (req) => req.attach('file', Buffer.from('fake-image'), 'food.jpg'),
      expectBody: (body) => {
        expect(body.label).toBe('image-analysis');
      },
    },
    {
      endpoint: '/ai/calories',
      method: 'get',
      path: '/ai/calories',
      expectBody: (body) => {
        expect(body.dailyCalories).toBe(2200);
      },
    },
    {
      endpoint: '/daily-calories',
      method: 'get',
      path: '/daily-calories',
      expectBody: (body) => {
        expect(body.dailyCalories).toBe(2200);
      },
    },
    {
      endpoint: '/logs',
      method: 'get',
      path: '/logs?limit=10',
      expectBody: (body) => {
        expect(Array.isArray(body)).toBe(true);
      },
    },
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AppController,
        AuthController,
        UsersController,
        FoodController,
        AiController,
        CloudinaryController,
        CaloriesController,
        LogsController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: FoodService, useValue: foodService },
        { provide: AiService, useValue: aiService },
        { provide: CaloriesService, useValue: caloriesService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: LogsService, useValue: logsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(InternalApiKeyGuard)
      .useClass(MockInternalApiKeyGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function runRouteCase(testCase: (typeof routeCases)[number]) {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const requestBuilder = request(server)[testCase.method](testCase.path);
    const preparedRequest = testCase.setup
      ? testCase.setup(requestBuilder)
      : requestBuilder;
    const start = process.hrtime.bigint();

    try {
      const response = await preparedRequest.expect((res) => {
        expect(res.status).toBeLessThan(500);
      });

      testCase.expectBody(response.body);
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      return {
        endpoint: testCase.endpoint,
        method: testCase.method.toUpperCase(),
        status: response.status,
        durationMs: Number(durationMs.toFixed(2)),
        result: 'success' as const,
      };
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      return {
        endpoint: testCase.endpoint,
        method: testCase.method.toUpperCase(),
        status: 500,
        durationMs: Number(durationMs.toFixed(2)),
        result: 'fail' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const results: TimedResult[] = [];

  it.each(routeCases)('$endpoint', async (testCase) => {
    const result = await runRouteCase(testCase);
    results.push(result);
    expect(result.result).toBe('success');
    console.log(
      `${result.method} ${result.endpoint} -> ${result.status} in ${result.durationMs.toFixed(2)} ms (${result.result})`,
    );
    if (result.result === 'fail') {
      console.log(`Error: ${result.error}`);
    }
  });

  afterAll(() => {
    const totalMs = results.reduce((sum, item) => sum + item.durationMs, 0);
    const avgMs = results.length ? totalMs / results.length : 0;
    const successCount = results.filter((item) => item.result === 'success').length;
    const failCount = results.filter((item) => item.result === 'fail').length;

    console.table(results);
    console.log(
      `Total endpoint time: ${totalMs.toFixed(2)} ms | Average: ${avgMs.toFixed(2)} ms | Endpoints: ${results.length} | Success: ${successCount} | Fail: ${failCount}`,
    );

    expect(results).toHaveLength(routeCases.length);
    expect(failCount).toBe(0);
  });
});

describe('Backend endpoints negative tests', () => {
  let app: INestApplication;

  const authService = {
    login: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.email || !dto?.password) {
        throw new Error('Invalid credentials payload');
      }

      return { accessToken: 'access-token' };
    }),
    register: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.email || !dto?.password) {
        throw new Error('Invalid register payload');
      }

      return { accessToken: 'access-token' };
    }),
    refresh: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.refresh_token) {
        throw new Error('Missing refresh token');
      }

      return { accessToken: 'new-access-token' };
    }),
    forgotPassword: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.email) {
        throw new Error('Email is required');
      }

      return { ok: true };
    }),
    verifyResetCode: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.code) {
        throw new Error('Reset code is required');
      }

      return { resetToken: 'reset-token' };
    }),
    resetPassword: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.token || !dto?.password) {
        throw new Error('Reset token and password are required');
      }

      return { ok: true };
    }),
    revoke: jest.fn().mockImplementation(async (dto) => {
      if (!dto?.session_id) {
        throw new Error('Session id is required');
      }

      return { revoked: true };
    }),
    listSessions: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
  };

  const usersService = {
    getMe: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    updateProfile: jest.fn().mockImplementation(async (userId, dto) => {
      if (!dto?.name) {
        throw new Error('Name is required');
      }

      return { id: userId, updated: true };
    }),
    removeById: jest.fn().mockImplementation(async (id, currentUserId) => {
      if (id === currentUserId) {
        return { deleted: true };
      }

      throw new Error('Forbidden');
    }),
  };

  const foodService = {
    analyzeImage: jest.fn().mockImplementation(async (userId, file) => {
      if (!file) {
        throw new Error('File is required');
      }

      return { label: 'apple', confidence: 0.98 };
    }),
    analyzeText: jest.fn().mockImplementation(async (userId, dto) => {
      if (!dto?.description) {
        throw new Error('Description is required');
      }

      return { label: 'salad', calories: 180 };
    }),
    getTextOptions: jest.fn().mockResolvedValue(['salad', 'rice', 'chicken']),
    getTextSuggestions: jest.fn().mockImplementation(async (userId, query) => {
      if (!query) {
        throw new Error('Query is required');
      }

      return ['salad with chicken'];
    }),
    getHistory: jest.fn().mockResolvedValue([{ id: 'history-1' }]),
    clearHistory: jest.fn().mockResolvedValue({ cleared: true }),
    deleteHistoryItem: jest.fn().mockImplementation(async (userId, id) => {
      if (!id) {
        throw new Error('History id is required');
      }

      return { deleted: true };
    }),
  };

  const aiService = {
    suggest: jest.fn().mockImplementation(async (userId, dto) => {
      if (!dto?.description) {
        throw new Error('Description is required');
      }

      return { suggestion: 'balanced meal' };
    }),
    analyzeText: jest.fn().mockImplementation(async (userId, dto) => {
      if (!dto?.description) {
        throw new Error('Description is required');
      }

      return { label: 'text-analysis' };
    }),
    analyzeImage: jest.fn().mockImplementation(async (userId, file) => {
      if (!file) {
        throw new Error('File is required');
      }

      return { label: 'image-analysis' };
    }),
    calories: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const caloriesService = {
    calculateDailyForUser: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const cloudinaryService = {
    getSignedUploadParams: jest.fn().mockImplementation(async (folder, publicId) => {
      if (!folder || !publicId) {
        throw new Error('Folder and publicId are required');
      }

      return {
        signature: 'signature',
        timestamp: 123,
        apiKey: 'key',
      };
    }),
  };

  const logsService = {
    getLogs: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AppController,
        AuthController,
        UsersController,
        FoodController,
        AiController,
        CloudinaryController,
        CaloriesController,
        LogsController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: FoodService, useValue: foodService },
        { provide: AiService, useValue: aiService },
        { provide: CaloriesService, useValue: caloriesService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: LogsService, useValue: logsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(InternalApiKeyGuard)
      .useClass(MockInternalApiKeyGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid auth and upload payloads', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server).post('/auth/login').send({}).expect(500);
    await request(server).post('/auth/refresh').send({}).expect(500);
    await request(server).post('/food/image').expect(500);
    await request(server).post('/cloudinary/signed-upload').send({}).expect(500);
  });

  it('rejects missing text inputs', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server).post('/food/text').send({}).expect(500);
    await request(server).post('/food/text-suggestions').send({}).expect(500);
    await request(server).post('/ai/analyze-text').send({}).expect(500);
    await request(server).get('/ai/suggest').expect(500);
  });
});

describe('Backend endpoints integration-style tests', () => {
  let app: INestApplication;

  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'access-token', refresh_token: 'refresh-token' }),
    register: jest.fn().mockResolvedValue({ accessToken: 'access-token' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'new-access-token' }),
    forgotPassword: jest.fn().mockResolvedValue({ ok: true }),
    verifyResetCode: jest.fn().mockResolvedValue({ resetToken: 'reset-token' }),
    resetPassword: jest.fn().mockResolvedValue({ ok: true }),
    revoke: jest.fn().mockResolvedValue({ revoked: true }),
    listSessions: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
  };

  const usersService = {
    getMe: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'user-1', updated: true }),
    removeById: jest.fn().mockResolvedValue({ deleted: true }),
  };

  const foodService = {
    analyzeImage: jest.fn().mockResolvedValue({ label: 'apple', confidence: 0.98 }),
    analyzeText: jest.fn().mockResolvedValue({ label: 'salad', calories: 180 }),
    getTextOptions: jest.fn().mockResolvedValue(['salad', 'rice', 'chicken']),
    getTextSuggestions: jest.fn().mockResolvedValue(['salad with chicken']),
    getHistory: jest.fn().mockResolvedValue([{ id: 'history-1' }]),
    clearHistory: jest.fn().mockResolvedValue({ cleared: true }),
    deleteHistoryItem: jest.fn().mockResolvedValue({ deleted: true }),
  };

  const aiService = {
    suggest: jest.fn().mockResolvedValue({ suggestion: 'balanced meal' }),
    analyzeText: jest.fn().mockResolvedValue({ label: 'text-analysis' }),
    analyzeImage: jest.fn().mockResolvedValue({ label: 'image-analysis' }),
    calories: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const caloriesService = {
    calculateDailyForUser: jest.fn().mockResolvedValue({ dailyCalories: 2200 }),
  };

  const cloudinaryService = {
    getSignedUploadParams: jest.fn().mockResolvedValue({ signature: 'signature', timestamp: 123, apiKey: 'key' }),
  };

  const logsService = {
    getLogs: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AppController,
        AuthController,
        UsersController,
        FoodController,
        AiController,
        CloudinaryController,
        CaloriesController,
        LogsController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: FoodService, useValue: foodService },
        { provide: AiService, useValue: aiService },
        { provide: CaloriesService, useValue: caloriesService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: LogsService, useValue: logsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(InternalApiKeyGuard)
      .useClass(MockInternalApiKeyGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wires controllers to services for auth, users, food, AI, and logs', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server).post('/auth/login').send({ email: 'user@example.com', password: 'SecurePassword123!' }).expect(201);
    await request(server).get('/users/me').expect(200);
    await request(server).post('/food/text').send({ description: 'grilled chicken with rice' }).expect(201);
    await request(server).get('/ai/calories').expect(200);
    await request(server).get('/logs').expect(200);

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(usersService.getMe).toHaveBeenCalledTimes(1);
    expect(foodService.analyzeText).toHaveBeenCalledTimes(1);
    expect(aiService.calories).toHaveBeenCalledTimes(1);
    expect(logsService.getLogs).toHaveBeenCalledTimes(1);
  });
});

describe('Backend endpoints security tests', () => {
  it('JwtAuthGuard rejects missing bearer token', async () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as never,
      { verifyAsync: jest.fn() } as never,
      { getOrThrow: jest.fn() } as never,
    );

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue({ headers: {} }) }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow('Missing bearer token');
  });

  it('InternalApiKeyGuard rejects missing internal key', () => {
    const guard = new InternalApiKeyGuard({
      getOrThrow: jest.fn().mockReturnValue('secret-key'),
    } as never);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue({ headers: {} }) }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow('Invalid internal API key');
  });
});
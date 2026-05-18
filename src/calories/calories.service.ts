import {
  Injectable,
  BadRequestException,
  HttpException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { DailyCalculation } from './daily-calculation.entity';
import { UsersService } from '../users/users.service';
import { GenderEnum } from '../common/enums/gender.enum';
import { ActivityLevelEnum } from '../common/enums/activity-level.enum';
import { GeminiService } from '../ai/gemini.service';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CALORIES_QUEUE } from '../common/constants/queue.constants';

const ACTIVITY_FACTORS: Record<ActivityLevelEnum, number> = {
  [ActivityLevelEnum.SEDENTARY]: 1.2,
  [ActivityLevelEnum.LIGHT]: 1.375,
  [ActivityLevelEnum.MODERATE]: 1.55,
  [ActivityLevelEnum.ACTIVE]: 1.725,
  [ActivityLevelEnum.VERY_ACTIVE]: 1.9,
};

interface DailyAdviceCachePayload {
  dailyAdvice: string;
  healthyAlternatives: string[];
  protein: number;
  carbs: number;
  fats: number;
}

@Injectable()
export class CaloriesService {
  private readonly logger = new Logger(CaloriesService.name);
  // In-memory TTL cache fallback for environments where Redis is disabled
  private readonly inMemoryResponseCache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  constructor(
    @InjectRepository(DailyCalculation)
    private readonly dailyCalculationRepository: Repository<DailyCalculation>,
    private readonly usersService: UsersService,
    private readonly geminiService: GeminiService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(CALORIES_QUEUE)
    private readonly caloriesQueue?: Queue,
  ) {}

  async calculateDailyForUser(userId: string) {
    const user = await this.usersService.findById(userId);

    if (
      !user.age ||
      !user.gender ||
      !user.height ||
      !user.weight ||
      !user.activityLevel
    ) {
      throw new BadRequestException(
        'Profile is incomplete. age, gender, height, weight, and activityLevel are required.',
      );
    }

    const responseCacheKey = `daily-calories-response:${user.id}`;

    // Try in-memory cache first (fastest)
    const mem = this.inMemoryResponseCache.get(responseCacheKey);
    if (mem && mem.expiresAt > Date.now()) {
      this.logger.log(`[daily-calories] cache hit (memory) user=${user.id}`);
      return mem.value as any;
    }

    // Try Redis cache next (fast path)
    try {
      const cachedResponse = await this.redisService.get<any>(responseCacheKey);
      if (cachedResponse) {
        this.logger.log(`[daily-calories] cache hit (redis) user=${user.id}`);
        // populate in-memory cache for faster subsequent hits
        const cachedWithSource = { ...cachedResponse, cacheSource: 'redis' };
        this.inMemoryResponseCache.set(responseCacheKey, {
          value: cachedWithSource,
          expiresAt: Date.now() + (this.getCaloriesCacheTtl() ?? 300) * 1000,
        });
        return cachedWithSource as any;
      }
    } catch (err) {
      this.logger.warn('Redis read failed for daily-calories-response cache');
    }

    const bmr = this.calculateBmr(
      user.gender,
      user.weight,
      user.height,
      user.age,
    );
    const tdee = bmr * ACTIVITY_FACTORS[user.activityLevel];
    const dailyCalories = tdee;
    const macroTargets = this.estimateMacroTargets(dailyCalories);

    const cacheKey = this.buildAdviceCacheKey({
      userId: user.id,
      gender: user.gender,
      age: user.age,
      height: user.height,
      weight: user.weight,
      activityLevel: user.activityLevel,
      dietaryPreference: user.dietaryPreference ?? null,
      bmr: Number(bmr.toFixed(2)),
      tdee: Number(tdee.toFixed(2)),
      dailyCalories: Number(dailyCalories.toFixed(2)),
    });

    const cachedAdvice =
      await this.redisService.get<DailyAdviceCachePayload>(cacheKey);

    let aiAdvice: DailyAdviceCachePayload;

    if (cachedAdvice) {
      aiAdvice = this.normalizeDailyAdvice(cachedAdvice, dailyCalories);
    } else {
      try {
        const generatedAdvice = await this.geminiService.generateDailyAdvice({
          gender: user.gender,
          age: user.age,
          height: user.height,
          weight: user.weight,
          activityLevel: user.activityLevel,
          bmr,
          tdee,
          dailyCalories,
          dietaryPreference: user.dietaryPreference,
        });
        aiAdvice = this.normalizeDailyAdvice(generatedAdvice, dailyCalories);
      } catch (error) {
        if (!this.isAiUnavailableError(error)) {
          throw error;
        }

        this.logger.warn(
          `Using local fallback daily advice due to AI unavailability: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );

        aiAdvice = this.buildFallbackDailyAdvice(dailyCalories);
      }
    }

    if (!cachedAdvice) {
      await this.redisService.set(
        cacheKey,
        aiAdvice,
        this.getCaloriesCacheTtl(),
      );
    }

    const createdRecord = await this.dailyCalculationRepository.save({
      userId: user.id,
      bmr: Number(bmr.toFixed(2)),
      tdee: Number(tdee.toFixed(2)),
      dailyCalories: Number(dailyCalories.toFixed(2)),
      recommendations: {
        dailyAdvice: aiAdvice.dailyAdvice,
        healthyAlternatives: aiAdvice.healthyAlternatives,
        macroTargets: {
          protein: macroTargets.protein,
          carbs: macroTargets.carbs,
          fats: macroTargets.fats,
        },
        protein: macroTargets.protein,
        carbs: macroTargets.carbs,
        fats: macroTargets.fats,
      },
    });
    const asyncSavePayload = {
      userId: user.id,
      bmr: Number(bmr.toFixed(2)),
      tdee: Number(tdee.toFixed(2)),
      dailyCalories: Number(dailyCalories.toFixed(2)),
      recommendations: {
        dailyAdvice: aiAdvice.dailyAdvice,
        healthyAlternatives: aiAdvice.healthyAlternatives,
        macroTargets: {
          protein: macroTargets.protein,
          carbs: macroTargets.carbs,
          fats: macroTargets.fats,
        },
        protein: macroTargets.protein,
        carbs: macroTargets.carbs,
        fats: macroTargets.fats,
      },
    };

    // enqueue background save (fire-and-forget)
    if (this.caloriesQueue) {
      try {
        await this.caloriesQueue.add(
          'save-daily-calculation',
          asyncSavePayload,
          {
            removeOnComplete: true,
            removeOnFail: { age: 3600 },
          },
        );
        this.logger.log(`[daily-calories] enqueued save job user=${user.id}`);
      } catch (err) {
        this.logger.warn(
          'Failed to enqueue daily calculation save job, saving inline',
        );
        // fallback to inline save if queue is unavailable
        await this.dailyCalculationRepository.save(asyncSavePayload as any);
        this.logger.log(`[daily-calories] saved inline user=${user.id}`);
      }
    } else {
      // If queue provider is unavailable (e.g., REDIS_ENABLED=false), save inline.
      await this.dailyCalculationRepository.save(asyncSavePayload as any);
      this.logger.log(`[daily-calories] queue unavailable, saved inline user=${user.id}`);
    }

    const response = {
      id: null,
      bmr: Number(bmr.toFixed(2)),
      tdee: Number(tdee.toFixed(2)),
      dailyCalories: Number(dailyCalories.toFixed(2)),
      protein: macroTargets.protein,
      carbs: macroTargets.carbs,
      fats: macroTargets.fats,
      recommendations: asyncSavePayload.recommendations,
      createdAt: new Date(),
    };

    // Cache the full response for a short period to speed up repeated calls
    const cachedResponseToStore = { ...response, cacheSource: 'computed' };
    try {
      await this.redisService.set(
        responseCacheKey,
        cachedResponseToStore,
        this.getCaloriesCacheTtl() ?? 300,
      );
      // also populate in-memory cache
      this.inMemoryResponseCache.set(responseCacheKey, {
        value: cachedResponseToStore,
        expiresAt: Date.now() + (this.getCaloriesCacheTtl() ?? 300) * 1000,
      });
      this.logger.log(`[daily-calories] computed and cached user=${user.id}`);
    } catch (err) {
      this.logger.warn('Redis write failed for daily-calories-response cache');
      // populate in-memory cache when Redis is unavailable
      this.inMemoryResponseCache.set(responseCacheKey, {
        value: cachedResponseToStore,
        expiresAt: Date.now() + (this.getCaloriesCacheTtl() ?? 300) * 1000,
      });
      this.logger.log(`[daily-calories] computed and cached in-memory user=${user.id}`);
    }

    return cachedResponseToStore;
  }

  private buildAdviceCacheKey(payload: Record<string, unknown>): string {
    const payloadJson = JSON.stringify(payload);
    const hash = createHash('sha256').update(payloadJson).digest('hex');
    return `calories-advice:${hash}`;
  }

  private getCaloriesCacheTtl(): number {
    return (
      this.configService.get<number>('CALORIES_AI_CACHE_TTL_SECONDS') ?? 86400
    );
  }

  private isAiUnavailableError(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status === 429 || status === 502 || status === 503;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('quota') ||
        message.includes('resource_exhausted') ||
        message.includes('temporarily unavailable')
      );
    }

    return false;
  }

  private buildFallbackDailyAdvice(
    dailyCalories: number,
  ): DailyAdviceCachePayload {
    const roundedCalories = Math.round(dailyCalories);
    const macros = this.estimateMacroTargets(dailyCalories);

    return {
      dailyAdvice: `Aim for about ${roundedCalories} kcal today. Split meals across the day, keep hydration steady, and prefer minimally processed foods while balancing protein, carbs, and healthy fats.`,
      healthyAlternatives: [
        'Swap sugary drinks with water or unsweetened tea.',
        'Choose grilled or baked proteins instead of fried options.',
        'Use whole grains and add vegetables to each main meal.',
      ],
      protein: macros.protein,
      carbs: macros.carbs,
      fats: macros.fats,
    };
  }

  private normalizeDailyAdvice(
    advice: Partial<DailyAdviceCachePayload>,
    dailyCalories: number,
  ): DailyAdviceCachePayload {
    const macros = this.estimateMacroTargets(dailyCalories);

    const protein = this.toPositiveNumber(advice.protein) ?? macros.protein;
    const carbs = this.toPositiveNumber(advice.carbs) ?? macros.carbs;
    const fats = this.toPositiveNumber(advice.fats) ?? macros.fats;

    return {
      dailyAdvice:
        typeof advice.dailyAdvice === 'string' &&
        advice.dailyAdvice.trim().length
          ? advice.dailyAdvice
          : `Aim for about ${Math.round(dailyCalories)} kcal today.`,
      healthyAlternatives: Array.isArray(advice.healthyAlternatives)
        ? advice.healthyAlternatives.map((item) => String(item))
        : [],
      protein,
      carbs,
      fats,
    };
  }

  private estimateMacroTargets(dailyCalories: number): {
    protein: number;
    carbs: number;
    fats: number;
  } {
    const calories = Math.max(0, dailyCalories);
    return {
      protein: Math.round((calories * 0.3) / 4),
      carbs: Math.round((calories * 0.45) / 4),
      fats: Math.round((calories * 0.25) / 9),
    };
  }

  private toPositiveNumber(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
      return null;
    }
    return Math.round(value);
  }

  private calculateBmr(
    gender: GenderEnum,
    weightKg: number,
    heightCm: number,
    age: number,
  ): number {
    if (gender === GenderEnum.MALE) {
      return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    }

    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

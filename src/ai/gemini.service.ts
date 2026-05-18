import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { MealTypeEnum } from '../common/enums/meal-type.enum';
import { ActivityLevelEnum } from '../common/enums/activity-level.enum';
import { DietaryPreferenceEnum } from '../common/enums/dietary-preference.enum';
import { GenderEnum } from '../common/enums/gender.enum';
import { RedisService } from '../redis/redis.service';

export interface NutritionAiResult {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  healthyAlternatives: string[];
  dailyAdvice: string;
  suggestionText: string;
  mealType: MealTypeEnum;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly ai: GoogleGenAI;
  private readonly models: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });

    const primaryModel =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    const fallbackModelsRaw =
      this.configService.get<string>('GEMINI_FALLBACK_MODELS') ??
      'gemini-2.0-flash,gemini-2.0-flash-lite';

    const fallbackModels = fallbackModelsRaw
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model.length > 0);

    this.models = Array.from(new Set([primaryModel, ...fallbackModels]));
  }

  async generateFromImagePrediction(input: {
    label: string;
    confidence: number;
    dietaryPreference?: DietaryPreferenceEnum | null;
  }): Promise<NutritionAiResult> {
    const prompt = `You are a nutrition assistant. Return ONLY valid JSON with this exact shape:\n{"calories":number,"protein":number,"carbs":number,"fats":number,"healthyAlternatives":string[],"dailyAdvice":string,"suggestionText":string,"mealType":"breakfast"|"lunch"|"dinner"|"snack"}.\nUse food label: ${input.label}. Confidence: ${input.confidence}. Dietary preference: ${input.dietaryPreference ?? 'none'}. Language: English.`;
    return this.generateStrictJson<NutritionAiResult>(prompt);
  }

  async generateFromText(input: {
    description: string;
    mealType: MealTypeEnum;
    dietaryPreference?: DietaryPreferenceEnum | null;
    userContext?: string;
  }): Promise<NutritionAiResult> {
    const prompt = `You are a nutrition assistant. Return ONLY valid JSON with this exact shape:\n{"calories":number,"protein":number,"carbs":number,"fats":number,"healthyAlternatives":string[],"dailyAdvice":string,"suggestionText":string,"mealType":"breakfast"|"lunch"|"dinner"|"snack"}.\nMeal type: ${input.mealType}. Description: ${input.description}. Dietary preference: ${input.dietaryPreference ?? 'none'}. Context: ${input.userContext ?? 'none'}. Language: English.\nImportant rules: estimate realistic per-serving values from the description; do not use fixed numbers or templates; vary calories and macros based on ingredients, cooking method, and portion cues; if the description is vague, infer the most likely meal composition from context and return a reasonable estimate.`;
    return this.generateStrictJson<NutritionAiResult>(prompt);
  }

  async validateFoodDescription(description: string): Promise<void> {
    const prompt = `You are a strict food description validator. Return ONLY valid JSON with this exact shape:\n{"isValid":boolean}.\nA description is valid only if it is clearly about food, a meal, ingredients, cooking, eating, or nutrition. If it is random text, gibberish, or unrelated to food, set isValid to false. Description: ${description}`;

    const result = await this.generateStrictJson<{ isValid: boolean }>(prompt, [
      'isValid',
    ]);

    if (!result.isValid) {
      throw new BadRequestException(
        'Description must be about food or meals. Please provide a valid food description.',
      );
    }
  }

  async generateDailyAdvice(input: {
    gender: GenderEnum;
    age: number;
    height: number;
    weight: number;
    activityLevel: ActivityLevelEnum;
    bmr: number;
    tdee: number;
    dailyCalories: number;
    dietaryPreference?: DietaryPreferenceEnum | null;
  }): Promise<{
    dailyAdvice: string;
    healthyAlternatives: string[];
    protein: number;
    carbs: number;
    fats: number;
  }> {
    const promptWithMacros = `You are a nutrition assistant. Return ONLY valid JSON with this exact shape:\n{"dailyAdvice":string,"healthyAlternatives":string[],"protein":number,"carbs":number,"fats":number}.\nUse grams for protein, carbs, and fats as daily macro targets that fit the DailyCalories value.\nGender:${input.gender} Age:${input.age} Height:${input.height} Weight:${input.weight} Activity:${input.activityLevel} BMR:${input.bmr} TDEE:${input.tdee} DailyCalories:${input.dailyCalories} DietaryPreference:${input.dietaryPreference ?? 'none'}. Language: English.`;

    const parsed = await this.generateStrictJson<{
      dailyAdvice: string;
      healthyAlternatives: string[];
      protein: number;
      carbs: number;
      fats: number;
    }>(promptWithMacros, [
      'dailyAdvice',
      'healthyAlternatives',
      'protein',
      'carbs',
      'fats',
    ]);

    return {
      dailyAdvice: String(parsed.dailyAdvice),
      healthyAlternatives: Array.isArray(parsed.healthyAlternatives)
        ? parsed.healthyAlternatives.map((item) => String(item))
        : [],
      protein: Number(parsed.protein),
      carbs: Number(parsed.carbs),
      fats: Number(parsed.fats),
    };
  }

  public async generateStrictJson<T extends object>(
    prompt: string,
    requiredKeys: string[] = [
      'calories',
      'protein',
      'carbs',
      'fats',
      'healthyAlternatives',
      'dailyAdvice',
      'suggestionText',
      'mealType',
    ],
  ): Promise<T> {
    const cacheKey = this.buildPromptCacheKey(prompt, requiredKeys);
    const cached = await this.redisService.get<T>(cacheKey);
    if (cached) {
      this.logger.log('Gemini cache hit');
      return cached;
    }

    let lastError: unknown;
    let quotaExceeded = false;
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const model = this.pickModelForAttempt(attempt);
      try {
        const result = await this.ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text = result.text;
        if (!text) {
          throw new InternalServerErrorException(
            'Gemini returned empty response',
          );
        }

        const parsed = this.extractJson(text);

        for (const key of requiredKeys) {
          if (!(key in parsed)) {
            throw new InternalServerErrorException(
              `Gemini response missing key: ${key}`,
            );
          }
        }

        await this.redisService.set(cacheKey, parsed, this.getGeminiCacheTtl());

        return parsed as T;
      } catch (error) {
        lastError = error;
        quotaExceeded = this.isHardQuotaExceeded(error);
        const status = this.getErrorStatusCode(error);
        const message = this.getErrorMessage(error);
        this.logger.warn(
          `Gemini attempt ${attempt}/${maxAttempts} failed${
            status ? ` (status ${status})` : ''
          } using model ${model}: ${message}`,
        );

        if (quotaExceeded) {
          break;
        }

        if (!this.shouldRetry(error, attempt, maxAttempts)) {
          break;
        }

        await this.sleep(this.getRetryDelayMs(error, attempt));
      }
    }

    if (quotaExceeded) {
      throw new HttpException(
        'AI service is temporarily busy. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const finalStatus = this.getErrorStatusCode(lastError);
    if (finalStatus === 503 || finalStatus === 429) {
      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable due to high demand. Please try again shortly.',
      );
    }

    this.logger.error(
      `Gemini failed after retries: ${this.getErrorMessage(lastError)}`,
    );
    throw new BadGatewayException('AI service is unavailable');
  }

  private buildPromptCacheKey(prompt: string, requiredKeys: string[]): string {
    const keyPayload = JSON.stringify({
      prompt,
      requiredKeys: [...requiredKeys].sort(),
    });
    const hash = createHash('sha256').update(keyPayload).digest('hex');
    return `gemini-response:${hash}`;
  }

  private getGeminiCacheTtl(): number {
    return (
      this.configService.get<number>('GEMINI_RESPONSE_CACHE_TTL_SECONDS') ??
      86400
    );
  }

  private extractJson(text: string): Record<string, unknown> {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new InternalServerErrorException(
        'No JSON object found in AI response',
      );
    }

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException('Invalid JSON in AI response');
    }
  }

  private shouldRetry(
    error: unknown,
    attempt: number,
    maxAttempts: number,
  ): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    const status = this.getErrorStatusCode(error);
    if (!status) {
      return true;
    }

    return status === 429 || status === 503 || status >= 500;
  }

  private pickModelForAttempt(attempt: number): string {
    const index = (attempt - 1) % this.models.length;
    return this.models[index] ?? 'gemini-2.5-flash';
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    const message = this.getErrorMessage(error);
    const retryDelayFromMessage = this.parseRetryDelayFromMessage(message);

    if (retryDelayFromMessage !== null) {
      return Math.min(retryDelayFromMessage, 10_000);
    }

    const status = this.getErrorStatusCode(error);
    const baseDelay = status === 503 ? 1500 : 800;
    return baseDelay * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
  }

  private parseRetryDelayFromMessage(message: string): number | null {
    const secondsMatch = message.match(/retry in\s+([\d.]+)s/i);
    if (secondsMatch) {
      const seconds = Number(secondsMatch[1]);
      if (!Number.isNaN(seconds) && seconds > 0) {
        return Math.round(seconds * 1000);
      }
    }

    const retryDelayFieldMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (retryDelayFieldMatch) {
      const seconds = Number(retryDelayFieldMatch[1]);
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1000;
      }
    }

    return null;
  }

  private isHardQuotaExceeded(error: unknown): boolean {
    const status = this.getErrorStatusCode(error);
    if (status !== 429) {
      return false;
    }

    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes('quota exceeded') ||
      message.includes('generaterequestsperdayperprojectpermodel-freetier')
    );
  }

  private getErrorStatusCode(error: unknown): number | null {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
    ) {
      return Number((error as { status: number }).status);
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'number'
    ) {
      return Number((error as { code: number }).code);
    }

    return null;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return String((error as { message: string }).message);
    }

    return 'Unknown error';
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

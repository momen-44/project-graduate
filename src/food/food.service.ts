import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { GeminiService, NutritionAiResult } from '../ai/gemini.service';
import { LOGGING_QUEUE } from '../common/constants/queue.constants';
import { RequestTypeEnum } from '../common/enums/request-type.enum';
import { DietaryPreferenceEnum } from '../common/enums/dietary-preference.enum';
import { redactSensitiveData } from '../common/utils/security.util';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadableImageFile } from '../cloudinary/cloudinary.service';
import { MlService } from '../ml/ml.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AnalyzeTextDto } from './dto/analyze-text.dto';
import { FoodRequest } from './entities/food-request.entity';
import { ImageAnalysis } from './entities/image-analysis.entity';
import { NutritionSuggestion } from './entities/nutrition-suggestion.entity';
import { ConfigService } from '@nestjs/config';
import { LOCAL_NUTRITION_DB, LocalNutritionEntry } from './local-nutrition.db';
import { MealTypeEnum } from '../common/enums/meal-type.enum';
import { FoodTextAnalysisService } from './text-analysis.service';

interface ImageNutritionResponse extends LocalNutritionEntry {
  source: 'local-nutrition-db' | 'gemini';
}

interface ImagePrediction {
  label: string;
  confidence: number;
}

interface ImageFlowCachePayload {
  prediction: ImagePrediction;
  lowConfidence: boolean;
  nutrition?: ImageNutritionResponse | null;
  imageUrl?: string;
  cloudinaryId?: string;
  nutritionPending?: boolean;
}

interface TextAnalysisCachePayload {
  aiResult: NutritionAiResult;
}

@Injectable()
export class FoodService {
  private readonly logger = new Logger(FoodService.name);
  private static readonly DEFAULT_TEXT_QUANTITY_GRAMS = 100;

  constructor(
    @InjectRepository(FoodRequest)
    private readonly foodRequestRepository: Repository<FoodRequest>,
    @InjectRepository(ImageAnalysis)
    private readonly imageAnalysisRepository: Repository<ImageAnalysis>,
    @InjectRepository(NutritionSuggestion)
    private readonly nutritionSuggestionRepository: Repository<NutritionSuggestion>,
    private readonly usersService: UsersService,
    private readonly mlService: MlService,
    private readonly geminiService: GeminiService,
    private readonly foodTextAnalysisService: FoodTextAnalysisService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(LOGGING_QUEUE)
    private readonly loggingQueue?: Queue,
  ) {}

  async analyzeImage(
    userId: string,
    file: UploadableImageFile,
  ): Promise<Record<string, unknown>> {
    const startedAt = Date.now();

    if (!file || !file.buffer) {
      throw new BadRequestException('Image file is required');
    }

    const imageHash = this.hashBuffer(file.buffer);
    const requestPayload = {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      imageHash,
    };

    const request = await this.foodRequestRepository.save({
      userId,
      requestType: RequestTypeEnum.IMAGE,
      requestData: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        imageHash,
      },
    });

    const cacheKey = `image-analysis:${imageHash}`;
    let cached = await this.redisService.get<ImageFlowCachePayload>(cacheKey);

    const confidenceThreshold =
      this.configService.get<number>('ML_CONFIDENCE_THRESHOLD') ?? 0.6;

    if (cached && this.shouldBypassCachedImagePrediction(cached.prediction)) {
      await this.redisService.del(cacheKey);
      cached = null;
    }

    if (cached) {
      const nutrition = cached.lowConfidence
        ? null
        : (cached.nutrition ??
          this.lookupNutritionByLabel(cached.prediction.label));

      if (!cached.lowConfidence && !nutrition) {
        void this.backfillImageNutrition({
          requestId: request.id,
          cacheKey,
          prediction: cached.prediction,
          userId,
          lowConfidence: cached.lowConfidence,
          imageUrl: cached.imageUrl,
          cloudinaryId: cached.cloudinaryId,
        });
      }

      if (cached.imageUrl && cached.cloudinaryId) {
        await this.persistImageAnalysis(
          request.id,
          cached.imageUrl,
          cached.cloudinaryId,
          cached.prediction.label,
          cached.prediction.confidence,
          nutrition,
        );
      }
      const warning = this.buildImageWarning(
        cached.lowConfidence,
        Boolean(nutrition),
      );

      if (nutrition) {
        await this.persistImageNutritionSuggestion(
          request.id,
          cached.prediction,
          nutrition,
        );
      }

      await this.enqueueLog('food', 'image-analysis-cached', requestPayload, {
        requestId: request.id,
        prediction: cached.prediction,
        nutrition,
        warning,
        status: cached.lowConfidence
          ? 'low-confidence-model-only-cached'
          : 'model-only-cached',
      });

      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `image-analysis requestId=${request.id} source=cache totalMs=${totalMs} lowConfidence=${cached.lowConfidence} label="${cached.prediction.label}" confidence=${cached.prediction.confidence.toFixed(4)}`,
      );

      return this.buildImageResponse(
        request.id,
        cached.prediction,
        nutrition,
        warning,
      );
    }

    const skipCloudinaryOnLowConfidence =
      this.configService.get<boolean>(
        'SKIP_CLOUDINARY_UPLOAD_ON_LOW_CONFIDENCE',
      ) ?? false;
    const asyncCloudinaryUpload =
      this.configService.get<boolean>('ASYNC_CLOUDINARY_UPLOAD') ?? false;

    if (asyncCloudinaryUpload) {
      const predictionStartedAt = Date.now();
      const prediction = await this.mlService.predictFromImageBuffer(
        file.buffer,
        file.mimetype,
      );
      const predictionMs = Date.now() - predictionStartedAt;

      const lowConfidence =
        prediction.confidence < confidenceThreshold ||
        this.shouldBypassCachedImagePrediction(prediction);
      const nutrition = lowConfidence
        ? null
        : this.lookupNutritionByLabel(prediction.label);

      await this.redisService.set(
        cacheKey,
        {
          prediction,
          lowConfidence,
          nutrition,
          nutritionPending: !nutrition && !lowConfidence,
        },
        this.getImageAnalysisCacheTtl(),
      );

      if (!lowConfidence) {
        this.persistImageAnalysisInBackground({
          requestId: request.id,
          cacheKey,
          prediction,
          userId,
          nutrition,
          file: {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
        });
      }

      const warning = this.buildImageWarning(lowConfidence, Boolean(nutrition));

      await this.enqueueLog('food', 'image-analysis', requestPayload, {
        requestId: request.id,
        prediction,
        nutrition,
        warning,
        status: lowConfidence
          ? 'low-confidence-model-only-async-upload'
          : 'model-only-async-upload',
      });

      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `image-analysis requestId=${request.id} source=fresh strategy=async-upload cloudinarySkipped=${lowConfidence} totalMs=${totalMs} predictionMs=${predictionMs} cloudinaryMs=pending lowConfidence=${lowConfidence} label="${prediction.label}" confidence=${prediction.confidence.toFixed(4)}`,
      );

      return this.buildImageResponse(
        request.id,
        prediction,
        nutrition,
        warning,
      );
    }

    if (skipCloudinaryOnLowConfidence) {
      const predictionStartedAt = Date.now();
      const prediction = await this.mlService.predictFromImageBuffer(
        file.buffer,
        file.mimetype,
      );
      const predictionMs = Date.now() - predictionStartedAt;

      const lowConfidence =
        prediction.confidence < confidenceThreshold ||
        this.shouldBypassCachedImagePrediction(prediction);

      if (lowConfidence) {
        const warning = this.buildImageWarning(true, false);

        await this.redisService.set(
          cacheKey,
          {
            prediction,
            lowConfidence: true,
            nutrition: null,
            nutritionPending: false,
          },
          this.getImageAnalysisCacheTtl(),
        );

        await this.enqueueLog('food', 'image-analysis', requestPayload, {
          requestId: request.id,
          prediction,
          nutrition: null,
          warning,
          status: 'low-confidence-model-only-skip-upload',
        });

        const totalMs = Date.now() - startedAt;
        this.logger.log(
          `image-analysis requestId=${request.id} source=fresh strategy=sequential cloudinarySkipped=true totalMs=${totalMs} predictionMs=${predictionMs} cloudinaryMs=0 lowConfidence=true label="${prediction.label}" confidence=${prediction.confidence.toFixed(4)}`,
        );

        return this.buildImageResponse(request.id, prediction, null, warning);
      }

      const cloudinaryStartedAt = Date.now();
      const uploadedImage = await this.cloudinaryService.uploadFile(file);
      const cloudinaryMs = Date.now() - cloudinaryStartedAt;
      const imageUrl = uploadedImage.secure_url;
      const cloudinaryId = uploadedImage.public_id;
      const nutrition = this.lookupNutritionByLabel(prediction.label);

      await this.persistImageAnalysis(
        request.id,
        imageUrl,
        cloudinaryId,
        prediction.label,
        prediction.confidence,
        nutrition,
      );

      await this.redisService.set(
        cacheKey,
        {
          prediction,
          lowConfidence: false,
          nutrition,
          imageUrl,
          cloudinaryId,
          nutritionPending: !nutrition,
        },
        this.getImageAnalysisCacheTtl(),
      );

      if (!nutrition) {
        void this.backfillImageNutrition({
          requestId: request.id,
          cacheKey,
          prediction,
          userId,
          lowConfidence: false,
          imageUrl,
          cloudinaryId,
        });
      }

      const warning = this.buildImageWarning(false, Boolean(nutrition));

      await this.enqueueLog('food', 'image-analysis', requestPayload, {
        requestId: request.id,
        prediction,
        nutrition,
        warning,
        status: 'model-only-skip-strategy',
      });

      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `image-analysis requestId=${request.id} source=fresh strategy=sequential cloudinarySkipped=false totalMs=${totalMs} predictionMs=${predictionMs} cloudinaryMs=${cloudinaryMs} lowConfidence=false label="${prediction.label}" confidence=${prediction.confidence.toFixed(4)}`,
      );

      return this.buildImageResponse(
        request.id,
        prediction,
        nutrition,
        warning,
      );
    }

    const predictionStartedAt = Date.now();
    const predictionPromise = this.mlService
      .predictFromImageBuffer(file.buffer, file.mimetype)
      .then((prediction) => ({
        prediction,
        predictionMs: Date.now() - predictionStartedAt,
      }));

    const cloudinaryStartedAt = Date.now();
    const uploadedImagePromise = this.cloudinaryService
      .uploadFile(file)
      .then((uploadedImage) => ({
        uploadedImage,
        cloudinaryMs: Date.now() - cloudinaryStartedAt,
      }));

    const [{ prediction, predictionMs }, { uploadedImage, cloudinaryMs }] =
      await Promise.all([predictionPromise, uploadedImagePromise]);

    const imageUrl = uploadedImage.secure_url;
    const cloudinaryId = uploadedImage.public_id;
    const lowConfidence =
      prediction.confidence < confidenceThreshold ||
      this.shouldBypassCachedImagePrediction(prediction);
    const nutrition = lowConfidence
      ? null
      : this.lookupNutritionByLabel(prediction.label);

    await this.persistImageAnalysis(
      request.id,
      imageUrl,
      cloudinaryId,
      prediction.label,
      prediction.confidence,
      nutrition,
    );

    await this.redisService.set(
      cacheKey,
      {
        prediction,
        lowConfidence,
        nutrition,
        imageUrl,
        cloudinaryId,
        nutritionPending: !nutrition && !lowConfidence,
      },
      this.getImageAnalysisCacheTtl(),
    );

    if (!lowConfidence && !nutrition) {
      void this.backfillImageNutrition({
        requestId: request.id,
        cacheKey,
        prediction,
        userId,
        lowConfidence,
        imageUrl,
        cloudinaryId,
      });
    }

    const warning = this.buildImageWarning(lowConfidence, Boolean(nutrition));

    await this.enqueueLog('food', 'image-analysis', requestPayload, {
      requestId: request.id,
      prediction,
      nutrition,
      warning,
      status: lowConfidence ? 'low-confidence-model-only' : 'model-only',
    });

    const totalMs = Date.now() - startedAt;
    this.logger.log(
      `image-analysis requestId=${request.id} source=fresh strategy=parallel cloudinarySkipped=false totalMs=${totalMs} predictionMs=${predictionMs} cloudinaryMs=${cloudinaryMs} lowConfidence=${lowConfidence} label="${prediction.label}" confidence=${prediction.confidence.toFixed(4)}`,
    );

    return this.buildImageResponse(request.id, prediction, nutrition, warning);
  }

  async analyzeText(userId: string, dto: AnalyzeTextDto) {
    const user = await this.usersService.findById(userId);
    const quantityGrams =
      dto.quantityGrams ?? FoodService.DEFAULT_TEXT_QUANTITY_GRAMS;

    this.foodTextAnalysisService.validateDescription(dto.description);

    const mealImageUrl = this.buildMealImageUrl(dto.description, dto.mealType);

    let request = await this.findTodayTextRequestForMeal(userId, dto.mealType);

    if (request) {
      request.requestData = {
        mealType: dto.mealType,
        description: dto.description,
        quantityGrams,
        userContext: dto.userContext ?? null,
        mealImageUrl,
      };
      request = await this.foodRequestRepository.save(request);
    } else {
      request = await this.foodRequestRepository.save({
        userId,
        requestType: RequestTypeEnum.TEXT,
        requestData: {
          mealType: dto.mealType,
          description: dto.description,
          quantityGrams,
          userContext: dto.userContext ?? null,
          mealImageUrl,
        },
      });
    }

    const cacheKey = this.buildCacheKey('text-analysis', {
      userId,
      mealType: dto.mealType,
      description: dto.description.trim().toLowerCase(),
      quantityGrams,
      userContext: (dto.userContext ?? '').trim().toLowerCase(),
      dietaryPreference: user.dietaryPreference ?? null,
    });

    const cached =
      await this.redisService.get<TextAnalysisCachePayload>(cacheKey);

    let aiResult: NutritionAiResult;

    if (cached?.aiResult) {
      aiResult = cached.aiResult;
    } else {
      aiResult = this.foodTextAnalysisService.generateNutrition({
        mealType: dto.mealType,
        description: dto.description,
        userContext: dto.userContext,
        dietaryPreference: user.dietaryPreference,
        quantityGrams,
      });
    }

    if (!cached) {
      await this.redisService.set(
        cacheKey,
        { aiResult },
        this.getTextAnalysisCacheTtl(),
      );
    }

    await this.persistNutritionSuggestion(request.id, aiResult);

    await this.enqueueLog('food', 'text-analysis', dto, {
      requestId: request.id,
      nutrition: this.toNutritionResponse(aiResult),
    });

    return {
      requestId: request.id,
      mealImageUrl,
      nutrition: this.toNutritionResponse(aiResult),
    };
  }

  getTextOptions(mealType?: MealTypeEnum): readonly string[] {
    if (mealType)
      return this.foodTextAnalysisService.getOptionsForMealType(mealType);
    return this.foodTextAnalysisService.getDescriptionOptions();
  }

  async getTextSuggestions(userId: string, query?: string) {
    if (!query || !query.trim()) {
      throw new BadRequestException(
        'Search query is required for food suggestions',
      );
    }

    const trimmedQuery = query.trim();

    // Validate query length
    if (trimmedQuery.length < 2 || trimmedQuery.length > 100) {
      throw new BadRequestException(
        'Search query must be between 2 and 100 characters',
      );
    }

    // Check if query contains non-alphabetic characters (except spaces and common symbols)
    const validQueryPattern = /^[a-zA-Z\s\-&()]{2,100}$/;
    if (!validQueryPattern.test(trimmedQuery)) {
      throw new BadRequestException(
        'Invalid search query. Use only letters, spaces, and common symbols',
      );
    }

    const cacheKey = this.buildCacheKey('food-suggestions', {
      query: trimmedQuery.toLowerCase(),
    });

    const cached = await this.redisService.get<{
      suggestions: Array<{
        name: string;
        mealTypes: string[];
        nutrition: {
          calories: number;
          protein: number;
          carbs: number;
          fats: number;
          servingSizeGrams?: number;
        };
      }>;
    }>(cacheKey);

    if (cached) {
      return {
        suggestions: cached.suggestions.map((food) => ({
          id: food.name.toLowerCase().replace(/\s+/g, '-'),
          ...food,
        })),
        total: cached.suggestions.length,
      };
    }

    // If user typed a meal type (breakfast/lunch/dinner/snack), return only those options
    const lower = trimmedQuery.toLowerCase();
    const mealTypeKeywords = ['breakfast', 'lunch', 'dinner', 'snack'];
    let options: string[] = [];

    if (mealTypeKeywords.includes(lower)) {
      const mt = lower.toUpperCase() as keyof typeof MealTypeEnum;
      options = this.foodTextAnalysisService.getOptionsForMealType(
        MealTypeEnum[mt],
      ) as string[];
    } else {
      options = this.foodTextAnalysisService
        .getDescriptionOptions()
        .filter((opt) => opt.toLowerCase().includes(lower));
    }

    const suggestions = options.slice(0, 20).map((name) => {
      const profile = this.foodTextAnalysisService.getProfile(name);
      const nutrition = profile
        ? {
            calories: profile.calories,
            protein: profile.protein,
            carbs: profile.carbs,
            fats: profile.fats,
            servingSizeGrams: profile.servingSizeGrams ?? 250,
          }
        : { calories: 0, protein: 0, carbs: 0, fats: 0, servingSizeGrams: 250 };

      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        mealTypes: profile ? [profile.mealType.toString().toLowerCase()] : [],
        nutrition,
      };
    });

    await this.redisService.set(cacheKey, { suggestions }, 3600);

    return { suggestions, total: suggestions.length };
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private buildCacheKey(
    prefix: string,
    payload: Record<string, unknown>,
  ): string {
    const payloadJson = JSON.stringify(payload);
    const hash = createHash('sha256').update(payloadJson).digest('hex');
    return `${prefix}:${hash}`;
  }

  private getImageAnalysisCacheTtl(): number {
    return (
      this.configService.get<number>('IMAGE_ANALYSIS_CACHE_TTL_SECONDS') ??
      this.configService.get<number>('PREDICTION_CACHE_TTL_SECONDS') ??
      86400
    );
  }

  private getTextAnalysisCacheTtl(): number {
    return (
      this.configService.get<number>('TEXT_ANALYSIS_CACHE_TTL_SECONDS') ?? 86400
    );
  }

  async getHistory(userId: string) {
    await this.usersService.findById(userId);

    const confidenceThreshold =
      this.configService.get<number>('ML_CONFIDENCE_THRESHOLD') ?? 0.6;

    const requests = await this.foodRequestRepository.find({
      where: { userId },
      relations: {
        imageAnalysis: true,
        nutritionSuggestions: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const mappedRequests = requests.map((request) => ({
      id: request.id,
      requestType: request.requestType,
      requestData: request.requestData,
      createdAt: request.createdAt,
      imageAnalysis: request.imageAnalysis
        ? {
            id: request.imageAnalysis.id,
            imageUrl: request.imageAnalysis.imageUrl,
            cloudinaryId: request.imageAnalysis.cloudinaryId,
            modelPrediction: request.imageAnalysis.modelPrediction,
            confidence: Number(request.imageAnalysis.confidence),
            nutritionSnapshot:
              Number(request.imageAnalysis.confidence) >= confidenceThreshold &&
              this.normalizeFoodLabel(request.imageAnalysis.modelPrediction) !==
                'unknown food'
                ? (request.imageAnalysis.nutritionSnapshot ?? null)
                : null,
            nutritionSource:
              Number(request.imageAnalysis.confidence) >= confidenceThreshold &&
              this.normalizeFoodLabel(request.imageAnalysis.modelPrediction) !==
                'unknown food'
                ? (request.imageAnalysis.nutritionSource ?? null)
                : null,
            analyzedAt: request.imageAnalysis.analyzedAt,
          }
        : null,
      nutritionSuggestions:
        request.imageAnalysis &&
        (Number(request.imageAnalysis.confidence) < confidenceThreshold ||
          this.normalizeFoodLabel(request.imageAnalysis.modelPrediction) ===
            'unknown food')
          ? []
          : request.nutritionSuggestions.map((suggestion) => ({
              id: suggestion.id,
              mealType: suggestion.mealType,
              suggestionText: suggestion.suggestionText,
              mealImageUrl:
                typeof request.requestData['mealImageUrl'] === 'string'
                  ? String(request.requestData['mealImageUrl'])
                  : this.buildMealImageUrl(
                      typeof request.requestData['description'] === 'string'
                        ? String(request.requestData['description'])
                        : suggestion.suggestionText,
                      suggestion.mealType ?? MealTypeEnum.SNACK,
                    ),
              nutrients: suggestion.nutrients,
              totalCalories: suggestion.totalCalories,
              createdAt: suggestion.createdAt,
            })),
    }));

    const dedupedTextMealKeys = new Set<string>();

    return mappedRequests.filter((request) => {
      if (request.requestType !== RequestTypeEnum.TEXT) {
        return true;
      }

      const mealType =
        (request.requestData['mealType'] as string | undefined) ??
        request.nutritionSuggestions[0]?.mealType ??
        'unknown';
      const dayKey = request.createdAt.toISOString().slice(0, 10);
      const key = `${dayKey}:${mealType}`;

      if (dedupedTextMealKeys.has(key)) {
        return false;
      }

      dedupedTextMealKeys.add(key);
      return true;
    });
  }

  async clearHistory(userId: string) {
    await this.usersService.findById(userId);

    const result = await this.foodRequestRepository.delete({ userId });

    return {
      success: true,
      deletedCount: result.affected ?? 0,
    };
  }

  async deleteHistoryItem(userId: string, requestId: string) {
    await this.usersService.findById(userId);

    const normalizedRequestId = requestId.trim();
    if (!/^\d+$/.test(normalizedRequestId)) {
      throw new BadRequestException(
        'Invalid history item id. Local entries must be deleted on the client only.',
      );
    }

    const result = await this.foodRequestRepository.delete({
      id: normalizedRequestId,
      userId,
    });

    if (!result.affected) {
      throw new NotFoundException('History item not found');
    }

    return {
      success: true,
      deletedCount: result.affected,
    };
  }

  private async persistImageAnalysis(
    requestId: string,
    imageUrl: string,
    cloudinaryId: string,
    modelPrediction: string,
    confidence: number,
    nutrition?: ImageNutritionResponse | null,
  ) {
    return this.imageAnalysisRepository.save({
      requestId,
      imageUrl,
      cloudinaryId,
      modelPrediction,
      confidence: Number(confidence.toFixed(4)),
      nutritionSnapshot: nutrition
        ? {
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fats: nutrition.fats,
            fiber: nutrition.fiber,
            unit: nutrition.unit,
            about: nutrition.about,
          }
        : null,
      nutritionSource: nutrition?.source ?? null,
      analyzedAt: new Date(),
    });
  }

  private async persistNutritionSuggestion(
    requestId: string,
    aiResult: NutritionAiResult,
  ) {
    await this.nutritionSuggestionRepository.delete({ requestId });

    return this.nutritionSuggestionRepository.save({
      requestId,
      mealType: aiResult.mealType,
      suggestionText: aiResult.suggestionText,
      nutrients: {
        protein: aiResult.protein,
        carbs: aiResult.carbs,
        fats: aiResult.fats,
      },
      totalCalories: Math.round(aiResult.calories),
    });
  }

  private async persistImageNutritionSuggestion(
    requestId: string,
    prediction: ImagePrediction,
    nutrition: ImageNutritionResponse,
  ) {
    await this.nutritionSuggestionRepository.delete({ requestId });

    return this.nutritionSuggestionRepository.save({
      requestId,
      mealType: MealTypeEnum.SNACK,
      suggestionText: `Image prediction: ${prediction.label}`,
      nutrients: {
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fats: nutrition.fats,
      },
      totalCalories: Math.round(nutrition.calories),
    });
  }

  private persistImageAnalysisInBackground(params: {
    requestId: string;
    cacheKey: string;
    prediction: ImagePrediction;
    userId: string;
    nutrition: ImageNutritionResponse | null;
    file: UploadableImageFile;
  }): void {
    const cloudinaryStartedAt = Date.now();

    void (async () => {
      try {
        const uploadedImage = await this.cloudinaryService.uploadFile(
          params.file,
        );
        const cloudinaryMs = Date.now() - cloudinaryStartedAt;
        const imageUrl = uploadedImage.secure_url;
        const cloudinaryId = uploadedImage.public_id;

        await this.persistImageAnalysis(
          params.requestId,
          imageUrl,
          cloudinaryId,
          params.prediction.label,
          params.prediction.confidence,
          params.nutrition,
        );

        await this.redisService.set(
          params.cacheKey,
          {
            prediction: params.prediction,
            lowConfidence: false,
            nutrition: params.nutrition,
            imageUrl,
            cloudinaryId,
            nutritionPending: !params.nutrition,
          },
          this.getImageAnalysisCacheTtl(),
        );

        if (!params.nutrition) {
          void this.backfillImageNutrition({
            requestId: params.requestId,
            cacheKey: params.cacheKey,
            prediction: params.prediction,
            userId: params.userId,
            lowConfidence: false,
            imageUrl,
            cloudinaryId,
          });
        }

        this.logger.log(
          `image-analysis background-upload requestId=${params.requestId} cloudinaryMs=${cloudinaryMs} label="${params.prediction.label}" confidence=${params.prediction.confidence.toFixed(4)}`,
        );
      } catch (error) {
        this.logger.warn(
          `image-analysis background-upload failed requestId=${params.requestId} reason="${
            error instanceof Error ? error.message : 'Unknown error'
          }"`,
        );
      }
    })();
  }

  private async backfillImageNutrition(params: {
    requestId: string;
    cacheKey: string;
    prediction: ImagePrediction;
    userId: string;
    lowConfidence: boolean;
    imageUrl?: string;
    cloudinaryId?: string;
  }): Promise<void> {
    try {
      if (params.lowConfidence) {
        return;
      }

      const user = await this.usersService.findById(params.userId);
      const nutrition = await this.resolveImageNutrition(
        params.prediction,
        user.dietaryPreference ?? null,
      );

      if (!nutrition) {
        return;
      }

      await Promise.all([
        this.imageAnalysisRepository.update(
          { requestId: params.requestId },
          {
            imageUrl: params.imageUrl,
            cloudinaryId: params.cloudinaryId,
            modelPrediction: params.prediction.label,
            confidence: Number(params.prediction.confidence.toFixed(4)),
            nutritionSnapshot: {
              calories: nutrition.calories,
              protein: nutrition.protein,
              carbs: nutrition.carbs,
              fats: nutrition.fats,
              fiber: nutrition.fiber,
              unit: nutrition.unit,
              about: nutrition.about,
            },
            nutritionSource: nutrition.source,
            analyzedAt: new Date(),
          },
        ),
        this.persistImageNutritionSuggestion(
          params.requestId,
          params.prediction,
          nutrition,
        ),
        this.redisService.set(
          params.cacheKey,
          {
            prediction: params.prediction,
            lowConfidence: params.lowConfidence,
            nutrition,
            imageUrl: params.imageUrl,
            cloudinaryId: params.cloudinaryId,
            nutritionPending: false,
          },
          this.getImageAnalysisCacheTtl(),
        ),
      ]);
    } catch (error) {
      this.logger.warn(
        `Image nutrition backfill failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async findTodayTextRequestForMeal(
    userId: string,
    mealType: MealTypeEnum,
  ): Promise<FoodRequest | null> {
    const { start, end } = this.getCurrentDayRange();

    return this.foodRequestRepository
      .createQueryBuilder('request')
      .where('request.userId = :userId', { userId })
      .andWhere('request.requestType = :requestType', {
        requestType: RequestTypeEnum.TEXT,
      })
      .andWhere('request.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere(`request.requestData ->> 'mealType' = :mealType`, { mealType })
      .orderBy('request.createdAt', 'DESC')
      .getOne();
  }

  private getCurrentDayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private toNutritionResponse(aiResult: NutritionAiResult) {
    return {
      calories: aiResult.calories,
      protein: aiResult.protein,
      carbs: aiResult.carbs,
      fats: aiResult.fats,
      healthyAlternatives: aiResult.healthyAlternatives,
      dailyAdvice: aiResult.dailyAdvice,
      mealType: aiResult.mealType,
      suggestionText: aiResult.suggestionText,
    };
  }

  private buildMealImageUrl(
    description: string,
    mealType: MealTypeEnum,
  ): string {
    const normalizedDescription = description
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const queryParts = [normalizedDescription || mealType, 'food', mealType];
    const query = encodeURIComponent(queryParts.join(' '));

    return `https://source.unsplash.com/featured/640x480/?${query}`;
  }

  private buildImageResponse(
    requestId: string,
    prediction: ImagePrediction,
    nutrition: ImageNutritionResponse | null,
    warning?: string,
  ): {
    requestId: string;
    prediction: ImagePrediction;
    nutrition?: ImageNutritionResponse;
    warning?: string;
  } {
    const response: {
      requestId: string;
      prediction: ImagePrediction;
      nutrition?: ImageNutritionResponse;
      warning?: string;
    } = {
      requestId,
      prediction,
    };

    if (nutrition) {
      response.nutrition = nutrition;
    }
    if (warning) {
      response.warning = warning;
    }

    return response;
  }

  private lookupNutritionByLabel(label: string): ImageNutritionResponse | null {
    const normalizedLabel = this.normalizeFoodLabel(label);
    const aliasMap: Record<string, string> = {
      jalapeno: 'jalepeno',
      'sweet potato': 'sweetpotato',
      'sweet corn': 'sweetcorn',
      soybean: 'soy beans',
      soybeans: 'soy beans',
      radish: 'raddish',
    };

    const canonicalLabel = aliasMap[normalizedLabel] ?? normalizedLabel;
    const nutrition = LOCAL_NUTRITION_DB[canonicalLabel];

    if (!nutrition) {
      return null;
    }

    return {
      ...nutrition,
      source: 'local-nutrition-db',
    };
  }

  private async resolveImageNutrition(
    prediction: ImagePrediction,
    dietaryPreference?: DietaryPreferenceEnum | null,
  ): Promise<ImageNutritionResponse | null> {
    const localNutrition = this.lookupNutritionByLabel(prediction.label);
    if (localNutrition) {
      return localNutrition;
    }

    try {
      const aiNutrition = await this.geminiService.generateFromImagePrediction({
        label: prediction.label,
        confidence: prediction.confidence,
        dietaryPreference,
      });

      const calories = this.toPositiveNumber(aiNutrition.calories);
      const protein = this.toPositiveNumber(aiNutrition.protein);
      const carbs = this.toPositiveNumber(aiNutrition.carbs);
      const fats = this.toPositiveNumber(aiNutrition.fats);

      if (!calories || !protein || !carbs || !fats) {
        return null;
      }

      return {
        calories,
        protein,
        carbs,
        fats,
        fiber: 0,
        unit: 'per serving',
        about: 'Estimated by Gemini based on image prediction.',
        source: 'gemini',
      };
    } catch (error) {
      this.logger.warn(
        `Failed to generate image nutrition with Gemini: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return this.buildFallbackImageNutrition(prediction);
    }
  }

  private buildFallbackImageNutrition(
    prediction: ImagePrediction,
  ): ImageNutritionResponse {
    const normalizedLabel = this.normalizeFoodLabel(prediction.label);

    let calories = 220;
    let protein = 10;
    let carbs = 22;
    let fats = 9;
    let fiber = 3;

    if (/(chicken|fish|beef|tuna|egg|protein)/.test(normalizedLabel)) {
      calories = 260;
      protein = 20;
      carbs = 8;
      fats = 14;
      fiber = 0;
    } else if (
      /(salad|lettuce|cucumber|tomato|spinach|vegetable)/.test(normalizedLabel)
    ) {
      calories = 95;
      protein = 4;
      carbs = 12;
      fats = 4;
      fiber = 4;
    } else if (
      /(apple|banana|orange|mango|pear|grapes|pineapple|watermelon)/.test(
        normalizedLabel,
      )
    ) {
      calories = 110;
      protein = 1;
      carbs = 28;
      fats = 0.5;
      fiber = 3;
    }

    return {
      calories,
      protein,
      carbs,
      fats,
      fiber,
      unit: 'per serving',
      about:
        'Estimated locally because the ML label was uncertain or the AI nutrition lookup was unavailable.',
      source: 'gemini',
    };
  }

  private toPositiveNumber(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
      return null;
    }

    return Number(value);
  }

  private normalizeFoodLabel(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private shouldBypassCachedImagePrediction(
    prediction: ImagePrediction,
  ): boolean {
    const normalizedLabel = this.normalizeFoodLabel(prediction.label);

    return (
      !normalizedLabel ||
      normalizedLabel === 'unknown food' ||
      normalizedLabel === 'unknown'
    );
  }

  private buildImageWarning(
    lowConfidence: boolean,
    hasNutrition: boolean,
  ): string | undefined {
    if (lowConfidence && !hasNutrition) {
      return 'Low confidence prediction. Nutrition data not found for this label.';
    }
    if (lowConfidence) {
      return 'Low confidence prediction.';
    }
    if (!hasNutrition) {
      return 'Nutrition data not found for this label.';
    }
    return undefined;
  }

  private async enqueueLog(
    action: string,
    serviceAction: string,
    requestData: unknown,
    responseData: unknown,
  ): Promise<void> {
    if (!this.loggingQueue) {
      return;
    }

    await this.loggingQueue.add(
      'create-system-log',
      {
        serviceName: action,
        action: serviceAction,
        requestData: redactSensitiveData(requestData),
        responseData: redactSensitiveData(responseData),
        status: 'success',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );
  }
}

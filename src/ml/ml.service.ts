import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface MlPredictionResponse {
  label: string;
  confidence: number;
}

@Injectable()
export class MlService implements OnModuleInit {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly warmupOnStart: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('ML_API_BASE_URL');
    this.timeoutMs = this.configService.get<number>('ML_TIMEOUT_MS') ?? 10000;
    this.warmupOnStart =
      this.configService.get<boolean>('ML_WARMUP_ON_START') ?? false;
  }

  async onModuleInit(): Promise<void> {
    if (!this.warmupOnStart) {
      return;
    }

    // 1x1 transparent PNG to warm model/runtime with minimal payload.
    const warmupImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwnwAGgwJ/lA1FwwAAAABJRU5ErkJggg==';
    const startedAt = Date.now();

    try {
      await this.predictWithPayload({
        image_base64: warmupImageBase64,
        mime_type: 'image/png',
      });
      const durationMs = Date.now() - startedAt;
      this.logger.log(`ML warmup completed durationMs=${durationMs}`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message =
        error instanceof Error ? error.message : 'Unknown warmup error';
      this.logger.warn(
        `ML warmup failed durationMs=${durationMs} reason="${message}"`,
      );
    }
  }

  async predictFromImageUrl(imageUrl: string): Promise<MlPredictionResponse> {
    return this.predictWithPayload({ image_url: imageUrl });
  }

  async predictFromImageBuffer(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<MlPredictionResponse> {
    return this.predictWithPayload({
      image_base64: buffer.toString('base64'),
      mime_type: mimeType ?? 'image/jpeg',
    });
  }

  private async predictWithPayload(
    payload: Record<string, unknown>,
  ): Promise<MlPredictionResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const attemptStartedAt = Date.now();
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/predict`, payload, {
            timeout: this.timeoutMs,
          }),
        );

        const label = response.data?.label ?? response.data?.prediction;
        const confidence = Number(response.data?.confidence);

        if (!label || Number.isNaN(confidence)) {
          throw new BadGatewayException(
            'Invalid prediction payload from ML service',
          );
        }

        const attemptMs = Date.now() - attemptStartedAt;
        this.logger.log(
          `ML predict success attempt=${attempt} durationMs=${attemptMs} label="${label}" confidence=${confidence.toFixed(4)}`,
        );

        return {
          label,
          confidence,
        };
      } catch (error) {
        lastError = error;
        const attemptMs = Date.now() - attemptStartedAt;
        const message =
          error instanceof Error ? error.message : 'Unknown ML error';
        this.logger.warn(
          `ML request attempt=${attempt} failed durationMs=${attemptMs} reason="${message}"`,
        );
      }
    }

    this.logger.error('ML prediction failed after retries', lastError as Error);
    throw new BadGatewayException('ML service is unavailable');
  }
}

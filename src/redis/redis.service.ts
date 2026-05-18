import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isAvailable = false;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled =
      this.configService.get<string>('REDIS_ENABLED')?.toLowerCase() !==
      'false';

    if (!this.isEnabled) {
      this.logger.warn('Redis is disabled by REDIS_ENABLED=false');
      return;
    }

    this.client = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
      reconnectOnError: () => false,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('error', (error: Error) => {
      this.isAvailable = false;
      this.logger.warn(`Redis error: ${error.message}`);
    });

    this.client.on('ready', () => {
      this.isAvailable = true;
      this.logger.log('Redis ready');
    });

    this.client.on('end', () => {
      this.isAvailable = false;
      this.logger.warn('Redis connection ended');
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.connect();
      this.isAvailable = true;
      this.logger.log('Redis connected');
    } catch (error) {
      this.isAvailable = false;
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(
        `Redis unavailable, continuing without cache: ${message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.client;
    if (!this.isAvailable || !client) {
      return null;
    }

    const value = await client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = this.client;
    if (!this.isAvailable || !client) {
      return;
    }

    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const client = this.client;
    if (!this.isAvailable || !client) {
      return;
    }

    await client.del(key);
  }
}

import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CALORIES_QUEUE,
  EMAIL_QUEUE,
  LOGGING_QUEUE,
} from '../common/constants/queue.constants';
import { MailModule } from '../mail/mail.module';
import { SystemLog } from '../logs/entities/system-log.entity';
import { EmailProcessor } from './email.processor';
import { LoggingProcessor } from './logging.processor';
import { DailyCalculationProcessor } from './daily-calculation.processor';

@Global()
@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([SystemLog]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB') ?? 0,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          reconnectOnError: () => false,
          connectTimeout: 5000,
          enableOfflineQueue: false,
        },
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: LOGGING_QUEUE }, { name: CALORIES_QUEUE }),
  ],
  providers: [EmailProcessor, LoggingProcessor, DailyCalculationProcessor],
  exports: [BullModule],
})
export class JobsModule {}

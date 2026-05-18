import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { envValidationSchema } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FoodModule } from './food/food.module';
import { AiModule } from './ai/ai.module';
import { MlModule } from './ml/ml.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { JobsModule } from './jobs/jobs.module';
import { CaloriesModule } from './calories/calories.module';
import { LogsModule } from './logs/logs.module';

const isRedisEnabled = process.env.REDIS_ENABLED?.toLowerCase() !== 'false';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    CommonModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        ssl: configService.get<boolean>('DB_SSL')
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize: true, // Set to false in production and use migrations instead
        migrationsRun: configService.get<boolean>('DB_MIGRATIONS_RUN') ?? false,
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
      }),
    }),
    RedisModule,
    MailModule,
    ...(isRedisEnabled ? [JobsModule] : []),
    AuthModule,
    UsersModule,
    FoodModule,
    AiModule,
    MlModule,
    CloudinaryModule,
    CaloriesModule,
    LogsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCoreModule } from '../ai/ai-core.module';
import { UsersModule } from '../users/users.module';
import { DailyCalculation } from './daily-calculation.entity';
import { CaloriesController } from './calories.controller';
import { CaloriesService } from './calories.service';
import { NutritionSuggestion } from '../food/entities/nutrition-suggestion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyCalculation, NutritionSuggestion]),
    UsersModule,
    AiCoreModule,
  ],
  controllers: [CaloriesController],
  providers: [CaloriesService],
  exports: [CaloriesService],
})
export class CaloriesModule {}

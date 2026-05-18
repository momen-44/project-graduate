import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCoreModule } from '../ai/ai-core.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MlModule } from '../ml/ml.module';
import { UsersModule } from '../users/users.module';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
import { FoodTextAnalysisService } from './text-analysis.service';
import { FoodRequest } from './entities/food-request.entity';
import { ImageAnalysis } from './entities/image-analysis.entity';
import { NutritionSuggestion } from './entities/nutrition-suggestion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodRequest, ImageAnalysis, NutritionSuggestion]),
    UsersModule,
    MlModule,
    AiCoreModule,
    CloudinaryModule,
  ],
  controllers: [FoodController],
  providers: [FoodService, FoodTextAnalysisService],
  exports: [FoodService],
})
export class FoodModule {}

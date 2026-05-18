import { Module } from '@nestjs/common';
import { FoodModule } from '../food/food.module';
import { CaloriesModule } from '../calories/calories.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [FoodModule, CaloriesModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}

import { Injectable } from '@nestjs/common';
import { CaloriesService } from '../calories/calories.service';
import { AnalyzeTextDto } from '../food/dto/analyze-text.dto';
import { FoodService } from '../food/food.service';

@Injectable()
export class AiService {
  constructor(
    private readonly foodService: FoodService,
    private readonly caloriesService: CaloriesService,
  ) {}

  async suggest(userId: string, dto: AnalyzeTextDto) {
    return this.foodService.analyzeText(userId, dto);
  }

  async analyzeText(userId: string, dto: AnalyzeTextDto) {
    return this.foodService.analyzeText(userId, dto);
  }

  async analyzeImage(userId: string, file: Express.Multer.File) {
    return this.foodService.analyzeImage(userId, file);
  }

  async calories(userId: string) {
    return this.caloriesService.calculateDailyForUser(userId);
  }
}

import { Controller, Get, UseGuards, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CaloriesService } from './calories.service';

@ApiTags('Calories')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller(['daily-calories', 'api/v1/daily-calories'])
export class CaloriesController {
  constructor(private readonly caloriesService: CaloriesService) {}

  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  getDailyCalories(@CurrentUser() user: JwtPayload) {
    return this.caloriesService.calculateDailyForUser(user.sub);
  }
}

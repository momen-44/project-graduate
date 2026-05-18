import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AnalyzeTextDto, FoodSuggestionsDto } from './dto/analyze-text.dto';
import { FoodService } from './food.service';

@ApiTags('Food')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller(['food'])
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  @Post('image')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  analyzeImage(@CurrentUser() user: JwtPayload, @UploadedFiles() files: any[]) {
    const file = files?.[0];
    return this.foodService.analyzeImage(user.sub, file);
  }

  @Post('text')
  analyzeText(@CurrentUser() user: JwtPayload, @Body() dto: AnalyzeTextDto) {
    return this.foodService.analyzeText(user.sub, dto);
  }

  @Get('text-options')
  @Get('text-options')
  @ApiQuery({
    name: 'mealType',
    required: false,
    type: String,
    description: 'Optional meal type filter: BREAKFAST, LUNCH, DINNER, SNACK',
  })
  getTextOptions(@Query('mealType') mealType?: string) {
    const mt = mealType ? (mealType.toUpperCase() as any) : undefined;
    return this.foodService.getTextOptions(mt);
  }

  @Post('text-suggestions')
  @ApiQuery({
    name: 'query',
    required: true,
    type: String,
    description: 'Search query for Egyptian food suggestions',
  })
  getTextSuggestions(
    @CurrentUser() user: JwtPayload,
    @Query('query') query?: string,
  ) {
    return this.foodService.getTextSuggestions(user.sub, query);
  }

  @Get('history')
  history(@CurrentUser() user: JwtPayload) {
    return this.foodService.getHistory(user.sub);
  }

  @Delete('history')
  clearHistory(@CurrentUser() user: JwtPayload) {
    return this.foodService.clearHistory(user.sub);
  }

  @Delete('history/:id')
  @Delete(':id')
  deleteHistoryItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.foodService.deleteHistoryItem(user.sub, id);
  }
}

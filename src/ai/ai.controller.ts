import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AnalyzeTextDto } from '../food/dto/analyze-text.dto';
import { FoodService } from '../food/food.service';
import { AiSuggestQueryDto } from './dto/ai-suggest-query.dto';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller(['ai', 'api/v1/ai'])
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly foodService: FoodService,
  ) {}

  @Get('suggest')
  suggest(@CurrentUser() user: JwtPayload, @Query() query: AiSuggestQueryDto) {
    const dto: AnalyzeTextDto = {
      mealType: query.mealType,
      description: query.description,
      userContext: query.userContext,
    };

    return this.aiService.suggest(user.sub, dto);
  }

  @Delete('suggest/:id')
  deleteSuggestion(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.foodService.deleteHistoryItem(user.sub, id);
  }

  @Post('analyze-text')
  analyzeText(@CurrentUser() user: JwtPayload, @Body() dto: AnalyzeTextDto) {
    return this.aiService.analyzeText(user.sub, dto);
  }

  @Post('image-analysis')
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
    return this.aiService.analyzeImage(user.sub, file);
  }

  @Get('calories')
  calories(@CurrentUser() user: JwtPayload) {
    return this.aiService.calories(user.sub);
  }
}

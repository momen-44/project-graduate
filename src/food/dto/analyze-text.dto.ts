import {
  IsIn,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MealTypeEnum } from '../../common/enums/meal-type.enum';
import { TEXT_ANALYSIS_DESCRIPTION_OPTIONS } from '../text-analysis.service';

export class AnalyzeTextDto {
  @ApiProperty({ enum: TEXT_ANALYSIS_DESCRIPTION_OPTIONS })
  @IsIn(TEXT_ANALYSIS_DESCRIPTION_OPTIONS, {
    message:
      'description must be one of the available food options. Fetch /food/text-options for the list.',
  })
  @IsString({ message: 'Description must be a string' })
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @IsEnum(MealTypeEnum, {
    message: 'mealType must be one of: breakfast, lunch, dinner, snack',
  })
  mealType!: MealTypeEnum;

  @IsOptional()
  @IsNumber({}, { message: 'quantityGrams must be a number (grams)' })
  @Min(1)
  @Max(5000)
  quantityGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userContext?: string;
}

export class FoodSuggestionsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  query?: string;
}

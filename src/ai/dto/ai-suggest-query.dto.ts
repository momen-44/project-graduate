import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MealTypeEnum } from '../../common/enums/meal-type.enum';

export class AiSuggestQueryDto {
  @IsEnum(MealTypeEnum)
  mealType!: MealTypeEnum;

  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userContext?: string;
}

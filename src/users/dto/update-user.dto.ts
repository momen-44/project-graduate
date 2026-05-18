import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityLevelEnum } from '../../common/enums/activity-level.enum';
import { DietaryPreferenceEnum } from '../../common/enums/dietary-preference.enum';
import { GenderEnum } from '../../common/enums/gender.enum';
import { MetabolismRate } from '../../common/enums/MetabolismRate.enum';

export class BaseUserProfileDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  @Max(260)
  height?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(400)
  weight?: number;

  @IsOptional()
  @IsEnum(ActivityLevelEnum)
  activityLevel?: ActivityLevelEnum;

  @IsOptional()
  @IsEnum(MetabolismRate)
  metabolismRate?: MetabolismRate;

  @IsOptional()
  @IsEnum(DietaryPreferenceEnum)
  dietaryPreference?: DietaryPreferenceEnum;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsOptional()
  @IsString()
  profileImagePublicId?: string;
}

export class UpdateUserDto extends PartialType(BaseUserProfileDto) {
  @IsOptional()
  @IsEnum(MetabolismRate)
  metabolismRate?: MetabolismRate;
}

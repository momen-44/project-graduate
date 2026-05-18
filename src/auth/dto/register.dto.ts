import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ActivityLevelEnum } from '../../common/enums/activity-level.enum';
import { DietaryPreferenceEnum } from '../../common/enums/dietary-preference.enum';
import { GenderEnum } from '../../common/enums/gender.enum';
import { MetabolismRate } from '../../common/enums/MetabolismRate.enum';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(260)
  height?: number;

  @IsOptional()
  @IsInt()
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

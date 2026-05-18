import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2048)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}

export class VerifyResetCodeDto {
  @IsString()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

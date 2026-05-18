import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyResetCodeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

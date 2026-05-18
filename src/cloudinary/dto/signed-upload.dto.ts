import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SignedUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  folder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  publicId?: string;
}

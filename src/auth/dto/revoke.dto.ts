import { IsOptional, IsString } from 'class-validator';

export class RevokeDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @IsOptional()
  @IsString()
  session_id?: string;
}

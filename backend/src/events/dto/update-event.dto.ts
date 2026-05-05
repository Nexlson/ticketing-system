import { IsString, IsUUID, IsDateString, IsOptional, IsIn } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  venue_id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_color_1?: string;

  @IsOptional()
  @IsString()
  cover_color_2?: string;
}

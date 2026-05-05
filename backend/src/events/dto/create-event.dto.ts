import {
  IsString, IsDateString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTierDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  tier_key?: string;
}

export class CreateEventDto {
  @IsString()
  venue_id: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'])
  status?: string;

  @IsString()
  title: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTierDto)
  tiers?: CreateTierDto[];
}

import { IsArray, IsString, ArrayMinSize, IsOptional } from 'class-validator';

export class HoldTierDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seat_labels: string[];

  @IsOptional()
  @IsString()
  queue_token?: string;
}

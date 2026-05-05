import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsNumber()
  @Min(1)
  capacity: number;
}

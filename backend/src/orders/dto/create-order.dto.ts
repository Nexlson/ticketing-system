import { IsString, IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  payment_token: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticket_ids: string[];
}

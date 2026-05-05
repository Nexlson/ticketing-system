import { IsInt, Min } from 'class-validator';

export class LockTicketDto {
  @IsInt()
  @Min(0)
  expected_version: number;
}

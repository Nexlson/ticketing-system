import { TicketEntity } from './ticket.entity';

export abstract class TicketRepository {
  abstract findById(id: string): Promise<TicketEntity | null>;
  abstract findByTierId(tierId: string): Promise<TicketEntity[]>;
  abstract lock(ticketId: string, expectedVersion: number): Promise<TicketEntity>;
  abstract unlock(ticketId: string): Promise<TicketEntity>;
  abstract findManyByIds(ids: string[]): Promise<TicketEntity[]>;
  abstract findAvailableByTierId(tierId: string): Promise<TicketEntity[]>;
  abstract findByTierIdAndSeatLabels(tierId: string, seatLabels: string[]): Promise<TicketEntity[]>;
  abstract markSold(ticketIds: string[], orderId: string): Promise<void>;
}

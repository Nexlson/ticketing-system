import { TicketTierEntity } from './ticket-tier.entity';
import { TicketEntity } from './ticket.entity';

export abstract class TicketTierRepository {
  abstract findByEventId(eventId: string): Promise<TicketTierEntity[]>;
  abstract findById(id: string): Promise<TicketTierEntity | null>;
  abstract findAvailableTicketsByTierId(tierId: string, qty: number): Promise<TicketEntity[]>;
}

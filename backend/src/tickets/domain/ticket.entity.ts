export type TicketStatus = 'AVAILABLE' | 'LOCKED' | 'SOLD';

export class TicketEntity {
  id: string;
  tierId: string;
  seatLabel: string | null;
  status: TicketStatus;
  orderId: string | null;
  version: number;
  tierPrice?: number;
}

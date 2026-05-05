export class TicketTierEntity {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  availableCount: number;
  color: string | null;
  tierKey: string | null;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export class EventEntity {
  id: string;
  venueId: string;
  organizerId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: EventStatus;
  category: string | null;
  description: string | null;
  coverColor1: string | null;
  coverColor2: string | null;
  venueName?: string | null;
  venueCity?: string | null;
}

import { EventEntity } from './event.entity';

export abstract class EventRepository {
  abstract findAll(venueId?: string): Promise<EventEntity[]>;
  abstract findById(id: string): Promise<EventEntity | null>;
  abstract create(data: Omit<EventEntity, 'id' | 'status'>): Promise<EventEntity>;
  abstract update(id: string, data: Partial<Omit<EventEntity, 'id'>>): Promise<EventEntity>;
}

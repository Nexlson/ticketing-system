import { VenueEntity } from './venue.entity';

export abstract class VenueRepository {
  abstract findById(id: string): Promise<VenueEntity | null>;
  abstract findAll(): Promise<VenueEntity[]>;
  abstract create(data: Omit<VenueEntity, 'id'>): Promise<VenueEntity>;
  abstract update(id: string, data: Partial<Omit<VenueEntity, 'id'>>): Promise<VenueEntity | null>;
}

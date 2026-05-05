import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VenueRepository } from '../domain/venue.repository';
import { VenueEntity } from '../domain/venue.entity';

@Injectable()
export class PrismaVenueRepository extends VenueRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<VenueEntity | null> {
    const row = await this.prisma.venue.findUnique({ where: { id } });
    if (!row) return null;
    return { ...row, city: row.city ?? null };
  }

  async findAll(): Promise<VenueEntity[]> {
    const rows = await this.prisma.venue.findMany();
    return rows.map((r) => ({ ...r, city: r.city ?? null }));
  }

  async create(data: Omit<VenueEntity, 'id'>): Promise<VenueEntity> {
    const row = await this.prisma.venue.create({ data });
    return { ...row, city: row.city ?? null };
  }

  async update(id: string, data: Partial<Omit<VenueEntity, 'id'>>): Promise<VenueEntity | null> {
    try {
      const row = await this.prisma.venue.update({ where: { id }, data });
      return { ...row, city: row.city ?? null };
    } catch {
      return null;
    }
  }
}

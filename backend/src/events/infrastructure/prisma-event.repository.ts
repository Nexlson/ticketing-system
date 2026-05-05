import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRepository } from '../domain/event.repository';
import { EventEntity } from '../domain/event.entity';

@Injectable()
export class PrismaEventRepository extends EventRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(venueId?: string): Promise<EventEntity[]> {
    const rows = await this.prisma.event.findMany({
      where: venueId ? { venueId } : undefined,
      include: { venue: { select: { name: true, city: true } } },
    });
    return rows.map((r) => ({
      ...r,
      venueName: r.venue?.name ?? null,
      venueCity: r.venue?.city ?? null,
    })) as EventEntity[];
  }

  async findById(id: string): Promise<EventEntity | null> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: { venue: { select: { name: true, city: true } } },
    });
    if (!row) return null;
    return { ...row, venueName: row.venue?.name ?? null, venueCity: row.venue?.city ?? null } as EventEntity;
  }

  async create(data: Omit<EventEntity, 'id' | 'status'>): Promise<EventEntity> {
    const row = await this.prisma.event.create({ data });
    return row as EventEntity;
  }

  async update(id: string, data: Partial<Omit<EventEntity, 'id'>>): Promise<EventEntity> {
    const row = await this.prisma.event.update({ where: { id }, data });
    return row as EventEntity;
  }
}

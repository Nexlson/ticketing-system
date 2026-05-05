import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketTierRepository } from '../domain/ticket-tier.repository';
import { TicketTierEntity } from '../domain/ticket-tier.entity';
import { TicketEntity } from '../domain/ticket.entity';

@Injectable()
export class PrismaTicketTierRepository extends TicketTierRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEventId(eventId: string): Promise<TicketTierEntity[]> {
    const tiers = await this.prisma.ticketTier.findMany({
      where: { eventId },
      include: { _count: { select: { tickets: { where: { status: 'AVAILABLE' } } } } },
    });
    return tiers.map((t) => ({
      id: t.id,
      eventId: t.eventId,
      name: t.name,
      price: t.price,
      quantity: t.quantity,
      availableCount: t._count.tickets,
      color: t.color ?? null,
      tierKey: t.tierKey ?? null,
    }));
  }

  async findById(id: string): Promise<TicketTierEntity | null> {
    const t = await this.prisma.ticketTier.findUnique({
      where: { id },
      include: { _count: { select: { tickets: { where: { status: 'AVAILABLE' } } } } },
    });
    if (!t) return null;
    return {
      id: t.id,
      eventId: t.eventId,
      name: t.name,
      price: t.price,
      quantity: t.quantity,
      availableCount: t._count.tickets,
      color: t.color ?? null,
      tierKey: t.tierKey ?? null,
    };
  }

  async findAvailableTicketsByTierId(tierId: string, qty: number): Promise<TicketEntity[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { tierId, status: 'AVAILABLE' },
      take: qty,
    });
    return tickets as TicketEntity[];
  }
}

import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketRepository } from '../domain/ticket.repository';
import { TicketEntity } from '../domain/ticket.entity';

@Injectable()
export class PrismaTicketRepository extends TicketRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<TicketEntity | null> {
    return this.prisma.ticket.findUnique({ where: { id } }) as Promise<TicketEntity | null>;
  }

  async findByTierId(tierId: string): Promise<TicketEntity[]> {
    return this.prisma.ticket.findMany({ where: { tierId } }) as Promise<TicketEntity[]>;
  }

  async findAvailableByTierId(tierId: string): Promise<TicketEntity[]> {
    return this.prisma.ticket.findMany({ where: { tierId, status: 'AVAILABLE' } }) as Promise<TicketEntity[]>;
  }

  async lock(ticketId: string, expectedVersion: number): Promise<TicketEntity> {
    try {
      return await this.prisma.ticket.update({
        where: { id: ticketId, version: expectedVersion, status: 'AVAILABLE' },
        data: { status: 'LOCKED', version: { increment: 1 } },
      }) as TicketEntity;
    } catch {
      throw new ConflictException('Ticket already locked or version mismatch');
    }
  }

  async unlock(ticketId: string): Promise<TicketEntity> {
    return this.prisma.ticket.update({
      where: { id: ticketId, status: 'LOCKED' },
      data: { status: 'AVAILABLE', version: { increment: 1 } },
    }) as Promise<TicketEntity>;
  }

  async findByTierIdAndSeatLabels(tierId: string, seatLabels: string[]): Promise<TicketEntity[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { tierId, seatLabel: { in: seatLabels }, status: 'AVAILABLE' },
    });
    return rows as TicketEntity[];
  }

  async findManyByIds(ids: string[]): Promise<TicketEntity[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { id: { in: ids } },
      include: { tier: { select: { price: true } } },
    });
    return rows.map((r) => ({ ...r, tierPrice: r.tier.price }));
  }

  async markSold(ticketIds: string[], orderId: string): Promise<void> {
    await this.prisma.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: 'SOLD', orderId },
    });
  }
}

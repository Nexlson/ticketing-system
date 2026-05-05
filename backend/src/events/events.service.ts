import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { EventRepository } from './domain/event.repository';
import { EventEntity } from './domain/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { TicketTierRepository } from '../tickets/domain/ticket-tier.repository';
import { TicketTierEntity } from '../tickets/domain/ticket-tier.entity';
import { PrismaService } from '../prisma/prisma.service';

// Stadium layout matching the frontend STADIUM constant
const STADIUM_SECTIONS = [
  { id: 'A', tier: 'vip',      rows: 4, perRow: 12 },
  { id: 'B', tier: 'premium',  rows: 5, perRow: 14 },
  { id: 'C', tier: 'standard', rows: 5, perRow: 16 },
  { id: 'D', tier: 'general',  rows: 4, perRow: 12 },
];

@Injectable()
export class EventsService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly tierRepo: TicketTierRepository,
    private readonly prisma: PrismaService,
  ) {}

  private toResponse(ev: EventEntity) {
    return {
      id: ev.id,
      venue_id: ev.venueId,
      venue_name: ev.venueName ?? null,
      venue_city: ev.venueCity ?? null,
      organizer_id: ev.organizerId,
      title: ev.title,
      start_time: ev.startTime,
      end_time: ev.endTime,
      status: ev.status,
      category: ev.category,
      description: ev.description,
      cover_color_1: ev.coverColor1,
      cover_color_2: ev.coverColor2,
    };
  }

  async findAll(venueId?: string) {
    const events = await this.eventRepo.findAll(venueId);
    return events.map((ev) => this.toResponse(ev));
  }

  async getTiers(eventId: string): Promise<TicketTierEntity[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    return this.tierRepo.findByEventId(eventId);
  }

  async getOccupiedSeats(eventId: string): Promise<string[]> {
    const tiers = await this.tierRepo.findByEventId(eventId);
    const tierIds = tiers.map((t) => t.id);
    const rows = await this.prisma.ticket.findMany({
      where: { tierId: { in: tierIds }, status: 'SOLD', seatLabel: { not: null } },
      select: { seatLabel: true },
    });
    return rows.map((r) => r.seatLabel as string);
  }

  async create(dto: CreateEventDto, user: JwtPayload) {
    if (new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new UnprocessableEntityException('end_time must be after start_time');
    }

    const tiers = dto.tiers ?? [];

    // Use a Prisma transaction to create event, tiers, and tickets atomically
    const event = await this.prisma.$transaction(async (tx) => {
      const createdEvent = await tx.event.create({
        data: {
          venueId: dto.venue_id,
          organizerId: user.sub,
          title: dto.title,
          startTime: new Date(dto.start_time),
          endTime: new Date(dto.end_time),
          status: (dto.status as EventEntity['status']) ?? 'DRAFT',
          category: dto.category ?? null,
          description: dto.description ?? null,
          coverColor1: dto.cover_color_1 ?? null,
          coverColor2: dto.cover_color_2 ?? null,
        },
      });

      for (let i = 0; i < tiers.length; i++) {
        const tierDto = tiers[i];
        const section = STADIUM_SECTIONS[i];

        const createdTier = await tx.ticketTier.create({
          data: {
            eventId: createdEvent.id,
            name: tierDto.name,
            price: Math.round(tierDto.price * 100), // store in cents
            quantity: tierDto.quantity,
            color: tierDto.color ?? null,
            tierKey: tierDto.tier_key ?? (section?.tier ?? null),
          },
        });

        // Generate seat tickets for this tier based on stadium section layout
        if (section) {
          const ticketData: { tierId: string; seatLabel: string; status: TicketStatus }[] = [];
          for (let row = 1; row <= section.rows; row++) {
            for (let col = 1; col <= section.perRow; col++) {
              if (ticketData.length >= tierDto.quantity) break;
              ticketData.push({
                tierId: createdTier.id,
                seatLabel: `${section.id}-${row}-${col}`,
                status: TicketStatus.AVAILABLE,
              });
            }
            if (ticketData.length >= tierDto.quantity) break;
          }
          if (ticketData.length > 0) {
            await tx.ticket.createMany({ data: ticketData });
          }
        }
      }

      return createdEvent;
    });

    return this.toResponse(event as EventEntity);
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.eventRepo.findById(id);
    if (!existing) throw new NotFoundException('Event not found');

    if (dto.start_time && dto.end_time && new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new UnprocessableEntityException('end_time must be after start_time');
    }

    const updated = await this.eventRepo.update(id, {
      ...(dto.venue_id && { venueId: dto.venue_id }),
      ...(dto.title && { title: dto.title }),
      ...(dto.start_time && { startTime: new Date(dto.start_time) }),
      ...(dto.end_time && { endTime: new Date(dto.end_time) }),
      ...(dto.status && { status: dto.status as EventEntity['status'] }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.cover_color_1 !== undefined && { coverColor1: dto.cover_color_1 }),
      ...(dto.cover_color_2 !== undefined && { coverColor2: dto.cover_color_2 }),
    });
    return this.toResponse(updated);
  }
}

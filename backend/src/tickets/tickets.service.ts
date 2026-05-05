import {
  Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException, HttpException, HttpStatus,
} from '@nestjs/common';
import { TicketRepository } from './domain/ticket.repository';
import { TicketEntity } from './domain/ticket.entity';
import { TicketTierRepository } from './domain/ticket-tier.repository';
import { LockTicketDto } from './dto/lock-ticket.dto';
import { HoldTierDto } from './dto/hold-tier.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { CacheService } from '../cache/cache.service';

const LOCK_DURATION_MS = 10 * 60 * 1000;
const LOCK_DURATION_S = LOCK_DURATION_MS / 1000;

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly tierRepo: TicketTierRepository,
    private readonly cacheService: CacheService,
  ) {}

  async findById(ticketId: string): Promise<TicketEntity> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async lock(ticketId: string, dto: LockTicketDto, user: JwtPayload): Promise<TicketEntity> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    const locked = await this.ticketRepo.lock(ticketId, dto.expected_version);
    await this.cacheService.setHold(ticketId, user.sub, LOCK_DURATION_S);
    return locked;
  }

  async unlock(ticketId: string, user: JwtPayload): Promise<void> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'LOCKED') throw new NotFoundException('Ticket not currently locked');
    const holder = await this.cacheService.getHold(ticketId);
    if (holder !== user.sub) throw new ForbiddenException('You do not own this lock');
    await this.ticketRepo.unlock(ticketId);
    await this.cacheService.deleteHold(ticketId);
  }

  async holdTicket(
    tierId: string,
    dto: HoldTierDto,
    user: JwtPayload,
  ): Promise<{ tickets: TicketEntity[]; expiresAt: string }> {
    const tier = await this.tierRepo.findById(tierId);
    if (!tier) throw new NotFoundException('Tier not found');

    const inflight = await this.cacheService.enterHoldInflight(tier.eventId);
    if (inflight > 1) {
      await this.cacheService.exitHoldInflight(tier.eventId);
      throw new HttpException(
        { message: 'High demand — join the queue', queueAvailable: true },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const queueToken = dto.queue_token ?? null;
      const hasWindow = queueToken
        ? await this.cacheService.isQueueWindowActive(tierId, queueToken)
        : false;

      if (!hasWindow) {
        const queueLen = await this.cacheService.getQueueLength(tierId);
        if (tier.availableCount === 0 || queueLen > 0) {
          throw new HttpException(
            { message: 'High demand — join the queue', queueAvailable: true },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      }

      const tickets = await this.ticketRepo.findByTierIdAndSeatLabels(tierId, dto.seat_labels);

      const unavailable = dto.seat_labels.filter(
        (label) => !tickets.some((t) => t.seatLabel === label),
      );
      if (unavailable.length > 0) {
        throw new UnprocessableEntityException(
          `Seats already taken or not found: ${unavailable.join(', ')}`,
        );
      }

      const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
      const held: string[] = [];

      for (const ticket of tickets) {
        const ok = await this.cacheService.setHold(ticket.id, user.sub, LOCK_DURATION_S);
        if (!ok) {
          for (const id of held) await this.cacheService.deleteHold(id);
          throw new HttpException(
            { message: 'High demand — join the queue', queueAvailable: true },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        held.push(ticket.id);
      }

      if (hasWindow && queueToken) {
        await this.cacheService.deleteQueueWindow(tierId, queueToken);
        await this.cacheService.leaveQueue(tierId, queueToken);
      }

      return { tickets, expiresAt: expiresAt.toISOString() };
    } finally {
      await this.cacheService.exitHoldInflight(tier.eventId);
    }
  }

  async joinQueue(tierId: string): Promise<{ queueToken: string; position: number; estimatedWaitSec: number }> {
    const tier = await this.tierRepo.findById(tierId);
    if (!tier) throw new NotFoundException('Tier not found');

    const queueLen = await this.cacheService.getQueueLength(tierId);
    if (queueLen >= 500) {
      throw new HttpException({ message: 'Queue is full, try again later' }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const queueToken = crypto.randomUUID();
    const rank = await this.cacheService.joinQueue(tierId, queueToken);
    const position = rank + 1;
    return { queueToken, position, estimatedWaitSec: position * 30 };
  }

  async getQueueStatus(tierId: string, token: string): Promise<{
    position: number | null;
    isActive: boolean;
    expiresAt: string | null;
  }> {
    const isActive = await this.cacheService.isQueueWindowActive(tierId, token);
    if (isActive) {
      const ttl = await this.cacheService.getQueueWindowTtl(tierId, token);
      return { position: 0, isActive: true, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    }

    const rank = await this.cacheService.getQueueRank(tierId, token);
    if (rank === null) return { position: null, isActive: false, expiresAt: null };

    const availableTickets = await this.ticketRepo.findAvailableByTierId(tierId);
    const freeCount = await this.cacheService.countFreeTickets(availableTickets.map((t) => t.id));
    if (rank < freeCount) {
      await this.cacheService.setQueueWindow(tierId, token, LOCK_DURATION_S);
      const ttl = await this.cacheService.getQueueWindowTtl(tierId, token);
      return { position: 0, isActive: true, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
    }

    return { position: rank + 1, isActive: false, expiresAt: null };
  }

  async leaveQueue(tierId: string, token: string): Promise<void> {
    await this.cacheService.leaveQueue(tierId, token);
    await this.cacheService.deleteQueueWindow(tierId, token);
  }
}

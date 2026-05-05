import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketRepository } from './domain/ticket.repository';
import { TicketTierRepository } from './domain/ticket-tier.repository';
import { CacheService } from '../cache/cache.service';
import { TicketEntity } from './domain/ticket.entity';
import { TicketTierEntity } from './domain/ticket-tier.entity';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const mockUser: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER' };

const mockTicket: TicketEntity = {
  id: 'ticket-1',
  tierId: 'tier-1',
  seatLabel: 'A-1-1',
  status: 'AVAILABLE',
  orderId: null,
  version: 0,
};

const mockTier: TicketTierEntity = {
  id: 'tier-1',
  eventId: 'evt-1',
  name: 'VIP',
  price: 10000,
  quantity: 48,
  availableCount: 10,
  color: null,
  tierKey: 'vip',
};

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: jest.fn().mockReturnValue('mock-uuid') },
      writable: true,
      configurable: true,
    });
  } else {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('mock-uuid' as any);
  }
});

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepo: jest.Mocked<TicketRepository>;
  let tierRepo: jest.Mocked<TicketTierRepository>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    ticketRepo = {
      findById: jest.fn(),
      findByTierId: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
      findManyByIds: jest.fn(),
      findAvailableByTierId: jest.fn(),
      findByTierIdAndSeatLabels: jest.fn(),
      markSold: jest.fn(),
    } as any;

    tierRepo = {
      findByEventId: jest.fn(),
      findById: jest.fn(),
      findAvailableTicketsByTierId: jest.fn(),
    } as any;

    cacheService = {
      setHold: jest.fn(),
      getHold: jest.fn(),
      deleteHold: jest.fn(),
      joinQueue: jest.fn(),
      leaveQueue: jest.fn(),
      getQueueRank: jest.fn(),
      getQueueLength: jest.fn(),
      setQueueWindow: jest.fn(),
      isQueueWindowActive: jest.fn(),
      getQueueWindowTtl: jest.fn(),
      deleteQueueWindow: jest.fn(),
      enterHoldInflight: jest.fn(),
      exitHoldInflight: jest.fn(),
      countFreeTickets: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: TicketRepository, useValue: ticketRepo },
        { provide: TicketTierRepository, useValue: tierRepo },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('findById()', () => {
    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(service.findById('ticket-x')).rejects.toThrow(NotFoundException);
    });

    it('should return ticket when found', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicket);

      const result = await service.findById('ticket-1');

      expect(result).toEqual(mockTicket);
    });
  });

  describe('lock()', () => {
    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(service.lock('ticket-x', { expected_version: 0 }, mockUser))
        .rejects.toThrow(NotFoundException);
    });

    it('should lock ticket using expected_version and set Redis hold', async () => {
      const lockedTicket: TicketEntity = { ...mockTicket, status: 'LOCKED', version: 1 };
      ticketRepo.findById.mockResolvedValue(mockTicket);
      ticketRepo.lock.mockResolvedValue(lockedTicket);
      cacheService.setHold.mockResolvedValue(true);

      const result = await service.lock('ticket-1', { expected_version: 0 }, mockUser);

      expect(ticketRepo.lock).toHaveBeenCalledWith('ticket-1', 0);
      expect(cacheService.setHold).toHaveBeenCalledWith('ticket-1', 'user-1', 600);
      expect(result.status).toBe('LOCKED');
    });
  });

  describe('unlock()', () => {
    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(service.unlock('ticket-x', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when ticket is not currently locked', async () => {
      ticketRepo.findById.mockResolvedValue({ ...mockTicket, status: 'AVAILABLE' });

      await expect(service.unlock('ticket-1', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when caller does not own the lock', async () => {
      ticketRepo.findById.mockResolvedValue({ ...mockTicket, status: 'LOCKED' });
      cacheService.getHold.mockResolvedValue('other-user');

      await expect(service.unlock('ticket-1', mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should unlock ticket and delete Redis hold when caller owns the lock', async () => {
      ticketRepo.findById.mockResolvedValue({ ...mockTicket, status: 'LOCKED' });
      cacheService.getHold.mockResolvedValue('user-1');
      ticketRepo.unlock.mockResolvedValue({ ...mockTicket, status: 'AVAILABLE' });
      cacheService.deleteHold.mockResolvedValue(undefined);

      await service.unlock('ticket-1', mockUser);

      expect(ticketRepo.unlock).toHaveBeenCalledWith('ticket-1');
      expect(cacheService.deleteHold).toHaveBeenCalledWith('ticket-1');
    });
  });

  describe('holdTicket()', () => {
    const holdDto = { seat_labels: ['A-1-1'] };

    it('should throw NotFoundException when tier does not exist', async () => {
      tierRepo.findById.mockResolvedValue(null);

      await expect(service.holdTicket('tier-x', holdDto, mockUser))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw 503 and exit inflight immediately when inflight count exceeds 1', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(2);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await expect(service.holdTicket('tier-1', holdDto, mockUser))
        .rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });

      expect(cacheService.exitHoldInflight).toHaveBeenCalledWith('evt-1');
      expect(cacheService.exitHoldInflight).toHaveBeenCalledTimes(1);
    });

    it('should throw 503 when no queue window and tier has zero availability', async () => {
      tierRepo.findById.mockResolvedValue({ ...mockTier, availableCount: 0 });
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(0);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await expect(service.holdTicket('tier-1', holdDto, mockUser))
        .rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });

      expect(cacheService.exitHoldInflight).toHaveBeenCalledWith('evt-1');
    });

    it('should throw 503 when no queue window and queue already has users', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(5);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await expect(service.holdTicket('tier-1', holdDto, mockUser))
        .rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });

    it('should throw UnprocessableEntityException when requested seats are already taken', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(0);
      ticketRepo.findByTierIdAndSeatLabels.mockResolvedValue([]);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await expect(service.holdTicket('tier-1', holdDto, mockUser))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should return tickets and expiresAt ISO string when hold succeeds', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(0);
      ticketRepo.findByTierIdAndSeatLabels.mockResolvedValue([mockTicket]);
      cacheService.setHold.mockResolvedValue(true);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      const result = await service.holdTicket('tier-1', holdDto, mockUser);

      expect(result.tickets).toEqual([mockTicket]);
      expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(cacheService.setHold).toHaveBeenCalledWith('ticket-1', 'user-1', 600);
    });

    it('should always call exitHoldInflight in the finally block on success', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(0);
      ticketRepo.findByTierIdAndSeatLabels.mockResolvedValue([mockTicket]);
      cacheService.setHold.mockResolvedValue(true);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await service.holdTicket('tier-1', holdDto, mockUser);

      expect(cacheService.exitHoldInflight).toHaveBeenCalledWith('evt-1');
    });

    it('should rollback held tickets and throw 503 when setHold fails mid-batch', async () => {
      const ticket2: TicketEntity = { ...mockTicket, id: 'ticket-2', seatLabel: 'A-1-2' };
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.getQueueLength.mockResolvedValue(0);
      ticketRepo.findByTierIdAndSeatLabels.mockResolvedValue([mockTicket, ticket2]);
      cacheService.setHold
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      cacheService.deleteHold.mockResolvedValue(undefined);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await expect(
        service.holdTicket('tier-1', { seat_labels: ['A-1-1', 'A-1-2'] }, mockUser),
      ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });

      expect(cacheService.deleteHold).toHaveBeenCalledWith('ticket-1');
    });

    it('should consume queue window when valid queue_token is provided', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.enterHoldInflight.mockResolvedValue(1);
      cacheService.isQueueWindowActive.mockResolvedValue(true);
      ticketRepo.findByTierIdAndSeatLabels.mockResolvedValue([mockTicket]);
      cacheService.setHold.mockResolvedValue(true);
      cacheService.deleteQueueWindow.mockResolvedValue(undefined);
      cacheService.leaveQueue.mockResolvedValue(undefined);
      cacheService.exitHoldInflight.mockResolvedValue(undefined);

      await service.holdTicket('tier-1', { seat_labels: ['A-1-1'], queue_token: 'tok-1' }, mockUser);

      expect(cacheService.deleteQueueWindow).toHaveBeenCalledWith('tier-1', 'tok-1');
      expect(cacheService.leaveQueue).toHaveBeenCalledWith('tier-1', 'tok-1');
    });
  });

  describe('joinQueue()', () => {
    it('should throw NotFoundException when tier does not exist', async () => {
      tierRepo.findById.mockResolvedValue(null);

      await expect(service.joinQueue('tier-x')).rejects.toThrow(NotFoundException);
    });

    it('should throw 503 when queue is at capacity (500)', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.getQueueLength.mockResolvedValue(500);

      await expect(service.joinQueue('tier-1'))
        .rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });

    it('should return queue token, 1-indexed position, and estimated wait', async () => {
      tierRepo.findById.mockResolvedValue(mockTier);
      cacheService.getQueueLength.mockResolvedValue(3);
      cacheService.joinQueue.mockResolvedValue(3);

      const result = await service.joinQueue('tier-1');

      expect(result.position).toBe(4);
      expect(result.estimatedWaitSec).toBe(120);
      expect(typeof result.queueToken).toBe('string');
    });
  });

  describe('getQueueStatus()', () => {
    it('should return active status and expiresAt when queue window is active', async () => {
      cacheService.isQueueWindowActive.mockResolvedValue(true);
      cacheService.getQueueWindowTtl.mockResolvedValue(300);

      const result = await service.getQueueStatus('tier-1', 'token-1');

      expect(result.isActive).toBe(true);
      expect(result.position).toBe(0);
      expect(result.expiresAt).toBeTruthy();
    });

    it('should return null position when token is not in queue', async () => {
      cacheService.isQueueWindowActive.mockResolvedValue(false);
      cacheService.getQueueRank.mockResolvedValue(null);

      const result = await service.getQueueStatus('tier-1', 'unknown-token');

      expect(result).toEqual({ position: null, isActive: false, expiresAt: null });
    });

    it('should activate window and return active when rank is less than free ticket count', async () => {
      cacheService.isQueueWindowActive.mockResolvedValue(false);
      cacheService.getQueueRank.mockResolvedValue(2);
      ticketRepo.findAvailableByTierId.mockResolvedValue([mockTicket, { ...mockTicket, id: 'ticket-2' }]);
      cacheService.countFreeTickets.mockResolvedValue(5);
      cacheService.setQueueWindow.mockResolvedValue(true);
      cacheService.getQueueWindowTtl.mockResolvedValue(600);

      const result = await service.getQueueStatus('tier-1', 'token-1');

      expect(result.isActive).toBe(true);
      expect(result.position).toBe(0);
      expect(cacheService.setQueueWindow).toHaveBeenCalledWith('tier-1', 'token-1', 600);
    });

    it('should return 1-indexed queue position when rank is at or beyond free count', async () => {
      cacheService.isQueueWindowActive.mockResolvedValue(false);
      cacheService.getQueueRank.mockResolvedValue(15);
      ticketRepo.findAvailableByTierId.mockResolvedValue([mockTicket]);
      cacheService.countFreeTickets.mockResolvedValue(3);

      const result = await service.getQueueStatus('tier-1', 'token-1');

      expect(result.position).toBe(16);
      expect(result.isActive).toBe(false);
      expect(result.expiresAt).toBeNull();
    });
  });

  describe('leaveQueue()', () => {
    it('should remove token from queue and delete queue window', async () => {
      cacheService.leaveQueue.mockResolvedValue(undefined);
      cacheService.deleteQueueWindow.mockResolvedValue(undefined);

      await service.leaveQueue('tier-1', 'token-1');

      expect(cacheService.leaveQueue).toHaveBeenCalledWith('tier-1', 'token-1');
      expect(cacheService.deleteQueueWindow).toHaveBeenCalledWith('tier-1', 'token-1');
    });
  });
});

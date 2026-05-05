import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketEntity } from './domain/ticket.entity';
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

describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: jest.Mocked<TicketsService>;

  beforeEach(async () => {
    ticketsService = {
      findById: jest.fn().mockResolvedValue(mockTicket),
      lock: jest.fn().mockResolvedValue({ ...mockTicket, status: 'LOCKED' }),
      unlock: jest.fn().mockResolvedValue(undefined),
      holdTicket: jest.fn().mockResolvedValue({
        tickets: [mockTicket],
        expiresAt: '2025-06-01T18:10:00.000Z',
      }),
      joinQueue: jest.fn().mockResolvedValue({
        queueToken: 'tok-abc',
        position: 1,
        estimatedWaitSec: 30,
      }),
      getQueueStatus: jest.fn().mockResolvedValue({
        position: 1,
        isActive: false,
        expiresAt: null,
      }),
      leaveQueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: ticketsService }],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  describe('findById()', () => {
    it('should call ticketsService.findById() with the ticketId param', async () => {
      await controller.findById('ticket-1');

      expect(ticketsService.findById).toHaveBeenCalledWith('ticket-1');
    });

    it('should return ticket from service', async () => {
      const result = await controller.findById('ticket-1');

      expect(result).toEqual(mockTicket);
    });
  });

  describe('lock()', () => {
    it('should call ticketsService.lock() with ticketId, DTO, and user', async () => {
      const dto = { expected_version: 0 };

      await controller.lock('ticket-1', dto, mockUser);

      expect(ticketsService.lock).toHaveBeenCalledWith('ticket-1', dto, mockUser);
    });
  });

  describe('unlock()', () => {
    it('should call ticketsService.unlock() with ticketId and user', async () => {
      await controller.unlock('ticket-1', mockUser);

      expect(ticketsService.unlock).toHaveBeenCalledWith('ticket-1', mockUser);
    });
  });

  describe('holdTicket()', () => {
    it('should call ticketsService.holdTicket() with tierId, DTO, and user', async () => {
      const dto = { seat_labels: ['A-1-1'] };

      await controller.holdTicket('tier-1', dto, mockUser);

      expect(ticketsService.holdTicket).toHaveBeenCalledWith('tier-1', dto, mockUser);
    });

    it('should return hold result from service', async () => {
      const result = await controller.holdTicket('tier-1', { seat_labels: ['A-1-1'] }, mockUser);

      expect(result).toMatchObject({ tickets: [mockTicket] });
    });
  });

  describe('joinQueue()', () => {
    it('should call ticketsService.joinQueue() with tierId param', async () => {
      await controller.joinQueue('tier-1');

      expect(ticketsService.joinQueue).toHaveBeenCalledWith('tier-1');
    });
  });

  describe('getQueueStatus()', () => {
    it('should call ticketsService.getQueueStatus() with tierId and token query param', async () => {
      await controller.getQueueStatus('tier-1', 'tok-abc');

      expect(ticketsService.getQueueStatus).toHaveBeenCalledWith('tier-1', 'tok-abc');
    });
  });

  describe('leaveQueue()', () => {
    it('should call ticketsService.leaveQueue() with tierId and token query param', async () => {
      await controller.leaveQueue('tier-1', 'tok-abc');

      expect(ticketsService.leaveQueue).toHaveBeenCalledWith('tier-1', 'tok-abc');
    });
  });
});

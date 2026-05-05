import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderRepository } from './domain/order.repository';
import { OrderEntity } from './domain/order.entity';
import { TicketRepository } from '../tickets/domain/ticket.repository';
import { TicketEntity } from '../tickets/domain/ticket.entity';
import { CacheService } from '../cache/cache.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const mockUser: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER' };

const mockOrder: OrderEntity = {
  id: 'order-1',
  userId: 'user-1',
  totalAmount: 108,
  status: 'PENDING',
  paymentReferenceId: 'pay-ref',
  createdAt: new Date(),
};

const mockTicket: TicketEntity & { tierPrice: number } = {
  id: 'ticket-1',
  tierId: 'tier-1',
  seatLabel: 'A-1-1',
  status: 'AVAILABLE',
  orderId: null,
  version: 0,
  tierPrice: 100,
};

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: jest.Mocked<OrderRepository>;
  let ticketRepo: jest.Mocked<TicketRepository>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    orderRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    ticketRepo = {
      findById: jest.fn(),
      findByTierId: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
      findManyByIds: jest.fn(),
      findByTierIdAndSeatLabels: jest.fn(),
      markSold: jest.fn(),
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
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrderRepository, useValue: orderRepo },
        { provide: TicketRepository, useValue: ticketRepo },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('findById()', () => {
    it('should throw NotFoundException when order does not exist', async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(service.findById('order-x', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when order belongs to a different user', async () => {
      orderRepo.findById.mockResolvedValue({ ...mockOrder, userId: 'other-user' });

      await expect(service.findById('order-1', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should return order when found and userId matches', async () => {
      orderRepo.findById.mockResolvedValue(mockOrder);

      const result = await service.findById('order-1', 'user-1');

      expect(result).toEqual(mockOrder);
    });
  });

  describe('findByCurrentUser()', () => {
    it('should return all orders for the current user', async () => {
      orderRepo.findByUserId.mockResolvedValue([mockOrder]);

      const result = await service.findByCurrentUser(mockUser);

      expect(result).toEqual([mockOrder]);
      expect(orderRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('create()', () => {
    const dto = { ticket_ids: ['ticket-1'], payment_token: 'pay-token' };

    it('should throw NotFoundException when not all requested tickets are found', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([]);

      await expect(service.create(dto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException when ticket hold has expired', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue(null);

      await expect(service.create(dto, mockUser))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when ticket is held by a different user', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue('other-user');

      await expect(service.create(dto, mockUser))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should create order with correct userId and payment token', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      await service.create(dto, mockUser);

      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', paymentReferenceId: 'pay-token' }),
      );
    });

    it('should mark tickets as sold with the new order id', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      await service.create(dto, mockUser);

      expect(ticketRepo.markSold).toHaveBeenCalledWith(['ticket-1'], 'order-1');
    });

    it('should release Redis holds for all tickets after purchase', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      await service.create(dto, mockUser);

      expect(cacheService.deleteHold).toHaveBeenCalledWith('ticket-1');
    });

    it('should return PAID order after successful purchase', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket]);
      cacheService.getHold.mockResolvedValue('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      const result = await service.create(dto, mockUser);

      expect(result.status).toBe('PAID');
      expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'PAID');
    });

    it('should compute total as sum of tier prices plus 8% tax', async () => {
      ticketRepo.findManyByIds.mockResolvedValue([{ ...mockTicket, tierPrice: 100 }]);
      cacheService.getHold.mockResolvedValue('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      await service.create(dto, mockUser);

      // 100 + round(100 * 0.08) = 100 + 8 = 108
      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 108 }),
      );
    });

    it('should compute total correctly for multiple tickets', async () => {
      const ticket2 = { ...mockTicket, id: 'ticket-2', tierPrice: 200 };
      ticketRepo.findManyByIds.mockResolvedValue([mockTicket, ticket2]);
      cacheService.getHold
        .mockResolvedValueOnce('user-1')
        .mockResolvedValueOnce('user-1');
      orderRepo.create.mockResolvedValue(mockOrder);
      ticketRepo.markSold.mockResolvedValue(undefined);
      cacheService.deleteHold.mockResolvedValue(undefined);
      orderRepo.updateStatus.mockResolvedValue({ ...mockOrder, status: 'PAID' });

      await service.create({ ticket_ids: ['ticket-1', 'ticket-2'], payment_token: 'pay' }, mockUser);

      // (100 + 200) + round(300 * 0.08) = 300 + 24 = 324
      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 324 }),
      );
    });
  });
});

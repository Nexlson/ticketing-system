import { Test, TestingModule } from '@nestjs/testing';
import { PrismaOrderRepository } from './prisma-order.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderEntity } from '../domain/order.entity';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockOrder: OrderEntity = {
  id: 'order-1',
  userId: 'user-1',
  totalAmount: 108,
  status: 'PENDING',
  paymentReferenceId: 'pay-ref',
  createdAt: new Date(),
};

describe('PrismaOrderRepository', () => {
  let repo: PrismaOrderRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaOrderRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaOrderRepository>(PrismaOrderRepository);
  });

  describe('findById()', () => {
    it('should return null when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await repo.findById('order-x');

      expect(result).toBeNull();
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({ where: { id: 'order-x' } });
    });

    it('should return order when found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await repo.findById('order-1');

      expect(result).toEqual(mockOrder);
    });
  });

  describe('findByUserId()', () => {
    it('should query with userId filter and desc order', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual([mockOrder]);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create()', () => {
    it('should create order with provided data', async () => {
      mockPrisma.order.create.mockResolvedValue(mockOrder);

      const result = await repo.create({
        userId: 'user-1',
        totalAmount: 108,
        paymentReferenceId: 'pay-ref',
      });

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', totalAmount: 108, paymentReferenceId: 'pay-ref' },
      });
    });
  });

  describe('updateStatus()', () => {
    it('should update order status and return updated order', async () => {
      const paidOrder = { ...mockOrder, status: 'PAID' as const };
      mockPrisma.order.update.mockResolvedValue(paidOrder);

      const result = await repo.updateStatus('order-1', 'PAID');

      expect(result.status).toBe('PAID');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'PAID' },
      });
    });
  });
});

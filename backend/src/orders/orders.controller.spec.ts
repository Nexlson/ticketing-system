import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderEntity } from './domain/order.entity';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const mockUser: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER' };

const mockOrder: OrderEntity = {
  id: 'order-1',
  userId: 'user-1',
  totalAmount: 108,
  status: 'PAID',
  paymentReferenceId: 'pay-ref',
  createdAt: new Date(),
};

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    ordersService = {
      findByCurrentUser: jest.fn().mockResolvedValue([mockOrder]),
      findById: jest.fn().mockResolvedValue(mockOrder),
      create: jest.fn().mockResolvedValue(mockOrder),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  describe('findAll()', () => {
    it('should call ordersService.findByCurrentUser() with the current user', async () => {
      await controller.findAll(mockUser);

      expect(ordersService.findByCurrentUser).toHaveBeenCalledWith(mockUser);
    });

    it('should return orders for the current user', async () => {
      const result = await controller.findAll(mockUser);

      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findById()', () => {
    it('should call ordersService.findById() with orderId and user sub', async () => {
      await controller.findById('order-1', mockUser);

      expect(ordersService.findById).toHaveBeenCalledWith('order-1', 'user-1');
    });

    it('should return the order from service', async () => {
      const result = await controller.findById('order-1', mockUser);

      expect(result).toEqual(mockOrder);
    });
  });

  describe('create()', () => {
    it('should call ordersService.create() with DTO and current user', async () => {
      const dto = { ticket_ids: ['ticket-1'], payment_token: 'pay-token' };

      await controller.create(dto, mockUser);

      expect(ordersService.create).toHaveBeenCalledWith(dto, mockUser);
    });

    it('should return created order from service', async () => {
      const result = await controller.create(
        { ticket_ids: ['ticket-1'], payment_token: 'pay-token' },
        mockUser,
      );

      expect(result).toEqual(mockOrder);
    });
  });
});

# Application Layer Tests

Application layer tests use **Jest with mocked ports**. All repository interfaces, event buses,
and external service ports are replaced with `jest.fn()` mocks. No NestJS testing module needed.

---

## Command Handler Tests

Test every:
- Happy path (entity created/updated, repository called with correct args)
- Entity not found (repository returns null → exception thrown)
- Domain invariant violation (domain exception propagates)
- Domain events published after successful save

### Full Example — `CreateOrderHandler`

```typescript
// create-order.handler.spec.ts
import { CreateOrderHandler } from './create-order.handler';
import { CreateOrderCommand } from './create-order.command';
import { IOrderRepository } from '../../domain/repositories/order.repository.interface';
import { Order } from '../../domain/entities/order.entity';

describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockEventBus: { publishAll: jest.Mock };

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    mockEventBus = { publishAll: jest.fn() };

    handler = new CreateOrderHandler(mockOrderRepository, mockEventBus as any);
  });

  describe('execute()', () => {
    it('should create an order and return its id', async () => {
      mockOrderRepository.save.mockResolvedValue(undefined);
      const command = new CreateOrderCommand('customer-1', []);

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should call repository.save() once', async () => {
      mockOrderRepository.save.mockResolvedValue(undefined);
      const command = new CreateOrderCommand('customer-1', []);

      await handler.execute(command);

      expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should save an Order entity (not a plain object)', async () => {
      mockOrderRepository.save.mockResolvedValue(undefined);
      const command = new CreateOrderCommand('customer-1', []);

      await handler.execute(command);

      const savedEntity = mockOrderRepository.save.mock.calls[0][0];
      expect(savedEntity).toBeInstanceOf(Order);
    });

    it('should publish domain events after saving', async () => {
      mockOrderRepository.save.mockResolvedValue(undefined);
      const command = new CreateOrderCommand('customer-1', []);

      await handler.execute(command);

      expect(mockEventBus.publishAll).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

### Full Example — `UpdateOrderStatusHandler` (with not-found case)

```typescript
// update-order-status.handler.spec.ts
import { UpdateOrderStatusHandler } from './update-order-status.handler';
import { UpdateOrderStatusCommand } from './update-order-status.command';
import { OrderNotFoundException } from '../../domain/exceptions/order-not-found.exception';

describe('UpdateOrderStatusHandler', () => {
  let handler: UpdateOrderStatusHandler;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };
    handler = new UpdateOrderStatusHandler(mockOrderRepository);
  });

  describe('execute()', () => {
    it('should update order status when order exists', async () => {
      const order = new OrderBuilder().build();
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue(undefined);

      const command = new UpdateOrderStatusCommand('order-1', 'PAID');
      await handler.execute(command);

      expect(mockOrderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PAID' }),
      );
    });

    it('should throw OrderNotFoundException when order does not exist', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      const command = new UpdateOrderStatusCommand('nonexistent-id', 'PAID');

      await expect(handler.execute(command)).rejects.toThrow(OrderNotFoundException);
    });

    it('should not call save when order is not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      const command = new UpdateOrderStatusCommand('nonexistent-id', 'PAID');

      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });
  });
});
```

---

## Query Handler Tests

Query handlers return projections/read models — test the shape and content of the response.

```typescript
// get-order.handler.spec.ts
import { GetOrderHandler } from './get-order.handler';
import { GetOrderQuery } from './get-order.query';

describe('GetOrderHandler', () => {
  let handler: GetOrderHandler;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };
    handler = new GetOrderHandler(mockOrderRepository);
  });

  describe('execute()', () => {
    it('should return order data when order exists', async () => {
      const order = new OrderBuilder().withCustomerId('c1').build();
      mockOrderRepository.findById.mockResolvedValue(order);

      const query = new GetOrderQuery('order-1');
      const result = await handler.execute(query);

      expect(result).toMatchObject({
        id: expect.any(String),
        customerId: 'c1',
        status: 'PENDING',
      });
    });

    it('should return null when order does not exist', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      const query = new GetOrderQuery('nonexistent-id');
      const result = await handler.execute(query);

      expect(result).toBeNull();
    });

    it('should call findById with the correct order id', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      const query = new GetOrderQuery('order-abc');
      await handler.execute(query);

      expect(mockOrderRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'order-abc' }),
      );
    });
  });
});
```

---

## Event Handler Tests

```typescript
// order-created.handler.spec.ts
import { OrderCreatedHandler } from './order-created.handler';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';

describe('OrderCreatedHandler', () => {
  let handler: OrderCreatedHandler;
  let mockEmailService: { sendOrderConfirmation: jest.Mock };
  let mockCustomerRepository: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    mockEmailService = { sendOrderConfirmation: jest.fn() };
    mockCustomerRepository = { findById: jest.fn() };
    handler = new OrderCreatedHandler(mockEmailService as any, mockCustomerRepository);
  });

  describe('handle()', () => {
    it('should send a confirmation email to the customer', async () => {
      mockCustomerRepository.findById.mockResolvedValue(
        CustomerMother.create({ email: 'customer@example.com' }),
      );
      mockEmailService.sendOrderConfirmation.mockResolvedValue(undefined);

      const event = new OrderCreatedEvent('order-1', 'customer-1');
      await handler.handle(event);

      expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalledWith(
        'customer@example.com',
        'order-1',
      );
    });

    it('should not send email when customer is not found', async () => {
      mockCustomerRepository.findById.mockResolvedValue(null);

      const event = new OrderCreatedEvent('order-1', 'unknown-customer');
      await handler.handle(event);

      expect(mockEmailService.sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });
});
```

---

## Testing Domain Event Dispatch from Handlers

Verify that a handler properly collects and publishes uncommitted domain events:

```typescript
it('should publish uncommitted domain events after save', async () => {
  const publishAllSpy = jest.spyOn(mockEventBus, 'publishAll');
  mockOrderRepository.save.mockResolvedValue(undefined);

  await handler.execute(new CreateOrderCommand('c1', []));

  expect(publishAllSpy).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ constructor: { name: 'OrderCreatedEvent' } }),
    ]),
  );
});
```

---

## Handling Repository Mock Failures

Always test what happens when the repository throws:

```typescript
it('should propagate repository errors', async () => {
  mockOrderRepository.save.mockRejectedValue(new Error('DB connection lost'));

  const command = new CreateOrderCommand('c1', []);

  await expect(handler.execute(command)).rejects.toThrow('DB connection lost');
});
```

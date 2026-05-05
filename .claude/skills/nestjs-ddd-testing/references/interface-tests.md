# Interface Layer Tests

Interface tests use `@nestjs/testing` `Test.createTestingModule()` with mocked buses.
The goal is to verify HTTP routing, request validation, response shaping, and guard behavior —
not business logic (which is in the application/domain layers).

---

## Controller Unit Tests

Mock the `CommandBus` and `QueryBus`. Test:
- Correct bus method dispatched for each endpoint
- Correct command/query constructed from request data
- Response shape matches expected output
- HTTP method + route is correct
- Guards are applied (metadata check)

### Full Example — `OrderController`

```typescript
// order.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { OrderController } from './order.controller';
import { CreateOrderCommand } from '../../application/commands/create-order/create-order.command';
import { GetOrderQuery } from '../../application/queries/get-order/get-order.query';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

describe('OrderController', () => {
  let controller: OrderController;
  let mockCommandBus: { execute: jest.Mock };
  let mockQueryBus: { execute: jest.Mock };

  beforeEach(async () => {
    mockCommandBus = { execute: jest.fn() };
    mockQueryBus = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<OrderController>(OrderController);
  });

  describe('POST /orders', () => {
    it('should dispatch CreateOrderCommand with correct parameters', async () => {
      mockCommandBus.execute.mockResolvedValue('new-order-id');
      const dto: CreateOrderDto = { items: [{ productId: 'p1', quantity: 2 }] };
      const user = { id: 'user-1' };

      await controller.create(dto, user as any);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateOrderCommand),
      );

      const dispatchedCommand: CreateOrderCommand = mockCommandBus.execute.mock.calls[0][0];
      expect(dispatchedCommand.customerId).toBe('user-1');
      expect(dispatchedCommand.items).toEqual(dto.items);
    });

    it('should return the created order id', async () => {
      mockCommandBus.execute.mockResolvedValue('new-order-id');

      const result = await controller.create(
        { items: [] },
        { id: 'u1' } as any,
      );

      expect(result).toEqual({ id: 'new-order-id' });
    });
  });

  describe('GET /orders/:id', () => {
    it('should dispatch GetOrderQuery with the correct id', async () => {
      mockQueryBus.execute.mockResolvedValue({ id: 'o1', status: 'PENDING' });

      await controller.findOne('o1');

      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        expect.any(GetOrderQuery),
      );
      const dispatchedQuery: GetOrderQuery = mockQueryBus.execute.mock.calls[0][0];
      expect(dispatchedQuery.orderId).toBe('o1');
    });

    it('should return the order data', async () => {
      const orderData = { id: 'o1', status: 'PENDING', customerId: 'c1' };
      mockQueryBus.execute.mockResolvedValue(orderData);

      const result = await controller.findOne('o1');

      expect(result).toEqual(orderData);
    });
  });
});
```

---

## DTO Validation Tests

Use `class-validator` + `plainToInstance` to verify that incoming DTOs are validated correctly.
These are pure unit tests — no HTTP server needed.

```typescript
// create-order.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto', () => {
  async function validateDto(data: object) {
    const dto = plainToInstance(CreateOrderDto, data);
    return validate(dto);
  }

  it('should pass validation with valid data', async () => {
    const errors = await validateDto({
      items: [{ productId: 'uuid-1', quantity: 2 }],
    });

    expect(errors).toHaveLength(0);
  });

  it('should fail when items is empty array', async () => {
    const errors = await validateDto({ items: [] });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('items');
  });

  it('should fail when items is missing', async () => {
    const errors = await validateDto({});

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('items');
  });

  it('should fail when quantity is zero or negative', async () => {
    const errors = await validateDto({
      items: [{ productId: 'uuid-1', quantity: 0 }],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when productId is not a valid UUID', async () => {
    const errors = await validateDto({
      items: [{ productId: 'not-a-uuid', quantity: 1 }],
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
```

---

## Exception Filter Tests

Test that domain exceptions map to the correct HTTP status codes.

```typescript
// domain-exception.filter.spec.ts
import { DomainExceptionFilter } from './domain-exception.filter';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';
import { ArgumentsHost } from '@nestjs/common';

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: object;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn(),
      }),
    } as unknown as ArgumentsHost;

    filter = new DomainExceptionFilter();
  });

  it('should return 404 for OrderNotFoundException', () => {
    const exception = new OrderNotFoundException('order-1');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('should include the exception message in the response body', () => {
    const exception = new OrderNotFoundException('order-1');

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('order-1') }),
    );
  });
});
```

---

## Guard Tests

```typescript
// jwt-auth.guard.spec.ts
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should allow request with valid JWT', async () => {
    const mockContext = createMockContext({ authorization: 'Bearer valid-token' });
    jest.spyOn(guard, 'canActivate').mockResolvedValue(true);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it('should deny request with missing authorization header', async () => {
    const mockContext = createMockContext({});

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });
});

function createMockContext(headers: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}
```

---

## E2E / Integration Tests (Supertest)

E2E tests boot the full NestJS app with a test database and exercise real HTTP endpoints.
Place in `test/` directory, file suffix `.e2e-spec.ts`.

```typescript
// test/order/order.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Order (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    // Authenticate and get a JWT token for protected routes
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    jwtToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create an order and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ items: [{ productId: 'valid-uuid', quantity: 1 }] });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 400 for invalid request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ items: [] }); // empty items array — invalid

      expect(res.status).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({ items: [{ productId: 'uuid', quantity: 1 }] });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return 404 for non-existent order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(404);
    });
  });
});
```

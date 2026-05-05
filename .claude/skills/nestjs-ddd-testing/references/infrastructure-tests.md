# Infrastructure Layer Tests

Infrastructure tests verify that:
- **Mappers** correctly translate between ORM entities and domain entities (pure unit tests)
- **Repositories** correctly persist and retrieve domain entities (integration tests)

---

## Mapper Tests (Pure Unit Tests)

Mappers have zero external dependencies — test them as pure functions.

Test every:
- `toDomain()` — ORM entity → domain entity (correct field mapping, VO construction)
- `toPersistence()` — domain entity → ORM entity (correct column mapping)
- Round-trip fidelity: `toPersistence(toDomain(ormEntity))` produces equivalent result
- Edge cases: null/optional fields, nested objects

### Full Example — `OrderMapper`

```typescript
// order.mapper.spec.ts
import { OrderMapper } from './order.mapper';
import { OrderOrmEntity } from '../entities/order.orm-entity';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../domain/enums/order-status.enum';

describe('OrderMapper', () => {
  let mapper: OrderMapper;

  beforeEach(() => {
    mapper = new OrderMapper();
  });

  describe('toDomain()', () => {
    it('should map ORM entity to domain entity', () => {
      const ormEntity = new OrderOrmEntity();
      ormEntity.id = 'order-uuid-1';
      ormEntity.customerId = 'customer-uuid-1';
      ormEntity.status = 'PENDING';
      ormEntity.createdAt = new Date('2024-01-01');
      ormEntity.items = [];

      const order = mapper.toDomain(ormEntity);

      expect(order).toBeInstanceOf(Order);
      expect(order.id.value).toBe('order-uuid-1');
      expect(order.customerId.value).toBe('customer-uuid-1');
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('should map items correctly', () => {
      const ormEntity = new OrderOrmEntity();
      ormEntity.id = 'order-1';
      ormEntity.items = [
        { id: 'item-1', productId: 'prod-1', quantity: 2, unitPrice: 10 },
      ];

      const order = mapper.toDomain(ormEntity);

      expect(order.items).toHaveLength(1);
      expect(order.items[0].productId.value).toBe('prod-1');
      expect(order.items[0].quantity).toBe(2);
    });
  });

  describe('toPersistence()', () => {
    it('should map domain entity to ORM entity', () => {
      const order = new OrderBuilder()
        .withCustomerId('customer-1')
        .build();

      const ormEntity = mapper.toPersistence(order);

      expect(ormEntity).toBeInstanceOf(OrderOrmEntity);
      expect(ormEntity.customerId).toBe('customer-1');
      expect(ormEntity.status).toBe('PENDING');
    });
  });

  describe('round-trip', () => {
    it('toDomain(toPersistence(order)) should preserve identity', () => {
      const original = new OrderBuilder().withCustomerId('c1').build();

      const ormEntity = mapper.toPersistence(original);
      const restored = mapper.toDomain(ormEntity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.customerId.value).toBe(original.customerId.value);
      expect(restored.status).toBe(original.status);
    });
  });
});
```

---

## Repository Integration Tests

Repository tests use a **real database** (SQLite in-memory for TypeORM, or testcontainers for PostgreSQL).
They verify that the SQL queries, ORM mappings, and domain mapping all work end-to-end.

### Setup with TypeORM SQLite (lightweight)

```typescript
// order.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmOrderRepository } from './order.repository';
import { OrderOrmEntity } from '../entities/order.orm-entity';
import { OrderMapper } from '../mappers/order.mapper';
import { OrderItemOrmEntity } from '../entities/order-item.orm-entity';

describe('TypeOrmOrderRepository (integration)', () => {
  let module: TestingModule;
  let repository: TypeOrmOrderRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [OrderOrmEntity, OrderItemOrmEntity],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]),
      ],
      providers: [
        TypeOrmOrderRepository,
        OrderMapper,
      ],
    }).compile();

    repository = module.get(TypeOrmOrderRepository);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('save() and findById()', () => {
    it('should persist and retrieve an order', async () => {
      const order = new OrderBuilder().withCustomerId('c1').build();

      await repository.save(order);
      const found = await repository.findById(order.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(order.id.value);
      expect(found!.customerId.value).toBe('c1');
    });

    it('should return null for a non-existent id', async () => {
      const nonExistentId = OrderId.create('00000000-0000-0000-0000-000000000000');

      const result = await repository.findById(nonExistentId);

      expect(result).toBeNull();
    });
  });

  describe('save() update', () => {
    it('should update existing order on second save', async () => {
      const order = new OrderBuilder().build();
      await repository.save(order);

      order.markAsPaid();
      await repository.save(order);

      const updated = await repository.findById(order.id);
      expect(updated!.status).toBe(OrderStatus.PAID);
    });
  });

  describe('delete()', () => {
    it('should remove order from database', async () => {
      const order = new OrderBuilder().build();
      await repository.save(order);

      await repository.delete(order.id);

      const found = await repository.findById(order.id);
      expect(found).toBeNull();
    });
  });
});
```

---

### Setup with Testcontainers (PostgreSQL — closer to production)

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('TypeOrmOrderRepository (postgres)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [OrderOrmEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([OrderOrmEntity]),
      ],
      providers: [TypeOrmOrderRepository, OrderMapper],
    }).compile();
  }, 60_000); // container startup can take time

  afterAll(async () => {
    await module.close();
    await container.stop();
  });

  // ... same tests as SQLite version
});
```

---

## Testing the Mapper in Isolation vs. Through the Repository

| Concern | Test approach |
|---|---|
| Mapper field accuracy | Pure unit test on mapper directly |
| Repository SQL correctness | Integration test (SQLite/testcontainer) |
| ORM relations loaded correctly | Integration test with relation data seeded |
| N+1 query detection | Integration test counting query calls |

### Detecting N+1 with query logging

```typescript
it('should not produce N+1 queries when loading orders with items', async () => {
  // Seed 3 orders each with 2 items
  const queryLog: string[] = [];
  dataSource.driver.afterConnect(); // setup listener or use datasource logging

  const orders = await repository.findAll();

  // With proper eager loading, expect 1-2 queries, not 3+
  expect(queryLog.length).toBeLessThanOrEqual(2);
  expect(orders).toHaveLength(3);
});
```

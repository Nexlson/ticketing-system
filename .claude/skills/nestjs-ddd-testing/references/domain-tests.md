# Domain Layer Tests

Domain tests are **pure unit tests** — no mocks, no NestJS, no database.
The domain layer has zero dependencies so tests are fast and deterministic.

---

## Aggregate / Entity Tests

Test every:
- Factory method (valid creation + invariant violations)
- State transition method (happy path + guard conditions)
- Domain event emission after mutations
- Invariant enforcement (exception thrown when rule violated)

### Full Example — `Order` aggregate

```typescript
// order.entity.spec.ts
import { Order } from './order.entity';
import { OrderItem } from '../value-objects/order-item.vo';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderShippedEvent } from '../events/order-shipped.event';
import { OrderCannotBeShippedException } from '../exceptions/order-cannot-be-shipped.exception';

describe('Order', () => {
  describe('create()', () => {
    it('should create an order with PENDING status', () => {
      const order = Order.create({ customerId: 'customer-1' });

      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('should emit OrderCreatedEvent on creation', () => {
      const order = Order.create({ customerId: 'customer-1' });

      const events = order.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    });

    it('should throw when customerId is empty', () => {
      expect(() => Order.create({ customerId: '' })).toThrow();
    });
  });

  describe('ship()', () => {
    it('should transition status to SHIPPED when order is PAID', () => {
      const order = Order.create({ customerId: 'customer-1' });
      order.markAsPaid();

      order.ship();

      expect(order.status).toBe(OrderStatus.SHIPPED);
    });

    it('should emit OrderShippedEvent when shipped', () => {
      const order = Order.create({ customerId: 'customer-1' });
      order.markAsPaid();
      order.clearEvents();

      order.ship();

      const events = order.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderShippedEvent);
    });

    it('should throw OrderCannotBeShippedException when order is PENDING', () => {
      const order = Order.create({ customerId: 'customer-1' });

      expect(() => order.ship()).toThrow(OrderCannotBeShippedException);
    });

    it('should throw OrderCannotBeShippedException when order is already SHIPPED', () => {
      const order = Order.create({ customerId: 'customer-1' });
      order.markAsPaid();
      order.ship();
      order.clearEvents();

      expect(() => order.ship()).toThrow(OrderCannotBeShippedException);
    });
  });

  describe('addItem()', () => {
    it('should add item when order is PENDING', () => {
      const order = Order.create({ customerId: 'customer-1' });
      const item = OrderItem.create({ productId: 'prod-1', quantity: 2, unitPrice: 10 });

      order.addItem(item);

      expect(order.items).toHaveLength(1);
    });

    it('should throw when adding item to a SHIPPED order', () => {
      const order = Order.create({ customerId: 'customer-1' });
      order.markAsPaid();
      order.ship();

      const item = OrderItem.create({ productId: 'prod-1', quantity: 1, unitPrice: 10 });

      expect(() => order.addItem(item)).toThrow();
    });
  });
});
```

---

## Value Object Tests

Test every:
- Valid construction
- All invalid inputs (empty, wrong format, out of range)
- Equality (two VOs with same value are equal)
- Immutability (no setters, properties are readonly)

### Full Example — `Email` value object

```typescript
// email.vo.spec.ts
import { Email } from './email.vo';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

describe('Email', () => {
  describe('create()', () => {
    it('should create a valid email', () => {
      const email = Email.create('user@example.com');

      expect(email.value).toBe('user@example.com');
    });

    it('should normalize email to lowercase', () => {
      const email = Email.create('User@EXAMPLE.COM');

      expect(email.value).toBe('user@example.com');
    });

    it('should throw InvalidEmailException for empty string', () => {
      expect(() => Email.create('')).toThrow(InvalidEmailException);
    });

    it('should throw InvalidEmailException for missing @ symbol', () => {
      expect(() => Email.create('notanemail')).toThrow(InvalidEmailException);
    });

    it('should throw InvalidEmailException for missing domain', () => {
      expect(() => Email.create('user@')).toThrow(InvalidEmailException);
    });
  });

  describe('equals()', () => {
    it('should return true for two emails with the same value', () => {
      const a = Email.create('user@example.com');
      const b = Email.create('user@example.com');

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two emails with different values', () => {
      const a = Email.create('alice@example.com');
      const b = Email.create('bob@example.com');

      expect(a.equals(b)).toBe(false);
    });
  });
});
```

### Full Example — `Money` value object

```typescript
// money.vo.spec.ts
import { Money } from './money.vo';

describe('Money', () => {
  describe('create()', () => {
    it('should create money with amount and currency', () => {
      const money = Money.create(100, 'MYR');

      expect(money.amount).toBe(100);
      expect(money.currency).toBe('MYR');
    });

    it('should throw for negative amount', () => {
      expect(() => Money.create(-1, 'MYR')).toThrow();
    });

    it('should throw for unsupported currency', () => {
      expect(() => Money.create(100, 'ZZZ')).toThrow();
    });
  });

  describe('add()', () => {
    it('should add two money objects with same currency', () => {
      const a = Money.create(50, 'MYR');
      const b = Money.create(30, 'MYR');

      const result = a.add(b);

      expect(result.amount).toBe(80);
    });

    it('should throw when adding different currencies', () => {
      const a = Money.create(50, 'MYR');
      const b = Money.create(30, 'USD');

      expect(() => a.add(b)).toThrow();
    });
  });
});
```

---

## Domain Service Tests

```typescript
// order-pricing.service.spec.ts
import { OrderPricingService } from './order-pricing.service';
import { Order } from '../entities/order.entity';
import { Money } from '../value-objects/money.vo';

describe('OrderPricingService', () => {
  let service: OrderPricingService;

  beforeEach(() => {
    service = new OrderPricingService();
  });

  describe('calculateTotal()', () => {
    it('should sum all item prices', () => {
      const order = Order.create({ customerId: 'c1' });
      order.addItem(OrderItem.create({ productId: 'p1', quantity: 2, unitPrice: 10 }));
      order.addItem(OrderItem.create({ productId: 'p2', quantity: 1, unitPrice: 25 }));

      const total = service.calculateTotal(order);

      expect(total.amount).toBe(45);
    });

    it('should return zero for an order with no items', () => {
      const order = Order.create({ customerId: 'c1' });

      const total = service.calculateTotal(order);

      expect(total.amount).toBe(0);
    });
  });
});
```

---

## Domain Exception Tests

```typescript
// order.exceptions.spec.ts
import { OrderNotFoundException } from './order-not-found.exception';

describe('OrderNotFoundException', () => {
  it('should have the correct message', () => {
    const exception = new OrderNotFoundException('order-123');

    expect(exception.message).toContain('order-123');
  });

  it('should be an instance of DomainException', () => {
    const exception = new OrderNotFoundException('order-123');

    expect(exception).toBeInstanceOf(DomainException);
  });
});
```

---

## Builder / Mother Pattern (for reusable test fixtures)

For complex aggregates, create an `OrderMother` or builder to avoid duplication:

```typescript
// test/builders/order.builder.ts
export class OrderBuilder {
  private customerId = 'default-customer-id';
  private items: OrderItem[] = [];

  withCustomerId(id: string): this {
    this.customerId = id;
    return this;
  }

  withItem(item: OrderItem): this {
    this.items.push(item);
    return this;
  }

  asPaid(): Order {
    const order = Order.create({ customerId: this.customerId });
    order.markAsPaid();
    order.clearEvents();
    return order;
  }

  build(): Order {
    const order = Order.create({ customerId: this.customerId });
    this.items.forEach(item => order.addItem(item));
    order.clearEvents();
    return order;
  }
}

// Usage in tests
const order = new OrderBuilder().withCustomerId('c1').asPaid().build();
```

# NestJS DDD Anti-Patterns

Common mistakes and how to fix them. Each entry includes the pattern name, what it looks like,
why it's a problem, and the correct approach.

---

## Anti-Pattern 1: Anemic Domain Model

**What it looks like:**
```typescript
// domain/entities/order.entity.ts  ← BAD
export class Order {
  id: string;
  status: string;
  items: OrderItem[];
  // No methods. Just a bag of data.
}
```

**Why it's a problem:**
Business rules live in services or (worse) controllers. The domain entity is just a DTO. Invariants
aren't enforced. Anyone can set `order.status = 'shipped'` without validation.

**Fix:**
```typescript
export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private _status: OrderStatus,
    private readonly _items: OrderItem[],
  ) { super(); }

  ship(): void {
    if (this._status !== OrderStatus.PAID) {
      throw new OrderCannotBeShippedException(this._id);
    }
    this._status = OrderStatus.SHIPPED;
    this.apply(new OrderShippedEvent(this._id));
  }
}
```

---

## Anti-Pattern 2: ORM Entity = Domain Entity (Persistence Leak)

**What it looks like:**
```typescript
// domain/entities/user.entity.ts  ← BAD
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;
}
```

**Why it's a problem:**
- Domain layer now depends on TypeORM (framework dependency violation)
- Changing ORM forces changes to domain model
- ORM concerns (lazy loading, cascade) pollute domain behavior
- Unit testing requires a database

**Fix:**
Separate ORM entity in `infrastructure/persistence/entities/user.orm-entity.ts` and
map it to/from the domain entity via a mapper.

---

## Anti-Pattern 3: Controller Bypasses Application Layer

**What it looks like:**
```typescript
// interface/http/controllers/order.controller.ts  ← BAD
@Controller('orders')
export class OrderController {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    const order = this.orderRepo.create({ ...dto, status: 'pending' });
    return this.orderRepo.save(order);
  }
}
```

**Why it's a problem:**
- Business logic is in the controller (or non-existent)
- Infrastructure (TypeORM) directly injected into interface layer
- Untestable, no DDD application layer

**Fix:**
Controller dispatches to `CommandBus`. Handler in application layer calls domain entity, persists via repository interface.

---

## Anti-Pattern 4: Fat Application Service (God Handler)

**What it looks like:**
```typescript
// application/commands/order.handler.ts  ← BAD
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(cmd: CreateOrderCommand) {
    // Validates input manually
    // Calls external payment API directly
    // Sends email directly via SMTP
    // Updates 5 aggregates
    // Transforms DTO manually
    // 200+ lines
  }
}
```

**Why it's a problem:**
- Violates Single Responsibility
- Mixes orchestration with business logic and infrastructure concerns
- Untestable without mocking the world

**Fix:**
- Move business logic to domain entities/services
- Move infra concerns (email, payment) behind interfaces/ports
- Split into multiple smaller commands if needed
- Use domain events + event handlers to decouple side effects

---

## Anti-Pattern 5: Repository Interface in Infrastructure Layer

**What it looks like:**
```typescript
// infrastructure/persistence/repositories/order.repository.interface.ts  ← BAD
export interface IOrderRepository { ... }

// infrastructure/persistence/repositories/order.repository.ts
export class TypeOrmOrderRepository implements IOrderRepository { ... }
```

**Why it's a problem:**
Application and domain layers can't depend on the interface without depending on the infrastructure
folder, creating an implicit coupling.

**Fix:**
Interface lives in `domain/repositories/order.repository.interface.ts`. Implementation lives in
`infrastructure/`. Domain owns the contract; infrastructure fulfills it.

---

## Anti-Pattern 6: Domain Exceptions as HTTP Exceptions

**What it looks like:**
```typescript
// domain/exceptions/order.exceptions.ts  ← BAD
import { HttpException, HttpStatus } from '@nestjs/common';

export class OrderNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Order ${id} not found`, HttpStatus.NOT_FOUND);
  }
}
```

**Why it's a problem:**
Domain layer imports from NestJS/HTTP. The domain is now coupled to HTTP transport.
If you switch to GraphQL or CLI, your domain throws HTTP status codes.

**Fix:**
```typescript
// domain/exceptions/order.exceptions.ts  ← GOOD
export class OrderNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Order ${id} not found`);
    this.name = 'OrderNotFoundException';
  }
}

// interface/http/filters/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = this.mapToStatus(exception);
    res.status(status).json({ message: exception.message });
  }
}
```

---

## Anti-Pattern 7: Missing Mapper (Direct ORM Entity Exposure)

**What it looks like:**
```typescript
// BAD: returning ORM entity from repository and using it as domain entity
async findById(id: string): Promise<OrderOrmEntity | null> {
  return this.repo.findOne({ where: { id } });
}
// And in controller: sends OrderOrmEntity as HTTP response directly
```

**Why it's a problem:**
- ORM entities can have lazy-loaded relations that cause unexpected DB queries
- Exposes persistence details (columns, joins) to higher layers
- Can leak sensitive fields
- ORM entity changes break domain and interface layers simultaneously

**Fix:** Always have mappers. Repository returns domain entity, controller returns response DTO.

---

## Anti-Pattern 8: Using `any` in Commands / Queries / DTOs

**What it looks like:**
```typescript
export class CreateOrderCommand {
  constructor(public readonly data: any) {} // BAD
}
```

**Why it's a problem:**
TypeScript's type safety is lost. Bugs surface at runtime, not compile time.

**Fix:**
Fully type all commands, queries, and DTOs. Use Value Objects where semantics matter.

---

## Anti-Pattern 9: Injecting Handlers Directly Instead of Using Buses

**What it looks like:**
```typescript
// BAD
constructor(private readonly createOrderHandler: CreateOrderHandler) {}

async create(dto: CreateOrderDto) {
  return this.createOrderHandler.execute(new CreateOrderCommand(dto));
}
```

**Why it's a problem:**
- Bypasses the CQRS bus infrastructure (middleware, logging, event sourcing hooks)
- Creates a tight coupling between controller and specific handler
- Makes adding cross-cutting concerns (audit log, retry, saga) much harder

**Fix:** Always use `CommandBus.execute()` and `QueryBus.execute()`.

---

## Anti-Pattern 10: Business Logic in NestJS Module Provider

**What it looks like:**
```typescript
// BAD: service with business logic but registered as a generic NestJS provider
// in the same module as everything else, with 500 lines mixing concerns
@Injectable()
export class OrderService {
  async createOrder(dto) { /* 200 lines of business logic */ }
  async getOrdersByCustomer(customerId) { /* query logic */ }
  async sendConfirmationEmail(order) { /* email logic */ }
}
```

**Fix:**
Break into: domain entity (business rules), command handler (orchestration),
application event handler (email side effect), query handler (reads).

---

## Anti-Pattern 11: `forwardRef` Circular Dependencies

**What it looks like:**
```typescript
@Module({
  imports: [forwardRef(() => PaymentModule)],
})
export class OrderModule {}

@Module({
  imports: [forwardRef(() => OrderModule)],
})
export class PaymentModule {}
```

**Why it's a problem:**
Circular dependency is almost always a domain design smell — two bounded contexts are too tightly coupled.

**Fix:**
Use domain events. `Order` raises `OrderCreatedEvent`, `Payment` handles it. No circular import needed.

---

## Anti-Pattern 12: No Validation on Incoming HTTP Data

**What it looks like:**
```typescript
// BAD: DTO with no validators
export class CreateUserDto {
  email: string;
  password: string;
  role: string; // could be 'admin' injected by attacker
}
```

**Fix:**
```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @IsEnum(UserRole)
  role: UserRole; // restricted to valid enum values
}
```

And globally: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))`.

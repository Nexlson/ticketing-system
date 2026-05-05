# DDD Layers Reference

## Layer Responsibilities

### Domain Layer
The heart of the application. Must be **100% framework-free**.

**Contains:**
- **Aggregate Roots** — transactional boundaries; enforce invariants
- **Entities** — have identity, mutable state within aggregate
- **Value Objects** — immutable, identity by value (Email, Money, Address)
- **Domain Events** — facts that happened in the domain
- **Domain Services** — stateless logic that doesn't belong to a single entity
- **Repository Interfaces** — ports (abstractions), no implementation
- **Domain Exceptions** — business rule violations

**Rules:**
- Zero NestJS imports (`@Injectable`, `@Module`, etc.)
- Zero ORM imports (TypeORM, Prisma, Mongoose)
- Zero HTTP imports (express, fastify)
- Entities hold behavior, not just data (rich domain model)
- Aggregates protect invariants — all mutations go through aggregate root
- Value objects are immutable (readonly properties, no setters)

**Example entity (correct):**
```typescript
// domain/entities/order.entity.ts
export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private _status: OrderStatus,
    private _items: OrderItem[],
  ) {
    super();
  }

  static create(props: CreateOrderProps): Order {
    const order = new Order(OrderId.generate(), OrderStatus.PENDING, []);
    order.apply(new OrderCreatedEvent(order._id));
    return order;
  }

  addItem(item: OrderItem): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new OrderNotEditableException();
    }
    this._items.push(item);
    this.apply(new OrderItemAddedEvent(this._id, item));
  }
}
```

---

### Application Layer
Orchestrates use cases. Knows about domain. Does NOT know about infrastructure details.

**Contains:**
- **Command Handlers** — write operations (via CQRS)
- **Query Handlers** — read operations (via CQRS)
- **Application Services** — (if not using CQRS) orchestration services
- **Event Handlers** — react to domain events
- **Application DTOs** — internal data transfer objects
- **Port interfaces** — for infra services (email, storage) if not in domain

**Rules:**
- May import `@nestjs/cqrs` (`ICommandHandler`, `IQueryHandler`, `EventsHandler`)
- May import domain layer
- Must NOT import TypeORM entities, HTTP decorators, or infrastructure classes
- Handlers should be thin orchestrators — no business logic here
- Use repository interfaces (domain ports), never concrete implementations

**Example command handler (correct):**
```typescript
// application/commands/create-order/create-order.handler.ts
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    const order = Order.create({ customerId: command.customerId });
    await this.orderRepository.save(order);
    return order.id.value;
  }
}
```

---

### Infrastructure Layer
Implements ports. Knows about frameworks and external systems.

**Contains:**
- **Repository Implementations** — concrete TypeORM/Prisma/Mongoose repos
- **ORM Entities** — TypeORM `@Entity()` classes (SEPARATE from domain entities)
- **Mappers** — translate between ORM entities and domain entities
- **Messaging Adapters** — Kafka, RabbitMQ, Redis pub/sub
- **External API Clients** — third-party HTTP clients
- **Email/SMS services** — concrete implementations

**Rules:**
- May use any framework/library
- Must implement interfaces defined in domain or application
- ORM entities must NEVER be used as domain entities
- Always have a mapper between persistence model and domain model

**Example repository (correct):**
```typescript
// infrastructure/persistence/repositories/order.repository.ts
@Injectable()
export class TypeOrmOrderRepository implements IOrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repo: Repository<OrderOrmEntity>,
    private readonly mapper: OrderMapper,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const ormEntity = await this.repo.findOne({ where: { id: id.value } });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async save(order: Order): Promise<void> {
    const ormEntity = this.mapper.toPersistence(order);
    await this.repo.save(ormEntity);
  }
}
```

---

### Interface / Presentation Layer
Handles HTTP, WebSocket, GraphQL, CLI — the delivery mechanism.

**Contains:**
- **Controllers** — route handlers, thin as possible
- **Request/Response DTOs** — with `class-validator` and `class-transformer`
- **Mappers** — translate HTTP DTOs to/from application commands/queries
- **Guards** — auth/authz
- **Interceptors** — logging, response transformation, caching headers
- **Pipes** — custom validation/transformation pipes
- **Exception Filters** — map domain/app exceptions to HTTP responses

**Rules:**
- Controllers ONLY dispatch to CommandBus/QueryBus — no business logic
- DTOs must have full validation decorators (`@IsString()`, `@IsEmail()`, etc.)
- Domain exceptions must be caught by exception filters, not in controllers
- No repository or domain service injection in controllers

**Example controller (correct):**
```typescript
// interface/http/controllers/order.controller.ts
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: UserPayload) {
    const orderId = await this.commandBus.execute(
      new CreateOrderCommand(user.id, dto.items),
    );
    return { id: orderId };
  }
}
```

---

## Dependency Inversion in Practice

```
Interface Layer   →  ApplicationLayer  →  Domain Layer
Infrastructure  →  (implements domain interfaces)

Domain has NO dependencies on outer layers.
Application depends only on domain interfaces.
Infrastructure implements domain/app interfaces.
Interface dispatches to application via CommandBus/QueryBus.
```

The `@Inject(REPOSITORY_TOKEN)` + interface pattern is the standard way to achieve this in NestJS.

---

## Shared Kernel

`shared/domain/` should contain base classes only:

```typescript
// shared/domain/aggregate-root.ts
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  protected apply(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearEvents(): void {
    this._domainEvents = [];
  }
}
```

Never put business logic in `shared/` — only structural abstractions.

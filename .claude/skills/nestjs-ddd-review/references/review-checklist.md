# NestJS DDD Review Checklist

Use this checklist when reviewing code. Mark each item that applies.

---

## Domain Layer Checklist

### Entities & Aggregates
- [ ] Aggregate root extends base `AggregateRoot` class
- [ ] All mutations go through aggregate root (no direct child entity mutation from outside)
- [ ] Aggregate enforces its own invariants (throws domain exceptions on violations)
- [ ] `static create()` factory method used instead of `new` constructor directly
- [ ] Entity ID is a Value Object (e.g., `OrderId`), not a raw `string` or `number`
- [ ] No NestJS decorators (`@Injectable`, `@Inject`, etc.) on entities
- [ ] No ORM decorators (`@Entity`, `@Column`, etc.) on domain entities
- [ ] No `async` methods that do I/O (domain is synchronous)
- [ ] Domain events applied via `apply()` when state changes

### Value Objects
- [ ] All properties are `readonly`
- [ ] Equality by value, not reference
- [ ] Validation in constructor / static `create()` factory
- [ ] Returns domain exception (not HTTP exception) on invalid input
- [ ] No setters

### Repository Interfaces
- [ ] Defined in `domain/repositories/` as TypeScript interfaces
- [ ] Methods use domain types (VOs for IDs, domain entities for return types)
- [ ] No TypeORM/Prisma/Mongoose types leak into interface signatures
- [ ] Injection token constant defined (e.g., `export const ORDER_REPOSITORY = Symbol(...)`)

### Domain Services
- [ ] Only used when logic genuinely doesn't belong to a single entity
- [ ] Stateless (no instance variables storing state)
- [ ] No NestJS decorators

### Domain Events
- [ ] Defined in `domain/events/`
- [ ] Immutable (readonly properties)
- [ ] Named in past tense (e.g., `OrderCreatedEvent`, `PaymentProcessedEvent`)
- [ ] Applied inside aggregate, dispatched from application layer

---

## Application Layer Checklist

### Commands & Handlers
- [ ] One command class per use case (e.g., `CreateOrderCommand`)
- [ ] Command is a plain class with readonly properties
- [ ] Handler decorated with `@CommandHandler(XCommand)`
- [ ] Handler implements `ICommandHandler<XCommand>`
- [ ] Handler is thin — orchestrates, does NOT contain business logic
- [ ] Repository injected via interface token (`@Inject(ORDER_REPOSITORY)`)
- [ ] Domain events dispatched after successful persistence (via EventBus or aggregate's uncommitted events)

### Queries & Handlers
- [ ] One query class per read use case
- [ ] Handler decorated with `@QueryHandler(XQuery)`
- [ ] Handler implements `IQueryHandler<XQuery>`
- [ ] Read models/projections returned (not domain entities) where appropriate
- [ ] No mutations in query handlers

### Event Handlers
- [ ] Decorated with `@EventsHandler(XEvent)`
- [ ] Implements `IEventHandler<XEvent>`
- [ ] Side effects isolated here (email, notifications, projections)
- [ ] Does NOT re-raise the same event (avoid infinite loops)

### General Application
- [ ] No TypeORM / Prisma / Mongoose imports
- [ ] No HTTP-specific imports (no `@Res()`, no express `Response`)
- [ ] Application exceptions extend a base `ApplicationException` (distinct from domain exceptions)

---

## Infrastructure Layer Checklist

### Repository Implementations
- [ ] Class implements the domain repository interface
- [ ] Decorated with `@Injectable()`
- [ ] Has a corresponding mapper (not doing inline mapping)
- [ ] Uses ORM entity types internally, returns domain entity types externally
- [ ] Registered in module with token: `{ provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository }`

### ORM Entities
- [ ] Placed in `infrastructure/persistence/entities/` (NOT in domain)
- [ ] Named with suffix to distinguish from domain (e.g., `OrderOrmEntity`, `OrderSchema`)
- [ ] All relations explicitly defined with correct cascade settings
- [ ] Indices defined for query-heavy columns

### Mappers
- [ ] `toDomain(ormEntity): DomainEntity` — infra → domain
- [ ] `toPersistence(domainEntity): OrmEntity` — domain → infra
- [ ] No business logic in mappers (pure structural translation)
- [ ] Handle null/undefined cases

### External Services
- [ ] Implements an interface defined in application or domain layer
- [ ] No business logic in adapters (just API translation)
- [ ] Error handling wraps external errors into domain/application exceptions

---

## Interface / Presentation Layer Checklist

### Controllers
- [ ] Thin — only: extract from request → dispatch command/query → format response
- [ ] Uses `CommandBus` / `QueryBus` (not injecting handlers directly)
- [ ] No repository injection
- [ ] No domain service injection
- [ ] No business logic
- [ ] Proper HTTP method decorators (`@Get`, `@Post`, `@Patch`, `@Delete`)
- [ ] Route params validated (e.g., `@Param('id', ParseUUIDPipe)`)

### DTOs
- [ ] Request DTOs have `class-validator` decorators on every property
- [ ] Response DTOs explicitly shape output (no raw domain entity serialization)
- [ ] Nested DTOs validated with `@ValidateNested()` + `@Type()`
- [ ] Sensitive fields excluded from response DTOs
- [ ] `@ApiProperty()` or `@ApiPropertyOptional()` present if using Swagger

### Guards
- [ ] Auth guard verifies JWT/session
- [ ] Authorization guard checks permissions (separate from authentication)
- [ ] No business logic in guards

### Exception Filters
- [ ] `DomainException` subtypes mapped to appropriate HTTP status codes
- [ ] No raw `throw new HttpException(...)` in controllers
- [ ] Filter registered globally or at controller level

### Interceptors
- [ ] Response transformation interceptor for consistent API shape
- [ ] Logging interceptor for request/response tracing

---

## Module Structure Checklist

### NestJS Module
- [ ] One module per bounded context
- [ ] `imports`: only what is needed (TypeOrmModule.forFeature, CqrsModule, SharedModule)
- [ ] `controllers`: only controllers of this module
- [ ] `providers`: handlers, repositories (with tokens), services, mappers
- [ ] `exports`: only what other modules need (usually services or use-case facades)
- [ ] No `forwardRef` unless absolutely unavoidable (flag if present)
- [ ] CQRS module imported: `CqrsModule`

### Example Module (correct):
```typescript
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([OrderOrmEntity]),
  ],
  controllers: [OrderController],
  providers: [
    // CQRS Handlers
    CreateOrderHandler,
    GetOrderHandler,
    OrderCreatedHandler,
    // Repository binding
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
    // Mappers
    OrderMapper,
  ],
  exports: [],
})
export class OrderModule {}
```

---

## Security Checklist
- [ ] `ValidationPipe` enabled globally with `whitelist: true, forbidNonWhitelisted: true`
- [ ] `helmet()` middleware applied
- [ ] Rate limiting applied to public endpoints
- [ ] JWT secrets from environment variables (not hardcoded)
- [ ] No sensitive data (passwords, tokens) logged
- [ ] SQL injection not possible (parameterized queries / ORM used correctly)
- [ ] CORS configured explicitly

---

## Performance Checklist
- [ ] No N+1 queries (use eager loading / DataLoader / query joins)
- [ ] Pagination on list endpoints
- [ ] Database indices on foreign keys and search fields
- [ ] No unnecessary `SELECT *` (select only needed columns)
- [ ] Caching strategy for expensive read queries
- [ ] Async/await used correctly (no floating promises)

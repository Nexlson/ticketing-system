---
name: nestjs-ddd-testing
description: >
  Write, scaffold, and review unit tests for NestJS codebases structured with Domain-Driven Design (DDD).
  Use this skill whenever the user asks to "write unit tests", "add tests", "test my NestJS code",
  "how do I test a command handler", "test my domain entity", "mock my repository", "write specs for",
  "test coverage", "Jest NestJS", or shares a NestJS/DDD file and wants tests written for it.
  Also trigger when users ask about testing strategy for DDD layers, how to test aggregates, value objects,
  CQRS handlers, controllers, or mappers. This skill knows how to test each DDD layer correctly: pure
  unit tests for domain, handler tests with mocked ports for application, integration tests for
  infrastructure, and supertest e2e for interface/HTTP. Always use this skill — do not freehand
  NestJS DDD test generation without it.
---

# NestJS DDD Unit Testing Skill

## Overview

Tests in a DDD NestJS project are written per layer. Each layer has different testing needs,
tools, and isolation strategies.

| Layer | Test Type | Framework | Isolation |
|---|---|---|---|
| Domain | Pure unit | Jest | None needed — no deps |
| Application | Unit | Jest | Mock repository ports & buses |
| Infrastructure | Integration | Jest + TypeORM/test-db | Real DB or in-memory |
| Interface (HTTP) | Unit + E2E | Jest + Supertest | Mock CommandBus/QueryBus |

Read the reference files for full examples per layer:
- `references/domain-tests.md` — entities, value objects, domain services, domain events
- `references/application-tests.md` — command handlers, query handlers, event handlers
- `references/infrastructure-tests.md` — repository implementations, mappers
- `references/interface-tests.md` — controllers, guards, exception filters, DTOs

---

## Test File Placement Convention

Co-locate tests next to the source file they test:

```
src/modules/order/
├── domain/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order.entity.spec.ts          ← domain unit test
│   └── value-objects/
│       ├── order-id.vo.ts
│       └── order-id.vo.spec.ts
├── application/
│   └── commands/
│       └── create-order/
│           ├── create-order.handler.ts
│           └── create-order.handler.spec.ts  ← application unit test
├── infrastructure/
│   └── persistence/
│       ├── mappers/
│       │   ├── order.mapper.ts
│       │   └── order.mapper.spec.ts
│       └── repositories/
│           ├── order.repository.ts
│           └── order.repository.spec.ts
└── interface/
    └── http/
        └── controllers/
            ├── order.controller.ts
            └── order.controller.spec.ts
```

E2E tests live separately:
```
test/
└── order/
    └── order.e2e-spec.ts
```

---

## Test Generation Process

### Step 1 — Identify the Layer

Determine what layer the file being tested belongs to (domain / application / infrastructure / interface).
Read the corresponding reference file for patterns.

### Step 2 — Identify What to Test

| File type | What to test |
|---|---|
| Aggregate / Entity | Invariants, state transitions, domain event emission, factory method |
| Value Object | Validation (valid + invalid inputs), equality, immutability |
| Domain Service | Business logic, interactions between domain objects |
| Command Handler | Happy path, not-found, domain exception propagation, repository called correctly |
| Query Handler | Returns correct projection, handles missing data |
| Event Handler | Triggered correctly, side effects called |
| Mapper | toDomain and toPersistence round-trip fidelity |
| Repository | CRUD operations (integration test with real/in-memory DB) |
| Controller | Correct bus dispatch, request shape, response shape, guard behavior |

### Step 3 — Write Tests Using Layer Pattern

Follow the patterns from the relevant reference file. Key rules:

- **Domain tests**: pure Jest, zero mocks, test via public API only
- **Application tests**: mock all ports (repositories, event bus, external services) with `jest.fn()`
- **Infrastructure tests**: use TypeORM in-memory SQLite or test database, no mocks
- **Controller tests**: use `Test.createTestingModule()`, mock `CommandBus` and `QueryBus`

### Step 4 — Output Format

When generating tests, produce:
1. Full test file with all imports
2. Descriptive `describe` / `it` block names following the pattern:
   - `describe('ClassName')` → top level
   - `describe('methodName()')` → method group
   - `it('should <behavior> when <condition>')` → individual case
3. Arrange / Act / Assert structure with blank line separators
4. One assertion concept per `it` block (can have multiple `expect` calls if they test the same thing)

---

## Tooling Setup

### Required packages
```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @nestjs/testing supertest @types/supertest
```

### jest.config.ts
```typescript
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

### Coverage targets by layer
| Layer | Target |
|---|---|
| Domain | 100% — pure logic, no excuse |
| Application | ≥ 90% — all handler branches |
| Infrastructure | ≥ 70% — integration tests cover most |
| Interface | ≥ 80% — controllers + guards |

---

## Quick Reference: Common Mock Patterns

### Mock repository (application layer tests)
```typescript
const mockOrderRepository: jest.Mocked<IOrderRepository> = {
  findById: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
};
```

### Mock CommandBus / QueryBus (controller tests)
```typescript
const mockCommandBus = { execute: jest.fn() };
const mockQueryBus = { execute: jest.fn() };
```

### Mock EventBus
```typescript
const mockEventBus = { publish: jest.fn(), publishAll: jest.fn() };
```

### Spy on domain event emission
```typescript
const order = Order.create({ ... });
expect(order.getUncommittedEvents()).toContainEqual(
  expect.objectContaining({ constructor: { name: 'OrderCreatedEvent' } })
);
```

---

## Test Naming Conventions

```
✅  it('should throw OrderNotFoundException when order does not exist')
✅  it('should emit OrderCreatedEvent when order is successfully created')
✅  it('should return 400 when email is invalid')
✅  it('should call repository.save() with the correct order entity')

❌  it('test 1')
❌  it('works')
❌  it('create order')
```

---

## Anti-Patterns to Avoid in Tests

- **Testing implementation** — test behavior, not which private methods were called
- **Over-mocking** — domain tests need zero mocks; if you're mocking in domain tests, the domain has a design problem
- **Single mega test** — one `it` block testing an entire workflow; split into focused cases
- **Asserting on `any`** — use `expect.objectContaining()` with typed shape
- **No negative tests** — always test invalid input, not-found, and error paths
- **Skipping domain event assertions** — always verify events were raised on state changes
- **`beforeEach` doing too much** — keep setup minimal; instantiate only what each test needs

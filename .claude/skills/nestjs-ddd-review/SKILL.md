---
name: nestjs-ddd-review
description: >
  Perform thorough code reviews on NestJS codebases structured with Domain-Driven Design (DDD).
  Use this skill whenever the user shares NestJS code for review, asks for feedback on NestJS
  architecture, pastes NestJS files, asks "review my NestJS code", "check my DDD structure",
  "is this good NestJS", "what's wrong with my module", or any variant of reviewing TypeScript/
  NestJS source files. Also trigger when users share directory trees of NestJS projects and ask
  for architectural feedback. This skill understands DDD layers (domain, application, infrastructure,
  presentation/interface), NestJS module conventions, CQRS, repositories, aggregates, value objects,
  domain events, and common anti-patterns. Always use this skill — do not freehand NestJS DDD reviews
  without it.
---

# NestJS DDD Code Review Skill

## Overview

This skill guides deep, structured code reviews for NestJS projects following Domain-Driven Design.
Reviews cover four concerns in order:

1. **DDD Architecture** — correct layering, domain purity, dependency direction
2. **NestJS Conventions** — modules, providers, decorators, lifecycle hooks
3. **Code Quality** — SOLID principles, naming, error handling, typing
4. **Security & Performance** — guards, validation, query efficiency, N+1

Read `references/ddd-layers.md` for the canonical directory structure and layer rules.
Read `references/review-checklist.md` for the full checklist used during review.
Read `references/anti-patterns.md` for common NestJS+DDD anti-patterns and how to flag them.

---

## Canonical DDD Directory Structure

```
src/
├── modules/
│   └── <domain>/                   ← one folder per bounded context
│       ├── domain/                 ← pure business logic, NO framework deps
│       │   ├── entities/           ← Aggregate roots & entities
│       │   ├── value-objects/      ← Immutable VOs (e.g. Email, Money)
│       │   ├── events/             ← Domain events
│       │   ├── exceptions/         ← Domain-specific exceptions
│       │   ├── repositories/       ← Repository interfaces (ports)
│       │   └── services/           ← Domain services (stateless logic)
│       ├── application/            ← Orchestration, use-cases
│       │   ├── commands/           ← CQRS write side
│       │   │   ├── create-x/
│       │   │   │   ├── create-x.command.ts
│       │   │   │   └── create-x.handler.ts
│       │   ├── queries/            ← CQRS read side
│       │   │   └── get-x/
│       │   │       ├── get-x.query.ts
│       │   │       └── get-x.handler.ts
│       │   ├── events/             ← Domain event handlers
│       │   ├── dtos/               ← Internal DTOs (app layer)
│       │   └── ports/              ← Interfaces for infra (if not in domain)
│       ├── infrastructure/         ← Framework & external concerns
│       │   ├── persistence/
│       │   │   ├── entities/       ← ORM entities (TypeORM/Prisma models)
│       │   │   ├── mappers/        ← Domain ↔ persistence mappers
│       │   │   └── repositories/   ← Concrete repository implementations
│       │   ├── messaging/          ← Event bus, message queue adapters
│       │   └── external/           ← Third-party API adapters
│       ├── interface/              ← (also called "presentation")
│       │   ├── http/
│       │   │   ├── controllers/
│       │   │   ├── dtos/           ← Request/Response DTOs with class-validator
│       │   │   └── mappers/        ← DTO ↔ domain/app mappers
│       │   └── guards/
│       └── <domain>.module.ts      ← NestJS module wiring
├── shared/                         ← Cross-cutting, framework-agnostic
│   ├── domain/
│   │   ├── aggregate-root.ts
│   │   ├── entity.ts
│   │   ├── value-object.ts
│   │   └── domain-event.ts
│   └── infrastructure/
│       └── base-repository.ts
└── app.module.ts
```

---

## Review Process

### Step 1 — Understand What Was Shared

Determine what the user has provided:
- **Single file** → focused review on that file's layer responsibilities
- **Multiple files** → cross-layer review, check dependency direction
- **Directory tree only** → architectural/structural review only
- **PR diff** → delta review, flag regressions

### Step 2 — Identify the Layer

Map each file to its DDD layer using the path and class name:
| Path pattern | Layer |
|---|---|
| `domain/entities/` | Domain |
| `domain/value-objects/` | Domain |
| `domain/repositories/` | Domain (interface) |
| `application/commands/` | Application |
| `application/queries/` | Application |
| `infrastructure/persistence/` | Infrastructure |
| `interface/http/controllers/` | Interface/Presentation |

### Step 3 — Apply Layer-Specific Rules

For each layer, apply the checks from `references/review-checklist.md`.

Key dependency rule: **Domain ← Application ← Infrastructure / Interface**
- Domain must NOT import from application, infrastructure, or NestJS
- Application must NOT import from infrastructure or interface
- Only infrastructure and interface may import NestJS decorators/modules

### Step 4 — Format the Review

Structure output as:

```
## Code Review: <FileName or Feature>

### ✅ What's Good
- <strengths>

### 🚨 Critical Issues
- <layer violations, broken DDD rules>

### ⚠️ Warnings
- <code smells, missing validations, weak typing>

### 💡 Suggestions
- <improvements, NestJS best practices>

### 📋 Summary
<2-3 sentence overall assessment + priority fix order>
```

For each issue, provide:
1. What the problem is
2. Why it violates DDD or NestJS best practices
3. A corrected code snippet (when practical)

---

## Quick Reference: Red Flags to Always Catch

- `@Injectable()` in a domain entity or value object → framework leak into domain
- TypeORM `@Entity()` / `@Column()` decorators on domain entities → persistence leak
- Repository implementation in `domain/` folder → layer violation
- `import { Repository } from 'typeorm'` in application or domain layer → infra leak
- Controllers calling repositories directly (skipping application layer)
- No mapper between ORM entity and domain entity
- Domain events not used when side effects exist across aggregates
- `any` type in DTOs or command/query objects
- Missing `class-validator` decorators on interface DTOs
- Business logic placed in controllers or NestJS providers outside application layer
- Circular module imports
- Missing `onModuleDestroy` cleanup for subscriptions/connections

---

## NestJS-Specific Checks

- **Module boundaries**: Each bounded context = one NestJS module; exports only what's needed
- **CQRS**: Use `@nestjs/cqrs` `CommandBus` / `QueryBus` — not direct handler injection
- **Guards vs Interceptors**: Auth/authz = guards; logging/transform = interceptors
- **Pipes**: Validation pipe at global level + `class-validator` DTOs
- **Exception filters**: Domain exceptions mapped to HTTP via exception filter, not in controllers
- **Circular deps**: Flag `forwardRef()` — usually a design smell
- **Provider scope**: Default (singleton) unless there's a reason for REQUEST scope

---

## Severity Levels

| Level | Meaning |
|---|---|
| 🚨 Critical | Breaks DDD layering, introduces coupling, security hole |
| ⚠️ Warning | Code smell, missing best practice, fragile pattern |
| 💡 Suggestion | Improvement, style, performance, DX |
| ✅ Positive | Worth calling out — reinforce good patterns |

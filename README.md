# Ticketing System

Full-stack event ticketing platform — NestJS backend, Next.js frontend, MySQL, Redis.

## Prerequisites

- Docker & Docker Compose

## Quick Start

1. Copy the env file and fill in values:

```bash
cp .env.example .env
```

Edit `.env` — at minimum set a non-empty `DATABASE_PASSWORD` and `JWT_SECRET`:

```env
DATABASE_PASSWORD=yourpassword
JWT_SECRET=changeme
```

2. Start all services:

```bash
docker compose up --build
```

| Service  | URL                                     |
|----------|-----------------------------------------|
| Frontend | http://localhost:3001                   |
| Backend  | http://localhost:3000/v1                |
| MySQL    | localhost:3306                          |
| Redis    | localhost:6379                          |

Ports can be changed in `.env`.

## Stopping

```bash
docker compose down
```

To also delete database data:

```bash
docker compose down -v
```

## Architecture

```
├── backend/     NestJS + Prisma ORM (DDD repository pattern)
├── frontend/    Next.js 15 App Router
├── postman/     Postman collection for all endpoints
└── openapi.yaml OpenAPI 3.0 spec
```

**Backend startup sequence:** waits for MySQL + Redis health checks, then runs `prisma migrate deploy` before starting the server. Migrations are applied automatically on every container start.

## Default Credentials

No seed data is included. Register a user via `POST /v1/auth/register` or connect directly to MySQL and insert one manually.

## Development (without Docker)

**Backend:**

```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Requires a local MySQL instance. Set `DATABASE_URL` in `backend/.env`.

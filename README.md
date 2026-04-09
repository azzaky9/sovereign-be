# sovereign-be

Bun + Hono backend for the Sovereign exchange flow.

## Includes

- HTTP API endpoints under `/api/*`
- Drizzle ORM database connection and schema
- Redis-backed WebSocket server for real-time topics

## Environment

Create a `.env` file with at least:

```env
DATABASE_URL=postgres://...
REDIS_URL=redis://localhost:6379
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

## Commands

```sh
bun install
bun run dev        # API + WebSocket server
```

## Database

```sh
bun run generate
bun run migrate
bun run seed
```

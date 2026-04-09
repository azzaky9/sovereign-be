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
WS_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## Commands

```sh
bun install
bun run dev        # API server
bun run dev:socket # WebSocket server
bun run dev:all    # API + WebSocket
```

## Database

```sh
bun run generate
bun run migrate
bun run seed
```

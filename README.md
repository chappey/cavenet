# Cavenet

Cavenet is a playful social feed app set in a caveman timeline, powered by a React client and a Bun + Elysia API.

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Run the app (server + client):

```bash
bun run dev
```

3. Open:

`http://localhost:3000`

## Useful Scripts

- `bun run dev`: Run server and client together
- `bun run dev:server`: Run API only on port `3001`
- `bun run dev:client`: Run Vite client only on port `3000`
- `bun run db:push`: Push Drizzle schema to SQLite
- `bun run db:seed`: Create schema (if needed) and seed sample data
- `bun run db:reset`: Delete and regenerate `src/server/sqlite.db` with seed data
- `bun run build`: Production build + TypeScript check
- `bun test`: Run tests

## Stack

- Client: React + Vite + React Router
- Server: Bun + Elysia
- Database: SQLite + Drizzle ORM

## Project Structure

- `src/client`: Frontend app
- `src/server`: API and DB access
- `src/server/db/schema.ts`: Database schema
- `drizzle.config.ts`: Drizzle config

## Notes

- Client runs on `3000`, API runs on `3001`.
- Vite proxies `/api` requests to the API server.
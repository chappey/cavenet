
# AGENTS.md

This file is for coding agents working in this repository.

## Mission

Ship small, correct changes quickly while keeping the project easy to understand and hack on.

## Non-Negotiables

1. Before any technical decision, ask:
	`Does this technology choice preserve the hackability of the project?`
2. If a choice reduces hackability, provide a strong justification in your final response.
3. Prefer simple, local solutions over heavyweight abstractions.
4. Do not add dependencies unless clearly necessary.
5. Do not rewrite unrelated code.

## Runtime And Commands

- Package manager/runtime: `bun`
- Default start command: `bun run dev`
- API only: `bun run dev:server`
- Client only: `bun run dev:client`
- DB schema push: `bun run db:push`
- Build/check: `bun run build`
- Tests: `bun test`

## Architecture Snapshot

- Client: `src/client` (React + Vite)
- Server: `src/server` (Elysia)
- DB schema: `src/server/db/schema.ts` (Drizzle + SQLite)
- SQLite DB file: `src/server/sqlite.db`
- Vite proxy: `/api -> http://localhost:3001`

## Working Rules

1. Read relevant files before editing.
2. Keep diffs minimal and targeted.
3. Preserve existing conventions unless there is a clear defect.
4. Prefer explicit error handling for network and DB operations.
5. For concurrency-sensitive logic (likes/rewards/reply ordering), prioritize transactional correctness over convenience.
6. If you identify a bug outside scope, mention it clearly.

## Definition Of Done For Code Changes

1. Code compiles/types check via `bun run build` when feasible.
2. Changed behavior is validated (run app or focused checks).
3. No unrelated file churn.
4. Final response includes:
	- what changed,
	- why,
	- how it was validated,
	- any known risks.

## PR/Review Focus

When reviewing, prioritize:

1. Correctness and regressions
2. Data integrity and race conditions
3. API contract breaks
4. Missing error handling
5. Missing tests for new behavior

Then include lower-priority style or refactor suggestions.

## Human Intent

Optimize for a human teammate returning to this code in 2 weeks.
If the result is harder to modify than before, it is not done.

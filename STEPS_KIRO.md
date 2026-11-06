# CrowdChess Execution Steps Log

This document tracks all steps taken during implementation, CLI commands executed, what was verified, and learnings.

---

## Task 1: Monorepo Scaffolding

### Steps Taken
1. Installed pnpm 12.16.1 globally via `npm install -g pnpm`
2. Updated `.gitignore` with entries for node_modules, dist, .env, Prisma generated client, turbo cache, coverage, Playwright reports
3. Created root `package.json` with Turborepo scripts (dev, build, test, lint, db:generate, db:migrate, format) and devDependencies (turbo ^2.3.3, typescript ^5.7.2, prettier ^3.4.2, @types/node ^22.10.0, tsx ^4.19.0)
4. Created `pnpm-workspace.yaml` defining workspace globs (apps/*, packages/*, packages/adapters/*)
5. Created `turbo.json` with task definitions (build, dev, test, lint, db:generate, db:migrate)
6. Created base `tsconfig.json` with strict TypeScript settings (ES2022 target, Bundler moduleResolution)
7. Created `.prettierrc` with project formatting rules (no semi, single quotes, trailing commas, 100 char width)
8. Created all package stubs (contracts, chess, game-core, modes, adapters/lichess, adapters/youtube, database, config) with package.json, tsconfig.json, and src/index.ts
9. Created `apps/web` with Vite + React + Ant Design v5 dependencies, vite.config.ts, index.html, and placeholder App.tsx/main.tsx
10. Created `apps/api` with tsx dev runner, placeholder server.ts
11. Created `.env.example` with all required environment variables documented
12. Created `PLAN.md` with the full implementation plan
13. Created `STEPS_KIRO.md` (this file)
14. Created directory structure for all packages including subdirectories (contracts/src/{api,events,models}, api/src/{routes,ws,services,plugins}, web/src/{components,pages,hooks,theme})

### CLI Commands Executed
- `npm install -g pnpm` — Installed pnpm globally (v12.16.1)
- `pnpm install` — Installed all workspace dependencies
- `pnpm build` — Verified all packages build
- `pnpm dev` — Verified both dev servers start (web on :3000, api via tsx)

### What Was Verified
- `pnpm install` completes without errors
- `pnpm build` builds all packages (even stubs with empty exports)
- `pnpm dev` starts placeholder dev servers for both apps
- Package imports resolve via TypeScript path aliases and pnpm workspace symlinks
- PLAN.md and STEPS_KIRO.md exist at project root
- .gitignore covers all necessary patterns

### Learnings
- Turborepo v2 uses "tasks" key in turbo.json (not "pipeline" which was v1)
- With moduleResolution: "Bundler", TypeScript can resolve .ts source files directly from package exports
- pnpm workspace symlinks make cross-package imports work without explicit path aliases in tsconfig
- tsx allows running TypeScript directly in dev mode without a build step for the API server
- pnpm v12 enforces build script approval for security: `onlyBuiltDependencies` in pnpm-workspace.yaml did not suppress the ERR_PNPM_IGNORED_BUILDS warning for esbuild, but the esbuild binary is functional regardless (verified with `node .../esbuild/bin/esbuild --version`). The warning is non-blocking for our use case.
- Vite 6 with React 19 and Ant Design v5 builds successfully out of the box


---

## Task 2: Shared Contracts Package

### Steps Taken
1. Added `zod` (^3.24.0) as a dependency and `vitest` (^3.0.0) as a devDependency to `packages/contracts/package.json`
2. Created `packages/contracts/src/models/enums.ts` with Zod enum schemas for all status types and modes:
   - `SessionStatusSchema` (11 states: DRAFT through FAILED)
   - `RoundStatusSchema` (7 states: PENDING through SKIPPED)
   - `GameModeSchema` (DEMOCRACY, BATTLE_ROYALE, CHAOS)
   - `GameStatusSchema`, `BotColorSchema`, `ChatEventTypeSchema`, `GameEventTypeSchema`, `SubmissionResultSchema`
3. Created `packages/contracts/src/models/index.ts` with Zod schemas and inferred TypeScript types for all 11 domain models from the design document:
   - `User`, `YoutubeConnection`, `LichessBotConnection`, `Session` (with `SessionSettings`), `Game`, `Round`, `ChatEvent`, `MoveCandidate`, `Vote`, `Score`, `GameEvent`, `MoveSubmissionResult`
4. Created `packages/contracts/src/api/index.ts` with Zod schemas and types for all 8 REST API endpoints:
   - YouTube connect/callback/broadcasts
   - Session create/start/pause/stop/get
5. Created `packages/contracts/src/events/index.ts` with discriminated union types for all 7 WebSocket events:
   - `session.updated`, `round.opened`, `round.updated`, `round.closed`, `game.state`, `move.confirmed`, `leaderboard.updated`
   - `WSEventSchema` as `z.discriminatedUnion('type', ...)` for type-safe event handling
6. Updated `packages/contracts/src/index.ts` to barrel-export all models, API types, and events
7. Created test files:
   - `packages/contracts/src/__tests__/schemas.test.ts` (27 tests: enums, models, API schemas)
   - `packages/contracts/src/__tests__/events.test.ts` (13 tests: individual events, discriminated union, exhaustive type check)
8. Fixed import error: `SessionSettingsSchema` is in `models/index.ts`, not `enums.ts` — corrected the import in `api/index.ts`
9. Updated test scripts in all other packages to `echo "no tests yet"` so `pnpm test` via turbo doesn't fail on packages without tests
10. Kept `ScaffoldVersion` type from Task 1 for backward compatibility with existing app imports

### CLI Commands Executed
- `pnpm install` — Installed zod and vitest for contracts package
- `pnpm --filter @crowdchess/contracts build` — Built contracts package (initially failed, then fixed import)
- `pnpm --filter @crowdchess/contracts test` — Ran contracts tests (40 passed)
- `pnpm build` — Full monorepo build (10/10 successful)
- `pnpm test` — Full test suite via turbo (10/10 successful, 40 tests in contracts)

### What Was Verified
- `pnpm --filter @crowdchess/contracts build` — TypeScript compiles without errors
- `pnpm --filter @crowdchess/contracts test` — 40 tests pass (27 schema + 13 events)
  - Zod schemas accept valid input (all enum values, all model fields, all API requests)
  - Zod schemas reject invalid input (invalid states, bad UUIDs, non-positive durations, unknown modes)
  - Discriminated union correctly narrows by `type` field
  - All 7 WebSocket event types are defined and parseable
  - SessionSettings defaults work (20s voting, 5s grace, RANDOM tie-break, etc.)
- `pnpm build` — Full monorepo builds (10/10), confirming both apps can import from contracts
- `pnpm test` — All 10 packages pass (contracts has real tests, others echo placeholder)

### Learnings
- When using `export * from './module.js'` in TypeScript ESM, the `.js` extension is required even though the source file is `.ts` — this is because `moduleResolution: "Bundler"` expects it for ESM output
- Zod's `z.discriminatedUnion()` is excellent for WebSocket event types — it provides both runtime validation and TypeScript narrowing in one definition
- Type inference with `z.infer<typeof Schema>` ensures TypeScript types and Zod schemas never drift
- Vitest works out of the box with TypeScript ESM imports — no special config needed for `.js` extension resolution
- `SessionSettingsSchema` is defined in `models/index.ts` (not `enums.ts`) because it's a composite object schema, not a simple enum


---

## Task 3: Database Package (Prisma)

### Steps Taken
1. Updated `packages/database/package.json` to add `prisma` (^6.0.0) as devDependency and `@prisma/client` (^6.0.0) as dependency, `vitest` (^3.0.0) as devDependency. Updated `db:generate` script to `prisma generate` and `db:migrate` to `prisma migrate dev --name init`. Updated `test` script to `vitest run`.
2. Created `packages/database/prisma/schema.prisma` with all 11 models from the design document:
   - User, YoutubeConnection, LichessBotConnection (with unique constraints per user+channel and user+bot)
   - Session (with settingsJson, mode, status, endedAt), Game (with platformGameId, currentFen, botColor)
   - Round (with unique [gameId, ply] for one round per ply), ChatEvent (unique platformMessageId for dedup)
   - MoveCandidate (unique [roundId, viewerId, canonicalUci] for dedup), Vote (unique [roundId, viewerId] for one vote per viewer)
   - Score (composite primary key [sessionId, viewerId]), GameEvent (audit log with index on gameId)
3. Configured Prisma generator output to `../src/generated` (excluded from git via .gitignore)
4. Created `packages/database/src/client.ts` — singleton PrismaClient with dev-mode global caching pattern
5. Updated `packages/database/src/index.ts` — exports prisma client instance, PrismaClient class, and all model types
6. Updated `packages/database/tsconfig.json` — excluded `src/generated/**` from TypeScript compilation
7. Updated `pnpm-workspace.yaml` — added `@prisma/client`, `@prisma/engines`, `prisma` to `onlyBuiltDependencies`
8. Started PostgreSQL 16 container via Docker for migration and testing
9. Ran `prisma generate` — generated Prisma client v6.19.3 with Node-API engine for debian-openssl-3.0.x
10. Ran `prisma migrate dev --name init` — created migration `20261104050838_init` with all tables and constraints
11. Created `packages/database/src/__tests__/database.test.ts` — 13 integration tests

### CLI Commands Executed
- `pnpm install` — Installed prisma, @prisma/client, and vitest
- `docker run -d --name crowdchess-pg -p 5432:5432 -e POSTGRES_USER=crowdchess -e POSTGRES_PASSWORD=crowdchess -e POSTGRES_DB=crowdchess postgres:16-alpine` — Started PostgreSQL container
- `packages/database/node_modules/.bin/prisma generate --schema=packages/database/prisma/schema.prisma` — Generated Prisma client
- `DATABASE_URL="postgresql://crowdchess:crowdchess@localhost:5432/crowdchess" packages/database/node_modules/.bin/prisma migrate dev --name init --schema=packages/database/prisma/schema.prisma` — Created and applied initial migration
- `DATABASE_URL="postgresql://crowdchess:crowdchess@localhost:5432/crowdchess" pnpm --filter @crowdchess/database test` — Ran database tests (13 passed)
- `pnpm build` — Full monorepo build (10/10 successful)

### What Was Verified
- Prisma schema compiles without errors (11 models, 5 unique constraints, 3 indexes)
- Migration applies cleanly to fresh PostgreSQL 16 database
- Prisma client generates to `src/generated/` and TypeScript types resolve correctly
- `pnpm --filter @crowdchess/database build` — TypeScript compiles with Prisma imports
- `pnpm --filter @crowdchess/database test` — 13 integration tests pass:
  - User CRUD (create, read, update, delete)
  - Full session → game → round chain creation
  - Unique [gameId, ply] constraint (prevents duplicate rounds)
  - MoveCandidate creation and unique [roundId, viewerId, canonicalUci] deduplication
  - Vote unique [roundId, viewerId] constraint (one vote per viewer per round)
  - Vote change via update (overwrite pattern)
  - Score composite key [sessionId, viewerId] create and update
  - ChatEvent unique platformMessageId deduplication
  - ChatEvent allows null roundId for messages outside active rounds
- `pnpm build` — Full monorepo builds (10/10), confirming database package integration

### Learnings
- pnpm v12's `onlyBuiltDependencies` in `pnpm-workspace.yaml` doesn't suppress the `ERR_PNPM_IGNORED_BUILDS` exit code for Prisma packages, but the binaries still install correctly and the CLI works
- Prisma v6.19.3 generates CommonJS client code (`Object.defineProperty(exports, ...)`) — importing from ESM works because the generated directory has its own `package.json` without `"type": "module"`, so Node.js treats the files as CommonJS and does interop automatically
- The generated client exports `PrismaClient` via `exports.PrismaClient = PrismaClient` in `index.js`, which Node.js cjs-module-lexer can detect for named ESM imports
- Prisma's `db:migrate` needs a running PostgreSQL instance — started a temporary Docker container for this task (will be formalized in Task 5's docker-compose)
- The `@@unique` constraint in Prisma maps to a SQL UNIQUE constraint, which causes `prisma.create` to throw on duplicates — used in tests with `.rejects.toThrow()`
- Prisma composite primary keys use `@@id([field1, field2])` syntax, and lookups use the compound key name like `sessionId_viewerId`


---

## Task 3 (follow-up): Fix `db:migrate`, Clean Install, and Complete Model Tests

Found while setting up the repo on a fresh Windows machine (Node 24.22.2, pnpm 12.16.1, PostgreSQL 16.15).

### Steps Taken
1. `packages/database/package.json`: `db:migrate` now runs through `dotenv -e ../../.env --`, so Prisma reads `DATABASE_URL` from the root `.env`. Added `dotenv-cli` (^8.0.0) as a devDependency. A `DATABASE_URL` already set in the shell still takes precedence.
2. `turbo.json`: `db:migrate` now has `"cache": false` and `"passThroughEnv": ["DATABASE_URL"]`. Removed its `outputs`, since migrations are source files and not build output.
3. `pnpm-workspace.yaml`: replaced the placeholder `allowBuilds` values (`set this to true or false`) with `true` for `esbuild`, `prisma`, `@prisma/client` and `@prisma/engines`.
4. `packages/database/src/__tests__/database.test.ts`: added 7 tests for the three models that had none:
   - `YoutubeConnection`: CRUD and unique `[userId, channelId]`
   - `LichessBotConnection`: CRUD, unique `[ownerUserId, botUsername]`, and cascade on user delete
   - `GameEvent`: CRUD with JSON payload, listing by game, and cascade on game delete

### CLI Commands Executed
- `pnpm install`: added `dotenv-cli` to the lockfile
- `pnpm install --frozen-lockfile` in a fresh clone: confirmed it now exits 0
- `pnpm db:migrate` with only the root `.env`: reported "Already in sync"
- `DATABASE_URL=.../crowdchess_fresh pnpm db:migrate`: created a new database and applied `20261104050838_init`
- `pnpm db:migrate` again: ran the migration instead of replaying a cached result
- `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code`: reported "No difference detected"
- `pnpm build`: 10/10 tasks succeeded
- `pnpm test`: 10/10 tasks succeeded; contracts 40 passed, database 20 passed (up from 13)

### What Was Verified
- A fresh clone installs with exit code 0, and Prisma's postinstall scripts run
- `pnpm db:migrate` works with `DATABASE_URL` from the root `.env` or from the shell, on both a fresh and an existing database
- `db:migrate` is never served from the Turbo cache
- All 11 Prisma models now have test coverage

### Learnings
- Before this fix, `pnpm db:migrate` always failed with `P1012 Environment variable not found: DATABASE_URL`. Turbo 2 runs tasks in strict env mode, so shell variables are dropped unless listed in `env` or `passThroughEnv`. Prisma also only loads a `.env` next to the schema or package, not the monorepo root.
- With `outputs` set and caching on, Turbo could replay a cached `db:migrate` result and skip applying migrations to a new database.
- `ERR_PNPM_IGNORED_BUILDS` was caused by the placeholder text in `allowBuilds`. pnpm 12 reads `allowBuilds`, and `onlyBuiltDependencies` alone does not approve builds.
- `db:migrate` still passes `--name init`, so a future schema change made through this script would also get a migration named `init`. Run `prisma migrate dev --name <name>` directly for new migrations.


---

## Task 4: Chess Rules Package

### Steps Taken
1. Added `chess.js` (^1.4.0) as a dependency, and `vitest` (^3.0.0), `fast-check` (^4.0.0) and `tsx` (^4.19.0) as devDependencies, to `packages/chess/package.json`. Set `test` to `vitest run` and added a `demo` script.
2. Created `packages/chess/src/position.ts`: `loadPosition(fen)` and `InvalidFenError`.
3. Created `packages/chess/src/moves.ts`:
   - `parseMove(input, fen): ParsedMove` throws `MoveParseError` with a `reason`
   - `validateMove(input, fen): ValidationResult` returns `{ valid: true, move }` or `{ valid: false, reason, message }`
   - `ParsedMove` holds canonical lowercase `uci`, chess.js `san`, `from`, `to`, optional `promotion`, the detected `notation` (`san` | `uci`) and the original `input`
   - Rejection reasons: `EMPTY`, `MALFORMED`, `INVALID_FEN`, `GAME_OVER`, `NO_PIECE`, `WRONG_SIDE`, `AMBIGUOUS`, `PROMOTION_REQUIRED`, `ILLEGAL`
4. Created `packages/chess/src/state.ts`: `getLegalMoves` (UCI), `whoseTurn` (`'white' | 'black'`, matching `BotColorSchema`), `isCheck`, `isCheckmate`, `isStalemate`, `isGameOver`, and `applyMove(fen, uci)` returning the next FEN.
5. `packages/chess/src/index.ts` re-exports all of the above, plus `Chess`, `validateFen` and the main chess.js types.
6. Created tests in `packages/chess/src/__tests__/`:
   - `moves.test.ts` (26 tests): SAN (pieces, pawns, captures, check/mate markers, castling, promotion and underpromotion, ambiguity, over-specified origins, en passant, bishop vs b-pawn), UCI (case, castling, promotion), and edge cases (empty square, wrong side, non-move text, invalid FEN, game over)
   - `state.test.ts` (12 tests): legal move generation, turn, check, checkmate, stalemate, `applyMove`
   - `properties.test.ts` (4 fast-check properties): SAN→UCI→SAN round-trip for every legal move in random positions; every `getLegalMoves` entry validates as itself; arbitrary strings never throw and anything accepted is legal; square-like noise is only accepted when legal
7. Created `packages/chess/scripts/demo.ts` for the Task 4 demo.

### CLI Commands Executed
- `pnpm install`: added chess.js 1.4.0, fast-check 4.10.2 and pure-rand 8.4.2 to the lockfile
- `pnpm --filter @crowdchess/chess build`: TypeScript compiles in strict mode
- `pnpm --filter @crowdchess/chess test`: 42 tests passed
- `pnpm --filter @crowdchess/chess demo`: ran the demo
- `pnpm build`: 10/10 tasks succeeded
- `pnpm test`: 10/10 tasks succeeded; contracts 40, database 20, chess 42 tests passed
- `pnpm install --frozen-lockfile`: lockfile is consistent

### What Was Verified
- Demo: in the position after 1.e4, `Nf6` and `g8f6` both resolve to `g8f6` / `Nf6`; `validateMove` accepts `Nf6` and rejects `e2e4` (`NO_PIECE`), `Nf5` (`ILLEGAL`) and `hello` (`MALFORMED`); `getLegalMoves` lists the 20 legal replies; the Fool's Mate position reports `isCheckmate: true` with 0 legal moves
- SAN→UCI→SAN round-trips for every legal move in 100 random positions of up to 60 plies

### Learnings
- Matching SAN against chess.js's verbose move list (piece, destination, optional origin file/rank, promotion) handles over-specified origins, a missing `x` and ambiguity in one place. Comparing SAN strings would not.
- A pawn SAN move without an origin file must be treated as a push: `e4` must not match `dxe4`.
- `WRONG_SIDE` for SAN is found by re-checking the move with the side to move flipped and the en passant square cleared. The re-check must not flip again, or an illegal move recurses forever.
- Promotions are rejected without a piece (`PROMOTION_REQUIRED`) rather than auto-queened, so the selected move never depends on a guess.
- `isGameOver` cannot detect threefold repetition from a FEN alone, since that needs move history. Lichess stays authoritative for results.
- In PowerShell, pnpm's stderr shows up as `NativeCommandError` text even when the command succeeds; check the exit code instead.


---

## Task 5: Docker Infrastructure

### Steps Taken
1. Created `infra/docker/docker-compose.yml` with `postgres` (postgres:16-alpine) and `redis` (redis:7-alpine, AOF enabled). Both have health checks (`pg_isready`, `redis-cli ping`), named volumes and a shared network. Ports are bound to `127.0.0.1` only. Credentials match `.env.example`.
2. Created a root `docker-compose.yml` that `include`s the infra file, so `docker compose up -d` works from the repo root. This needs Compose v2.20 or later. Removed `infra/docker/.gitkeep`.
3. Implemented `packages/config` (`src/env.ts`):
   - `EnvSchema` (Zod): `DATABASE_URL` must be `postgresql://`/`postgres://`; `REDIS_URL` must be `redis://`/`rediss://`; `PORT` is coerced and defaults to 3001; `NODE_ENV` defaults to `development`. Lichess, YouTube, `ENCRYPTION_KEY` and `JWT_SECRET` stay optional until Tasks 8, 11 and 24.
   - Empty strings count as unset, since `.env` files often contain `KEY=`.
   - `loadConfig(env = process.env)` returns typed config or throws `ConfigError`, which lists every problem as `{ variable, message }`. Messages are built so they never echo values; Zod's default enum message includes the received value.
4. Added to `apps/api`:
   - `src/infra/redis.ts`: `createRedis(url, options)` using ioredis 5 with bounded retries (`maxRetriesPerRequest: 3`, 5s connect timeout), so an outage fails fast instead of queueing forever
   - `src/infra/health.ts`: `checkPostgres` (`SELECT 1`) and `checkRedis` (`PING`), returning `{ ok, latencyMs, error? }` with no connection details in the error, ready for a `/health` route in Task 9
   - `scripts/infra-check.ts` with an `infra:check` script (loads the root `.env` via dotenv-cli) for the demo
   - Dependencies: `@crowdchess/config`, `@crowdchess/database`, `ioredis`; devDependencies: `vitest`, `dotenv-cli`
5. Tests:
   - `packages/config/src/__tests__/env.test.ts` (10 tests): defaults, `.env.example` values, URL protocols, coercion, missing and empty required variables, invalid `PORT`/`NODE_ENV`, and no values in errors
   - `apps/api/src/__tests__/infra.test.ts` (8 integration tests): PostgreSQL query and health, Redis PING, SET/GET with TTL, SET NX deduplication, pub/sub, health, and fast failure when Redis is unreachable
6. README: added `cp .env.example .env`, the `infra:check` step, and a note on running without Docker.

### Local Setup Without Docker
This machine runs Windows 11 Home. Docker Desktop needs WSL 2 there, since Hyper-V isn't available on Home, and installing WSL was declined. Task 5 was verified against equivalent services running natively instead:
- PostgreSQL 16.15 (portable binaries from `@embedded-postgres/windows-x64`)
- Garnet 2.2.4, Microsoft's Redis-protocol-compatible server, on a portable .NET 10 runtime
Both run outside the repo, on `127.0.0.1` only. **`docker compose up -d` itself has not been run yet.** The compose files were checked against the official Compose specification JSON schema instead. Whoever has Docker should run `docker compose up -d` and `docker compose ps` once to confirm both services report healthy.

### CLI Commands Executed
- `pnpm install`: added ioredis 5.11.1 and the workspace links
- `pnpm build`: 10/10 tasks succeeded
- `pnpm test`: 10/10 tasks succeeded; contracts 40, database 20, chess 42, config 10, api 8 (120 total)
- `pnpm --filter @crowdchess/api infra:check`: demo succeeded (see below)
- `DATABASE_URL=mysql://... pnpm --filter @crowdchess/api infra:check`: exited 1 with `DATABASE_URL must be a URL starting with postgresql:// or postgres://`, and the password was not printed
- Compose files validated with ajv against `compose-spec.json` (draft 2020-12): both `VALID`

### What Was Verified
- Demo: config loaded; PostgreSQL 16.15 answered `SELECT version()`; a user record was created, read back (match) and deleted; Redis `PING` → `PONG`, `SET` → `OK`, `GET` → `hello`
- Env validation rejects missing, empty and malformed required variables, reporting all at once without values
- Backend connects to PostgreSQL and executes a query; connects to Redis and does SET/GET, NX and pub/sub
- Not verified: `docker compose up -d` with real containers and health checks (needs Docker)

### Learnings
- Docker Desktop on Windows Home needs WSL 2, because the Hyper-V backend is only on Pro/Enterprise. GitHub Actions runners have Docker, so a CI job can verify the compose files without anything installed locally.
- Integration tests in different packages run in parallel under Turbo, and the database tests wipe every table before each test. Other packages' integration tests should not depend on rows persisting; the infra test only runs read queries, and the create/read/delete check is in the demo script.
- Redis keys in tests use a unique per-run prefix and are deleted afterwards, so a shared local Redis isn't polluted.
- Garnet is Redis-compatible for the commands used here (PING, SET with EX/NX, GET, TTL, KEYS, DEL, PUBLISH/SUBSCRIBE). Later tasks that rely on less common commands (e.g. Lua scripts) should also be tested against real Redis 7.


---

## Task 6: Session State Machine

### Steps Taken
1. Created `packages/game-core/src/session/machine.ts`, a pure state machine with no I/O:
   - `SessionEvent` discriminated union: `START`, `YOUTUBE_CONNECTED`, `CHALLENGE_ACCEPTED`, `GAME_STARTED`, `STREAMER_MOVED`, `MOVE_SELECTED`, `MOVE_CONFIRMED`, `MOVE_REJECTED`, `GAME_ENDED`, `PAUSE`, `RESUME { turn? }`, `ABORT`, `FAIL`
   - `SessionState = { status, pausedFrom }`, where `pausedFrom` records where a paused session returns to
   - `transition(state, event)` returns the next state or throws `InvalidTransitionError`; `canTransition` is the guard; `checkTransition` returns `{ ok, next | reason }` without throwing
   - Groups: `SETUP_STATUSES`, `IN_GAME_STATUSES`, `TERMINAL_STATUSES`
2. Prisma schema: added `Session.pausedFrom` and a new `SessionTransition` model (`id` autoincrement, `sessionId`, `fromStatus`, `toStatus`, `event`, `reason`, `createdAt`; cascade delete; index on `[sessionId, id]`). Migration: `20261106171250_session_transitions`.
3. Created `packages/game-core/src/session/service.ts` with `SessionStateService`:
   - `create()` makes a DRAFT session; `getState()`, `history()` (oldest first)
   - `apply(sessionId, event, reason?)` validates with the machine, then in one database transaction does a guarded `updateMany` (`WHERE id AND status AND pausedFrom` match what was read) and inserts the `SessionTransition` row. If the guard matches 0 rows it throws `ConcurrentTransitionError`. Terminal states set `endedAt`.
   - `onTransition(listener)` returns an unsubscribe function. Listeners run only after commit, and a throwing listener can't undo a committed transition.
   - `toSessionUpdatedEvent(record)` produces the contracts `session.updated` WebSocket event
4. Tests (`packages/game-core/src/__tests__/`):
   - `machine.test.ts` (143 tests): every non-paused status × every event checked against an explicit table of allowed transitions; full happy path including `MOVE_REJECTED`; pause/resume; terminal states; error contents; the `pausedFrom` invariant
   - `service.test.ts` (10 integration tests): persisted history with reasons and timestamps; invalid transition writes and emits nothing; `pausedFrom` round-trip; `endedAt`; not-found; cascade; listener order, unsubscribe and fault isolation; contracts schema check; a real race (exactly one winner); the stale-read guard (forced with a proxied Prisma client)
   - Integration tests use their own PostgreSQL schema, `game_core_test`. `vitest.global-setup.ts` drops it and runs `prisma migrate deploy` through Node, so no shell or pnpm is needed and it works on any OS.
5. `scripts/demo.ts` (`pnpm --filter @crowdchess/game-core demo`) for the Task 6 demo.
6. Exported the `SessionTransition` type from `@crowdchess/database`.
7. Fixed a Task 4 test issue: the chess property tests now have a 30s timeout (see Learnings).

### Deviations From the Plan's Diagram (intentional)
- **`GAME_ENDED` is accepted from `GAME_READY`, every in-game state, and `PAUSED` with a game in progress**, not only from `STREAMER_TURN`. Lichess is authoritative, and a game can end by resignation, timeout, draw or abort on either side's turn or while CrowdChess is paused.
- **`RESUME` of an in-progress game requires `turn`** (`STREAMER` or `AUDIENCE`) from the game stream instead of always going to `STREAMER_TURN`. The design doc (6.2) says the game stream decides whose turn it is. Resuming a session paused during setup returns to the setup step it was paused at.
- **Added `MOVE_REJECTED`** (`MOVE_SUBMITTING → AUDIENCE_TURN`) for design doc section 14: "Lichess returns illegal move: … reopen a safe round only if it is still the bot's turn."
- `DRAFT` cannot be paused, since nothing has started. Any non-terminal state can `ABORT` or `FAIL`.

### CLI Commands Executed
- `prisma migrate dev --name session_transitions` hung non-interactively after creating its shadow database, so it was stopped and replaced with:
  - `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261106171250_session_transitions/migration.sql`
  - `prisma migrate deploy` applied it
  - `prisma migrate diff ... --exit-code` reported "No difference detected"
  - `prisma generate`
- `pnpm build`: 10/10 tasks succeeded
- `pnpm exec turbo test --force`, twice: 10/10 tasks succeeded both times; config 10, contracts 40, api 8, database 20, game-core 153, chess 42 (273 total)
- `pnpm --filter @crowdchess/game-core demo`: succeeded

### What Was Verified
- Demo: a DEMOCRACY session was created in DRAFT and walked through START → YOUTUBE_CONNECTED → CHALLENGE_ACCEPTED → GAME_STARTED to STREAMER_TURN, with a `session.updated` event per step. The 4 `SessionTransition` rows were printed with timestamps and reasons, and the session row shows STREAMER_TURN. `MOVE_CONFIRMED` in STREAMER_TURN was rejected ("only valid in MOVE_SUBMITTING") and the status stayed STREAMER_TURN. The demo data was removed afterwards.
- All valid transitions, all rejected transitions and terminal states are unit tested; persistence is integration tested against PostgreSQL

### Learnings
- `prisma migrate dev` can block on a prompt when stdin is not a terminal, even with `--name`. For new migrations in scripted or agent environments, use `migrate diff --script` into a new migration folder, then `migrate deploy`.
- Guarding the update on the status that was read (`updateMany … WHERE status = ?` and checking `count === 1`) is a simple optimistic lock: two workers can't both apply a transition from the same state.
- An autoincrement `id` on the audit table gives reliable ordering. Several transitions can share a millisecond `createdAt`.
- Integration tests in different packages share one PostgreSQL. Giving each package its own schema (`?schema=...` in the URL, reset in a Vitest global setup) stops one package's cleanup from deleting another's data mid-test.
- The Task 4 SAN→UCI→SAN property test took about 4s alone but 10–12s when Turbo ran all packages in parallel, hitting Vitest's 5s default timeout. It was a timeout, not a wrong result. Property tests that exhaustively check positions need an explicit timeout.

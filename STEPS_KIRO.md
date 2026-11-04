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

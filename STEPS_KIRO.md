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

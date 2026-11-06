# CrowdChess

*A live-stream audience becomes the opponent.*

CrowdChess turns a livestream audience from passive viewers into an active chess opponent. A streamer connects a YouTube channel, starts a session, and plays a normal game against a dedicated CrowdChess bot account on Lichess. Viewers submit candidate moves through YouTube Live Chat. CrowdChess parses and validates those moves, runs one of three game-mode strategies, selects a move, submits it through the Lichess Bot API, and reconciles the resulting game state.

## Tech Stack

- **Backend:** Node.js + TypeScript + Fastify
- **Frontend:** React + TypeScript + Vite + Ant Design v5
- **Monorepo:** Turborepo + pnpm workspaces
- **Database:** PostgreSQL + Prisma
- **Cache/Coordination:** Redis
- **Chess Rules:** chess.js
- **Board UI:** react-chessboard
- **External APIs:** Lichess Bot API, YouTube Data API v3 / Live Streaming API
- **Testing:** Vitest, Playwright, fast-check

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 12+
- Docker (for PostgreSQL and Redis)

### Installation

```bash
pnpm install
```

### Development

```bash
# Create your local env file (DATABASE_URL and REDIS_URL are required)
cp .env.example .env

# Start PostgreSQL and Redis
docker compose up -d

# Check that the database and Redis are reachable
pnpm --filter @crowdchess/api infra:check

# Run database migrations
pnpm db:migrate

# Start both frontend and backend dev servers
pnpm dev
```

- Frontend (web): http://localhost:3000
- Backend (API): http://localhost:3001

**Without Docker:** any PostgreSQL 16 on `localhost:5432` and Redis 7 on `localhost:6379` will do, as long as they match `DATABASE_URL` and `REDIS_URL` in `.env`. On Windows, where Redis has no official build, Microsoft's Redis-compatible [Garnet](https://github.com/microsoft/garnet) works for local development.

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

## Project Structure

See [PLAN.md](./PLAN.md) for the full implementation plan and [STEPS_KIRO.md](./STEPS_KIRO.md) for the execution log.

## Game Modes

| Mode | Input | Selection | Viewer Reward |
| --- | --- | --- | --- |
| Democracy | Propose + vote | Highest vote count | Optional participation stats |
| Battle Royale | Propose move | Most-supported candidate | Points for winning submission |
| Chaos | Propose move | Random legal candidate | Optional participation stats |

## License

Hackathon MVP — see the design document for details.

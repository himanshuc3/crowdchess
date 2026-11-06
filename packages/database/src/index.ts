// @crowdchess/database
// Prisma schema, migrations, and generated client.
// Client and types are exported from here for use by other packages.

export { prisma, PrismaClient } from './client.js'
export type {
  User,
  YoutubeConnection,
  LichessBotConnection,
  Session,
  SessionTransition,
  Game,
  Round,
  ChatEvent,
  MoveCandidate,
  Vote,
  Score,
  GameEvent,
} from './generated/index.js'

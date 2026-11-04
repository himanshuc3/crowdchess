import { z } from 'zod'
import {
  GameModeSchema,
  RoundStatusSchema,
  SessionStatusSchema,
} from '../models/enums.js'

// ─── WebSocket Event Discriminated Union ───
// All events share a `type` field used for discriminated union narrowing.
// The frontend uses these to update dashboard components in real-time.

// ─── session.updated ───

export const SessionUpdatedEventSchema = z.object({
  type: z.literal('session.updated'),
  sessionId: z.string().uuid(),
  status: SessionStatusSchema,
  mode: GameModeSchema,
})
export type SessionUpdatedEvent = z.infer<typeof SessionUpdatedEventSchema>

// ─── round.opened ───

export const RoundOpenedEventSchema = z.object({
  type: z.literal('round.opened'),
  sessionId: z.string().uuid(),
  roundId: z.string().uuid(),
  ply: z.number().int().nonnegative(),
  mode: GameModeSchema,
  closesAt: z.string().datetime(),
})
export type RoundOpenedEvent = z.infer<typeof RoundOpenedEventSchema>

// ─── round.updated ───
// Pushed when candidate list or vote counts change.

export const CandidateSummarySchema = z.object({
  candidateId: z.string().uuid(),
  canonicalUci: z.string().min(1),
  san: z.string().min(1),
  voteCount: z.number().int().nonnegative(),
  submissionCount: z.number().int().nonnegative(),
})

export const RoundUpdatedEventSchema = z.object({
  type: z.literal('round.updated'),
  sessionId: z.string().uuid(),
  roundId: z.string().uuid(),
  candidates: z.array(CandidateSummarySchema),
  totalVotes: z.number().int().nonnegative(),
})
export type RoundUpdatedEvent = z.infer<typeof RoundUpdatedEventSchema>

// ─── round.closed ───

export const RoundClosedEventSchema = z.object({
  type: z.literal('round.closed'),
  sessionId: z.string().uuid(),
  roundId: z.string().uuid(),
  status: RoundStatusSchema,
  selectedMove: z.string().nullable(),
  selectedSan: z.string().nullable(),
})
export type RoundClosedEvent = z.infer<typeof RoundClosedEventSchema>

// ─── game.state ───
// Pushed when Lichess reports a new game state (FEN, moves).

export const GameStateEventSchema = z.object({
  type: z.literal('game.state'),
  sessionId: z.string().uuid(),
  gameId: z.string().uuid(),
  fen: z.string(),
  turn: z.enum(['white', 'black']),
  moveList: z.array(z.string()),
  isCheck: z.boolean(),
  isCheckmate: z.boolean(),
  isStalemate: z.boolean(),
  isGameOver: z.boolean(),
})
export type GameStateEvent = z.infer<typeof GameStateEventSchema>

// ─── move.confirmed ───
// Pushed when Lichess confirms a submitted move.

export const MoveConfirmedEventSchema = z.object({
  type: z.literal('move.confirmed'),
  sessionId: z.string().uuid(),
  gameId: z.string().uuid(),
  roundId: z.string().uuid(),
  moveUci: z.string(),
  moveSan: z.string(),
  fen: z.string(),
})
export type MoveConfirmedEvent = z.infer<typeof MoveConfirmedEventSchema>

// ─── leaderboard.updated ───
// Pushed when Battle Royale scores change.

export const LeaderboardEntrySchema = z.object({
  viewerId: z.string().min(1),
  viewerDisplayName: z.string(),
  points: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
})

export const LeaderboardUpdatedEventSchema = z.object({
  type: z.literal('leaderboard.updated'),
  sessionId: z.string().uuid(),
  entries: z.array(LeaderboardEntrySchema),
})
export type LeaderboardUpdatedEvent = z.infer<typeof LeaderboardUpdatedEventSchema>

// ─── Discriminated union of all WebSocket events ───

export const WSEventSchema = z.discriminatedUnion('type', [
  SessionUpdatedEventSchema,
  RoundOpenedEventSchema,
  RoundUpdatedEventSchema,
  RoundClosedEventSchema,
  GameStateEventSchema,
  MoveConfirmedEventSchema,
  LeaderboardUpdatedEventSchema,
])
export type WSEvent = z.infer<typeof WSEventSchema>

// ─── Helper: event type strings ───

export const WS_EVENT_TYPES = [
  'session.updated',
  'round.opened',
  'round.updated',
  'round.closed',
  'game.state',
  'move.confirmed',
  'leaderboard.updated',
] as const
export type WSEventType = (typeof WS_EVENT_TYPES)[number]

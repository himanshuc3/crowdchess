import { z } from 'zod'

// ─── Session State Machine ───
// DRAFT → CONNECTING_YOUTUBE → WAITING_FOR_LICHESS_CHALLENGE → GAME_READY
// → STREAMER_TURN → AUDIENCE_TURN → MOVE_SUBMITTING → STREAMER_TURN
// Terminal/exceptional: PAUSED, COMPLETED, ABORTED, FAILED

export const SessionStatusSchema = z.enum([
  'DRAFT',
  'CONNECTING_YOUTUBE',
  'WAITING_FOR_LICHESS_CHALLENGE',
  'GAME_READY',
  'STREAMER_TURN',
  'AUDIENCE_TURN',
  'MOVE_SUBMITTING',
  'PAUSED',
  'COMPLETED',
  'ABORTED',
  'FAILED',
])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

// ─── Round Status ───
// PENDING → OPEN → CLOSED → SUBMITTING → CONFIRMED
// Alternative: EXPIRED (no candidates), SKIPPED (no move)

export const RoundStatusSchema = z.enum([
  'PENDING', // Created but not yet open
  'OPEN', // Accepting submissions/votes
  'CLOSED', // Round closed, selecting move
  'SUBMITTING', // Move being submitted to Lichess
  'CONFIRMED', // Move confirmed by Lichess stream
  'EXPIRED', // No valid candidates after grace period
  'SKIPPED', // Round skipped (no move submitted)
])
export type RoundStatus = z.infer<typeof RoundStatusSchema>

// ─── Game Mode ───

export const GameModeSchema = z.enum(['DEMOCRACY', 'BATTLE_ROYALE', 'CHAOS'])
export type GameMode = z.infer<typeof GameModeSchema>

// ─── Game Status ───

export const GameStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'ABORTED'])
export type GameStatus = z.infer<typeof GameStatusSchema>

// ─── Bot Color ───

export const BotColorSchema = z.enum(['white', 'black'])
export type BotColor = z.infer<typeof BotColorSchema>

// ─── Chat Event Type ───

export const ChatEventTypeSchema = z.enum(['MOVE_SUBMISSION', 'VOTE', 'OTHER'])
export type ChatEventType = z.infer<typeof ChatEventTypeSchema>

// ─── Game Event Type (Lichess stream events) ───

export const GameEventTypeSchema = z.enum([
  'GAME_FULL',
  'GAME_STATE',
  'CHAT_LINE',
  'OPPONENT_GONE',
  'CHALLENGE',
  'GAME_FINISH',
])
export type GameEventType = z.infer<typeof GameEventTypeSchema>

// ─── Submission Result ───

export const SubmissionResultSchema = z.enum([
  'ACCEPTED', // Move accepted as a valid candidate
  'REJECTED_ILLEGAL', // Move is not legal for current position
  'REJECTED_MALFORMED', // Could not parse as SAN or UCI
  'REJECTED_STALE', // Message from a prior round
  'REJECTED_DUPLICATE', // Already submitted by this viewer
  'REJECTED_RATE_LIMITED', // Viewer exceeded submission rate
  'REJECTED_ROUND_CLOSED', // Round is no longer open
])
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>

import { z } from 'zod'
import {
  BotColorSchema,
  ChatEventTypeSchema,
  GameEventTypeSchema,
  GameModeSchema,
  GameStatusSchema,
  RoundStatusSchema,
  SessionStatusSchema,
  SubmissionResultSchema,
} from './enums.js'

// ─── Shared primitives ───

const uuid = z.string().uuid()
const isoTimestamp = z.string().datetime()
const nonEmptyString = z.string().min(1)

// ─── User ───

export const UserSchema = z.object({
  id: uuid,
  displayName: nonEmptyString,
  createdAt: isoTimestamp,
})
export type User = z.infer<typeof UserSchema>

// ─── YouTube Connection ───

export const YoutubeConnectionSchema = z.object({
  userId: uuid,
  channelId: nonEmptyString,
  status: z.enum(['ACTIVE', 'DISCONNECTED', 'REVOKED']),
  scopes: z.array(z.string()),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type YoutubeConnection = z.infer<typeof YoutubeConnectionSchema>

// ─── Lichess Bot Connection ───

export const LichessBotConnectionSchema = z.object({
  ownerUserId: uuid,
  botUsername: nonEmptyString,
  status: z.enum(['ACTIVE', 'DISCONNECTED', 'REVOKED']),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type LichessBotConnection = z.infer<typeof LichessBotConnectionSchema>

// ─── Session Settings ───

export const SessionSettingsSchema = z.object({
  votingDurationSeconds: z.number().int().positive().default(20),
  gracePeriodSeconds: z.number().int().positive().default(5),
  allowVoteChanges: z.boolean().default(true),
  tieBreak: z.enum(['RANDOM', 'DETERMINISTIC']).default('RANDOM'),
  noVoteBehavior: z.enum(['SKIP', 'ABORT']).default('SKIP'),
  maxCandidatesPerRound: z.number().int().positive().default(50),
})
export type SessionSettings = z.infer<typeof SessionSettingsSchema>

// ─── Session ───

export const SessionSchema = z.object({
  id: uuid,
  streamerUserId: uuid,
  youtubeBroadcastId: z.string().nullable(),
  mode: GameModeSchema,
  status: SessionStatusSchema,
  settings: SessionSettingsSchema,
  createdAt: isoTimestamp,
  endedAt: isoTimestamp.nullable(),
})
export type Session = z.infer<typeof SessionSchema>

// ─── Game ───

export const GameSchema = z.object({
  id: uuid,
  sessionId: uuid,
  platform: z.string().default('lichess'),
  platformGameId: z.string().nullable(),
  botColor: BotColorSchema.default('black'),
  currentFen: z.string(),
  status: GameStatusSchema,
  lastPlatformEventAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type Game = z.infer<typeof GameSchema>

// ─── Round ───

export const RoundSchema = z.object({
  id: uuid,
  gameId: uuid,
  ply: z.number().int().nonnegative(),
  mode: GameModeSchema,
  status: RoundStatusSchema,
  opensAt: isoTimestamp,
  closesAt: isoTimestamp.nullable(),
  selectedMove: z.string().nullable(),
  resultJson: z.string().nullable(),
  createdAt: isoTimestamp,
})
export type Round = z.infer<typeof RoundSchema>

// ─── Chat Event ───

export const ChatEventSchema = z.object({
  id: uuid,
  platformMessageId: nonEmptyString,
  roundId: uuid.nullable(),
  viewerPlatformId: nonEmptyString,
  viewerDisplayName: z.string().default(''),
  rawText: z.string(),
  parsedType: ChatEventTypeSchema,
  receivedAt: isoTimestamp,
})
export type ChatEvent = z.infer<typeof ChatEventSchema>

// ─── Move Candidate ───

export const MoveCandidateSchema = z.object({
  id: uuid,
  roundId: uuid,
  viewerId: nonEmptyString,
  canonicalUci: nonEmptyString,
  san: nonEmptyString,
  valid: z.boolean(),
  submissionCount: z.number().int().nonnegative().default(1),
  createdAt: isoTimestamp,
})
export type MoveCandidate = z.infer<typeof MoveCandidateSchema>

// ─── Vote ───

export const VoteSchema = z.object({
  id: uuid,
  roundId: uuid,
  viewerId: nonEmptyString,
  candidateId: uuid,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type Vote = z.infer<typeof VoteSchema>

// ─── Score (Battle Royale leaderboard) ───

export const ScoreSchema = z.object({
  sessionId: uuid,
  viewerId: nonEmptyString,
  viewerDisplayName: z.string().default(''),
  points: z.number().int().nonnegative().default(0),
  updatedAt: isoTimestamp,
})
export type Score = z.infer<typeof ScoreSchema>

// ─── Game Event (audit log for Lichess stream events) ───

export const GameEventSchema = z.object({
  id: uuid,
  gameId: uuid,
  eventType: GameEventTypeSchema,
  payloadJson: z.string(),
  platformEventAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
})
export type GameEvent = z.infer<typeof GameEventSchema>

// ─── Move Submission Result ───

export const MoveSubmissionResultSchema = z.object({
  result: SubmissionResultSchema,
  canonicalUci: z.string().optional(),
  san: z.string().optional(),
  reason: z.string().optional(),
})
export type MoveSubmissionResult = z.infer<typeof MoveSubmissionResultSchema>

// Re-export enums
export * from './enums.js'

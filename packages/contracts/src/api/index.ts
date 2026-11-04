import { z } from 'zod'
import { GameModeSchema } from '../models/enums.js'
import { SessionSettingsSchema } from '../models/index.js'

// ─── Broadcast (YouTube) ───

export const BroadcastSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: z.enum(['active', 'upcoming', 'completed']),
  liveChatId: z.string().nullable(),
  scheduledStartTime: z.string().nullable(),
})
export type Broadcast = z.infer<typeof BroadcastSchema>

// ─── POST /api/youtube/connect ───

export const ConnectYouTubeRequestSchema = z.object({})
export type ConnectYouTubeRequest = z.infer<typeof ConnectYouTubeRequestSchema>

export const ConnectYouTubeResponseSchema = z.object({
  redirectUrl: z.string().url(),
  state: z.string(),
})
export type ConnectYouTubeResponse = z.infer<typeof ConnectYouTubeResponseSchema>

// ─── GET /api/youtube/callback ───

export const YouTubeCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})
export type YouTubeCallbackQuery = z.infer<typeof YouTubeCallbackQuerySchema>

export const YouTubeCallbackResponseSchema = z.object({
  success: z.boolean(),
  channelId: z.string().optional(),
})
export type YouTubeCallbackResponse = z.infer<typeof YouTubeCallbackResponseSchema>

// ─── GET /api/youtube/broadcasts ───

export const ListBroadcastsResponseSchema = z.object({
  broadcasts: z.array(BroadcastSchema),
})
export type ListBroadcastsResponse = z.infer<typeof ListBroadcastsResponseSchema>

// ─── POST /api/sessions ───

export const CreateSessionRequestSchema = z.object({
  mode: GameModeSchema,
  youtubeBroadcastId: z.string().optional(),
  settings: SessionSettingsSchema.partial().optional(),
})
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>

export const CreateSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.string(),
    mode: GameModeSchema,
    settings: SessionSettingsSchema,
    createdAt: z.string().datetime(),
  }),
})
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>

// ─── POST /api/sessions/:id/start ───

export const StartSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.string(),
    mode: GameModeSchema,
  }),
})
export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>

// ─── POST /api/sessions/:id/pause ───

export const PauseSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.string(),
  }),
})
export type PauseSessionResponse = z.infer<typeof PauseSessionResponseSchema>

// ─── POST /api/sessions/:id/stop ───

export const StopSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.string(),
  }),
})
export type StopSessionResponse = z.infer<typeof StopSessionResponseSchema>

// ─── GET /api/sessions/:id ───

export const GetSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    streamerUserId: z.string().uuid(),
    youtubeBroadcastId: z.string().nullable(),
    mode: GameModeSchema,
    status: z.string(),
    settings: SessionSettingsSchema,
    createdAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable(),
  }),
  game: z
    .object({
      id: z.string().uuid(),
      platformGameId: z.string().nullable(),
      botColor: z.string(),
      currentFen: z.string(),
      status: z.string(),
    })
    .nullable()
    .optional(),
  round: z
    .object({
      id: z.string().uuid(),
      ply: z.number(),
      mode: GameModeSchema,
      status: z.string(),
      opensAt: z.string().datetime(),
      closesAt: z.string().datetime().nullable(),
      selectedMove: z.string().nullable(),
    })
    .nullable()
    .optional(),
})
export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>

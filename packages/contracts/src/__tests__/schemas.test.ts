import { describe, it, expect } from 'vitest'
import {
  SessionStatusSchema,
  RoundStatusSchema,
  GameModeSchema,
  GameStatusSchema,
  BotColorSchema,
  SubmissionResultSchema,
  SessionSettingsSchema,
  SessionSchema,
  GameSchema,
  RoundSchema,
  MoveCandidateSchema,
  VoteSchema,
  ScoreSchema,
  ChatEventSchema,
  CreateSessionRequestSchema,
  CreateSessionResponseSchema,
  ConnectYouTubeResponseSchema,
  BroadcastSchema,
} from '../index.js'

describe('Enums', () => {
  it('SessionStatusSchema accepts all valid session states', () => {
    const validStates = [
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
    ]
    for (const state of validStates) {
      expect(SessionStatusSchema.parse(state)).toBe(state)
    }
  })

  it('SessionStatusSchema rejects invalid states', () => {
    expect(() => SessionStatusSchema.parse('INVALID')).toThrow()
    expect(() => SessionStatusSchema.parse('')).toThrow()
  })

  it('RoundStatusSchema accepts all valid round states', () => {
    const validStates = ['PENDING', 'OPEN', 'CLOSED', 'SUBMITTING', 'CONFIRMED', 'EXPIRED', 'SKIPPED']
    for (const state of validStates) {
      expect(RoundStatusSchema.parse(state)).toBe(state)
    }
  })

  it('GameModeSchema accepts the three game modes', () => {
    expect(GameModeSchema.parse('DEMOCRACY')).toBe('DEMOCRACY')
    expect(GameModeSchema.parse('BATTLE_ROYALE')).toBe('BATTLE_ROYALE')
    expect(GameModeSchema.parse('CHAOS')).toBe('CHAOS')
  })

  it('GameModeSchema rejects unknown modes', () => {
    expect(() => GameModeSchema.parse('SPEED')).toThrow()
  })

  it('GameStatusSchema accepts valid statuses', () => {
    expect(GameStatusSchema.parse('ACTIVE')).toBe('ACTIVE')
    expect(GameStatusSchema.parse('COMPLETED')).toBe('COMPLETED')
    expect(GameStatusSchema.parse('ABORTED')).toBe('ABORTED')
  })

  it('BotColorSchema accepts white and black', () => {
    expect(BotColorSchema.parse('white')).toBe('white')
    expect(BotColorSchema.parse('black')).toBe('black')
  })

  it('SubmissionResultSchema accepts all result types', () => {
    const results = [
      'ACCEPTED',
      'REJECTED_ILLEGAL',
      'REJECTED_MALFORMED',
      'REJECTED_STALE',
      'REJECTED_DUPLICATE',
      'REJECTED_RATE_LIMITED',
      'REJECTED_ROUND_CLOSED',
    ]
    for (const r of results) {
      expect(SubmissionResultSchema.parse(r)).toBe(r)
    }
  })
})

describe('SessionSettings', () => {
  it('accepts valid settings with defaults', () => {
    const settings = SessionSettingsSchema.parse({})
    expect(settings.votingDurationSeconds).toBe(20)
    expect(settings.gracePeriodSeconds).toBe(5)
    expect(settings.allowVoteChanges).toBe(true)
    expect(settings.tieBreak).toBe('RANDOM')
    expect(settings.noVoteBehavior).toBe('SKIP')
    expect(settings.maxCandidatesPerRound).toBe(50)
  })

  it('accepts custom settings', () => {
    const settings = SessionSettingsSchema.parse({
      votingDurationSeconds: 15,
      gracePeriodSeconds: 3,
      allowVoteChanges: false,
      tieBreak: 'DETERMINISTIC',
      noVoteBehavior: 'ABORT',
      maxCandidatesPerRound: 100,
    })
    expect(settings.votingDurationSeconds).toBe(15)
    expect(settings.allowVoteChanges).toBe(false)
    expect(settings.tieBreak).toBe('DETERMINISTIC')
  })

  it('rejects non-positive durations', () => {
    expect(() => SessionSettingsSchema.parse({ votingDurationSeconds: 0 })).toThrow()
    expect(() => SessionSettingsSchema.parse({ votingDurationSeconds: -5 })).toThrow()
  })
})

describe('Session', () => {
  const validSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    streamerUserId: '550e8400-e29b-41d4-a716-446655440001',
    youtubeBroadcastId: null,
    mode: 'DEMOCRACY',
    status: 'DRAFT',
    settings: {},
    createdAt: '2026-11-04T12:00:00.000Z',
    endedAt: null,
  }

  it('accepts a valid session', () => {
    const session = SessionSchema.parse(validSession)
    expect(session.mode).toBe('DEMOCRACY')
    expect(session.settings.votingDurationSeconds).toBe(20)
  })

  it('rejects invalid UUID', () => {
    expect(() => SessionSchema.parse({ ...validSession, id: 'not-a-uuid' })).toThrow()
  })

  it('rejects invalid mode', () => {
    expect(() => SessionSchema.parse({ ...validSession, mode: 'SPEED' })).toThrow()
  })
})

describe('Game', () => {
  const validGame = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    sessionId: '550e8400-e29b-41d4-a716-446655440011',
    platformGameId: 'abc123',
    botColor: 'black',
    currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'ACTIVE',
    lastPlatformEventAt: null,
    createdAt: '2026-11-04T12:00:00.000Z',
    updatedAt: '2026-11-04T12:00:00.000Z',
  }

  it('accepts a valid game', () => {
    const game = GameSchema.parse(validGame)
    expect(game.botColor).toBe('black')
    expect(game.status).toBe('ACTIVE')
  })
})

describe('Round', () => {
  const validRound = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    gameId: '550e8400-e29b-41d4-a716-446655440021',
    ply: 1,
    mode: 'DEMOCRACY',
    status: 'OPEN',
    opensAt: '2026-11-04T12:00:00.000Z',
    closesAt: null,
    selectedMove: null,
    resultJson: null,
    createdAt: '2026-11-04T12:00:00.000Z',
  }

  it('accepts a valid round', () => {
    const round = RoundSchema.parse(validRound)
    expect(round.ply).toBe(1)
    expect(round.status).toBe('OPEN')
  })

  it('rejects negative ply', () => {
    expect(() => RoundSchema.parse({ ...validRound, ply: -1 })).toThrow()
  })
})

describe('MoveCandidate', () => {
  it('accepts a valid candidate', () => {
    const candidate = MoveCandidateSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440030',
      roundId: '550e8400-e29b-41d4-a716-446655440031',
      viewerId: 'UC_viewer123',
      canonicalUci: 'g1f3',
      san: 'Nf3',
      valid: true,
      submissionCount: 1,
      createdAt: '2026-11-04T12:00:00.000Z',
    })
    expect(candidate.canonicalUci).toBe('g1f3')
  })
})

describe('Vote', () => {
  it('accepts a valid vote', () => {
    const vote = VoteSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440040',
      roundId: '550e8400-e29b-41d4-a716-446655440041',
      viewerId: 'UC_viewer123',
      candidateId: '550e8400-e29b-41d4-a716-446655440042',
      createdAt: '2026-11-04T12:00:00.000Z',
      updatedAt: '2026-11-04T12:00:00.000Z',
    })
    expect(vote.viewerId).toBe('UC_viewer123')
  })
})

describe('Score', () => {
  it('accepts a valid score entry', () => {
    const score = ScoreSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440050',
      viewerId: 'UC_viewer123',
      viewerDisplayName: 'ChessFan42',
      points: 30,
      updatedAt: '2026-11-04T12:00:00.000Z',
    })
    expect(score.points).toBe(30)
  })
})

describe('ChatEvent', () => {
  it('accepts a valid chat event', () => {
    const event = ChatEventSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440060',
      platformMessageId: 'msg_abc123',
      roundId: '550e8400-e29b-41d4-a716-446655440061',
      viewerPlatformId: 'UC_viewer123',
      viewerDisplayName: 'ChessFan42',
      rawText: 'Nf6',
      parsedType: 'MOVE_SUBMISSION',
      receivedAt: '2026-11-04T12:00:00.000Z',
    })
    expect(event.rawText).toBe('Nf6')
    expect(event.parsedType).toBe('MOVE_SUBMISSION')
  })
})

describe('API Schemas', () => {
  it('CreateSessionRequestSchema accepts valid request', () => {
    const req = CreateSessionRequestSchema.parse({
      mode: 'DEMOCRACY',
      youtubeBroadcastId: 'broadcast123',
      settings: { votingDurationSeconds: 15 },
    })
    expect(req.mode).toBe('DEMOCRACY')
  })

  it('CreateSessionRequestSchema rejects missing mode', () => {
    expect(() => CreateSessionRequestSchema.parse({})).toThrow()
  })

  it('ConnectYouTubeResponseSchema accepts valid response', () => {
    const res = ConnectYouTubeResponseSchema.parse({
      redirectUrl: 'https://accounts.google.com/o/oauth2/auth?...',
      state: 'random_state_string',
    })
    expect(res.state).toBe('random_state_string')
  })

  it('ConnectYouTubeResponseSchema rejects non-URL redirectUrl', () => {
    expect(() =>
      ConnectYouTubeResponseSchema.parse({
        redirectUrl: 'not-a-url',
        state: 'state',
      }),
    ).toThrow()
  })

  it('BroadcastSchema accepts a valid broadcast', () => {
    const b = BroadcastSchema.parse({
      id: 'broadcast123',
      title: 'Chess Stream',
      status: 'active',
      liveChatId: 'live_chat_abc',
      scheduledStartTime: '2026-11-04T12:00:00.000Z',
    })
    expect(b.liveChatId).toBe('live_chat_abc')
  })

  it('BroadcastSchema accepts null liveChatId', () => {
    const b = BroadcastSchema.parse({
      id: 'broadcast456',
      title: 'Upcoming Stream',
      status: 'upcoming',
      liveChatId: null,
      scheduledStartTime: null,
    })
    expect(b.liveChatId).toBeNull()
  })
})

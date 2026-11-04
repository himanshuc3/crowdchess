import { describe, it, expect } from 'vitest'
import {
  WSEventSchema,
  SessionUpdatedEventSchema,
  RoundOpenedEventSchema,
  RoundUpdatedEventSchema,
  RoundClosedEventSchema,
  GameStateEventSchema,
  MoveConfirmedEventSchema,
  LeaderboardUpdatedEventSchema,
  WS_EVENT_TYPES,
  type WSEvent,
} from '../index.js'

describe('WebSocket Events', () => {
  const validSessionId = '550e8400-e29b-41d4-a716-446655440000'
  const validRoundId = '550e8400-e29b-41d4-a716-446655440020'
  const validGameId = '550e8400-e29b-41d4-a716-446655440010'
  const isoTime = '2026-11-04T12:00:00.000Z'

  it('session.updated parses correctly', () => {
    const event = {
      type: 'session.updated' as const,
      sessionId: validSessionId,
      status: 'STREAMER_TURN' as const,
      mode: 'DEMOCRACY' as const,
    }
    const parsed = SessionUpdatedEventSchema.parse(event)
    expect(parsed.type).toBe('session.updated')
    expect(parsed.status).toBe('STREAMER_TURN')
  })

  it('round.opened parses correctly', () => {
    const event = {
      type: 'round.opened' as const,
      sessionId: validSessionId,
      roundId: validRoundId,
      ply: 3,
      mode: 'DEMOCRACY' as const,
      closesAt: isoTime,
    }
    const parsed = RoundOpenedEventSchema.parse(event)
    expect(parsed.ply).toBe(3)
  })

  it('round.updated parses with candidates', () => {
    const event = {
      type: 'round.updated' as const,
      sessionId: validSessionId,
      roundId: validRoundId,
      candidates: [
        {
          candidateId: '550e8400-e29b-41d4-a716-446655440030',
          canonicalUci: 'g1f3',
          san: 'Nf3',
          voteCount: 5,
          submissionCount: 3,
        },
        {
          candidateId: '550e8400-e29b-41d4-a716-446655440031',
          canonicalUci: 'e2e4',
          san: 'e4',
          voteCount: 8,
          submissionCount: 8,
        },
      ],
      totalVotes: 13,
    }
    const parsed = RoundUpdatedEventSchema.parse(event)
    expect(parsed.candidates).toHaveLength(2)
    expect(parsed.totalVotes).toBe(13)
  })

  it('round.closed parses with selected move', () => {
    const event = {
      type: 'round.closed' as const,
      sessionId: validSessionId,
      roundId: validRoundId,
      status: 'CONFIRMED' as const,
      selectedMove: 'g1f3',
      selectedSan: 'Nf3',
    }
    const parsed = RoundClosedEventSchema.parse(event)
    expect(parsed.selectedMove).toBe('g1f3')
    expect(parsed.selectedSan).toBe('Nf3')
  })

  it('round.closed parses with null move (skipped)', () => {
    const event = {
      type: 'round.closed' as const,
      sessionId: validSessionId,
      roundId: validRoundId,
      status: 'SKIPPED' as const,
      selectedMove: null,
      selectedSan: null,
    }
    const parsed = RoundClosedEventSchema.parse(event)
    expect(parsed.selectedMove).toBeNull()
  })

  it('game.state parses correctly', () => {
    const event = {
      type: 'game.state' as const,
      sessionId: validSessionId,
      gameId: validGameId,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'white' as const,
      moveList: ['e2e4', 'e7e5'],
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isGameOver: false,
    }
    const parsed = GameStateEventSchema.parse(event)
    expect(parsed.turn).toBe('white')
    expect(parsed.moveList).toHaveLength(2)
  })

  it('move.confirmed parses correctly', () => {
    const event = {
      type: 'move.confirmed' as const,
      sessionId: validSessionId,
      gameId: validGameId,
      roundId: validRoundId,
      moveUci: 'g1f3',
      moveSan: 'Nf3',
      fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
    }
    const parsed = MoveConfirmedEventSchema.parse(event)
    expect(parsed.moveUci).toBe('g1f3')
  })

  it('leaderboard.updated parses with entries', () => {
    const event = {
      type: 'leaderboard.updated' as const,
      sessionId: validSessionId,
      entries: [
        { viewerId: 'UC_viewer1', viewerDisplayName: 'ChessFan1', points: 30, rank: 1 },
        { viewerId: 'UC_viewer2', viewerDisplayName: 'ChessFan2', points: 20, rank: 2 },
      ],
    }
    const parsed = LeaderboardUpdatedEventSchema.parse(event)
    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries[0].rank).toBe(1)
  })
})

describe('WSEvent discriminated union', () => {
  const validSessionId = '550e8400-e29b-41d4-a716-446655440000'

  it('parses session.updated via union schema', () => {
    const event = {
      type: 'session.updated' as const,
      sessionId: validSessionId,
      status: 'STREAMER_TURN' as const,
      mode: 'DEMOCRACY' as const,
    }
    const parsed = WSEventSchema.parse(event)
    expect(parsed.type).toBe('session.updated')
  })

  it('parses game.state via union schema', () => {
    const event = {
      type: 'game.state' as const,
      sessionId: validSessionId,
      gameId: '550e8400-e29b-41d4-a716-446655440010',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'white' as const,
      moveList: [],
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isGameOver: false,
    }
    const parsed = WSEventSchema.parse(event)
    expect(parsed.type).toBe('game.state')
  })

  it('rejects unknown event type', () => {
    expect(() =>
      WSEventSchema.parse({
        type: 'unknown.event',
        sessionId: validSessionId,
      }),
    ).toThrow()
  })

  it('all 7 event types are defined', () => {
    expect(WS_EVENT_TYPES).toHaveLength(7)
    expect(WS_EVENT_TYPES).toContain('session.updated')
    expect(WS_EVENT_TYPES).toContain('round.opened')
    expect(WS_EVENT_TYPES).toContain('round.updated')
    expect(WS_EVENT_TYPES).toContain('round.closed')
    expect(WS_EVENT_TYPES).toContain('game.state')
    expect(WS_EVENT_TYPES).toContain('move.confirmed')
    expect(WS_EVENT_TYPES).toContain('leaderboard.updated')
  })

  it('WSEvent type can be narrowed by discriminated union', () => {
    // Type-level test: this assignment compiles only if discriminated union works
    const event: WSEvent = {
      type: 'session.updated',
      sessionId: validSessionId,
      status: 'DRAFT',
      mode: 'DEMOCRACY',
    }

    if (event.type === 'session.updated') {
      // TypeScript narrows to SessionUpdatedEvent here
      expect(event.status).toBe('DRAFT')
    }
  })
})

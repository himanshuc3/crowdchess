import { describe, it, expect } from 'vitest'
import { SessionStatusSchema, type SessionStatus } from '@crowdchess/contracts'
import {
  canTransition,
  checkTransition,
  InvalidTransitionError,
  SESSION_EVENT_TYPES,
  TERMINAL_STATUSES,
  transition,
  type SessionEvent,
  type SessionEventType,
  type SessionState,
} from '../index.js'

const ALL_STATUSES = SessionStatusSchema.options
const NOT_PAUSED = ALL_STATUSES.filter((s) => s !== 'PAUSED')

const state = (status: SessionStatus, pausedFrom: SessionStatus | null = null): SessionState => ({
  status,
  pausedFrom,
})
const event = (type: SessionEventType): SessionEvent =>
  type === 'RESUME' ? { type, turn: 'STREAMER' } : ({ type } as SessionEvent)

const STOPPABLE = { ABORT: 'ABORTED', FAIL: 'FAILED' } as const

/** Every allowed transition from a non-paused status. Anything not listed must be rejected. */
const EXPECTED: Record<Exclude<SessionStatus, 'PAUSED'>, Partial<Record<SessionEventType, SessionStatus>>> = {
  DRAFT: { START: 'CONNECTING_YOUTUBE', ...STOPPABLE },
  CONNECTING_YOUTUBE: { YOUTUBE_CONNECTED: 'WAITING_FOR_LICHESS_CHALLENGE', PAUSE: 'PAUSED', ...STOPPABLE },
  WAITING_FOR_LICHESS_CHALLENGE: { CHALLENGE_ACCEPTED: 'GAME_READY', PAUSE: 'PAUSED', ...STOPPABLE },
  GAME_READY: { GAME_STARTED: 'STREAMER_TURN', GAME_ENDED: 'COMPLETED', PAUSE: 'PAUSED', ...STOPPABLE },
  STREAMER_TURN: { STREAMER_MOVED: 'AUDIENCE_TURN', GAME_ENDED: 'COMPLETED', PAUSE: 'PAUSED', ...STOPPABLE },
  AUDIENCE_TURN: { MOVE_SELECTED: 'MOVE_SUBMITTING', GAME_ENDED: 'COMPLETED', PAUSE: 'PAUSED', ...STOPPABLE },
  MOVE_SUBMITTING: {
    MOVE_CONFIRMED: 'STREAMER_TURN',
    MOVE_REJECTED: 'AUDIENCE_TURN',
    GAME_ENDED: 'COMPLETED',
    PAUSE: 'PAUSED',
    ...STOPPABLE,
  },
  COMPLETED: {},
  ABORTED: {},
  FAILED: {},
}

describe('transition table', () => {
  for (const from of NOT_PAUSED) {
    for (const type of SESSION_EVENT_TYPES) {
      const expected = EXPECTED[from as keyof typeof EXPECTED][type]
      it(`${from} + ${type} -> ${expected ?? 'rejected'}`, () => {
        expect(canTransition(state(from), event(type))).toBe(expected !== undefined)
        if (expected) {
          expect(transition(state(from), event(type)).status).toBe(expected)
        } else {
          expect(() => transition(state(from), event(type))).toThrow(InvalidTransitionError)
        }
      })
    }
  }
})

describe('happy path', () => {
  it('walks setup into the game loop and around it', () => {
    let s = state('DRAFT')
    const path: [SessionEventType, SessionStatus][] = [
      ['START', 'CONNECTING_YOUTUBE'],
      ['YOUTUBE_CONNECTED', 'WAITING_FOR_LICHESS_CHALLENGE'],
      ['CHALLENGE_ACCEPTED', 'GAME_READY'],
      ['GAME_STARTED', 'STREAMER_TURN'],
      ['STREAMER_MOVED', 'AUDIENCE_TURN'],
      ['MOVE_SELECTED', 'MOVE_SUBMITTING'],
      ['MOVE_CONFIRMED', 'STREAMER_TURN'],
      ['STREAMER_MOVED', 'AUDIENCE_TURN'],
      ['MOVE_SELECTED', 'MOVE_SUBMITTING'],
      ['MOVE_REJECTED', 'AUDIENCE_TURN'],
      ['MOVE_SELECTED', 'MOVE_SUBMITTING'],
      ['MOVE_CONFIRMED', 'STREAMER_TURN'],
      ['GAME_ENDED', 'COMPLETED'],
    ]
    for (const [type, expected] of path) {
      s = transition(s, event(type))
      expect(s).toEqual({ status: expected, pausedFrom: null })
    }
  })
})

describe('pause and resume', () => {
  it('records where the session was paused and returns there during setup', () => {
    const paused = transition(state('WAITING_FOR_LICHESS_CHALLENGE'), { type: 'PAUSE' })
    expect(paused).toEqual({ status: 'PAUSED', pausedFrom: 'WAITING_FOR_LICHESS_CHALLENGE' })
    expect(transition(paused, { type: 'RESUME' })).toEqual({
      status: 'WAITING_FOR_LICHESS_CHALLENGE',
      pausedFrom: null,
    })
  })

  it('resumes an in-progress game to the turn reported by the game stream', () => {
    const paused = transition(state('AUDIENCE_TURN'), { type: 'PAUSE' })
    expect(transition(paused, { type: 'RESUME', turn: 'STREAMER' }).status).toBe('STREAMER_TURN')
    expect(transition(paused, { type: 'RESUME', turn: 'AUDIENCE' }).status).toBe('AUDIENCE_TURN')
  })

  it('refuses to resume an in-progress game without the turn', () => {
    const paused = state('PAUSED', 'MOVE_SUBMITTING')
    const result = checkTransition(paused, { type: 'RESUME' })
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('current turn') })
  })

  it('cannot pause twice, pause a DRAFT, or resume when not paused', () => {
    expect(canTransition(state('PAUSED', 'STREAMER_TURN'), { type: 'PAUSE' })).toBe(false)
    expect(canTransition(state('DRAFT'), { type: 'PAUSE' })).toBe(false)
    expect(canTransition(state('STREAMER_TURN'), { type: 'RESUME', turn: 'STREAMER' })).toBe(false)
  })

  it('allows only RESUME, ABORT, FAIL and (once a game exists) GAME_ENDED while paused', () => {
    const inGame = state('PAUSED', 'AUDIENCE_TURN')
    const inSetup = state('PAUSED', 'CONNECTING_YOUTUBE')
    const allowed = (s: SessionState) =>
      SESSION_EVENT_TYPES.filter((t) => canTransition(s, event(t))).sort()
    expect(allowed(inGame)).toEqual(['ABORT', 'FAIL', 'GAME_ENDED', 'RESUME'])
    expect(allowed(inSetup)).toEqual(['ABORT', 'FAIL', 'RESUME'])
    expect(transition(inGame, { type: 'GAME_ENDED' })).toEqual({ status: 'COMPLETED', pausedFrom: null })
    expect(transition(inGame, { type: 'ABORT' })).toEqual({ status: 'ABORTED', pausedFrom: null })
  })
})

describe('terminal states', () => {
  for (const terminal of TERMINAL_STATUSES) {
    it(`${terminal} rejects every event`, () => {
      for (const type of SESSION_EVENT_TYPES) {
        const result = checkTransition(state(terminal), event(type))
        expect(result).toEqual({ ok: false, reason: `${terminal} is a terminal state` })
      }
    })
  }
})

describe('errors', () => {
  it('InvalidTransitionError carries the state, event and reason', () => {
    try {
      transition(state('DRAFT'), { type: 'MOVE_SELECTED' })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError)
      const e = err as InvalidTransitionError
      expect(e.from).toEqual(state('DRAFT'))
      expect(e.event).toBe('MOVE_SELECTED')
      expect(e.message).toBe(
        'Cannot apply MOVE_SELECTED to a session in DRAFT: MOVE_SELECTED is only valid in AUDIENCE_TURN',
      )
    }
  })

  it('never returns a paused state without pausedFrom, or pausedFrom outside PAUSED', () => {
    for (const from of NOT_PAUSED) {
      for (const type of SESSION_EVENT_TYPES) {
        const result = checkTransition(state(from), event(type))
        if (!result.ok) continue
        expect(result.next.pausedFrom !== null).toBe(result.next.status === 'PAUSED')
      }
    }
  })
})

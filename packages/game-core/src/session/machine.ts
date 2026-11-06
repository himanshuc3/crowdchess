import type { SessionStatus } from '@crowdchess/contracts'

/** Whose move it is, as reported by the Lichess game stream. */
export type TurnOwner = 'STREAMER' | 'AUDIENCE'

export type SessionEvent =
  | { type: 'START' }
  | { type: 'YOUTUBE_CONNECTED' }
  | { type: 'CHALLENGE_ACCEPTED' }
  | { type: 'GAME_STARTED' }
  | { type: 'STREAMER_MOVED' }
  | { type: 'MOVE_SELECTED' }
  | { type: 'MOVE_CONFIRMED' }
  | { type: 'MOVE_REJECTED' }
  | { type: 'GAME_ENDED' }
  | { type: 'PAUSE' }
  /** `turn` comes from the game stream and is required when resuming an in-progress game. */
  | { type: 'RESUME'; turn?: TurnOwner }
  | { type: 'ABORT' }
  | { type: 'FAIL' }

export type SessionEventType = SessionEvent['type']

export const SESSION_EVENT_TYPES = [
  'START',
  'YOUTUBE_CONNECTED',
  'CHALLENGE_ACCEPTED',
  'GAME_STARTED',
  'STREAMER_MOVED',
  'MOVE_SELECTED',
  'MOVE_CONFIRMED',
  'MOVE_REJECTED',
  'GAME_ENDED',
  'PAUSE',
  'RESUME',
  'ABORT',
  'FAIL',
] as const satisfies readonly SessionEventType[]

/** The machine's full state: the status, plus where to return to after a pause. */
export interface SessionState {
  status: SessionStatus
  /** Status the session was in when paused; null unless status is PAUSED. */
  pausedFrom: SessionStatus | null
}

export const SETUP_STATUSES = [
  'DRAFT',
  'CONNECTING_YOUTUBE',
  'WAITING_FOR_LICHESS_CHALLENGE',
  'GAME_READY',
] as const satisfies readonly SessionStatus[]

export const IN_GAME_STATUSES = [
  'STREAMER_TURN',
  'AUDIENCE_TURN',
  'MOVE_SUBMITTING',
] as const satisfies readonly SessionStatus[]

export const TERMINAL_STATUSES = [
  'COMPLETED',
  'ABORTED',
  'FAILED',
] as const satisfies readonly SessionStatus[]

/** The main game loop: each event moves the session one step forward from exactly one status. */
const FORWARD: Partial<Record<SessionEventType, [SessionStatus, SessionStatus]>> = {
  START: ['DRAFT', 'CONNECTING_YOUTUBE'],
  YOUTUBE_CONNECTED: ['CONNECTING_YOUTUBE', 'WAITING_FOR_LICHESS_CHALLENGE'],
  CHALLENGE_ACCEPTED: ['WAITING_FOR_LICHESS_CHALLENGE', 'GAME_READY'],
  GAME_STARTED: ['GAME_READY', 'STREAMER_TURN'],
  STREAMER_MOVED: ['STREAMER_TURN', 'AUDIENCE_TURN'],
  MOVE_SELECTED: ['AUDIENCE_TURN', 'MOVE_SUBMITTING'],
  MOVE_CONFIRMED: ['MOVE_SUBMITTING', 'STREAMER_TURN'],
  // Lichess refused the move: reopen the audience round (it is still the bot's turn).
  MOVE_REJECTED: ['MOVE_SUBMITTING', 'AUDIENCE_TURN'],
}

export type TransitionCheck =
  | { ok: true; next: SessionState }
  | { ok: false; reason: string }

/** Works out the next state without throwing. */
export function checkTransition(state: SessionState, event: SessionEvent): TransitionCheck {
  const { status, pausedFrom } = state
  const fail = (reason: string): TransitionCheck => ({ ok: false, reason })
  const to = (next: SessionStatus, nextPausedFrom: SessionStatus | null = null): TransitionCheck => ({
    ok: true,
    next: { status: next, pausedFrom: nextPausedFrom },
  })

  if (isTerminal(status)) return fail(`${status} is a terminal state`)

  const forward = FORWARD[event.type]
  if (forward) {
    return status === forward[0] ? to(forward[1]) : fail(`${event.type} is only valid in ${forward[0]}`)
  }

  switch (event.type) {
    case 'GAME_ENDED': {
      // Lichess decides when a game ends (mate, resignation, timeout, draw), which can happen on
      // either side's turn or while the session is paused.
      const inGame = (s: SessionStatus | null) => s === 'GAME_READY' || isInGame(s)
      if (inGame(status) || (status === 'PAUSED' && inGame(pausedFrom))) return to('COMPLETED')
      return fail('GAME_ENDED is only valid once a game exists')
    }
    case 'PAUSE':
      if (status === 'PAUSED') return fail('the session is already paused')
      if (status === 'DRAFT') return fail('a DRAFT session has not started, so it cannot be paused')
      return to('PAUSED', status)
    case 'RESUME': {
      if (status !== 'PAUSED' || pausedFrom === null) return fail('RESUME is only valid in PAUSED')
      if (!isInGame(pausedFrom)) return to(pausedFrom)
      if (!event.turn) return fail('RESUME needs the current turn from the game stream')
      return to(event.turn === 'STREAMER' ? 'STREAMER_TURN' : 'AUDIENCE_TURN')
    }
    case 'ABORT':
      return to('ABORTED')
    case 'FAIL':
      return to('FAILED')
    default:
      return fail(`unknown event ${(event as { type: string }).type}`)
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SessionState,
    public readonly event: SessionEventType,
    public readonly detail: string,
  ) {
    super(`Cannot apply ${event} to a session in ${from.status}: ${detail}`)
    this.name = 'InvalidTransitionError'
  }
}

/** Returns the next state, or throws InvalidTransitionError. Pure: no I/O. */
export function transition(state: SessionState, event: SessionEvent): SessionState {
  const result = checkTransition(state, event)
  if (!result.ok) throw new InvalidTransitionError(state, event.type, result.reason)
  return result.next
}

/** Guard: whether the event is allowed in this state. */
export function canTransition(state: SessionState, event: SessionEvent): boolean {
  return checkTransition(state, event).ok
}

export function isTerminal(status: SessionStatus | null): boolean {
  return (TERMINAL_STATUSES as readonly (SessionStatus | null)[]).includes(status)
}

export function isInGame(status: SessionStatus | null): boolean {
  return (IN_GAME_STATUSES as readonly (SessionStatus | null)[]).includes(status)
}

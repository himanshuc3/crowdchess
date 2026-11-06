import type { GameMode, SessionSettings, SessionStatus, SessionUpdatedEvent } from '@crowdchess/contracts'
import type { PrismaClient, Session } from '@crowdchess/database'
import {
  isTerminal,
  transition,
  type SessionEvent,
  type SessionEventType,
  type SessionState,
} from './machine.js'

/** A transition that has been committed to the database. */
export interface TransitionRecord {
  id: number
  sessionId: string
  mode: GameMode
  from: SessionStatus
  to: SessionStatus
  event: SessionEventType
  reason: string | null
  at: Date
}

export type TransitionListener = (record: TransitionRecord) => void

export class SessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Session ${sessionId} not found`)
    this.name = 'SessionNotFoundError'
  }
}

/** Another writer changed the session between our read and our write; re-read and retry. */
export class ConcurrentTransitionError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly expected: SessionStatus,
  ) {
    super(`Session ${sessionId} was changed concurrently (expected it to be ${expected})`)
    this.name = 'ConcurrentTransitionError'
  }
}

export interface CreateSessionInput {
  streamerUserId: string
  mode: GameMode
  settings?: Partial<SessionSettings>
  youtubeBroadcastId?: string
}

/**
 * Applies state machine transitions to persisted sessions.
 *
 * Each transition updates the session row and appends a SessionTransition row in one database
 * transaction. The update is guarded on the status we read, so if two workers race, exactly one
 * wins and the other gets ConcurrentTransitionError. Listeners run only after the commit.
 */
export class SessionStateService {
  private readonly listeners = new Set<TransitionListener>()

  constructor(private readonly prisma: PrismaClient) {}

  /** Subscribes to committed transitions. Returns an unsubscribe function. */
  onTransition(listener: TransitionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Creates a session in DRAFT. */
  async create(input: CreateSessionInput): Promise<Session> {
    return this.prisma.session.create({
      data: {
        streamerUserId: input.streamerUserId,
        mode: input.mode,
        status: 'DRAFT',
        settingsJson: input.settings ?? {},
        youtubeBroadcastId: input.youtubeBroadcastId ?? null,
      },
    })
  }

  async getState(sessionId: string): Promise<SessionState> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { status: true, pausedFrom: true },
    })
    if (!session) throw new SessionNotFoundError(sessionId)
    return toState(session)
  }

  /**
   * Validates and persists one transition.
   * Throws InvalidTransitionError (nothing is written), SessionNotFoundError or
   * ConcurrentTransitionError.
   */
  async apply(sessionId: string, event: SessionEvent, reason?: string): Promise<TransitionRecord> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { status: true, pausedFrom: true, mode: true },
    })
    if (!session) throw new SessionNotFoundError(sessionId)

    const from = toState(session)
    const next = transition(from, event)

    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.session.updateMany({
        where: { id: sessionId, status: from.status, pausedFrom: from.pausedFrom },
        data: {
          status: next.status,
          pausedFrom: next.pausedFrom,
          ...(isTerminal(next.status) ? { endedAt: new Date() } : {}),
        },
      })
      if (updated.count !== 1) throw new ConcurrentTransitionError(sessionId, from.status)

      const row = await tx.sessionTransition.create({
        data: {
          sessionId,
          fromStatus: from.status,
          toStatus: next.status,
          event: event.type,
          reason: reason ?? null,
        },
      })
      return {
        id: row.id,
        sessionId,
        mode: session.mode as GameMode,
        from: from.status,
        to: next.status,
        event: event.type,
        reason: row.reason,
        at: row.createdAt,
      } satisfies TransitionRecord
    })

    for (const listener of this.listeners) {
      try {
        listener(record)
      } catch {
        // A failing listener must not undo or hide a committed transition.
      }
    }
    return record
  }

  /** All transitions for a session, oldest first. */
  async history(sessionId: string): Promise<TransitionRecord[]> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { mode: true, transitions: { orderBy: { id: 'asc' } } },
    })
    if (!session) throw new SessionNotFoundError(sessionId)
    return session.transitions.map((t) => ({
      id: t.id,
      sessionId,
      mode: session.mode as GameMode,
      from: t.fromStatus as SessionStatus,
      to: t.toStatus as SessionStatus,
      event: t.event as SessionEventType,
      reason: t.reason,
      at: t.createdAt,
    }))
  }
}

/** Maps a committed transition to the dashboard WebSocket event. */
export function toSessionUpdatedEvent(record: TransitionRecord): SessionUpdatedEvent {
  return {
    type: 'session.updated',
    sessionId: record.sessionId,
    status: record.to,
    mode: record.mode,
  }
}

function toState(row: { status: string; pausedFrom: string | null }): SessionState {
  return {
    status: row.status as SessionStatus,
    pausedFrom: row.pausedFrom as SessionStatus | null,
  }
}

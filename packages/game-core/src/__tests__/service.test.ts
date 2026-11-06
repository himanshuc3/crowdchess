import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@crowdchess/database'
import { SessionUpdatedEventSchema } from '@crowdchess/contracts'
import {
  ConcurrentTransitionError,
  InvalidTransitionError,
  SessionNotFoundError,
  SessionStateService,
  toSessionUpdatedEvent,
  type TransitionRecord,
} from '../index.js'
import { TEST_DATABASE_URL } from './test-db.js'

const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL })
let service: SessionStateService
let streamerUserId: string

beforeAll(async () => {
  await prisma.$connect()
  const user = await prisma.user.create({ data: { displayName: 'StateMachineStreamer' } })
  streamerUserId = user.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(() => {
  service = new SessionStateService(prisma)
})

async function newSession() {
  return service.create({ streamerUserId, mode: 'DEMOCRACY', settings: { votingDurationSeconds: 20 } })
}

describe('SessionStateService', () => {
  it('creates sessions in DRAFT with no transitions', async () => {
    const session = await newSession()
    expect(session.status).toBe('DRAFT')
    expect(session.pausedFrom).toBeNull()
    expect(await service.getState(session.id)).toEqual({ status: 'DRAFT', pausedFrom: null })
    expect(await service.history(session.id)).toEqual([])
  })

  it('persists each transition with its event, reason and timestamp', async () => {
    const { id } = await newSession()
    const before = Date.now()
    await service.apply(id, { type: 'START' }, 'streamer clicked Start')
    await service.apply(id, { type: 'YOUTUBE_CONNECTED' }, 'broadcast abc123 selected')
    await service.apply(id, { type: 'CHALLENGE_ACCEPTED' }, 'challenge XyZ accepted')
    const last = await service.apply(id, { type: 'GAME_STARTED' })

    expect(last).toMatchObject({ sessionId: id, mode: 'DEMOCRACY', from: 'GAME_READY', to: 'STREAMER_TURN' })
    expect(await service.getState(id)).toEqual({ status: 'STREAMER_TURN', pausedFrom: null })

    const history = await service.history(id)
    expect(history.map((h) => [h.from, h.event, h.to, h.reason])).toEqual([
      ['DRAFT', 'START', 'CONNECTING_YOUTUBE', 'streamer clicked Start'],
      ['CONNECTING_YOUTUBE', 'YOUTUBE_CONNECTED', 'WAITING_FOR_LICHESS_CHALLENGE', 'broadcast abc123 selected'],
      ['WAITING_FOR_LICHESS_CHALLENGE', 'CHALLENGE_ACCEPTED', 'GAME_READY', 'challenge XyZ accepted'],
      ['GAME_READY', 'GAME_STARTED', 'STREAMER_TURN', null],
    ])
    for (const h of history) {
      expect(h.at).toBeInstanceOf(Date)
      expect(h.at.getTime()).toBeGreaterThanOrEqual(before - 1000)
    }
  })

  it('rejects an invalid transition without writing anything or emitting', async () => {
    const { id } = await newSession()
    const seen: TransitionRecord[] = []
    service.onTransition((r) => seen.push(r))

    await expect(service.apply(id, { type: 'MOVE_SELECTED' })).rejects.toThrow(InvalidTransitionError)
    expect(await service.getState(id)).toEqual({ status: 'DRAFT', pausedFrom: null })
    expect(await service.history(id)).toEqual([])
    expect(seen).toEqual([])
  })

  it('stores pausedFrom while paused and clears it on resume', async () => {
    const { id } = await walkTo('AUDIENCE_TURN')
    await service.apply(id, { type: 'PAUSE' }, 'streamer paused')
    expect(await service.getState(id)).toEqual({ status: 'PAUSED', pausedFrom: 'AUDIENCE_TURN' })

    await expect(service.apply(id, { type: 'RESUME' })).rejects.toThrow(/current turn/)
    await service.apply(id, { type: 'RESUME', turn: 'STREAMER' }, 'game stream: white to move')
    expect(await service.getState(id)).toEqual({ status: 'STREAMER_TURN', pausedFrom: null })
  })

  it('sets endedAt on terminal states and then rejects every event', async () => {
    const { id } = await walkTo('STREAMER_TURN')
    const row = await prisma.session.findUniqueOrThrow({ where: { id } })
    expect(row.endedAt).toBeNull()

    await service.apply(id, { type: 'ABORT' }, 'streamer stopped the session')
    const ended = await prisma.session.findUniqueOrThrow({ where: { id } })
    expect(ended.status).toBe('ABORTED')
    expect(ended.endedAt).toBeInstanceOf(Date)

    await expect(service.apply(id, { type: 'GAME_STARTED' })).rejects.toThrow(/terminal state/)
    await expect(service.apply(id, { type: 'FAIL' })).rejects.toThrow(InvalidTransitionError)
  })

  it('throws SessionNotFoundError for unknown sessions', async () => {
    const missing = '00000000-0000-0000-0000-000000000000'
    await expect(service.apply(missing, { type: 'START' })).rejects.toThrow(SessionNotFoundError)
    await expect(service.getState(missing)).rejects.toThrow(SessionNotFoundError)
  })

  it('cascades transitions when a session is deleted', async () => {
    const { id } = await walkTo('GAME_READY')
    expect(await prisma.sessionTransition.count({ where: { sessionId: id } })).toBe(3)
    await prisma.session.delete({ where: { id } })
    expect(await prisma.sessionTransition.count({ where: { sessionId: id } })).toBe(0)
  })
})

describe('events', () => {
  it('emits each committed transition in order, and stops after unsubscribe', async () => {
    const { id } = await newSession()
    const seen: TransitionRecord[] = []
    const unsubscribe = service.onTransition((r) => seen.push(r))

    await service.apply(id, { type: 'START' })
    await service.apply(id, { type: 'YOUTUBE_CONNECTED' })
    unsubscribe()
    await service.apply(id, { type: 'CHALLENGE_ACCEPTED' })

    expect(seen.map((r) => r.to)).toEqual(['CONNECTING_YOUTUBE', 'WAITING_FOR_LICHESS_CHALLENGE'])
    expect(seen[0].id).toBeLessThan(seen[1].id)
  })

  it('keeps the transition when a listener throws', async () => {
    const { id } = await newSession()
    service.onTransition(() => {
      throw new Error('listener bug')
    })
    const record = await service.apply(id, { type: 'START' })
    expect(record.to).toBe('CONNECTING_YOUTUBE')
    expect(await service.getState(id)).toEqual({ status: 'CONNECTING_YOUTUBE', pausedFrom: null })
  })

  it('maps to a valid session.updated WebSocket event', async () => {
    const { id } = await newSession()
    const event = toSessionUpdatedEvent(await service.apply(id, { type: 'START' }))
    expect(SessionUpdatedEventSchema.parse(event)).toEqual({
      type: 'session.updated',
      sessionId: id,
      status: 'CONNECTING_YOUTUBE',
      mode: 'DEMOCRACY',
    })
  })
})

describe('concurrency', () => {
  it('lets exactly one of two racing transitions win', async () => {
    const { id } = await walkTo('STREAMER_TURN')
    const results = await Promise.allSettled([
      service.apply(id, { type: 'STREAMER_MOVED' }, 'worker A'),
      service.apply(id, { type: 'STREAMER_MOVED' }, 'worker B'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    // Depending on timing the loser either read the old state (guard) or the new one (machine).
    expect(
      rejected.reason instanceof ConcurrentTransitionError ||
        rejected.reason instanceof InvalidTransitionError,
    ).toBe(true)

    const moves = (await service.history(id)).filter((h) => h.event === 'STREAMER_MOVED')
    expect(moves).toHaveLength(1)
  })

  it('rejects a write based on a stale read, via the status guard', async () => {
    const { id } = await walkTo('AUDIENCE_TURN')
    // A service whose reads are stale: it still believes the session is in STREAMER_TURN.
    const staleRead = new Proxy(prisma, {
      get(target, prop) {
        const value = Reflect.get(target, prop)
        if (prop !== 'session') return typeof value === 'function' ? value.bind(target) : value
        return new Proxy(value, {
          get(delegate, method) {
            if (method === 'findUnique') {
              return async () => ({ status: 'STREAMER_TURN', pausedFrom: null, mode: 'DEMOCRACY' })
            }
            const fn = Reflect.get(delegate, method)
            return typeof fn === 'function' ? fn.bind(delegate) : fn
          },
        })
      },
    })
    const stale = new SessionStateService(staleRead)

    await expect(stale.apply(id, { type: 'STREAMER_MOVED' })).rejects.toThrow(ConcurrentTransitionError)
    expect(await service.getState(id)).toEqual({ status: 'AUDIENCE_TURN', pausedFrom: null })
    expect((await service.history(id)).filter((h) => h.event === 'STREAMER_MOVED')).toHaveLength(1)
  })
})

async function walkTo(target: 'GAME_READY' | 'STREAMER_TURN' | 'AUDIENCE_TURN') {
  const session = await newSession()
  const steps = [
    'START',
    'YOUTUBE_CONNECTED',
    'CHALLENGE_ACCEPTED',
    'GAME_STARTED',
    'STREAMER_MOVED',
  ] as const
  const stopAfter = { GAME_READY: 3, STREAMER_TURN: 4, AUDIENCE_TURN: 5 }[target]
  for (const type of steps.slice(0, stopAfter)) await service.apply(session.id, { type })
  return session
}

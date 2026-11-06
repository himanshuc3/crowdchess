import type { PrismaClient } from '@crowdchess/database'
import type { Redis } from 'ioredis'

export interface DependencyHealth {
  ok: boolean
  latencyMs: number
  /** Short error description; never contains connection strings or credentials. */
  error?: string
}

/** Runs `SELECT 1` against PostgreSQL. */
export function checkPostgres(prisma: PrismaClient): Promise<DependencyHealth> {
  return timed(async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`
    if (rows[0]?.ok !== 1) throw new Error('unexpected result from SELECT 1')
  })
}

/** Sends PING to Redis and expects PONG. */
export function checkRedis(redis: Redis): Promise<DependencyHealth> {
  return timed(async () => {
    const reply = await redis.ping()
    if (reply !== 'PONG') throw new Error('unexpected reply to PING')
  })
}

async function timed(check: () => Promise<void>): Promise<DependencyHealth> {
  const start = performance.now()
  try {
    await check()
    return { ok: true, latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.name : 'Error',
    }
  }
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadConfig } from '@crowdchess/config'

// Integration tests: need PostgreSQL on 5432 and Redis on 6379 (docker compose up -d).
process.env.DATABASE_URL ??= 'postgresql://crowdchess:crowdchess@localhost:5432/crowdchess'
process.env.REDIS_URL ??= 'redis://localhost:6379'

const config = loadConfig()
const { prisma } = await import('@crowdchess/database')
const { createRedis } = await import('../infra/redis.js')
const { checkPostgres, checkRedis } = await import('../infra/health.js')

const redis = createRedis(config.REDIS_URL)
const prefix = `test:infra:${process.pid}:${Date.now()}:`

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  const keys = await redis.keys(`${prefix}*`)
  if (keys.length > 0) await redis.del(...keys)
  redis.disconnect()
  await prisma.$disconnect()
})

describe('PostgreSQL', () => {
  it('executes a query', async () => {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`
    expect(rows[0].version).toMatch(/PostgreSQL 16/)
  })

  it('reports healthy', async () => {
    expect(await checkPostgres(prisma)).toMatchObject({ ok: true })
  })
})

describe('Redis', () => {
  it('answers PING', async () => {
    expect(await redis.ping()).toBe('PONG')
  })

  it('round-trips SET and GET, with expiry', async () => {
    const key = `${prefix}roundtrip`
    expect(await redis.set(key, 'hello', 'EX', 60)).toBe('OK')
    expect(await redis.get(key)).toBe('hello')
    const ttl = await redis.ttl(key)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60)
  })

  it('supports SET NX for deduplication', async () => {
    const key = `${prefix}dedupe`
    expect(await redis.set(key, '1', 'EX', 60, 'NX')).toBe('OK')
    expect(await redis.set(key, '1', 'EX', 60, 'NX')).toBeNull()
  })

  it('delivers pub/sub messages', async () => {
    const channel = `${prefix}channel`
    const subscriber = createRedis(config.REDIS_URL)
    try {
      const received = new Promise<string>((resolve) => {
        subscriber.on('message', (ch, message) => {
          if (ch === channel) resolve(message)
        })
      })
      await subscriber.subscribe(channel)
      await redis.publish(channel, 'round.opened')
      expect(await received).toBe('round.opened')
    } finally {
      subscriber.disconnect()
    }
  })

  it('reports healthy', async () => {
    expect(await checkRedis(redis)).toMatchObject({ ok: true })
  })

  it('reports unhealthy, without hanging, when Redis is unreachable', async () => {
    const unreachable = createRedis('redis://127.0.0.1:1', {
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    })
    unreachable.on('error', () => {})
    try {
      const health = await checkRedis(unreachable)
      expect(health.ok).toBe(false)
      expect(health.error).toBeDefined()
      expect(JSON.stringify(health)).not.toContain('127.0.0.1')
    } finally {
      unreachable.disconnect()
    }
  })
})

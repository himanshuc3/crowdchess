import { Redis, type RedisOptions } from 'ioredis'

/**
 * Creates a Redis client for REDIS_URL. Commands fail after a few retries instead of queueing
 * forever, so a Redis outage surfaces as an error rather than a hang.
 */
export function createRedis(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5_000,
    ...options,
  })
}

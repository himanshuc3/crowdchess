import { describe, it, expect } from 'vitest'
import { ConfigError, loadConfig } from '../index.js'

const VALID = {
  DATABASE_URL: 'postgresql://crowdchess:crowdchess@localhost:5432/crowdchess',
  REDIS_URL: 'redis://localhost:6379',
}

function issuesFor(env: Record<string, string | undefined>) {
  try {
    loadConfig(env)
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError)
    return (err as ConfigError).issues
  }
  throw new Error('expected loadConfig to throw')
}

describe('loadConfig', () => {
  it('accepts the minimum required variables and applies defaults', () => {
    const config = loadConfig(VALID)
    expect(config.DATABASE_URL).toBe(VALID.DATABASE_URL)
    expect(config.REDIS_URL).toBe(VALID.REDIS_URL)
    expect(config.PORT).toBe(3001)
    expect(config.NODE_ENV).toBe('development')
    expect(config.LICHESS_BOT_TOKEN).toBeUndefined()
  })

  it('accepts the values in .env.example', () => {
    const config = loadConfig({
      ...VALID,
      LICHESS_BOT_TOKEN: 'your_lichess_bot_api_token',
      YOUTUBE_CLIENT_ID: 'your_youtube_client_id',
      YOUTUBE_CLIENT_SECRET: 'your_youtube_client_secret',
      YOUTUBE_REDIRECT_URI: 'http://localhost:3001/api/youtube/callback',
      ENCRYPTION_KEY: 'your_32_byte_encryption_key',
      JWT_SECRET: 'your_jwt_secret',
      PORT: '3001',
    })
    expect(config.PORT).toBe(3001)
    expect(config.LICHESS_BOT_TOKEN).toBe('your_lichess_bot_api_token')
  })

  it('accepts postgres:// and rediss:// URLs', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://u:p@db.example.com:5432/app?sslmode=require',
      REDIS_URL: 'rediss://:secret@cache.example.com:6380',
    })
    expect(config.REDIS_URL).toMatch(/^rediss:/)
  })

  it('coerces PORT and NODE_ENV', () => {
    const config = loadConfig({ ...VALID, PORT: '8080', NODE_ENV: 'production' })
    expect(config.PORT).toBe(8080)
    expect(config.NODE_ENV).toBe('production')
  })

  it('rejects missing required variables, reporting all of them at once', () => {
    const issues = issuesFor({})
    expect(issues.map((i) => i.variable).sort()).toEqual(['DATABASE_URL', 'REDIS_URL'])
    expect(issues.every((i) => i.message.startsWith('is required'))).toBe(true)
  })

  it('treats empty strings as missing', () => {
    const issues = issuesFor({ DATABASE_URL: '', REDIS_URL: VALID.REDIS_URL })
    expect(issues).toEqual([{ variable: 'DATABASE_URL', message: expect.stringMatching(/^is required/) }])
    expect(loadConfig({ ...VALID, PORT: '', LICHESS_BOT_TOKEN: '' })).toMatchObject({
      PORT: 3001,
      LICHESS_BOT_TOKEN: undefined,
    })
  })

  it('rejects URLs with the wrong protocol or that are not URLs', () => {
    expect(issuesFor({ ...VALID, DATABASE_URL: 'mysql://localhost/db' })[0].variable).toBe(
      'DATABASE_URL',
    )
    expect(issuesFor({ ...VALID, REDIS_URL: 'localhost:6379' })[0].variable).toBe('REDIS_URL')
  })

  it('rejects an invalid PORT or NODE_ENV', () => {
    expect(issuesFor({ ...VALID, PORT: 'abc' })).toEqual([
      { variable: 'PORT', message: 'must be a number' },
    ])
    expect(issuesFor({ ...VALID, PORT: '70000' })).toEqual([
      { variable: 'PORT', message: 'must be at most 65535' },
    ])
    expect(issuesFor({ ...VALID, NODE_ENV: 'staging' })).toEqual([
      { variable: 'NODE_ENV', message: 'must be one of: development, test, production' },
    ])
  })

  it('never includes variable values in the error message', () => {
    const secret = 'mysql://admin:SuperSecret123@prod-db/app'
    try {
      loadConfig({
        DATABASE_URL: secret,
        REDIS_URL: 'not-a-url-with-SECRET',
        NODE_ENV: 'secret-env-SECRET',
        PORT: 'SECRET',
      })
      expect.unreachable()
    } catch (err) {
      const text = (err as Error).message + JSON.stringify((err as ConfigError).issues)
      expect(text).not.toContain('SuperSecret123')
      expect(text).not.toContain('SECRET')
      expect(text).toContain('DATABASE_URL')
    }
  })

  it('defaults to process.env', () => {
    const saved = { ...process.env }
    try {
      process.env.DATABASE_URL = VALID.DATABASE_URL
      process.env.REDIS_URL = VALID.REDIS_URL
      expect(loadConfig().REDIS_URL).toBe(VALID.REDIS_URL)
    } finally {
      process.env = saved
    }
  })
})

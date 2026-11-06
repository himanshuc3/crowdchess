import { z } from 'zod'

/** Unset and empty variables are treated the same, since `.env` files often contain `KEY=`. */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)

const urlWithProtocol = (protocols: readonly string[], example: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string({ required_error: `is required (e.g. ${example})` })
      .refine((value) => protocols.includes(protocolOf(value)), {
        message: `must be a URL starting with ${protocols.map((p) => `${p}//`).join(' or ')}`,
      }),
  )

const optionalString = z.preprocess(emptyToUndefined, z.string().optional())

export const EnvSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3001)),

  DATABASE_URL: urlWithProtocol(
    ['postgresql:', 'postgres:'],
    'postgresql://crowdchess:crowdchess@localhost:5432/crowdchess',
  ),
  REDIS_URL: urlWithProtocol(['redis:', 'rediss:'], 'redis://localhost:6379'),

  // Optional until the tasks that use them (Lichess: Task 8, YouTube: Task 11, security: Task 24).
  LICHESS_BOT_TOKEN: optionalString,
  YOUTUBE_CLIENT_ID: optionalString,
  YOUTUBE_CLIENT_SECRET: optionalString,
  YOUTUBE_REDIRECT_URI: optionalString,
  ENCRYPTION_KEY: optionalString,
  JWT_SECRET: optionalString,
})

export type Config = z.infer<typeof EnvSchema>

export interface ConfigIssue {
  variable: string
  message: string
}

/** Thrown when the environment is invalid. Lists variable names only, never their values. */
export class ConfigError extends Error {
  constructor(public readonly issues: ConfigIssue[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((i) => `  - ${i.variable} ${i.message}`)
        .join('\n')}`,
    )
    this.name = 'ConfigError'
  }
}

/**
 * Validates environment variables and returns typed config.
 * Defaults to `process.env`; pass an object to validate something else (e.g. in tests).
 * Throws ConfigError listing every problem at once.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = EnvSchema.safeParse(env)
  if (result.success) return result.data
  throw new ConfigError(
    result.error.issues.map((issue) => ({
      variable: String(issue.path[0] ?? '(root)'),
      message: messageFor(issue),
    })),
  )
}

/** Builds a message that never echoes the received value (Zod's defaults sometimes do). */
function messageFor(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return issue.message.startsWith('is required') ? issue.message : 'is required'
      }
      return `must be a ${issue.expected}`
    case z.ZodIssueCode.invalid_enum_value:
      return `must be one of: ${issue.options.join(', ')}`
    case z.ZodIssueCode.too_small:
      return `must be at least ${String(issue.minimum)}`
    case z.ZodIssueCode.too_big:
      return `must be at most ${String(issue.maximum)}`
    case z.ZodIssueCode.custom:
      return issue.message
    default:
      return 'is invalid'
  }
}

function protocolOf(value: string): string {
  try {
    return new URL(value).protocol
  } catch {
    return ''
  }
}

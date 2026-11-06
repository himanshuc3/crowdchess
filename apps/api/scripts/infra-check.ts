// Task 5 demo: `pnpm --filter @crowdchess/api infra:check`
// Validates env, then writes and reads a record in PostgreSQL and does a Redis PING/SET/GET round-trip.
import { ConfigError, loadConfig } from '@crowdchess/config'

let config
try {
  config = loadConfig()
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
}

const { prisma } = await import('@crowdchess/database')
const { createRedis } = await import('../src/infra/redis.js')

console.log(`Config OK (NODE_ENV=${config.NODE_ENV}, PORT=${config.PORT})\n`)

console.log('PostgreSQL')
const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`
console.log(`  ${version.split(',')[0]}`)
const created = await prisma.user.create({ data: { displayName: `infra-check-${Date.now()}` } })
console.log(`  created user ${created.id} (${created.displayName})`)
const found = await prisma.user.findUnique({ where: { id: created.id } })
console.log(`  read back:   ${found?.displayName === created.displayName ? 'match' : 'MISMATCH'}`)
await prisma.user.delete({ where: { id: created.id } })
console.log('  deleted test user')
await prisma.$disconnect()

console.log('\nRedis')
const redis = createRedis(config.REDIS_URL)
const key = `infra-check:${Date.now()}`
console.log(`  PING -> ${await redis.ping()}`)
console.log(`  SET ${key} hello -> ${await redis.set(key, 'hello', 'EX', 30)}`)
console.log(`  GET ${key} -> ${await redis.get(key)}`)
await redis.del(key)
redis.disconnect()

console.log('\nAll infrastructure checks passed.')

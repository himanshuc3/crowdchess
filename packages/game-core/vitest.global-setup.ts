// Resets the game-core test schema and applies all migrations before the test run.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_DATABASE_URL, TEST_SCHEMA } from './src/__tests__/test-db.js'

export default function setup() {
  const databaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../database')
  const prismaCli = createRequire(path.join(databaseDir, 'package.json')).resolve(
    'prisma/build/index.js',
  )
  const schema = path.join(databaseDir, 'prisma', 'schema.prisma')
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: '1' }
  const run = (args: string[], input?: string) =>
    execFileSync(process.execPath, [prismaCli, ...args, '--schema', schema], {
      env,
      input,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })

  run(['db', 'execute', '--stdin'], `DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE;`)
  run(['migrate', 'deploy'])
}

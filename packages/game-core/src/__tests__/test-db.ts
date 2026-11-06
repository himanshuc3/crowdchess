// Integration tests run in their own PostgreSQL schema so they never collide with other
// packages' tests (the database package wipes every table in `public` before each test).
const base =
  process.env.DATABASE_URL ?? 'postgresql://crowdchess:crowdchess@localhost:5432/crowdchess'

const url = new URL(base)
url.searchParams.set('schema', 'game_core_test')

export const TEST_SCHEMA = 'game_core_test'
export const TEST_DATABASE_URL = url.toString()

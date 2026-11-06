// Task 6 demo: `pnpm --filter @crowdchess/game-core demo`
// Creates a session in DRAFT, walks it to STREAMER_TURN, prints the persisted history,
// shows that an invalid transition is rejected, then removes the demo data.
import { prisma } from '@crowdchess/database'
import {
  InvalidTransitionError,
  SessionStateService,
  toSessionUpdatedEvent,
  type SessionEvent,
} from '../src/index.js'

const service = new SessionStateService(prisma)
service.onTransition((record) => {
  console.log(`  event   ${JSON.stringify(toSessionUpdatedEvent(record))}`)
})

const user = await prisma.user.create({ data: { displayName: `demo-streamer-${Date.now()}` } })
try {
  const session = await service.create({ streamerUserId: user.id, mode: 'DEMOCRACY' })
  console.log(`Created session ${session.id} in ${session.status}\n`)

  const steps: [SessionEvent, string][] = [
    [{ type: 'START' }, 'streamer clicked Start'],
    [{ type: 'YOUTUBE_CONNECTED' }, 'broadcast selected'],
    [{ type: 'CHALLENGE_ACCEPTED' }, 'Lichess challenge accepted'],
    [{ type: 'GAME_STARTED' }, 'gameFull received'],
  ]
  for (const [event, reason] of steps) {
    const r = await service.apply(session.id, event, reason)
    console.log(`${r.from.padEnd(30)} --${r.event}--> ${r.to}`)
  }

  console.log('\nPersisted history (SessionTransition rows):')
  for (const h of await service.history(session.id)) {
    console.log(`  #${h.id} ${h.at.toISOString()}  ${h.from} -> ${h.to}  (${h.event}: ${h.reason})`)
  }
  const row = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
  console.log(`\nSession row status: ${row.status}`)

  console.log('\nTrying an invalid transition: MOVE_CONFIRMED in STREAMER_TURN')
  try {
    await service.apply(session.id, { type: 'MOVE_CONFIRMED' })
    console.log('  UNEXPECTED: it was accepted')
    process.exitCode = 1
  } catch (err) {
    if (!(err instanceof InvalidTransitionError)) throw err
    console.log(`  rejected: ${err.message}`)
    console.log(`  status still: ${(await service.getState(session.id)).status}`)
  }
} finally {
  await prisma.user.delete({ where: { id: user.id } }) // cascades to the session and its history
  await prisma.$disconnect()
}

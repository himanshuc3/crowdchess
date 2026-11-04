import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

// Test database URL — uses the crowdchess PostgreSQL Docker container
process.env.DATABASE_URL = 'postgresql://crowdchess:crowdchess@localhost:5432/crowdchess'

import { prisma } from '../client.js'

beforeAll(async () => {
  // Ensure database is accessible
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Clean up all data between tests (order matters for foreign keys)
  await prisma.vote.deleteMany()
  await prisma.moveCandidate.deleteMany()
  await prisma.chatEvent.deleteMany()
  await prisma.gameEvent.deleteMany()
  await prisma.round.deleteMany()
  await prisma.game.deleteMany()
  await prisma.score.deleteMany()
  await prisma.session.deleteMany()
  await prisma.youtubeConnection.deleteMany()
  await prisma.lichessBotConnection.deleteMany()
  await prisma.user.deleteMany()
})

describe('User CRUD', () => {
  it('creates a user', async () => {
    const user = await prisma.user.create({
      data: { displayName: 'TestStreamer' },
    })
    expect(user.id).toBeDefined()
    expect(user.displayName).toBe('TestStreamer')
    expect(user.createdAt).toBeInstanceOf(Date)
  })

  it('reads a user by id', async () => {
    const created = await prisma.user.create({ data: { displayName: 'Streamer1' } })
    const found = await prisma.user.findUnique({ where: { id: created.id } })
    expect(found?.displayName).toBe('Streamer1')
  })

  it('updates a user', async () => {
    const created = await prisma.user.create({ data: { displayName: 'OldName' } })
    const updated = await prisma.user.update({
      where: { id: created.id },
      data: { displayName: 'NewName' },
    })
    expect(updated.displayName).toBe('NewName')
  })

  it('deletes a user', async () => {
    const created = await prisma.user.create({ data: { displayName: 'ToDelete' } })
    await prisma.user.delete({ where: { id: created.id } })
    const found = await prisma.user.findUnique({ where: { id: created.id } })
    expect(found).toBeNull()
  })
})

describe('Session with Game and Round', () => {
  it('creates a full session -> game -> round chain', async () => {
    const user = await prisma.user.create({ data: { displayName: 'Streamer' } })
    const session = await prisma.session.create({
      data: {
        streamerUserId: user.id,
        mode: 'DEMOCRACY',
        status: 'DRAFT',
        settingsJson: { votingDurationSeconds: 20 },
      },
    })
    expect(session.mode).toBe('DEMOCRACY')
    expect(session.status).toBe('DRAFT')

    const game = await prisma.game.create({
      data: {
        sessionId: session.id,
        platformGameId: 'lichess_game_123',
        botColor: 'black',
        currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        status: 'ACTIVE',
      },
    })
    expect(game.platformGameId).toBe('lichess_game_123')

    const round = await prisma.round.create({
      data: {
        gameId: game.id,
        ply: 1,
        mode: 'DEMOCRACY',
        status: 'PENDING',
        opensAt: new Date(),
      },
    })
    expect(round.ply).toBe(1)
    expect(round.mode).toBe('DEMOCRACY')
  })

  it('enforces unique (gameId, ply) for rounds', async () => {
    const user = await prisma.user.create({ data: { displayName: 'S' } })
    const session = await prisma.session.create({
      data: { streamerUserId: user.id, mode: 'CHAOS', status: 'DRAFT' },
    })
    const game = await prisma.game.create({
      data: { sessionId: session.id, status: 'ACTIVE' },
    })
    await prisma.round.create({
      data: { gameId: game.id, ply: 1, mode: 'CHAOS', status: 'OPEN', opensAt: new Date() },
    })
    // Second round with same ply should fail
    await expect(
      prisma.round.create({
        data: { gameId: game.id, ply: 1, mode: 'CHAOS', status: 'OPEN', opensAt: new Date() },
      }),
    ).rejects.toThrow()
  })
})

describe('MoveCandidate deduplication', () => {
  it('creates a move candidate', async () => {
    const { roundId } = await createTestRound()

    const candidate = await prisma.moveCandidate.create({
      data: {
        roundId,
        viewerId: 'UC_viewer1',
        canonicalUci: 'g1f3',
        san: 'Nf3',
        valid: true,
      },
    })
    expect(candidate.canonicalUci).toBe('g1f3')
    expect(candidate.san).toBe('Nf3')
  })

  it('enforces unique (roundId, viewerId, canonicalUci)', async () => {
    const { roundId } = await createTestRound()

    await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v1', canonicalUci: 'e2e4', san: 'e4', valid: true },
    })
    // Same viewer + same move should fail
    await expect(
      prisma.moveCandidate.create({
        data: { roundId, viewerId: 'UC_v1', canonicalUci: 'e2e4', san: 'e4', valid: true },
      }),
    ).rejects.toThrow()
    // Different viewer + same move should succeed
    const c2 = await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v2', canonicalUci: 'e2e4', san: 'e4', valid: true },
    })
    expect(c2.viewerId).toBe('UC_v2')
    // Same viewer + different move should succeed
    const c3 = await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v1', canonicalUci: 'g1f3', san: 'Nf3', valid: true },
    })
    expect(c3.canonicalUci).toBe('g1f3')
  })
})

describe('Vote unique constraint', () => {
  it('enforces one vote per viewer per round', async () => {
    const { roundId } = await createTestRound()

    const candidate = await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v1', canonicalUci: 'e2e4', san: 'e4', valid: true },
    })

    await prisma.vote.create({
      data: { roundId, viewerId: 'UC_voter1', candidateId: candidate.id },
    })

    // Same viewer voting again should fail (must use update instead)
    await expect(
      prisma.vote.create({
        data: { roundId, viewerId: 'UC_voter1', candidateId: candidate.id },
      }),
    ).rejects.toThrow()
  })

  it('allows vote change via update', async () => {
    const { roundId } = await createTestRound()

    const c1 = await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v1', canonicalUci: 'e2e4', san: 'e4', valid: true },
    })
    const c2 = await prisma.moveCandidate.create({
      data: { roundId, viewerId: 'UC_v2', canonicalUci: 'g1f3', san: 'Nf3', valid: true },
    })

    // Initial vote for c1
    const vote = await prisma.vote.create({
      data: { roundId, viewerId: 'UC_voter', candidateId: c1.id },
    })
    // Change vote to c2 (upsert pattern: find by unique, update)
    const updated = await prisma.vote.update({
      where: { id: vote.id },
      data: { candidateId: c2.id },
    })
    expect(updated.candidateId).toBe(c2.id)
  })
})

describe('Score composite key', () => {
  it('creates and updates score with composite key', async () => {
    const user = await prisma.user.create({ data: { displayName: 'S' } })
    const session = await prisma.session.create({
      data: { streamerUserId: user.id, mode: 'BATTLE_ROYALE', status: 'DRAFT' },
    })

    // Create score with composite key
    await prisma.score.create({
      data: {
        sessionId: session.id,
        viewerId: 'UC_player1',
        viewerDisplayName: 'ChessFan',
        points: 10,
      },
    })

    // Update by composite key
    const updated = await prisma.score.update({
      where: {
        sessionId_viewerId: { sessionId: session.id, viewerId: 'UC_player1' },
      },
      data: { points: { increment: 10 } },
    })
    expect(updated.points).toBe(20)
  })
})

describe('ChatEvent deduplication', () => {
  it('enforces unique platformMessageId', async () => {
    const { roundId } = await createTestRound()

    await prisma.chatEvent.create({
      data: {
        platformMessageId: 'yt_msg_001',
        roundId,
        viewerPlatformId: 'UC_v1',
        rawText: 'Nf6',
        parsedType: 'MOVE_SUBMISSION',
      },
    })

    // Same platformMessageId should fail
    await expect(
      prisma.chatEvent.create({
        data: {
          platformMessageId: 'yt_msg_001',
          roundId,
          viewerPlatformId: 'UC_v2',
          rawText: 'e4',
          parsedType: 'MOVE_SUBMISSION',
        },
      }),
    ).rejects.toThrow()
  })

  it('allows null roundId for messages outside a round', async () => {
    await prisma.chatEvent.create({
      data: {
        platformMessageId: 'yt_msg_002',
        roundId: null,
        viewerPlatformId: 'UC_v1',
        rawText: 'hello',
        parsedType: 'OTHER',
      },
    })
    const found = await prisma.chatEvent.findUnique({
      where: { platformMessageId: 'yt_msg_002' },
    })
    expect(found?.roundId).toBeNull()
  })
})

// ─── Test helpers ───

async function createTestRound() {
  const user = await prisma.user.create({ data: { displayName: 'TestStreamer' } })
  const session = await prisma.session.create({
    data: { streamerUserId: user.id, mode: 'DEMOCRACY', status: 'GAME_READY' },
  })
  const game = await prisma.game.create({
    data: { sessionId: session.id, status: 'ACTIVE' },
  })
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      ply: 1,
      mode: 'DEMOCRACY',
      status: 'OPEN',
      opensAt: new Date(),
    },
  })
  return { userId: user.id, sessionId: session.id, gameId: game.id, roundId: round.id }
}

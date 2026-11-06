import { describe, it, expect } from 'vitest'
import {
  applyMove,
  getLegalMoves,
  InvalidFenError,
  isCheck,
  isCheckmate,
  isGameOver,
  isStalemate,
  whoseTurn,
} from '../index.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FOOLS_MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'
const CHECK = 'rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3'

describe('getLegalMoves', () => {
  it('returns the 20 opening moves in UCI', () => {
    const moves = getLegalMoves(START)
    expect(moves).toHaveLength(20)
    expect(moves).toContain('e2e4')
    expect(moves).toContain('g1f3')
    expect(moves.every((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))).toBe(true)
  })

  it('lists each promotion piece separately', () => {
    const moves = getLegalMoves('8/4P3/8/8/8/8/8/k6K w - - 0 1').filter((m) => m.startsWith('e7'))
    expect(moves.sort()).toEqual(['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r'])
  })

  it('returns no moves when checkmated or stalemated', () => {
    expect(getLegalMoves(FOOLS_MATE)).toEqual([])
    expect(getLegalMoves(STALEMATE)).toEqual([])
  })

  it('throws InvalidFenError for an invalid FEN', () => {
    expect(() => getLegalMoves('garbage')).toThrow(InvalidFenError)
  })
})

describe('game state', () => {
  it('reports whose turn it is', () => {
    expect(whoseTurn(START)).toBe('white')
    expect(whoseTurn(STALEMATE)).toBe('black')
  })

  it('detects checkmate', () => {
    expect(isCheckmate(FOOLS_MATE)).toBe(true)
    expect(isCheck(FOOLS_MATE)).toBe(true)
    expect(isGameOver(FOOLS_MATE)).toBe(true)
    expect(isStalemate(FOOLS_MATE)).toBe(false)
  })

  it('detects stalemate', () => {
    expect(isStalemate(STALEMATE)).toBe(true)
    expect(isCheckmate(STALEMATE)).toBe(false)
    expect(isCheck(STALEMATE)).toBe(false)
    expect(isGameOver(STALEMATE)).toBe(true)
  })

  it('detects check that is not mate', () => {
    expect(isCheck(CHECK)).toBe(true)
    expect(isCheckmate(CHECK)).toBe(false)
    expect(isGameOver(CHECK)).toBe(false)
  })

  it('reports the start position as ongoing', () => {
    expect(isCheck(START)).toBe(false)
    expect(isGameOver(START)).toBe(false)
  })
})

describe('applyMove', () => {
  it('returns the FEN after a legal move', () => {
    const fen = applyMove(START, 'e2e4')
    expect(fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq')).toBe(true)
    expect(whoseTurn(fen)).toBe('black')
  })

  it('plays Fool’s Mate to checkmate', () => {
    let fen = START
    for (const uci of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) fen = applyMove(fen, uci)
    expect(isCheckmate(fen)).toBe(true)
    expect(whoseTurn(fen)).toBe('white')
  })

  it('throws on an illegal move', () => {
    expect(() => applyMove(START, 'e2e5')).toThrow(/Illegal move/)
  })
})

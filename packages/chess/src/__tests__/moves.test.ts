import { describe, it, expect } from 'vitest'
import { MoveParseError, parseMove, validateMove, type MoveRejectionReason } from '../index.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
// 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 — white to play Qxf7#
const SCHOLARS = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
const PROMOTION = '3r4/4P3/8/8/8/8/8/k6K w - - 0 1'
// Knights on b1 and f1 can both reach d2
const TWO_KNIGHTS = '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1'
// White pawn e5 can capture f5 en passant
const EN_PASSANT = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
const FOOLS_MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'

function uciOf(input: string, fen: string): string {
  return parseMove(input, fen).uci
}

function reasonOf(input: string, fen: string): MoveRejectionReason {
  const result = validateMove(input, fen)
  if (result.valid) throw new Error(`expected ${input} to be rejected, got ${result.move.uci}`)
  return result.reason
}

describe('SAN parsing', () => {
  it('parses piece moves and pawn pushes', () => {
    expect(uciOf('Nf3', START)).toBe('g1f3')
    expect(uciOf('e4', START)).toBe('e2e4')
    expect(uciOf('e3', START)).toBe('e2e3')
    expect(uciOf('Nf6', AFTER_E4)).toBe('g8f6')
  })

  it('returns canonical SAN and records the notation', () => {
    const move = parseMove('Nf3', START)
    expect(move).toMatchObject({ uci: 'g1f3', san: 'Nf3', from: 'g1', to: 'f3', notation: 'san' })
    expect(move.promotion).toBeUndefined()
  })

  it('parses captures and tolerates a missing x', () => {
    expect(uciOf('Qxf7', SCHOLARS)).toBe('h5f7')
    expect(uciOf('Qf7', SCHOLARS)).toBe('h5f7')
    expect(uciOf('Bxf7', SCHOLARS)).toBe('c4f7')
  })

  it('accepts check and mate markers, and reports them in canonical SAN', () => {
    expect(parseMove('Qxf7#', SCHOLARS).san).toBe('Qxf7#')
    expect(parseMove('Qxf7+', SCHOLARS).san).toBe('Qxf7#')
    expect(parseMove('Qxf7', SCHOLARS).san).toBe('Qxf7#')
    expect(parseMove('Bxf7+', SCHOLARS).san).toBe('Bxf7+')
    expect(uciOf('Nf3!?', START)).toBe('g1f3')
  })

  it('parses castling in O and zero notation', () => {
    expect(uciOf('O-O', CASTLING)).toBe('e1g1')
    expect(uciOf('O-O-O', CASTLING)).toBe('e1c1')
    expect(uciOf('0-0', CASTLING)).toBe('e1g1')
    expect(uciOf('0-0-0', CASTLING)).toBe('e1c1')
    expect(uciOf('o-o', CASTLING)).toBe('e1g1')
  })

  it('rejects castling when it is not available', () => {
    expect(reasonOf('O-O', START)).toBe('ILLEGAL')
  })

  it('parses promotions with and without =, including underpromotion and capture', () => {
    expect(uciOf('e8=Q', PROMOTION)).toBe('e7e8q')
    expect(uciOf('e8Q', PROMOTION)).toBe('e7e8q')
    expect(uciOf('e8=q', PROMOTION)).toBe('e7e8q')
    expect(uciOf('e8=N', PROMOTION)).toBe('e7e8n')
    expect(uciOf('exd8=R', PROMOTION)).toBe('e7d8r')
    expect(parseMove('e8=Q', PROMOTION).promotion).toBe('q')
  })

  it('requires the promotion piece', () => {
    expect(reasonOf('e8', PROMOTION)).toBe('PROMOTION_REQUIRED')
    expect(reasonOf('exd8', PROMOTION)).toBe('PROMOTION_REQUIRED')
  })

  it('rejects ambiguous moves and accepts disambiguated ones', () => {
    expect(reasonOf('Nd2', TWO_KNIGHTS)).toBe('AMBIGUOUS')
    expect(validateMove('Nd2', TWO_KNIGHTS)).toMatchObject({
      message: expect.stringContaining('Nbd2'),
    })
    expect(uciOf('Nbd2', TWO_KNIGHTS)).toBe('b1d2')
    expect(uciOf('Nfd2', TWO_KNIGHTS)).toBe('f1d2')
    // Both knights are on rank 1, so a rank does not disambiguate here
    expect(reasonOf('N1d2', TWO_KNIGHTS)).toBe('AMBIGUOUS')
  })

  it('accepts over-specified origins', () => {
    expect(uciOf('Ng1f3', START)).toBe('g1f3')
    expect(uciOf('Ngf3', START)).toBe('g1f3')
    expect(uciOf('e2e4', START)).toBe('e2e4')
  })

  it('treats a pawn move without an origin file as a push, not a capture', () => {
    // After 1.e4 d5, white can play exd5 but "d5" is not a pawn push for white
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
    expect(uciOf('exd5', fen)).toBe('e4d5')
    expect(uciOf('ed5', fen)).toBe('e4d5')
    expect(reasonOf('d5', fen)).toBe('ILLEGAL')
  })

  it('parses en passant', () => {
    expect(uciOf('exf6', EN_PASSANT)).toBe('e5f6')
    expect(uciOf('exf6 e.p.', EN_PASSANT)).toBe('e5f6')
  })

  it('distinguishes a bishop from a b-pawn by case', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/8/1P6/P1PPPPPP/RNBQKBNR w KQkq - 0 2'
    expect(uciOf('Bb2', fen)).toBe('c1b2')
    expect(uciOf('b4', fen)).toBe('b3b4')
  })

  it('rejects illegal SAN', () => {
    expect(reasonOf('Ke2', START)).toBe('ILLEGAL')
    expect(reasonOf('Nf5', START)).toBe('ILLEGAL')
    expect(reasonOf('Bb5', START)).toBe('ILLEGAL')
  })
})

describe('UCI parsing', () => {
  it('parses and normalizes to lowercase', () => {
    expect(uciOf('g1f3', START)).toBe('g1f3')
    expect(uciOf('G1F3', START)).toBe('g1f3')
    expect(uciOf('  e2e4  ', START)).toBe('e2e4')
    expect(parseMove('e2e4', START)).toMatchObject({ san: 'e4', notation: 'uci' })
  })

  it('parses castling as a king move', () => {
    expect(parseMove('e1g1', CASTLING).san).toBe('O-O')
    expect(parseMove('e1c1', CASTLING).san).toBe('O-O-O')
  })

  it('parses promotions and requires the promotion piece', () => {
    expect(parseMove('e7e8q', PROMOTION).san).toBe('e8=Q')
    expect(parseMove('E7D8N', PROMOTION).uci).toBe('e7d8n')
    expect(reasonOf('e7e8', PROMOTION)).toBe('PROMOTION_REQUIRED')
  })

  it('rejects a promotion suffix on a non-promoting move', () => {
    expect(reasonOf('e2e4q', START)).toBe('ILLEGAL')
  })

  it('treats SAN and UCI for the same move as identical', () => {
    const san = parseMove('Nf6', AFTER_E4)
    const uci = parseMove('g8f6', AFTER_E4)
    expect(san.uci).toBe(uci.uci)
    expect(san.san).toBe(uci.san)
  })

  it('rejects illegal UCI', () => {
    expect(reasonOf('e2e5', START)).toBe('ILLEGAL')
    expect(reasonOf('g1g3', START)).toBe('ILLEGAL')
  })
})

describe('edge cases', () => {
  it('rejects moving from an empty square', () => {
    expect(reasonOf('e3e4', START)).toBe('NO_PIECE')
  })

  it('rejects moves by the side not to move, in UCI and SAN', () => {
    expect(reasonOf('e7e5', START)).toBe('WRONG_SIDE')
    expect(reasonOf('e5', START)).toBe('WRONG_SIDE')
    expect(reasonOf('Nf6', START)).toBe('WRONG_SIDE')
    expect(reasonOf('e2e4', AFTER_E4)).toBe('NO_PIECE')
    expect(reasonOf('d2d4', AFTER_E4)).toBe('WRONG_SIDE')
  })

  it('rejects empty and non-move input', () => {
    expect(reasonOf('', START)).toBe('EMPTY')
    expect(reasonOf('   ', START)).toBe('EMPTY')
    expect(reasonOf('hello', START)).toBe('MALFORMED')
    expect(reasonOf('https://example.com', START)).toBe('MALFORMED')
    expect(reasonOf('z9z9', START)).toBe('MALFORMED')
    expect(reasonOf('Qe8=Q', START)).toBe('MALFORMED')
  })

  it('rejects an invalid FEN', () => {
    expect(reasonOf('e4', 'not a fen')).toBe('INVALID_FEN')
  })

  it('rejects any move once the game is over', () => {
    expect(reasonOf('e4', FOOLS_MATE)).toBe('GAME_OVER')
  })

  it('throws MoveParseError with the reason from parseMove', () => {
    try {
      parseMove('e7e5', START)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(MoveParseError)
      expect((err as MoveParseError).reason).toBe('WRONG_SIDE')
      expect((err as MoveParseError).input).toBe('e7e5')
    }
  })
})

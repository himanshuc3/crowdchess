import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Chess } from 'chess.js'
import { getLegalMoves, parseMove, validateMove } from '../index.js'

/** Reaches a pseudo-random position by playing up to 60 random legal moves from the start. */
const positionArb = fc.array(fc.nat(), { maxLength: 60 }).map((choices) => {
  const chess = new Chess()
  for (const n of choices) {
    const moves = chess.moves()
    if (moves.length === 0) break
    chess.move(moves[n % moves.length])
  }
  return chess.fen()
})

describe('properties', () => {
  it('SAN -> UCI -> SAN round-trips for every legal move', () => {
    fc.assert(
      fc.property(positionArb, (fen) => {
        for (const move of new Chess(fen).moves({ verbose: true })) {
          const expectedUci = move.from + move.to + (move.promotion ?? '')
          const fromSan = parseMove(move.san, fen)
          expect(fromSan.uci).toBe(expectedUci)
          expect(parseMove(fromSan.uci, fen).san).toBe(move.san)
        }
      }),
    )
  })

  it('every move from getLegalMoves validates as itself', () => {
    fc.assert(
      fc.property(positionArb, (fen) => {
        for (const uci of getLegalMoves(fen)) {
          const result = validateMove(uci, fen)
          expect(result.valid && result.move.uci).toBe(uci)
        }
      }),
    )
  })

  it('never throws on arbitrary input, and anything accepted is a legal move', () => {
    fc.assert(
      fc.property(positionArb, fc.string({ maxLength: 16 }), (fen, input) => {
        const result = validateMove(input, fen)
        if (result.valid) expect(getLegalMoves(fen)).toContain(result.move.uci)
      }),
    )
  })

  it('accepts square-like noise only when it is a legal move', () => {
    const squareish = fc
      .tuple(
        fc.constantFrom(...'abcdefghKQRBNx'),
        fc.constantFrom(...'abcdefgh12345678'),
        fc.constantFrom(...'abcdefgh12345678'),
        fc.constantFrom('', ...'12345678qQ='),
      )
      .map((parts) => parts.join(''))
    fc.assert(
      fc.property(positionArb, squareish, (fen, input) => {
        const result = validateMove(input, fen)
        if (result.valid) expect(getLegalMoves(fen)).toContain(result.move.uci)
      }),
    )
  })
})

import { loadPosition } from './position.js'

export { InvalidFenError } from './position.js'

export type Side = 'white' | 'black'

/** Side to move in the given position. */
export function whoseTurn(fen: string): Side {
  return loadPosition(fen).turn() === 'w' ? 'white' : 'black'
}

export function isCheck(fen: string): boolean {
  return loadPosition(fen).isCheck()
}

export function isCheckmate(fen: string): boolean {
  return loadPosition(fen).isCheckmate()
}

export function isStalemate(fen: string): boolean {
  return loadPosition(fen).isStalemate()
}

/**
 * True for checkmate, stalemate, insufficient material and the 50-move rule.
 * Threefold repetition needs move history, which a FEN does not carry, so it is never detected here.
 * Lichess remains the authority on game results.
 */
export function isGameOver(fen: string): boolean {
  return loadPosition(fen).isGameOver()
}

/** Every legal move in the position, in canonical UCI (e.g. `e2e4`, `e7e8q`, `e1g1`). */
export function getLegalMoves(fen: string): string[] {
  return loadPosition(fen)
    .moves({ verbose: true })
    .map((m) => m.from + m.to + (m.promotion ?? ''))
}

/** Plays a legal UCI move and returns the resulting FEN. Throws if the move is not legal. */
export function applyMove(fen: string, uci: string): string {
  const chess = loadPosition(fen)
  const match = chess
    .moves({ verbose: true })
    .find((m) => m.from + m.to + (m.promotion ?? '') === uci.toLowerCase())
  if (!match) throw new Error(`Illegal move ${uci} in position ${fen}`)
  chess.move({ from: match.from, to: match.to, promotion: match.promotion })
  return chess.fen()
}

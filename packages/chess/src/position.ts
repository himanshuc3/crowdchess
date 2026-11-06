import { Chess } from 'chess.js'

/** Thrown when a FEN string cannot be loaded. */
export class InvalidFenError extends Error {
  constructor(
    public readonly fen: string,
    cause?: unknown,
  ) {
    super(`Invalid FEN: ${fen}`, { cause })
    this.name = 'InvalidFenError'
  }
}

/** Loads a FEN into a fresh chess.js instance, throwing InvalidFenError if it is invalid. */
export function loadPosition(fen: string): Chess {
  try {
    return new Chess(fen)
  } catch (err) {
    throw new InvalidFenError(fen, err)
  }
}

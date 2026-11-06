// @crowdchess/chess
// Wrapper around chess.js for SAN/UCI parsing, move validation, and legal move generation.
// Shared between backend (move validation) and frontend (board display logic).

export * from './moves.js'
export * from './state.js'
export { Chess, validateFen } from 'chess.js'
export type { Move, Square, PieceSymbol, Color } from 'chess.js'

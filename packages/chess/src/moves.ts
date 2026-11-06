import type { Chess, Move, PieceSymbol } from 'chess.js'
import { InvalidFenError, loadPosition } from './position.js'

export type MoveNotation = 'san' | 'uci'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

/** A legal move resolved against a specific position. */
export interface ParsedMove {
  /** Canonical UCI, lowercase, with promotion suffix when promoting (e.g. `e7e8q`). */
  uci: string
  /** Standard SAN as produced by chess.js, including `+`/`#` (e.g. `Qxf7#`). */
  san: string
  from: string
  to: string
  promotion?: PromotionPiece
  /** Which notation the input was recognised as. */
  notation: MoveNotation
  /** The original input, untrimmed. */
  input: string
}

export type MoveRejectionReason =
  | 'EMPTY'
  | 'MALFORMED'
  | 'INVALID_FEN'
  | 'GAME_OVER'
  | 'NO_PIECE'
  | 'WRONG_SIDE'
  | 'AMBIGUOUS'
  | 'PROMOTION_REQUIRED'
  | 'ILLEGAL'

export type ValidationResult =
  | { valid: true; move: ParsedMove }
  | { valid: false; reason: MoveRejectionReason; message: string }

/** Thrown by parseMove when the input is not a legal move in the position. */
export class MoveParseError extends Error {
  constructor(
    public readonly reason: MoveRejectionReason,
    message: string,
    public readonly input: string,
  ) {
    super(message)
    this.name = 'MoveParseError'
  }
}

/** Longest accepted input after trimming; the longest real SAN is ~7 chars (e.g. `exd8=Q#`). */
const MAX_INPUT_LENGTH = 12

const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/
// piece? fromFile? fromRank? capture? destination (=?promotion)?
const SAN_PATTERN = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([QRBNqrbn]))?$/
const CASTLE_KING = /^[O0o]-[O0o]$/
const CASTLE_QUEEN = /^[O0o]-[O0o]-[O0o]$/

/**
 * Parses a move in SAN or UCI and resolves it against the position.
 * Returns the canonical move, or throws MoveParseError with a machine-readable reason.
 */
export function parseMove(input: string, fen: string): ParsedMove {
  const result = validateMove(input, fen)
  if (!result.valid) throw new MoveParseError(result.reason, result.message, input)
  return result.move
}

/**
 * Validates a move in SAN or UCI against the position without throwing.
 *
 * Accepted forms:
 * - UCI: `e2e4`, `E2E4`, `e7e8q`, `e1g1` (castling as king move)
 * - SAN: `Nf3`, `exd5`, `e8=Q`, `e8Q`, `O-O`, `0-0-0`, `Nbd2`, `Ng1f3`
 * - SAN is lenient about a missing or extra `x`, trailing `+`/`#`/`!`/`?`, and over-specified
 *   origins, but ambiguous moves (e.g. `Nd2` when two knights can reach d2) are rejected.
 * - Promotions must name the piece; there is no automatic queening.
 */
export function validateMove(input: string, fen: string): ValidationResult {
  return validate(input, fen, true)
}

/** `checkOtherSide` is false on the internal re-check against the flipped position, to stop recursion. */
function validate(input: string, fen: string, checkOtherSide: boolean): ValidationResult {
  let chess: Chess
  try {
    chess = loadPosition(fen)
  } catch (err) {
    if (err instanceof InvalidFenError) return reject('INVALID_FEN', `Invalid FEN: ${fen}`)
    throw err
  }

  const text = normalizeInput(input)
  if (text.length === 0) return reject('EMPTY', 'No move given')
  if (text.length > MAX_INPUT_LENGTH) return reject('MALFORMED', `Not a move: ${truncate(input)}`)

  const legal = chess.moves({ verbose: true })
  if (legal.length === 0) return reject('GAME_OVER', 'The game is over; no moves are possible')

  const uci = UCI_PATTERN.exec(text.toLowerCase())
  if (uci) return resolveUci(chess, legal, uci, input)

  if (CASTLE_KING.test(text) || CASTLE_QUEEN.test(text)) {
    const flag = CASTLE_QUEEN.test(text) ? 'q' : 'k'
    const match = legal.find((m) => m.piece === 'k' && m.flags.includes(flag))
    if (match) return accept(match, 'san', input)
    return rejectIllegalSan(fen, text, checkOtherSide)
  }

  const san = SAN_PATTERN.exec(text)
  if (!san) return reject('MALFORMED', `Not a move: ${truncate(input)}`)
  return resolveSan(fen, legal, san, input, checkOtherSide)
}

function resolveUci(
  chess: Chess,
  legal: Move[],
  [, from, to, promotion]: RegExpExecArray,
  input: string,
): ValidationResult {
  const piece = chess.get(from as Move['from'])
  if (!piece) return reject('NO_PIECE', `There is no piece on ${from}`)
  if (piece.color !== chess.turn()) {
    return reject('WRONG_SIDE', `It is ${sideName(chess.turn())}'s move`)
  }
  const sameSquares = legal.filter((m) => m.from === from && m.to === to)
  if (sameSquares.length === 0) return reject('ILLEGAL', `${from}${to} is not a legal move`)
  if (!promotion) {
    if (sameSquares.some((m) => m.promotion)) {
      return reject('PROMOTION_REQUIRED', `Add the promotion piece, e.g. ${from}${to}q`)
    }
    return accept(sameSquares[0], 'uci', input)
  }
  const match = sameSquares.find((m) => m.promotion === promotion)
  if (!match) return reject('ILLEGAL', `${from}${to}${promotion} is not a legal move`)
  return accept(match, 'uci', input)
}

function resolveSan(
  fen: string,
  legal: Move[],
  [, pieceLetter, fromFile, fromRank, , to, promotionLetter]: RegExpExecArray,
  input: string,
  checkOtherSide: boolean,
): ValidationResult {
  const piece = (pieceLetter?.toLowerCase() ?? 'p') as PieceSymbol
  const promotion = promotionLetter?.toLowerCase() as PromotionPiece | undefined
  if (promotion && piece !== 'p') return reject('MALFORMED', `Not a move: ${truncate(input)}`)

  const candidates = legal.filter(
    (m) =>
      m.piece === piece &&
      m.to === to &&
      (!fromFile || m.from[0] === fromFile) &&
      (!fromRank || m.from[1] === fromRank) &&
      // A pawn move without an origin file is a push, never a capture (`e4`, not `dxe4`).
      (piece !== 'p' || fromFile || m.from[0] === to[0]),
  )
  if (candidates.length === 0) return rejectIllegalSan(fen, input.trim(), checkOtherSide)

  if (!promotion && candidates.some((m) => m.promotion)) {
    return reject('PROMOTION_REQUIRED', `Add the promotion piece, e.g. ${to}=Q`)
  }
  const matches = promotion ? candidates.filter((m) => m.promotion === promotion) : candidates
  if (matches.length === 0) return reject('ILLEGAL', `${input.trim()} is not a legal move`)
  if (matches.length > 1) {
    const options = matches.map((m) => m.san).join(' or ')
    return reject('AMBIGUOUS', `${input.trim()} is ambiguous: ${options}`)
  }
  return accept(matches[0], 'san', input)
}

/**
 * A SAN move that is illegal here may be legal for the other side, which makes for a
 * clearer rejection ("not your move") than a generic illegal-move message.
 */
function rejectIllegalSan(fen: string, text: string, checkOtherSide: boolean): ValidationResult {
  const flipped = checkOtherSide ? flipSideToMove(fen) : null
  if (flipped) {
    const other = validate(text, flipped, false)
    if (other.valid) {
      const toMove = fen.split(' ')[1] === 'w' ? 'white' : 'black'
      return reject('WRONG_SIDE', `It is ${toMove}'s move`)
    }
  }
  return reject('ILLEGAL', `${text} is not a legal move`)
}

function flipSideToMove(fen: string): string | null {
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 2) return null
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  if (parts.length > 3) parts[3] = '-' // en passant square is only valid for the original side
  const flipped = parts.join(' ')
  try {
    loadPosition(flipped)
    return flipped
  } catch {
    return null
  }
}

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/\s*e\.p\.$/i, '')
    .replace(/[+#!?]+$/, '')
}

function accept(move: Move, notation: MoveNotation, input: string): ValidationResult {
  const parsed: ParsedMove = {
    uci: move.from + move.to + (move.promotion ?? ''),
    san: move.san,
    from: move.from,
    to: move.to,
    notation,
    input,
  }
  if (move.promotion) parsed.promotion = move.promotion as PromotionPiece
  return { valid: true, move: parsed }
}

function reject(reason: MoveRejectionReason, message: string): ValidationResult {
  return { valid: false, reason, message }
}

function sideName(color: 'w' | 'b'): string {
  return color === 'w' ? 'white' : 'black'
}

function truncate(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed
}

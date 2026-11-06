// Task 4 demo: run with `pnpm --filter @crowdchess/chess demo`
import {
  getLegalMoves,
  isCheckmate,
  isGameOver,
  parseMove,
  validateMove,
  whoseTurn,
} from '../src/index.js'

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const FOOLS_MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'

console.log(`Position after 1.e4 (${whoseTurn(AFTER_E4)} to move)\n  ${AFTER_E4}\n`)

const san = parseMove('Nf6', AFTER_E4)
const uci = parseMove('g8f6', AFTER_E4)
console.log(`"Nf6"  -> ${san.uci} (${san.san}, read as ${san.notation})`)
console.log(`"g8f6" -> ${uci.uci} (${uci.san}, read as ${uci.notation})`)
console.log(`Same move: ${san.uci === uci.uci}\n`)

const check = validateMove('Nf6', AFTER_E4)
console.log(`validateMove("Nf6"): ${check.valid ? 'legal' : `rejected (${check.reason})`}`)
for (const input of ['e2e4', 'Nf5', 'hello', 'e5', 'Ke7']) {
  const r = validateMove(input, AFTER_E4)
  console.log(`validateMove("${input}"): ${r.valid ? `legal -> ${r.move.uci}` : `${r.reason}: ${r.message}`}`)
}

const legal = getLegalMoves(AFTER_E4)
console.log(`\n${legal.length} legal moves: ${legal.join(' ')}\n`)

console.log(`Fool's Mate position\n  ${FOOLS_MATE}`)
console.log(`isCheckmate: ${isCheckmate(FOOLS_MATE)}, isGameOver: ${isGameOver(FOOLS_MATE)}, legal moves: ${getLegalMoves(FOOLS_MATE).length}`)

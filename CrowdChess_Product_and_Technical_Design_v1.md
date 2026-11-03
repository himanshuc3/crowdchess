**CROWDCHESS**

Product Requirements & Technical Design

*A live-stream audience becomes the opponent.*

![image1.png](CrowdChess_Product_and_Technical_Design_v1_assets/image1.png)

Version 1.0  •  2 November 2026  •  Hackathon MVP design

# Document control

| Field | Value |
| --- | --- |
| Product | CrowdChess |
| Document | Product Requirements Document (PRD) + Technical Design Document (TDD) |
| Version / status | 1.0 — proposed baseline; decisions marked as assumptions should be validated during implementation |
| Primary hackathon track | Frankenstein |
| Target experience | YouTube streamer plays White; audience collectively controls a Lichess bot playing Black |
| MVP game platform | Lichess Bot API; CrowdChess provides its own companion dashboard and synchronized board view |
| Long-term vision | A reusable audience-control engine with adapters for other games and platforms |

## Executive summary

CrowdChess turns a livestream audience from passive viewers into an active chess opponent. A streamer connects a YouTube channel, starts a session, and plays a normal game against a dedicated CrowdChess bot account on Lichess. Viewers submit candidate moves through YouTube Live Chat. CrowdChess parses and validates those moves, runs one of three game-mode strategies, selects a move, submits it through the Lichess Bot API, and reconciles the resulting game state.

| Core architectural boundary<br>CrowdChess owns streamer onboarding, audience identity, chat ingestion, move proposals, voting/scoring, session orchestration and the companion dashboard. Lichess owns the authoritative live chess game and accepts bot moves through its official Bot API. |
| --- |

The hackathon MVP deliberately targets one platform (YouTube Live), one external game platform (Lichess), one matchup (human streamer vs CrowdChess bot), and three modes (Democracy, Battle Royale and Chaos). A native chessboard can be added as a development/demo fallback, but it is not the primary game authority in the Lichess-first MVP.

## 1. Product vision and positioning

### 1.1 Vision

Make livestreams interactive by letting viewers collectively control a game through the chat interface they already use. CrowdChess starts with chess because its turn-based rules make audience input understandable, verifiable and entertaining. The longer-term product is a universal audience-driven game-control platform.

### 1.2 Problem

Livestream audiences mostly react to gameplay rather than influence it. Streamers have limited ways to turn chat participation into meaningful, structured control of a game. Existing chat polls are disconnected from game state and cannot reliably validate or execute game actions.

### 1.3 Solution

CrowdChess connects live chat to a game-aware control layer. It converts messages into candidate actions, validates them against the current game state, applies a selectable audience decision strategy, and executes the selected action through a supported game adapter.

### 1.4 Hackathon positioning

Frankenstein track: combine livestream APIs, real-time chat processing, chess rules/engine logic, collective decision-making and game-platform automation/API integration into a new audience-controlled gaming experience. The novelty is the cohesive interaction model, not the existence of chess or chat voting individually.

### 1.5 Goals and non-goals

| Goals (MVP) | Non-goals (MVP) |
| --- | --- |
| A streamer can connect YouTube and start a CrowdChess session. | Build a full chess social network, matchmaking or ratings system. |
| A streamer can play a Lichess challenge game against a CrowdChess bot account. | Automate moves on Chess.com or bypass platform fair-play controls. |
| Viewers can submit legal move candidates through chat. | Support Twitch, Discord or arbitrary games in the first release. |
| All three modes can select and execute audience-controlled moves. | Build a chess engine from scratch or require Stockfish for move legality. |
| A companion dashboard shows board state, voting and participation. | Guarantee zero-latency chat or unlimited YouTube API quota. |

## 2. Personas and user journeys

### 2.1 Streamer

- Connects a YouTube channel using OAuth consent.

- Selects an active or upcoming livestream with chat enabled.

- Chooses a game mode, voting duration and basic tie/no-vote behavior.

- Starts a Lichess challenge against the CrowdChess bot.

- Plays White on Lichess while CrowdChess manages the audience-controlled Black turns.

- Monitors the companion dashboard, pauses/ends the session and reviews results.

### 2.2 Viewer

- Watches the stream and sees the current position and voting instructions.

- Submits a move using SAN (e.g. Nf6) or UCI (e.g. g8f6), according to the displayed command format.

- In Democracy, votes for one candidate. In Battle Royale, competes to submit the winning candidate. In Chaos, contributes candidates to the random pool.

- Sees whether the submission was accepted, rejected or selected, plus leaderboard feedback where applicable.

### 2.3 Operator / moderator

- Can stop or pause a session, block abusive participants, and inspect connection or API errors.

- Can reset a demo session and review logs without exposing OAuth tokens.

## 3. Game modes and rules

![image1.png](CrowdChess_Product_and_Technical_Design_v1_assets/image1.png)

### 3.1 Shared turn lifecycle

1. Wait for the streamer’s move and confirm it from the Lichess game stream.

1. Open an audience turn for the bot’s side. Start a configurable timer (default proposal: 20 seconds).

1. Ingest chat messages and parse move submissions / votes.

1. Validate candidate moves against the current authoritative position. Reject malformed, illegal, stale or duplicate inputs.

1. Close the round and ask the selected mode strategy to choose a legal move.

1. Submit exactly one move to the Lichess Bot API.

1. Wait for the Lichess game stream to confirm the move; only then persist the confirmed state and open the next streamer turn.

### 3.2 Democracy Mode — default

Viewers propose legal moves. The dashboard presents the unique candidate moves and their vote totals. Each eligible viewer gets one vote per round; a viewer can change their vote until the round closes. The candidate with the most votes wins.

- Candidate submission and voting are separate actions: a viewer may propose a move and then vote for any listed candidate.

- Default tie-break: select randomly among tied top candidates. Alternative: streamer-configurable fixed tie-break.

- No valid submissions: extend once by a short grace period, then pass/abort the bot turn according to the session setting. Do not invent an illegal move.

- Suggested initial defaults: 20-second round, one vote per viewer, vote changes allowed, one candidate per unique UCI move.

### 3.3 Battle Royale Mode — competitive

Viewers compete by submitting a move candidate. After the round closes, the system selects the most-supported legal candidate (or uses a configured selection rule). Every viewer who submitted the winning move receives points. The leaderboard persists across the session.

- Baseline scoring: +10 points for submitting the winning move.

- Optional future bonuses: streaks, predicting the streamer’s next move, or special achievements. Avoid outcome-based bonuses until the scoring definition is clear and testable.

- Prevent farming: one scored submission per viewer per round; deduplicate by YouTube channel/user ID and round.

- This mode is distinct from Democracy through its persistent competition and reward loop, even if its initial move-selection rule is the same.

### 3.4 Chaos Mode — entertainment

Viewers continuously submit legal candidates during a short window. At close, CrowdChess selects one candidate randomly and submits it. The default should be uniform random over unique legal candidate moves; optional weighted-random selection can weight by distinct viewer submissions, with a cap to prevent spam domination.

- A viewer’s repeated identical message must not create unlimited weight.

- Suggested defaults: 10–15-second round, one weighted entry per viewer per candidate, no voting UI.

- Expose the selection rule in the dashboard so the outcome feels transparent rather than arbitrary.

### 3.5 Mode comparison

| Mode | Input | Selection | Viewer reward | Purpose |
| --- | --- | --- | --- | --- |
| Democracy | Propose + vote | Highest vote count | Optional participation stats | Collective strategy |
| Battle Royale | Propose move | Most-supported candidate (initial version) | Points for winning submission | Competition and retention |
| Chaos | Propose move | Random legal candidate | Optional participation stats | Unpredictability and fun |

## 4. Platform strategy and integration decision

### 4.1 Lichess-first

Use a dedicated Lichess bot account as the audience-controlled Black player. The streamer challenges the bot directly. The bot account must be upgraded through Lichess’s official bot-account process and must use the Bot API. Bot accounts are restricted to challenge games; they cannot enter normal pools or tournaments. During development, use casual games and follow Lichess API rate limits and terms.

The Lichess Bot API exposes challenge events, game-state streaming and move submission. CrowdChess sends the selected move in UCI format to the bot game move endpoint and reconciles the result from the game stream. Lichess remains authoritative: a local prediction is never treated as a confirmed move until Lichess reports it.

### 4.2 Why not Chess.com for MVP?

Do not rely on browser automation to move pieces on Chess.com. Its public API is not a general-purpose live move-submission API, and automated or outside assistance in live human games raises fair-play and terms concerns. The Lichess Bot API is the better-supported integration for this bot-vs-human architecture.

### 4.3 Companion dashboard

Build a CrowdChess web dashboard for streamer controls, audience status, candidate moves, voting, leaderboard and a synchronized board display. The dashboard is not a second authoritative chess platform. It mirrors the game state received from Lichess and can link the streamer to the Lichess game.

### 4.4 Future adapters

Keep game-specific behavior behind an adapter boundary. Later adapters may support other chess platforms where official APIs and policies permit, followed by other turn-based or real-time games. Do not implement a generic universal-game abstraction beyond what the chess MVP needs.

## 5. High-level architecture

![image2.png](CrowdChess_Product_and_Technical_Design_v1_assets/image2.png)

Logical components:

| Component | Responsibility |
| --- | --- |
| Streamer dashboard (React) | OAuth connection flow, broadcast selection, mode configuration, session controls, live status, board/vote/leaderboard display. |
| Backend API (Node.js + TypeScript) | Auth callbacks, session APIs, streamer commands, dashboard WebSocket gateway. |
| YouTube chat connector | Resolve broadcast/liveChatId, consume streamList where available, use list polling fallback, normalize message events. |
| Command parser | Recognize move commands, vote commands and controls; parse SAN/UCI; enforce message and identity rules. |
| Game manager | Own session state machine, turn ownership, round timing, orchestration and idempotency. |
| Chess rules module | Maintain a synchronized chess position, parse/normalize moves and validate legality using chess.js. |
| Mode strategies | Democracy vote tally, Battle Royale scoring and Chaos random selection. |
| Lichess adapter | OAuth/token handling for bot, challenge lifecycle, NDJSON game stream, move submission, reconnect and reconciliation. |
| Persistence | PostgreSQL for durable records; Redis optional for timers, ephemeral state and pub/sub. |
| Observability | Structured logs, metrics, error reporting and audit events. |

## 6. End-to-end game flow

![image3.png](CrowdChess_Product_and_Technical_Design_v1_assets/image3.png)

### 6.1 Session state machine

DRAFT → CONNECTING_YOUTUBE → WAITING_FOR_LICHESS_CHALLENGE → GAME_READY → STREAMER_TURN → AUDIENCE_TURN → MOVE_SUBMITTING → STREAMER_TURN

Terminal / exceptional states: PAUSED, COMPLETED, ABORTED, FAILED. Persist state transitions with timestamps and reasons. Only one active audience round may exist for a game at a time.

### 6.2 Turn ownership

- Streamer is White and plays directly on Lichess.

- CrowdChess bot is Black and only moves after a completed audience round.

- The game stream determines whose turn it is. Do not infer turn ownership solely from chat or a dashboard timer.

- If the streamer takes too long, the Lichess clock governs the game; CrowdChess should not fabricate moves or override the clock.

## 7. Technology stack

| Layer | Recommended technology | Reason / notes |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Fast development, typed dashboard, component ecosystem. |
| Chessboard UI | react-chessboard | Render synchronized board in the companion dashboard; not the game authority. |
| Backend | Node.js + TypeScript (Fastify or NestJS) | Good fit for API integrations, streaming I/O and shared TypeScript types. |
| Chess rules | chess.js | FEN/PGN handling, legal move generation, SAN/UCI conversion and check/game-state logic. |
| Lichess integration | Official Lichess Bot API over HTTPS + NDJSON stream | Challenge events, game stream and move submission; no browser automation required. |
| YouTube integration | YouTube Data API v3 / Live Streaming API | OAuth-authorized broadcast and live chat access. Prefer streamList for low-latency chat; use list with pageToken/pollingIntervalMillis as fallback. |
| Realtime dashboard | WebSocket (Socket.IO or ws) | Push round state, candidate counts, move confirmations and session status. |
| Database | PostgreSQL | Durable users, channel connections, sessions, games, rounds, submissions, votes and scores. |
| Ephemeral coordination | Redis (optional for MVP) | Distributed round timers, deduplication cache and pub/sub if multiple backend instances are deployed. |
| Testing | Vitest + Playwright + property-based tests (fast-check) | Unit/integration tests, dashboard flows and randomized move/round invariants. |
| Deployment | Docker; managed app/container host + managed PostgreSQL | Keep deployment simple; use one backend instance initially if that reduces coordination complexity. |
| Development workflow | Kiro Specs, Steering, Hooks, MCP where useful | Requirements → design → tasks; persistent project conventions; automated test/documentation workflows. |

### 7.1 Suggested repository structure

crowdchess/
  apps/
    web/                    # React streamer dashboard
    api/                    # TypeScript backend API and WebSocket gateway
  packages/
    contracts/              # Shared API/event types and schemas
    chess/                  # Chess rules wrapper, SAN/UCI normalization
    game-core/              # Session state machine and turn orchestration
    modes/                  # democracy, battle-royale, chaos strategies
    adapters/
      lichess/              # Lichess Bot API adapter
      youtube/               # YouTube OAuth and Live Chat connector
  infra/
    docker/
    deployment/
  docs/
  .kiro/
    specs/
    steering/
    hooks/                  # if generated/configured by Kiro
  README.md

## 8. Core backend design

### 8.1 Game adapter contract

Define a small adapter boundary around the live game. Avoid over-generalizing: the first implementation only needs the capabilities required by a chess bot.

interface GameAdapter<State, Move> {
  createOrJoinGame(input: CreateGameInput): Promise<GameRef>;
  streamState(gameId: string): AsyncIterable<State>;
  getState(gameId: string): Promise<State>;
  validateMove(state: State, move: Move): Promise<boolean>;
  submitMove(gameId: string, move: Move): Promise<SubmitResult>;
  resign?(gameId: string): Promise<void>;
}

The Lichess adapter should submit only moves selected by the game manager. The adapter must handle HTTP errors, reconnects, duplicate submissions and stream reconciliation.

### 8.2 Mode strategy contract

interface GameModeStrategy {
  openRound(context: RoundContext): RoundConfig;
  handleSubmission(input: MoveSubmission): SubmissionResult;
  handleVote?(input: VoteInput): VoteResult;
  closeRound(context: RoundContext): SelectionResult;
  onMoveConfirmed?(result: ConfirmedMove): void;
}

All strategies receive the same normalized, legal candidate set and current round context. The strategy returns a candidate move; the game manager re-validates it immediately before submission.

### 8.3 Move parsing and validation

- Accept SAN and UCI only; publish the expected syntax in the stream overlay and dashboard.

- Parse against the current confirmed FEN. Normalize to canonical UCI for deduplication and storage.

- Reject illegal moves, wrong-side moves, stale messages from prior rounds, malformed notation and moves submitted after round closure.

- Do not let viewers submit raw FEN, arbitrary API calls or browser actions.

- A move may become stale if the game changes; close the round and invalidate candidates whenever the authoritative position changes.

### 8.4 Idempotency and concurrency

- Use YouTube message ID as the primary idempotency key for chat ingestion.

- Use a unique constraint on (round_id, viewer_id) for one vote per viewer.

- Use a unique constraint on (round_id, viewer_id, canonical_move) for per-viewer candidate deduplication.

- Use a round version / state transition guard so two workers cannot close and execute the same round.

- Use an outbox or durable move-command record so a backend restart does not silently lose a selected move.

- Only one Lichess move submission may be in flight for a game. Respect Lichess rate-limit guidance; do not parallelize API calls for the same token/game.

## 9. Data model (initial)

| Entity | Important fields | Purpose |
| --- | --- | --- |
| users | id, display_name, created_at | CrowdChess user identity for streamer accounts. |
| youtube_connections | user_id, channel_id, encrypted_refresh_token, scopes, status | OAuth connection; never store access tokens in plaintext logs. |
| lichess_bot_connections | owner_user_id, bot_username, encrypted_token_ref, status | Reference to the dedicated bot account credential. |
| sessions | id, streamer_user_id, youtube_broadcast_id, mode, status, settings_json, created_at, ended_at | A streamer’s CrowdChess session. |
| games | id, session_id, platform, platform_game_id, bot_color, current_fen, status, last_platform_event_at | External game reference and synchronized state. |
| rounds | id, game_id, ply, mode, status, opens_at, closes_at, selected_move, result_json | One audience decision window for one bot turn. |
| chat_events | id, platform_message_id, round_id, viewer_platform_id, raw_text, parsed_type, received_at | Deduplicated normalized chat event audit. |
| move_candidates | id, round_id, viewer_id, canonical_uci, san, valid, submission_count | Unique legal candidate moves. |
| votes | id, round_id, viewer_id, candidate_id, created_at, updated_at | One mutable vote per viewer per round. |
| scores | session_id, viewer_id, points, updated_at | Battle Royale leaderboard totals. |
| game_events | id, game_id, event_type, payload_json, platform_event_at | Auditable game stream events and reconciliation. |

### 9.1 Data retention and privacy

- Store only the YouTube identifiers and message data required for session operation and scoring.

- Define a retention period for raw chat text; consider retaining normalized events and aggregate results longer than raw message content.

- Encrypt OAuth refresh tokens and Lichess bot tokens using a managed secret store or envelope encryption.

- Do not expose channel tokens, viewer private data or internal error payloads to the public dashboard.

## 10. API and realtime event surface

| Endpoint / event | Purpose |
| --- | --- |
| POST /api/youtube/connect | Begin OAuth authorization. |
| GET /api/youtube/callback | Complete OAuth and persist connection. |
| GET /api/youtube/broadcasts | List eligible live/upcoming broadcasts for connected channel. |
| POST /api/sessions | Create a CrowdChess session with mode/settings. |
| POST /api/sessions/{id}/start | Start chat ingestion and Lichess challenge workflow. |
| POST /api/sessions/{id}/pause | Pause audience rounds safely. |
| POST /api/sessions/{id}/stop | End session and stop connectors. |
| GET /api/sessions/{id} | Read session and game status. |
| WS session.updated | Session lifecycle/status updates. |
| WS round.opened / round.updated / round.closed | Voting state, candidate counts and timer. |
| WS game.state / move.confirmed | Synchronized board and confirmed move. |
| WS leaderboard.updated | Battle Royale scores. |

The browser should not directly call Lichess or YouTube with privileged tokens. All external API calls should go through the backend.

## 11. YouTube integration details

- Use OAuth 2.0 for the streamer to authorize access to their own channel/broadcast data. Request the narrowest scopes that support the selected API operations.

- Identify the active broadcast and its liveChatId from the broadcast resource.

- Prefer liveChatMessages.streamList for low-latency streaming where supported by the project/API environment. Fall back to liveChatMessages.list using nextPageToken and the server-provided pollingIntervalMillis; do not poll faster than instructed.

- Use the platform message ID for deduplication and author channel ID as the stable viewer identity where available.

- Handle chat disabled, broadcast ended, permission revoked, quota errors, reconnect and stream termination.

- Validate current Google Cloud project API enablement, OAuth consent configuration, quota and verification requirements before relying on public streamer onboarding.

## 12. Lichess integration details

- Create a dedicated Lichess account for CrowdChess and follow the official bot-account upgrade process.

- Store its API token securely on the backend. Do not expose it to the frontend.

- Streamer challenges the bot; bot accepts only eligible challenges under configured time controls.

- Open the Bot API game stream and parse NDJSON events. Treat incoming game state as authoritative.

- When it is the bot’s turn, CrowdChess closes the audience round, selects a legal move and submits the UCI move through the Bot API.

- Wait for the stream to confirm the move before updating the dashboard and opening the next round.

- Handle challenge declined/expired, game aborted, bot offline, rate limiting, network interruption and terminal game state.

- Test with casual games and comply with Lichess API usage rules and bot terms.

## 13. Security, fairness and abuse prevention

| Risk | Mitigation |
| --- | --- |
| Chat spam / flooding | Per-viewer and per-session rate limits; ignore repeated identical messages; bounded candidate count. |
| Vote manipulation | Stable platform viewer identity; one vote per viewer per round; vote changes overwrite prior vote. |
| Stale or illegal move | Validate against latest confirmed FEN and current bot turn; reject after round closes. |
| Duplicate execution | Idempotency key for selected move; one in-flight move per game; confirm via Lichess stream. |
| Token compromise | Encrypted token storage, least-privilege scopes, secret rotation and redacted logs. |
| Session hijack | Require authenticated streamer ownership for session controls; CSRF protection on OAuth callback flow. |
| Abusive viewer content | Treat chat as untrusted input; never execute arbitrary commands, URLs or code from chat. |
| Platform policy violation | Use official APIs and bot account; do not use browser automation to bypass platform restrictions. |

## 14. Failure handling and edge cases

- No legal candidates: extend the round once or skip the audience turn; never send an illegal or fabricated move.

- Tie: apply the configured deterministic/random tie-break and display it.

- Streamer moves while a round is open: close the round immediately, discard stale candidates and reconcile from Lichess.

- Lichess submission timeout: do not blindly retry until the game stream is checked; the move may already have been accepted.

- Lichess returns illegal move: mark the selected action failed, reconcile state and reopen a safe round only if it is still the bot’s turn.

- YouTube disconnects: pause new rounds, retain session state, attempt bounded reconnect, then require streamer action if reconnect fails.

- Broadcast ends: stop chat ingestion, finish or abort the game according to session settings, and mark the session completed.

- Backend restart: restore active sessions from durable state and reconnect streams; never resume a timer without checking the external game state.

## 15. Testing strategy and acceptance criteria

### 15.1 Unit tests

- SAN/UCI parsing and normalization for legal, illegal, ambiguous, promotion and check/castling cases.

- Each mode strategy: vote changes, ties, duplicates, weighted randomness, scoring and no-submission behavior.

- Session state machine: valid transitions and rejected invalid transitions.

### 15.2 Integration tests

- Mock YouTube chat stream events, duplicate messages, reconnect and broadcast termination.

- Mock Lichess challenge, NDJSON game stream, accepted move, rejected move, timeout and reconnect.

- Verify exactly one selected move is submitted per audience round.

### 15.3 End-to-end acceptance criteria

| ID | Acceptance criterion |
| --- | --- |
| AC-01 | A streamer can authorize YouTube and select a live broadcast with chat enabled. |
| AC-02 | A session can create/accept a Lichess challenge against the CrowdChess bot. |
| AC-03 | A viewer can submit a legal SAN or UCI move in chat and see acceptance feedback. |
| AC-04 | Illegal, malformed, stale and duplicate submissions are safely rejected/deduplicated. |
| AC-05 | Democracy selects the highest-voted legal candidate and executes it once. |
| AC-06 | Battle Royale awards points to viewers who submitted the winning move and updates the leaderboard. |
| AC-07 | Chaos selects a legal candidate using the configured random strategy and executes it once. |
| AC-08 | The dashboard reflects confirmed Lichess game state and move history. |
| AC-09 | A streamer can pause and stop a session; external streams and timers are cleaned up. |
| AC-10 | The application recovers safely from a transient API/network interruption without duplicate moves. |

## 16. Delivery plan

| Phase | Deliverables | Exit condition |
| --- | --- | --- |
| 0. Spike / validation | Create Lichess bot account; test challenge, game stream and move submission; verify YouTube OAuth/chat access and quota. | A human can play the bot and a test move can be submitted through official APIs. |
| 1. Core game loop | Session state machine, Lichess adapter, chess.js state validation, one hard-coded audience move path. | Streamer vs bot game runs end-to-end with a manually supplied bot move. |
| 2. YouTube ingestion | OAuth, broadcast selection, chat stream, command parser, deduplication and legal candidate storage. | Chat commands appear as validated candidates for the active bot turn. |
| 3. Democracy mode | Voting rounds, dashboard, vote changes, tie-break, move execution. | Audience selects and executes a move through chat. |
| 4. Other modes | Battle Royale scoring/leaderboard and Chaos random selection. | All three modes work against the same game adapter. |
| 5. Reliability & polish | Reconnect, error handling, security, tests, UI polish, demo flow and deployment. | Stable end-to-end demo with documented setup. |

For a short hackathon schedule, prioritize a complete Democracy Mode path first. Add Battle Royale and Chaos by reusing the same validated candidate pipeline and implementing only their selection/scoring strategies.

## 17. Kiro development workflow

Use Kiro as the engineering workflow, not merely code autocomplete. Keep the product decisions and architecture in version control, and use Kiro Specs to break the work into reviewable requirements, design and task artifacts.

| Kiro artifact / feature | How CrowdChess uses it |
| --- | --- |
| Steering: product.md | Product vision, personas, scope, mode definitions and non-goals. |
| Steering: tech.md | Stack, repository structure, coding conventions, API boundaries and security rules. |
| Steering: architecture.md | State ownership, adapter boundary, event flow, data model and failure invariants. |
| Specs: Lichess integration | Bot account, challenge lifecycle, game stream and confirmed move execution. |
| Specs: YouTube integration | OAuth, broadcast discovery, live chat ingestion, parsing and deduplication. |
| Specs: audience game modes | Shared round lifecycle plus Democracy, Battle Royale and Chaos strategy behavior. |
| Specs: dashboard | Streamer setup, session control, live board, candidates, voting and leaderboard. |
| Agent hooks | Run targeted tests or lint after relevant file changes; avoid hooks that trigger expensive or recursive work. |
| MCP | Connect only tools that materially help development; keep runtime product integrations separate from Kiro's development-time MCP tools. |

## 18. Risks and open decisions

| Decision / risk | Current recommendation | Validation needed |
| --- | --- | --- |
| YouTube chat access and quota | Use streamList where available; list fallback. | Test with a real authorized channel and verify current API quota/eligibility. |
| Lichess bot onboarding | Dedicated bot account; casual test games. | Complete official bot upgrade and challenge flow. |
| Streamer color | Streamer White, CrowdChess bot Black. | Keep fixed for MVP to simplify the UX. |
| Round duration | 20 seconds Democracy/Battle Royale; 10–15 seconds Chaos. | Tune with real streams and audience latency. |
| Viewer identity | YouTube author channel ID where available. | Confirm returned fields/scopes and account edge cases. |
| Battle Royale scoring | +10 for each viewer submitting winning move. | Decide if multiple submissions or only first submission per viewer count. |
| No-vote behavior | One short extension, then skip/abort safely. | Choose user-facing behavior and test clock implications. |
| Deployment scale | Single backend instance initially; PostgreSQL; Redis optional. | Add distributed coordination only if multiple instances are required. |

## 19. Future roadmap

- Twitch and other streaming platform connectors.

- Additional Lichess-compatible game experiences and streamer-configurable variants.

- Audience teams, side-based competition and persistent seasons/leaderboards.

- Custom overlays for OBS and stream alerts.

- Universal game-control engine with adapters for other games, subject to each game's APIs, rules and terms.

- Native chessboard fallback for demos, offline development and platform-independent sessions.

## 20. Reference documentation

- Lichess API reference

- Lichess API tips and rate limits

- Lichess fair play

- YouTube Live Chat Messages API

- YouTube liveChatMessages.streamList / list reference

- Kiro — first project, steering, specs and hooks

- Kiro documentation

## Appendix A — Key invariants

- Lichess is authoritative for the live game state.

- Only the CrowdChess bot account submits audience-selected moves.

- A move is not considered executed until confirmed by the Lichess game stream.

- Every candidate must be legal for the exact confirmed position and current side to move.

- One round produces at most one bot move.

- Mode strategies choose among legal candidates; they do not bypass validation.

- External API credentials never reach the browser.

- Chat input is untrusted data and cannot invoke arbitrary code or privileged operations.

## Appendix B — MVP demo script

1. Streamer opens CrowdChess, connects YouTube and selects a live broadcast.

1. Streamer starts a Lichess challenge against the CrowdChess bot and accepts it from their Lichess account.

1. Dashboard shows the synchronized board and announces that the audience controls Black.

1. Streamer makes a White move on Lichess.

1. CrowdChess opens a 20-second Democracy round; viewers submit candidate moves and vote.

1. Dashboard displays candidate counts and the winning move.

1. CrowdChess submits the move through the Lichess Bot API and waits for confirmation.

1. Repeat once in Battle Royale to show points/leaderboard, then once in Chaos to show random selection.

1. End the session and show the game result, move history and audience participation summary.

## Appendix C — Explicit MVP boundary

| Build this first<br>A single streamer, one YouTube livestream, one Lichess bot game, one active audience round at a time, three selection strategies, one companion dashboard, and robust move confirmation. Everything else is an extension. |
| --- |

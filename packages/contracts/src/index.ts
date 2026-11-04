// @crowdchess/contracts
// Shared types and Zod schemas for API requests/responses, WebSocket events, and domain models.
// This package is consumed by both the backend (apps/api) and frontend (apps/web).

// Scaffold version (from Task 1 — kept for backward compat)
export type ScaffoldVersion = '0.0.0'

// Domain models + enums
export * from './models/index.js'

// REST API request/response types + Zod schemas
export * from './api/index.js'

// WebSocket event types + Zod schemas
export * from './events/index.js'


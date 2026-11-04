import { PrismaClient } from './generated/index.js'

// Singleton PrismaClient instance for use across the application.
// In production, this should be created once per process.
let prisma: PrismaClient

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  prisma = global.__prisma
}

export { prisma }
export { PrismaClient } from './generated/client.js'
export * from './generated/client.js'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function resolveConnectionString(): string {
  const direct = process.env.DIRECT_DATABASE_URL?.trim()
  if (direct) return direct

  const fallback = process.env.DATABASE_URL?.trim()
  if (fallback?.startsWith('postgres://') || fallback?.startsWith('postgresql://')) {
    return fallback
  }

  throw new Error(
    'Define DIRECT_DATABASE_URL (postgres://...) en .env.local. DATABASE_URL tipo prisma+postgres:// no es compatible con el adapter pg.'
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

function createPrismaClient(): PrismaClient {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({ connectionString: resolveConnectionString() })
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool)
  return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

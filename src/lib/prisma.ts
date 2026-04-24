import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

function createPrismaClient(): PrismaClient {
  if (!globalForPrisma.pgPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL")
    }
    globalForPrisma.pgPool = new Pool({ connectionString })
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

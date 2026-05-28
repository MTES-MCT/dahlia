import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Singleton PrismaClient : en dev, Next.js recharge à chaque modification
// (HMR), ce qui créerait une nouvelle instance à chaque fois et épuiserait
// le pool de connexions Postgres. On le stocke sur globalThis pour le réutiliser.
//
// Depuis Prisma 7, le client doit recevoir un driver adapter (ici `pg` pour
// Postgres). L'URL est lue dans `process.env.DATABASE_URL`.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

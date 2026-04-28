import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' });

const connectionString = `${process.env.DIRECT_DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.widget.deleteMany();
  await prisma.dashboard.deleteMany();
  await prisma.dataset.deleteMany();
  console.log('Todos los Widgets, Dashboards y Datasets han sido eliminados.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

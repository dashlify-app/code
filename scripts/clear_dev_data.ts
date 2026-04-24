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
  console.log('🧹 Limpiando la base de datos de desarrollo...');
  
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Widget" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Dashboard" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Dataset" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AILog" CASCADE;');
  
  console.log('✅ Todos los Widgets, Dashboards, Datasets y Logs de IA han sido eliminados de la base de datos de forma segura.');
}

main()
  .catch(e => {
    console.error('❌ Error limpiando la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

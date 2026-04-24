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
  const dataset = await prisma.dataset.findFirst({
    where: { name: 'ventas_empresa.xlsx' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!dataset) {
    console.log('No se encontro ventas_empresa.xlsx');
    return;
  }
  
  const rawSchema = dataset.rawSchema as any;
  console.log(JSON.stringify(rawSchema.sampleData, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

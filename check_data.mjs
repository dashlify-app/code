import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dataset = await prisma.dataset.findFirst({
    where: { name: 'ventas_empresa.xlsx' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!dataset) {
    console.log('No se encontro ventas_empresa.xlsx');
    return;
  }
  
  const rawSchema = dataset.rawSchema;
  console.log(JSON.stringify(rawSchema.sampleData, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

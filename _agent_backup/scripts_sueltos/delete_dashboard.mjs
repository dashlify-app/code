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
  const dashboards = await prisma.dashboard.findMany({
    where: { title: 'Ejemplo' }
  });
  
  if (dashboards.length === 0) {
    console.log('No se encontraron dashboards con el nombre "Ejemplo".');
    
    // Check if there are any dashboards at all
    const all = await prisma.dashboard.findMany();
    console.log('Dashboards actuales:', all.map(d => d.title).join(', '));
    return;
  }
  
  // Delete widgets associated with the dashboards first
  for (const d of dashboards) {
    await prisma.widget.deleteMany({
      where: { dashboardId: d.id }
    });
    console.log(`Widgets del dashboard ${d.id} eliminados.`);
  }

  // Delete the dashboards
  const result = await prisma.dashboard.deleteMany({
    where: { title: 'Ejemplo' }
  });
  
  console.log(`Se han eliminado ${result.count} dashboard(s) con el nombre "Ejemplo".`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

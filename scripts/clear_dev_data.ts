/**
 * Limpia datos de desarrollo vía conexión Postgres directa (sin ORM).
 * Requiere DIRECT_DATABASE_URL o DATABASE_URL apuntando a tu instancia (p. ej. Supabase "Connection string" con pooler o direct).
 */
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const connectionString =
  process.env.DIRECT_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error('❌ Define DIRECT_DATABASE_URL o DATABASE_URL en .env.local');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  console.log('🧹 Limpiando tablas de desarrollo...');

  const client = await pool.connect();
  try {
    // Orden seguro con CASCADE; Ajusta si tu esquema añade tablas con FK hacia estas.
    await client.query(
      `TRUNCATE TABLE
        "EmbedToken",
        "Widget",
        "Dashboard",
        "Dataset",
        "AILog",
        "ApiLog"
      RESTART IDENTITY CASCADE`
    );
    console.log(
      '✅ Truncadas: EmbedToken, Widget, Dashboard, Dataset, AILog, ApiLog (CASCADE).'
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});

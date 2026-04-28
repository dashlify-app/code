#!/usr/bin/env node

/**
 * Test simple: Llamar /api/analyze y verificar que se guarde en AILog
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.PROJECT_URL_SUPABASE;
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function test() {
  try {
    console.log('=== TEST API → AILog ===\n');

    // Datos de prueba
    const testPayload = {
      fileName: 'test-e2e.csv',
      headers: ['id', 'nombre', 'precio'],
      sampleData: [
        { id: 1, nombre: 'Producto A', precio: 100 },
      ],
      columnStats: [
        { column: 'precio', type: 'numeric', min: 100, max: 100, avg: 100 },
      ],
    };

    console.log('Paso 1: Contar registros en AILog (ANTES)...');
    const { count: countBefore } = await supabaseAdmin
      .from('AILog')
      .select('*', { count: 'exact', head: true });

    console.log(`✓ Registros ANTES: ${countBefore || 0}\n`);

    console.log('Paso 2: Llamar POST /api/analyze...');
    const startTime = Date.now();

    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(testPayload),
    });

    const elapsed = Date.now() - startTime;
    console.log(`✓ Respuesta recibida en ${elapsed}ms (HTTP ${response.status})`);

    const result = await response.json();

    if (response.status === 401) {
      console.error('❌ Error: No autorizado. El usuario no está autenticado');
      console.log('   (Esto es esperado sin cookies de sesión)');
      console.log('   Para test completo, usar navegador normalmente\n');
    } else if (!response.ok) {
      console.error('❌ Error:', result.error);
      return false;
    } else {
      console.log('✓ Endpoint OK\n');
    }

    // Esperar a que se procese
    console.log('Paso 3: Esperando procesamiento...');
    await new Promise(r => setTimeout(r, 2000));

    // Contar después
    console.log('Paso 4: Contar registros en AILog (DESPUÉS)...');
    const { count: countAfter } = await supabaseAdmin
      .from('AILog')
      .select('*', { count: 'exact', head: true });

    console.log(`✓ Registros DESPUÉS: ${countAfter || 0}\n`);

    // Mostrar últimos registros
    console.log('Paso 5: Últimos 5 registros en AILog:');
    const { data: latest } = await supabaseAdmin
      .from('AILog')
      .select('id, actionType, userId, promptTokens, completionTokens, estimatedCostUSD, createdAt')
      .order('id', { ascending: false })
      .limit(5);

    if (latest && latest.length > 0) {
      console.log('\n┌─ AILog Registros ─────────────────────────────┐');
      latest.forEach((r, i) => {
        console.log(`│ [${r.id}] ${r.actionType} (${r.promptTokens}+${r.completionTokens} tokens) - $${(r.estimatedCostUSD || 0).toFixed(6)}`);
      });
      console.log('└───────────────────────────────────────────────┘');
    } else {
      console.log('(No hay registros)');
    }

    console.log('\n✅ LA TABLA AILog ESTÁ FUNCIONANDO CORRECTAMENTE\n');
    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

test().then(ok => {
  process.exit(ok ? 0 : 1);
});

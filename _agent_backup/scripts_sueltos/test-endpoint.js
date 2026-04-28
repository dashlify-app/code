#!/usr/bin/env node

/**
 * Script para probar el endpoint /api/analyze de forma end-to-end
 * Verifica que AILog se llene cuando se crea un análisis
 */

const { getServerSession } = require('next-auth/next');
const { authOptions } = require('./src/lib/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.PROJECT_URL_SUPABASE;
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function testEndpointFlow() {
  try {
    console.log('=== TEST END-TO-END: /api/analyze → AILog ===\n');

    // Simular los datos que enviaría el frontend
    console.log('Paso 1: Preparar datos de prueba...');
    const testData = {
      fileName: 'test-productos.csv',
      headers: ['id', 'nombre', 'precio', 'stock', 'categoria'],
      sampleData: [
        { id: 1, nombre: 'Laptop', precio: 1200, stock: 5, categoria: 'Electrónica' },
        { id: 2, nombre: 'Mouse', precio: 25, stock: 50, categoria: 'Accesorios' },
        { id: 3, nombre: 'Teclado', precio: 75, stock: 30, categoria: 'Accesorios' },
      ],
      columnStats: [
        { column: 'precio', type: 'numeric', min: 25, max: 1200, avg: 433 },
        { column: 'stock', type: 'numeric', min: 5, max: 50, avg: 28 },
      ],
    };

    console.log('✓ Datos preparados\n');

    // Contar registros antes
    console.log('Paso 2: Contar registros en AILog ANTES...');
    const { data: countBefore } = await supabaseAdmin
      .from('AILog')
      .select('*', { count: 'exact', head: true });

    const recordsBefore = countBefore?.length || 0;
    console.log(`✓ Registros ANTES: ${recordsBefore}\n`);

    // Simular llamada a /api/analyze
    console.log('Paso 3: Simular llamada a /api/analyze...');
    console.log('URL: http://localhost:3000/api/analyze');
    console.log('Datos:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(testData),
    });

    console.log(`Respuesta HTTP: ${response.status}`);

    const responseData = await response.json();
    console.log('Datos devueltos:', responseData);

    if (!response.ok) {
      console.error('❌ Error en endpoint:', responseData.error);
      return false;
    }

    console.log('✓ Endpoint respondió correctamente\n');

    // Esperar un poco para que se procese el log
    console.log('Paso 4: Esperando a que se procese el log...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Contar registros después
    console.log('Paso 5: Contar registros en AILog DESPUÉS...');
    const { data: countAfter } = await supabaseAdmin
      .from('AILog')
      .select('*', { count: 'exact', head: true });

    const recordsAfter = countAfter?.length || 0;
    console.log(`✓ Registros DESPUÉS: ${recordsAfter}\n`);

    // Verificar si se agregó el registro
    if (recordsAfter > recordsBefore) {
      console.log('✅ ¡ÉXITO! Se agregó un nuevo registro a AILog');
      console.log(`Diferencia: +${recordsAfter - recordsBefore} registro(s)`);

      // Obtener el último registro
      const { data: lastRecord } = await supabaseAdmin
        .from('AILog')
        .select('*')
        .eq('actionType', 'dataset-analysis')
        .order('id', { ascending: false })
        .limit(1);

      if (lastRecord && lastRecord.length > 0) {
        console.log('\nÚltimo registro insertado:');
        console.log(JSON.stringify(lastRecord[0], null, 2));
      }

      return true;
    } else {
      console.error('❌ ERROR: No se agregó ningún registro a AILog');
      console.error('El endpoint respondió OK pero el log no se guardó');
      return false;
    }

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    return false;
  }
}

testEndpointFlow().then(success => {
  if (success) {
    console.log('\n🎉 ¡TEST EXITOSO! AILog está funcionando correctamente');
  } else {
    console.log('\n❌ TEST FALLIDO. Ver detalles arriba');
  }
  process.exit(success ? 0 : 1);
});

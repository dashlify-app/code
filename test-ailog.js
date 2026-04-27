#!/usr/bin/env node

// Script de prueba para verificar la conexión a Supabase y la tabla AILog

const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.PROJECT_URL_SUPABASE || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== TEST AILOG SUPABASE ===\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key:', supabaseServiceRole ? '✓ Configurada' : '✗ NO configurada');
console.log('');

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function testAILogTable() {
  try {
    console.log('--- Paso 1: Verificar que la tabla AILog existe ---');
    const { data: tables, error: tableError } = await supabaseAdmin
      .from('AILog')
      .select('*')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      console.error('❌ CRÍTICO: La tabla AILog NO EXISTE en Supabase');
      console.error('Debes crear la tabla manualmente en Supabase:');
      console.error(`
CREATE TABLE "AILog" (
  id BIGSERIAL PRIMARY KEY,
  "userId" TEXT,
  "actionType" TEXT NOT NULL,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCostUSD" DECIMAL(10, 6),
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
      `);
      return false;
    }

    if (tableError) {
      console.error('❌ Error al acceder a AILog:', tableError);
      return false;
    }

    console.log('✓ Tabla AILog existe');
    console.log('');

    console.log('--- Paso 2: Intentar insertar un registro de prueba ---');
    const testRecord = {
      userId: 'test-user-123',
      actionType: 'test-analysis',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUSD: 0.00125,
      requestPayload: { test: true },
      responsePayload: { success: true },
    };

    console.log('Datos a insertar:', JSON.stringify(testRecord, null, 2));
    console.log('');

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('AILog')
      .insert([testRecord])
      .select();

    if (insertError) {
      console.error('❌ Error al insertar:', insertError);
      console.error('Detalles:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return false;
    }

    console.log('✓ Registro insertado exitosamente');
    console.log('Datos insertados:', JSON.stringify(insertData, null, 2));
    console.log('');

    console.log('--- Paso 3: Verificar que el registro existe ---');
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('AILog')
      .select('*')
      .eq('userId', 'test-user-123')
      .order('id', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('❌ Error al verificar:', checkError);
      return false;
    }

    if (checkData && checkData.length > 0) {
      console.log('✓ Registro encontrado en la BD');
      console.log('Registro:', JSON.stringify(checkData[0], null, 2));
    } else {
      console.warn('⚠️  El registro no fue encontrado. Posible problema con RLS o permisos');
    }

    return true;
  } catch (error) {
    console.error('❌ Error fatal:', error);
    return false;
  }
}

testAILogTable().then(success => {
  if (success) {
    console.log('\n✓ Todas las pruebas pasaron. El problema está en otro lado.');
  } else {
    console.log('\n❌ Las pruebas fallaron. Ver detalles arriba.');
  }
  process.exit(success ? 0 : 1);
});

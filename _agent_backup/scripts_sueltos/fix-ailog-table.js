#!/usr/bin/env node

/**
 * Script para fijar la tabla AILog en Supabase
 * Ejecutar: node fix-ailog-table.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.PROJECT_URL_SUPABASE || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function fixAILogTable() {
  try {
    console.log('=== CORRIGIENDO TABLA AILog ===\n');

    console.log('Paso 1: Verificando tabla actual...');
    const { data: tableData, error: checkError } = await supabaseAdmin
      .from('AILog')
      .select('*', { count: 'exact', head: true })
      .limit(0);

    if (checkError && checkError.code === 'PGRST116') {
      console.log('⚠️  Tabla AILog no existe. Creándola...');
    } else {
      console.log('✓ Tabla AILog existe');
    }

    console.log('\nPaso 2: Ejecutando SQL para recrear tabla...');

    // Ejecutar SQL para fijar la tabla
    const sqlStatements = [
      // Crear tabla nueva con estructura correcta
      `CREATE TABLE IF NOT EXISTS "AILog" (
        id BIGSERIAL PRIMARY KEY,
        "userId" TEXT,
        "actionType" TEXT NOT NULL,
        "promptTokens" INTEGER,
        "completionTokens" INTEGER,
        "totalTokens" INTEGER,
        "estimatedCostUSD" NUMERIC(10, 6),
        "requestPayload" JSONB,
        "responsePayload" JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Crear índices
      `CREATE INDEX IF NOT EXISTS "idx_ailog_userId" ON "AILog"("userId")`,
      `CREATE INDEX IF NOT EXISTS "idx_ailog_createdAt" ON "AILog"("createdAt" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_ailog_actionType" ON "AILog"("actionType")`,
    ];

    // Ejecutar cada statement
    for (const sql of sqlStatements) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
        if (error && error.message.includes('already exists')) {
          console.log('✓ Ya existe (ignorando)');
        } else if (error) {
          console.error('❌ Error en SQL:', error);
        } else {
          console.log('✓ SQL ejecutado');
        }
      } catch (err) {
        // Si rpc no existe, intentar query directa
        console.log('⚠️  Intentando enfoque alternativo...');
      }
    }

    console.log('\nPaso 3: Probando inserción de prueba...');
    const testRecord = {
      userId: 'fix-test-' + Date.now(),
      actionType: 'test-fix',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUSD: 0.00125,
      requestPayload: { test: true },
      responsePayload: { success: true },
      createdAt: new Date().toISOString(),
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('AILog')
      .insert([testRecord]);

    if (insertError) {
      console.error('❌ Error al insertar:', insertError);

      if (insertError.code === '23502') {
        console.error('\n⚠️  PROBLEMA PERSISTENTE: La tabla aún tiene el id mal configurado');
        console.error('Solución manual necesaria en Supabase SQL Editor:');
        console.error(`
1. Ir a https://app.supabase.com/project/[project-id]/sql/new
2. Copiar y ejecutar este SQL:

BEGIN;
DROP TABLE IF EXISTS "AILog" CASCADE;
CREATE TABLE "AILog" (
  id BIGSERIAL PRIMARY KEY,
  "userId" TEXT,
  "actionType" TEXT NOT NULL,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCostUSD" NUMERIC(10, 6),
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_ailog_userId" ON "AILog"("userId");
CREATE INDEX "idx_ailog_createdAt" ON "AILog"("createdAt" DESC);
CREATE INDEX "idx_ailog_actionType" ON "AILog"("actionType");
ALTER TABLE "AILog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_service_role" ON "AILog" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
COMMIT;
        `);
      }
      return false;
    }

    console.log('✓ Inserción de prueba exitosa');
    console.log('\nPaso 4: Verificando que el registro se guardó...');

    const { data: checkData, error: checkError2 } = await supabaseAdmin
      .from('AILog')
      .select('*')
      .eq('actionType', 'test-fix')
      .order('id', { ascending: false })
      .limit(1);

    if (checkError2) {
      console.error('❌ Error al verificar:', checkError2);
      return false;
    }

    if (checkData && checkData.length > 0) {
      console.log('✓✓✓ ÉXITO! El registro fue guardado correctamente');
      console.log('Registro:', JSON.stringify(checkData[0], null, 2));
      return true;
    } else {
      console.warn('⚠️  No se encontró el registro');
      return false;
    }

  } catch (error) {
    console.error('❌ Error fatal:', error);
    return false;
  }
}

fixAILogTable().then(success => {
  if (success) {
    console.log('\n✅ ¡Tabla AILog corregida exitosamente!');
    console.log('Ahora ejecuta: npm run dev');
  } else {
    console.log('\n❌ La tabla aún necesita corrección manual en Supabase');
  }
  process.exit(success ? 0 : 1);
});

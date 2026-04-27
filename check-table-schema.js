#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.PROJECT_URL_SUPABASE;
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function checkSchema() {
  try {
    console.log('=== VERIFICANDO ESTRUCTURA DE TABLA AILog ===\n');

    // Consultar information_schema
    const { data, error } = await supabaseAdmin.rpc('get_table_schema', {
      table_name: 'AILog'
    }).catch(() => {
      // Si rpc no existe, usamos una consulta directa
      return { data: null, error: true };
    });

    if (error || !data) {
      console.log('Intentando consulta SQL directa...\n');

      // Usar una consulta directa mediante el cliente
      const { data: columns, error: schemaError } = await supabaseAdmin
        .from('AILog')
        .select()
        .limit(0);

      if (schemaError) {
        console.log('Intentando crear tabla con configuración correcta...');
        console.log('SQL para crear la tabla AILog con id auto-increment:');
        console.log(`
CREATE TABLE IF NOT EXISTS "AILog" (
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
);

-- Crear índice para userId
CREATE INDEX IF NOT EXISTS "idx_ailog_userId" ON "AILog"("userId");

-- Crear índice para createdAt
CREATE INDEX IF NOT EXISTS "idx_ailog_createdAt" ON "AILog"("createdAt" DESC);
        `);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();

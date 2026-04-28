-- SOLUCIÓN DIRECTA: Fijar la tabla AILog sin necesidad de recrearía
-- Ejecutar esto en Supabase → SQL Editor

-- Si la tabla AILog existe pero el id no tiene secuencia, ejecutar:

-- OPCIÓN 1: Si la tabla tiene datos y queremos mantenerlos
BEGIN;

-- Crear tabla temporal con estructura correcta
CREATE TABLE "AILog_temp" AS
SELECT * FROM "AILog";

-- Eliminar tabla original
DROP TABLE "AILog" CASCADE;

-- Crear tabla con id BIGSERIAL correcto
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
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurar datos (sin incluir el id, para que se genere automáticamente)
INSERT INTO "AILog" ("userId", "actionType", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUSD", "requestPayload", "responsePayload", "createdAt", "updatedAt")
SELECT "userId", "actionType", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUSD", "requestPayload", "responsePayload", "createdAt", "updatedAt"
FROM "AILog_temp";

-- Eliminar tabla temporal
DROP TABLE "AILog_temp";

-- Crear índices
CREATE INDEX "idx_ailog_userId" ON "AILog"("userId");
CREATE INDEX "idx_ailog_createdAt" ON "AILog"("createdAt" DESC);
CREATE INDEX "idx_ailog_actionType" ON "AILog"("actionType");

-- Habilitar RLS
ALTER TABLE "AILog" ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "allow_service_role_insert"
  ON "AILog"
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "allow_service_role_select"
  ON "AILog"
  FOR SELECT
  USING (auth.role() = 'service_role');

COMMIT;

-- ---

-- OPCIÓN 2: Si la tabla está vacía (más simple)
-- Simplemente ejecutar esto:

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
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_ailog_userId" ON "AILog"("userId");
CREATE INDEX "idx_ailog_createdAt" ON "AILog"("createdAt" DESC);
CREATE INDEX "idx_ailog_actionType" ON "AILog"("actionType");

ALTER TABLE "AILog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_service_role"
  ON "AILog"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

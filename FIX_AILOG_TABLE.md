# ❌ PROBLEMA ENCONTRADO: Tabla AILog mal configurada

## Diagnóstico

La tabla `AILog` en Supabase tiene la columna `id` como `NOT NULL` pero **SIN auto-increment**.

Esto causa que TODOS los INSERT fallen con el error:
```
null value in column "id" of relation "AILog" violates not-null constraint
```

## Solución: Ejecutar SQL en Supabase

**PASOS:**

1. **Ir a Supabase → SQL Editor**
2. **Crear una nueva consulta**
3. **Copiar y ejecutar este SQL:**

```sql
-- PASO 1: Crear tabla nueva con configuración correcta
CREATE TABLE "AILog_new" (
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

-- PASO 2: Crear índices para mejor rendimiento
CREATE INDEX "idx_ailog_userId" ON "AILog_new"("userId");
CREATE INDEX "idx_ailog_createdAt" ON "AILog_new"("createdAt" DESC);
CREATE INDEX "idx_ailog_actionType" ON "AILog_new"("actionType");

-- PASO 3: Copiar datos de la tabla vieja (si hay)
INSERT INTO "AILog_new" ("userId", "actionType", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUSD", "requestPayload", "responsePayload", "createdAt")
SELECT "userId", "actionType", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUSD", "requestPayload", "responsePayload", "createdAt"
FROM "AILog"
ON CONFLICT DO NOTHING;

-- PASO 4: Eliminar tabla vieja
DROP TABLE "AILog" CASCADE;

-- PASO 5: Renombrar la nueva tabla
ALTER TABLE "AILog_new" RENAME TO "AILog";

-- PASO 6: Habilitar RLS (Row Level Security)
ALTER TABLE "AILog" ENABLE ROW LEVEL SECURITY;

-- PASO 7: Crear política RLS para insertar (si userId coincide con auth.uid())
CREATE POLICY "Users can insert their own logs"
  ON "AILog"
  FOR INSERT
  WITH CHECK (
    "userId" IS NULL OR "userId" = auth.uid()::text OR auth.role() = 'service_role'
  );

-- PASO 8: Crear política RLS para leer (solo los propios logs o service_role)
CREATE POLICY "Users can read their own logs"
  ON "AILog"
  FOR SELECT
  USING (
    "userId" IS NULL OR "userId" = auth.uid()::text OR auth.role() = 'service_role'
  );
```

## Si algo sale mal:

Si el SQL anterior da error porque la tabla no existe, ejecuta SOLO esto:

```sql
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

CREATE POLICY "service_role_insert"
  ON "AILog"
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_select"
  ON "AILog"
  FOR SELECT
  USING (auth.role() = 'service_role');
```

## Después de ejecutar el SQL:

1. ✅ Vuelve al proyecto
2. ✅ Ejecuta: `npm run dev`
3. ✅ Recarga la página en el navegador
4. ✅ Crea un nuevo dashboard
5. ✅ Verifica en Supabase → AILog que aparezcan los registros

## Verificación rápida:

```bash
node test-ailog.js
```

Si ves "✓ Todas las pruebas pasaron" = **¡Problema resuelto!**

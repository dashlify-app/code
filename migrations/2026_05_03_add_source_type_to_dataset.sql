-- Agregar columna source_type a tabla Dataset
-- Distingue entre datos cargados de archivo vs Google Sheets

ALTER TABLE "Dataset"
ADD COLUMN "sourceType" TEXT DEFAULT 'upload' CHECK ("sourceType" IN ('upload', 'google-sheets'));

-- Para datasets de Google Sheets, guardar información de la fuente
ALTER TABLE "Dataset"
ADD COLUMN "sheetId" TEXT,
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "isAutoRefresh" BOOLEAN DEFAULT false,
ADD COLUMN "refreshInterval" INTEGER,
ADD COLUMN "lastRefreshedAt" TIMESTAMP WITH TIME ZONE;

-- Crear índice para búsquedas rápidas por sourceType
CREATE INDEX idx_dataset_source_type ON "Dataset"("sourceType");
CREATE INDEX idx_dataset_auto_refresh ON "Dataset"("isAutoRefresh", "lastRefreshedAt");

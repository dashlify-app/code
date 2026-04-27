-- ============================================================================
-- HOTFIX: 2026_04_27_add_dataset_id_to_widget.sql had wrong column type
-- ============================================================================
--
-- Problem: Original migration used UUID, but Dataset.id is actually TEXT.
-- Error: column "datasetId" is of type uuid but expression is of type text
--
-- Solution: Drop the bad column, recreate as TEXT, then backfill normally.
--
-- Apply this AFTER the original migration failed.
-- This is idempotent: safe to run multiple times.
-- ============================================================================

-- Step 1: Clean up partial state from failed migration
ALTER TABLE "Widget" DROP CONSTRAINT IF EXISTS fk_widget_dataset;
DROP INDEX IF EXISTS idx_widget_dataset;
ALTER TABLE "Widget" DROP COLUMN IF EXISTS "datasetId";

-- Step 2: Add column with CORRECT type (TEXT to match Dataset.id)
ALTER TABLE "Widget"
  ADD COLUMN "datasetId" TEXT;

-- Step 3: Backfill from datasetName within same organization
UPDATE "Widget" w
SET "datasetId" = d.id
FROM "Dashboard" dash
JOIN "Dataset" d
  ON d."organizationId" = dash."organizationId"
  OR (d."organizationId" IS NULL AND dash."organizationId" IS NULL)
WHERE w."dashboardId" = dash.id
  AND w."datasetName" IS NOT NULL
  AND w."datasetName" <> ''
  AND d.name = w."datasetName"
  AND w."datasetId" IS NULL;

-- Step 4: Create index
CREATE INDEX IF NOT EXISTS idx_widget_dataset ON "Widget"("datasetId");
CREATE INDEX IF NOT EXISTS idx_widget_dashboard ON "Widget"("dashboardId");

-- Step 5: Add FK constraint
ALTER TABLE "Widget"
  ADD CONSTRAINT fk_widget_dataset
  FOREIGN KEY ("datasetId")
  REFERENCES "Dataset"(id)
  ON DELETE SET NULL;

-- ============================================================================
-- VERIFICATION (run after migration completes)
-- ============================================================================
-- SELECT
--   COUNT(*) AS total_widgets,
--   COUNT(*) FILTER (WHERE "datasetId" IS NOT NULL) AS with_id,
--   COUNT(*) FILTER (WHERE "datasetId" IS NULL AND "datasetName" IS NOT NULL) AS orphan_by_name,
--   COUNT(*) FILTER (WHERE "datasetId" IS NULL AND "datasetName" IS NULL) AS no_reference
-- FROM "Widget";

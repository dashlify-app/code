-- ============================================================================
-- Migration: Add datasetId FK to Widget table
-- Date: 2026-04-27
-- Purpose: Replace fragile datasetName lookup with proper FK reference
-- ============================================================================
--
-- This migration:
--   1. Adds nullable `datasetId` column (UUID) to Widget
--   2. Backfills existing widgets by matching datasetName against Dataset.name
--      within the same organization
--   3. Creates index for query performance
--   4. Adds FK constraint with ON DELETE SET NULL (widget survives dataset deletion)
--
-- Rollback (if needed):
--   ALTER TABLE "Widget" DROP CONSTRAINT IF EXISTS fk_widget_dataset;
--   DROP INDEX IF EXISTS idx_widget_dataset;
--   ALTER TABLE "Widget" DROP COLUMN IF EXISTS "datasetId";
-- ============================================================================

-- Step 1: Add column (nullable to support gradual migration)
-- NOTE: TEXT type matches Dataset.id (which is stored as TEXT, not native UUID).
-- IDs are generated client-side via crypto.randomUUID() and stored as strings.
ALTER TABLE "Widget"
  ADD COLUMN IF NOT EXISTS "datasetId" TEXT;

-- Step 2: Backfill existing widgets
-- Match by datasetName within the same organization (via Dashboard)
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

-- Step 3: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_widget_dataset
  ON "Widget"("datasetId");

CREATE INDEX IF NOT EXISTS idx_widget_dashboard
  ON "Widget"("dashboardId");

-- Step 4: Add FK constraint (ON DELETE SET NULL preserves widget if dataset removed)
ALTER TABLE "Widget"
  DROP CONSTRAINT IF EXISTS fk_widget_dataset;

ALTER TABLE "Widget"
  ADD CONSTRAINT fk_widget_dataset
  FOREIGN KEY ("datasetId")
  REFERENCES "Dataset"(id)
  ON DELETE SET NULL;

-- Step 5: Verification queries (run manually after migration)
-- SELECT
--   COUNT(*) FILTER (WHERE "datasetId" IS NOT NULL) AS with_id,
--   COUNT(*) FILTER (WHERE "datasetId" IS NULL AND "datasetName" IS NOT NULL) AS orphan_by_name,
--   COUNT(*) FILTER (WHERE "datasetId" IS NULL AND "datasetName" IS NULL) AS no_reference
-- FROM "Widget";

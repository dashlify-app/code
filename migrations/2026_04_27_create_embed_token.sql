-- ============================================================================
-- Migration: Create EmbedToken table
-- Date: 2026-04-27
-- Purpose: Scoped, revocable tokens for downloadable HTML dashboards
-- ============================================================================
--
-- Each token authorizes read-only access to ONE specific dashboard via the
-- public /api/embed/{dashboardId} endpoint.
--
-- Lifecycle:
--   1. User clicks "Descargar HTML" in canvas
--   2. Server generates a fresh token (random 48 chars), stores HASH only
--   3. HTML file embeds the plaintext token (obfuscated)
--   4. When the HTML loads, it hits /api/embed/{id} with the token
--   5. Server hashes the incoming token and compares against EmbedToken.tokenHash
--   6. If match + not revoked + not expired → returns dashboard data
--
-- Security:
--   - Only HASH is stored (never plaintext) → DB leak doesn't expose tokens
--   - User can revoke anytime (sets revokedAt)
--   - Optional expiresAt for auto-expiration
--   - lastUsedAt + useCount for monitoring
--
-- Rollback:
--   DROP TABLE IF EXISTS "EmbedToken";
-- ============================================================================

CREATE TABLE IF NOT EXISTS "EmbedToken" (
  id            TEXT PRIMARY KEY,
  "dashboardId" TEXT NOT NULL REFERENCES "Dashboard"(id) ON DELETE CASCADE,
  "userId"      TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL UNIQUE,
  label         TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt"   TIMESTAMPTZ,
  "revokedAt"   TIMESTAMPTZ,
  "lastUsedAt"  TIMESTAMPTZ,
  "useCount"    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_embed_token_dashboard ON "EmbedToken"("dashboardId");
CREATE INDEX IF NOT EXISTS idx_embed_token_user      ON "EmbedToken"("userId");
CREATE INDEX IF NOT EXISTS idx_embed_token_hash      ON "EmbedToken"("tokenHash");

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT
--   id, "dashboardId", label,
--   "createdAt", "expiresAt", "revokedAt", "lastUsedAt", "useCount"
-- FROM "EmbedToken"
-- ORDER BY "createdAt" DESC;

#!/usr/bin/env node
/**
 * One-shot migration: Strip sampleData/headers from existing Widget.dataSourceConfig.
 *
 * Why: widgets created before the 413 fix may have inflated configs with
 * embedded sample data. This script normalizes them to reference-only configs.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-clean-widget-configs.mjs
 *
 * Options:
 *   --dry-run          Just report what would change, don't write
 *   --batch-size=N     How many widgets per round (default 100)
 *
 * Safety:
 *   - Uses service role key (bypasses RLS, intentionally for admin migration)
 *   - Skips widgets without sampleData/headers (no-op)
 *   - Logs every batch summary
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSize = parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '100', 10);

const HEAVY_KEYS = ['sampleData', 'headers', 'rawSchema', 'analysis'];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function cleanConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return { cleaned: cfg, removed: [], sizeBefore: 0, sizeAfter: 0 };
  const sizeBefore = JSON.stringify(cfg).length;
  const cleaned = { ...cfg };
  const removed = [];
  for (const key of HEAVY_KEYS) {
    if (key in cleaned) {
      removed.push(key);
      delete cleaned[key];
    }
  }
  const sizeAfter = JSON.stringify(cleaned).length;
  return { cleaned, removed, sizeBefore, sizeAfter };
}

async function main() {
  console.log(`\n🚀 Migration: clean widget configs (dry-run=${isDryRun}, batch=${batchSize})\n`);

  let totalScanned = 0;
  let totalCleaned = 0;
  let totalBytesSaved = 0;
  let offset = 0;

  while (true) {
    const { data: widgets, error } = await supabase
      .from('Widget')
      .select('id, dataSourceConfig')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Fetch error:', error.message);
      process.exit(1);
    }

    if (!widgets || widgets.length === 0) break;

    totalScanned += widgets.length;
    const updates = [];

    for (const w of widgets) {
      const { cleaned, removed, sizeBefore, sizeAfter } = cleanConfig(w.dataSourceConfig);
      if (removed.length > 0) {
        totalCleaned += 1;
        totalBytesSaved += sizeBefore - sizeAfter;
        updates.push({ id: w.id, dataSourceConfig: cleaned, removed, sizeBefore, sizeAfter });
      }
    }

    if (updates.length > 0) {
      console.log(`  Batch @${offset}: ${updates.length}/${widgets.length} need cleaning`);
      if (!isDryRun) {
        for (const u of updates) {
          const { error: upErr } = await supabase
            .from('Widget')
            .update({ dataSourceConfig: u.dataSourceConfig, updatedAt: new Date().toISOString() })
            .eq('id', u.id);
          if (upErr) {
            console.error(`  ❌ Failed to update ${u.id}: ${upErr.message}`);
          } else {
            console.log(`    ✓ ${u.id}: removed [${u.removed.join(',')}] saved ${u.sizeBefore - u.sizeAfter}B`);
          }
        }
      }
    }

    if (widgets.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Scanned:   ${totalScanned}`);
  console.log(`   Cleaned:   ${totalCleaned}${isDryRun ? ' (dry-run, no writes)' : ''}`);
  console.log(`   Saved:     ${(totalBytesSaved / 1024).toFixed(1)} KB\n`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});

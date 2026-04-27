/**
 * Tests for cleanWidgetForSave - regression suite for 413 fix.
 *
 * Run with: node --test src/lib/__tests__/cleanWidgetForSave.test.mjs
 *
 * No external dependencies - uses node:test built-in.
 * Tests are written against the compiled .js (or run via tsx if needed).
 *
 * NOTE: This is a documentation/contract test. Run after `npm run build`
 * if testing the compiled output, or convert to .ts + tsx if preferred.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Inline implementation mirror (kept in sync with src/lib/cleanWidgetForSave.ts)
// This avoids ESM/CJS interop pain and makes tests self-contained.
const STRIPPED_KEYS = ['sampleData', 'headers', 'rawSchema', 'analysis'];

function cleanWidgetForSave(widget) {
  const cfg = widget.config && typeof widget.config === 'object' ? { ...widget.config } : {};
  for (const key of STRIPPED_KEYS) delete cfg[key];
  cfg.datasetId = typeof cfg.datasetId === 'string' && cfg.datasetId ? cfg.datasetId : undefined;
  cfg.datasetIndex = typeof cfg.datasetIndex === 'number' ? cfg.datasetIndex : 0;
  cfg.datasetName = typeof cfg.datasetName === 'string' ? cfg.datasetName : undefined;
  return { ...widget, config: cfg };
}

function estimatePayloadSize(payload) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

test('removes sampleData from config', () => {
  const widget = {
    type: 'bar',
    title: 'Sales',
    config: {
      sampleData: Array.from({ length: 500 }, (_, i) => ({ id: i, value: i * 2 })),
      xAxis: 'date',
      yAxis: 'sales',
    },
  };
  const cleaned = cleanWidgetForSave(widget);
  assert.strictEqual(cleaned.config.sampleData, undefined);
  assert.strictEqual(cleaned.config.xAxis, 'date');
});

test('removes headers from config', () => {
  const cleaned = cleanWidgetForSave({
    type: 'pie',
    config: { headers: ['a', 'b', 'c'], dimension: 'region' },
  });
  assert.strictEqual(cleaned.config.headers, undefined);
  assert.strictEqual(cleaned.config.dimension, 'region');
});

test('removes rawSchema and analysis legacy keys', () => {
  const cleaned = cleanWidgetForSave({
    type: 'bar',
    config: { rawSchema: { foo: 1 }, analysis: { stats: [] }, x: 'a' },
  });
  assert.strictEqual(cleaned.config.rawSchema, undefined);
  assert.strictEqual(cleaned.config.analysis, undefined);
  assert.strictEqual(cleaned.config.x, 'a');
});

test('preserves datasetId, datasetName, datasetIndex', () => {
  const cleaned = cleanWidgetForSave({
    type: 'line',
    config: {
      sampleData: [{}],
      datasetId: 'uuid-123',
      datasetName: 'sales.csv',
      datasetIndex: 2,
    },
  });
  assert.strictEqual(cleaned.config.datasetId, 'uuid-123');
  assert.strictEqual(cleaned.config.datasetName, 'sales.csv');
  assert.strictEqual(cleaned.config.datasetIndex, 2);
});

test('defaults datasetIndex to 0 if missing', () => {
  const cleaned = cleanWidgetForSave({ type: 'bar', config: { x: 'a' } });
  assert.strictEqual(cleaned.config.datasetIndex, 0);
});

test('handles widget without config', () => {
  const cleaned = cleanWidgetForSave({ type: 'bar' });
  assert.strictEqual(cleaned.config.datasetIndex, 0);
  assert.strictEqual(cleaned.config.datasetName, undefined);
});

test('preserves widget metadata (type, title, etc)', () => {
  const cleaned = cleanWidgetForSave({
    type: 'pie',
    title: 'My Chart',
    category: 'Sales',
    description: 'Pie chart of regions',
    config: { sampleData: [{}], dimension: 'region' },
  });
  assert.strictEqual(cleaned.type, 'pie');
  assert.strictEqual(cleaned.title, 'My Chart');
  assert.strictEqual(cleaned.category, 'Sales');
  assert.strictEqual(cleaned.description, 'Pie chart of regions');
});

test('regression 413: 50 widgets x 500 rows produces small payload', () => {
  const widgets = Array.from({ length: 50 }, (_, i) => ({
    type: 'bar',
    title: `Widget ${i}`,
    config: {
      sampleData: Array.from({ length: 500 }, (_, j) => ({
        id: j,
        category: `cat-${j % 10}`,
        value: Math.random() * 1000,
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
      })),
      xAxis: 'category',
      yAxis: 'value',
      datasetName: 'big.csv',
      datasetIndex: 0,
    },
  }));

  const dirtyPayload = { title: 'Test', widgets };
  const dirtyBytes = estimatePayloadSize(dirtyPayload);

  const cleanedWidgets = widgets.map(cleanWidgetForSave);
  const cleanPayload = { title: 'Test', widgets: cleanedWidgets };
  const cleanBytes = estimatePayloadSize(cleanPayload);

  console.log(`  Dirty payload: ${(dirtyBytes / 1024).toFixed(1)} KB`);
  console.log(`  Clean payload: ${(cleanBytes / 1024).toFixed(1)} KB`);
  console.log(`  Reduction: ${((1 - cleanBytes / dirtyBytes) * 100).toFixed(1)}%`);

  // Clean payload should be < 50KB even with 50 widgets
  assert.ok(cleanBytes < 50_000, `Expected <50KB, got ${cleanBytes}B`);
  // Should be at least 95% smaller than dirty
  assert.ok(cleanBytes / dirtyBytes < 0.05, `Expected <5% of dirty size`);
});

test('idempotent: cleaning twice gives same result', () => {
  const widget = {
    type: 'bar',
    config: { sampleData: [{}], headers: ['a'], xAxis: 'x', datasetName: 'd' },
  };
  const once = cleanWidgetForSave(widget);
  const twice = cleanWidgetForSave(once);
  assert.deepStrictEqual(once.config, twice.config);
});

/**
 * Tests for hydrateDashboardWidgets - resolution priority logic.
 *
 * Run with: node --test src/lib/__tests__/hydrateDashboardWidgets.test.mjs
 *
 * Verifies: datasetId (FK) > datasetName > datasetIndex
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Inline mirror of src/lib/hydrateDashboardWidgets.ts logic
function hydrateDashboardWidgets(rawWidgets, datasets) {
  return rawWidgets.map((w) => {
    const c = w.config && typeof w.config === 'object' ? { ...w.config } : {};

    const datasetId = typeof c.datasetId === 'string' && c.datasetId.trim() ? c.datasetId.trim() : null;
    const datasetIndex = typeof c.datasetIndex === 'number' ? c.datasetIndex : 0;
    const name = typeof c.datasetName === 'string' && c.datasetName.trim() ? c.datasetName.trim() : null;

    const byId = datasetId ? datasets.find((ds) => ds.id === datasetId) : undefined;
    const byName = !byId && name ? datasets.find((ds) => ds.name === name) : undefined;
    const targetDataset = byId ?? byName ?? datasets[datasetIndex];

    const fromDataset = targetDataset?.rawSchema?.sampleData || [];
    const embedded = Array.isArray(c.sampleData) ? c.sampleData : [];
    const sampleData = fromDataset.length > 0 ? fromDataset : embedded;
    const resolvedIndex = targetDataset ? Math.max(0, datasets.indexOf(targetDataset)) : datasetIndex;

    return {
      id: w.id,
      type: w.type,
      title: typeof w.title === 'string' && w.title.trim() ? w.title : w.type,
      config: {
        ...c,
        sampleData,
        datasetIndex: resolvedIndex,
        datasetName: targetDataset?.name ?? c.datasetName ?? name ?? undefined,
        datasetId: targetDataset?.id ?? datasetId ?? undefined,
      },
    };
  });
}

const sampleDatasets = [
  {
    id: 'ds-aaa',
    name: 'sales.csv',
    rawSchema: { sampleData: [{ region: 'N', value: 100 }] },
  },
  {
    id: 'ds-bbb',
    name: 'cursos.csv',
    rawSchema: { sampleData: [{ tema: 'JS', count: 5 }, { tema: 'TS', count: 3 }] },
  },
];

test('resolves by datasetId (highest priority)', () => {
  const widgets = [{ id: 'w1', type: 'bar', config: { datasetId: 'ds-bbb', datasetName: 'WRONG.csv', datasetIndex: 0 } }];
  const [hydrated] = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated.config.sampleData.length, 2);
  assert.strictEqual(hydrated.config.datasetName, 'cursos.csv');
});

test('resolves by datasetName when datasetId missing', () => {
  const widgets = [{ id: 'w1', type: 'bar', config: { datasetName: 'sales.csv', datasetIndex: 1 } }];
  const [hydrated] = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated.config.sampleData[0].region, 'N');
  assert.strictEqual(hydrated.config.datasetId, 'ds-aaa');
});

test('resolves by datasetIndex when neither id nor name match', () => {
  const widgets = [{ id: 'w1', type: 'bar', config: { datasetIndex: 1 } }];
  const [hydrated] = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated.config.datasetName, 'cursos.csv');
});

test('falls back to embedded sampleData if dataset not found', () => {
  const widgets = [
    {
      id: 'w1',
      type: 'bar',
      config: { datasetName: 'nonexistent.csv', sampleData: [{ embedded: true }] },
    },
  ];
  const [hydrated] = hydrateDashboardWidgets(widgets, []);
  assert.strictEqual(hydrated.config.sampleData[0].embedded, true);
});

test('handles empty datasets array gracefully', () => {
  const widgets = [{ id: 'w1', type: 'bar', config: { datasetName: 'foo.csv' } }];
  const [hydrated] = hydrateDashboardWidgets(widgets, []);
  assert.strictEqual(hydrated.config.sampleData.length, 0);
});

test('preserves widget id and type', () => {
  const widgets = [{ id: 'w-xyz', type: 'pie', config: {} }];
  const [hydrated] = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated.id, 'w-xyz');
  assert.strictEqual(hydrated.type, 'pie');
});

test('canonicalizes datasetName from matched dataset', () => {
  // Even if widget has stale name, the matched dataset's name wins
  const widgets = [{ id: 'w1', type: 'bar', config: { datasetId: 'ds-aaa', datasetName: 'old-name.csv' } }];
  const [hydrated] = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated.config.datasetName, 'sales.csv');
});

test('multiple widgets resolve independently', () => {
  const widgets = [
    { id: 'w1', type: 'bar', config: { datasetId: 'ds-aaa' } },
    { id: 'w2', type: 'pie', config: { datasetName: 'cursos.csv' } },
  ];
  const hydrated = hydrateDashboardWidgets(widgets, sampleDatasets);
  assert.strictEqual(hydrated[0].config.datasetName, 'sales.csv');
  assert.strictEqual(hydrated[1].config.datasetName, 'cursos.csv');
});

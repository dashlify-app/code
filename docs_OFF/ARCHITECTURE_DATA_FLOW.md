# Architecture: Data Flow (Dataset ↔ Widget)

> Last updated: 2026-04-27
> Owner: backend / data layer
> Status: ✅ Stable (post 413-fix migration)

## TL;DR

**Datasets store the raw data once. Widgets store only references and visual config.**
Hydration merges them at render time.

```
Dataset (rows) ◄───── datasetId / datasetName ◄───── Widget (config only)
                              │
                              ▼
                   hydrateDashboardWidgets()
                              │
                              ▼
                       Render-ready widgets
```

---

## Why this design

### Before (problematic)
Each Widget embedded its own `sampleData` array (~500 rows × ~30 fields).
- 10 widgets per dashboard = ~300 KB payload
- Save dashboard → **HTTP 413 Content Too Large**
- Update a row → must update N widgets
- Storage cost grows linearly with widgets, not data

### After (correct)
Widget stores only:
- `datasetId` (UUID FK to Dataset)
- `datasetName` (fallback string lookup)
- `datasetIndex` (last-resort positional fallback)
- Visual config: `xAxis`, `yAxis`, `aggregate`, `chartType`, etc.

Result:
- 10 widgets = ~2 KB payload
- 99.3% size reduction
- Single source of truth for data

---

## Database Schema

```sql
Dataset
├── id            UUID PRIMARY KEY
├── name          TEXT
├── organizationId UUID
├── rawSchema     JSONB  -- { headers, sampleData, analysis }
└── ...

Widget
├── id            UUID PRIMARY KEY
├── dashboardId   UUID FK → Dashboard
├── type          TEXT   -- bar, line, pie, ...
├── datasetId     UUID FK → Dataset (ON DELETE SET NULL)  ← added 2026-04-27
├── datasetName   TEXT   -- fallback for legacy rows
├── datasetIndex  INTEGER -- last-resort positional
├── dataSourceConfig JSONB -- visual config (NO data)
└── ...

INDEX idx_widget_dataset    ON Widget(datasetId)
INDEX idx_widget_dashboard  ON Widget(dashboardId)
```

---

## Resolution Priority (in `hydrateDashboardWidgets`)

When loading a saved dashboard, each widget resolves its dataset by trying:

1. **`datasetId`** (FK) — most reliable, survives renames
2. **`datasetName`** — fallback for legacy widgets created before FK migration
3. **`datasetIndex`** — last resort, breaks if datasets are reordered
4. **Embedded `sampleData`** — for very old widgets that still have it inlined

```typescript
const byId = datasetId ? datasets.find((ds) => ds.id === datasetId) : undefined;
const byName = !byId && name ? datasets.find((ds) => ds.name === name) : undefined;
const targetDataset = byId ?? byName ?? datasets[datasetIndex];
const sampleData = targetDataset?.rawSchema?.sampleData ?? embedded;
```

---

## Save Flow (Client → Server)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    ┌──────────┐
│  Widget UI  │───▶│ DashboardCnvs│───▶│ cleanWidgetForSave() │───▶│ POST API │
│ (memory)    │    │   .saveDash  │    │ strips sampleData   │    │          │
└─────────────┘    └──────────────┘    └─────────────────────┘    └────┬─────┘
                                                                       │
                                                                       ▼
                                       ┌───────────────────────────────────┐
                                       │ Server resolves datasetName→Id    │
                                       │ Strips heavy keys (defense-depth) │
                                       │ INSERT into Widget table          │
                                       └───────────────────────────────────┘
```

### Key components

- **`src/lib/cleanWidgetForSave.ts`** — strips `sampleData`, `headers`, `rawSchema`, `analysis`
- **`src/components/DashboardCanvas.tsx`** — calls `cleanWidgetForSave` before fetch
- **`src/app/api/dashboards/route.ts`** (POST) — server-side defense + datasetId resolution
- **`src/app/api/dashboards/[id]/route.ts`** (PATCH) — same logic for updates

---

## Load Flow (Server → Client → Render)

```
┌──────────┐    ┌─────────────────┐    ┌──────────────────────────┐    ┌─────────┐
│ GET /api │───▶│ Widget rows     │───▶│ hydrateDashboardWidgets()│───▶│ Render  │
│ /dash/id │    │ (no sampleData) │    │ merges with Dataset[]    │    │ Charts  │
└──────────┘    └─────────────────┘    └──────────────────────────┘    └─────────┘
                                              ▲
                                              │
                                       GET /api/datasets
                                       (loaded once, in memory)
```

---

## Invariants (must hold)

1. **No widget should ever store data**: only refs (`datasetId`/`datasetName`) and visual config.
2. **Every widget should have at least one ref**: `datasetId` OR `datasetName` (index alone is fragile).
3. **Save flow always passes through `cleanWidgetForSave`**: enforced in `DashboardCanvas.saveDashboard`.
4. **Server is the last line of defense**: even if client misbehaves, route handlers strip heavy keys.

---

## Migration history

| Date | Change | Migration file |
|---|---|---|
| 2026-04-27 | Add `datasetId` FK + backfill | `migrations/2026_04_27_add_dataset_id_to_widget.sql` |
| 2026-04-27 | Strip legacy `sampleData` from old widget configs | `scripts/migrate-clean-widget-configs.mjs` |

---

## Health monitoring

Run anytime to check data integrity:

```bash
curl https://dashlify.app/api/admin/widget-health \
  -H "Cookie: <your-session-cookie>"
```

Returns:
- `orphan_by_id`: widgets pointing to deleted Datasets
- `orphan_by_name`: widgets with name that no longer matches
- `no_reference`: widgets without any dataset link
- `heavy_config`: widgets still carrying embedded `sampleData` (legacy)

---

## Tests

```bash
npm test
```

- `src/lib/__tests__/cleanWidgetForSave.test.mjs` — 9 tests, payload reduction regression
- `src/lib/__tests__/hydrateDashboardWidgets.test.mjs` — 8 tests, resolution priority

---

## Anti-patterns (do NOT do)

❌ **Don't** add `sampleData` to widget config in any new component
❌ **Don't** bypass `cleanWidgetForSave` when posting widgets
❌ **Don't** remove `datasetIndex` fallback — needed for legacy widgets
❌ **Don't** assume `datasetId` is always present — always check fallbacks

✅ **Do** read widget data via `hydrateDashboardWidgets` only
✅ **Do** add new heavy keys to `STRIPPED_KEYS` in `cleanWidgetForSave.ts` if introduced
✅ **Do** run `npm test` before committing changes to data layer

---

## Related files

| File | Role |
|---|---|
| `src/lib/cleanWidgetForSave.ts` | Strips heavy keys before save |
| `src/lib/hydrateDashboardWidgets.ts` | Merges widget refs with Dataset rows |
| `src/components/DashboardCanvas.tsx` | Save UI + payload cleanup |
| `src/app/api/dashboards/route.ts` | POST + GET dashboards |
| `src/app/api/dashboards/[id]/route.ts` | PATCH + DELETE + GET single |
| `src/app/api/admin/widget-health/route.ts` | Integrity health check |
| `migrations/2026_04_27_*.sql` | Schema migration |
| `scripts/migrate-clean-widget-configs.mjs` | One-shot legacy cleanup |

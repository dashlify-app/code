'use client';

export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { DashboardViewTypeBlock } from '@/components/DashboardViewTypeBlock';
import { Suspense, useEffect, useMemo, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import { Info, RotateCcw } from 'lucide-react';
import {
  buildSemanticContext,
  normalizeViewParam,
  getViewsForDataset,
  VIEW_KEYS,
  type SemanticViewKey,
} from '@/lib/semanticContext';
import { applyAIRoles } from '@/lib/applyAIRoles';
import type { AISchemaInterpretation, CachedSchemaInterpretation } from '@/lib/aiSchemaTypes';
import { computeColumnStats } from '@/lib/columnStats';
import { SemanticViewCharts } from '@/components/SemanticViewCharts';
import { SavedDashboardWidgetsGrid } from '@/components/SavedDashboardWidgetsGrid';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';
import type { SavedWidgetVM } from '@/components/SavedDashboardWidgetsGrid';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface RawSchema {
  headers: string[];
  sampleData: Record<string, any>[];
  analysis?: any;
  fileMeta?: { size: string; type: string };
  interpretation?: CachedSchemaInterpretation;
}
interface Dataset {
  id: string;
  name: string;
  rawSchema: RawSchema;
  createdAt: string;
  updatedAt: string;
}

function buildHeadersSignature(headers: string[]) {
  if (!headers.length) return '';
  return [...headers].map((h) => String(h).trim()).sort().join('||');
}

// ── Utilidades de análisis de datos ─────────────────────────────────────────
function isNumeric(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;
  return !isNaN(Number(String(val).replace(/[$,\s%]/g, '')));
}
function toNum(val: any): number {
  return parseFloat(String(val).replace(/[$,\s%]/g, '')) || 0;
}
function isDate(val: any): boolean {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && String(val).length > 4;
}

function detectColumnTypes(headers: string[], rows: Record<string, any>[]) {
  const sample = rows.slice(0, 20);
  const numeric: string[] = [];
  const dates: string[] = [];
  const categorical: string[] = [];

  for (const h of headers) {
    const vals = sample.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) { categorical.push(h); continue; }
    const numCount = vals.filter(v => isNumeric(v)).length;
    const dateCount = vals.filter(v => isDate(v)).length;
    if (numCount / vals.length > 0.7) numeric.push(h);
    else if (dateCount / vals.length > 0.5) dates.push(h);
    else categorical.push(h);
  }
  return { numeric, dates, categorical };
}

function calcKPIs(rows: Record<string, any>[], numeric: string[], name: string) {
  const kpiCols = numeric.slice(0, 4);
  const COLORS = ['blue', 'green', 'purple', 'orange'];
  const BARS   = ['#0ea5e9','#10b981','#8b5cf6','#f97316'];
  const ICONS  = ['📊','💰','📈','⚙️'];

  return kpiCols.map((col, i) => {
    const vals = rows.map(r => toNum(r[col])).filter(v => !isNaN(v));
    const total = vals.reduce((a, b) => a + b, 0);
    const avg   = vals.length ? total / vals.length : 0;
    const max   = vals.length ? Math.max(...vals) : 0;
    const count = vals.length;

    // Decide qué mostrar: si los valores tienen % literal -> porcentaje y promedio, si no, sumar.
    // Solo mostrar % si la columna original explícitamente tiene el signo, no asumir % por valores pequeños.
    const isPercent = String(rows[0]?.[col] ?? '').includes('%');
    const displayVal = isPercent
      ? `${avg.toFixed(1)}%`
      : total > 1_000_000
      ? `$${(total/1_000_000).toFixed(2)}M`
      : total > 1_000
      ? `$${(total/1_000).toFixed(1)}K`
      : total.toFixed(0);

    const pct = Math.min(100, Math.round((total / (max * count || 1)) * 100));

    return {
      label: col,
      value: displayVal,
      delta: `${count} registros`,
      dir: 'up' as const,
      color: COLORS[i],
      icon: ICONS[i],
      pct: pct || 50,
      bar: BARS[i],
      isPercent,
      valueCount: count,
    };
  });
}

type KpiData = ReturnType<typeof calcKPIs>[number];

function KpiFlippableCard({
  k,
  rowsLength,
  flipped,
  onFlip,
}: {
  k: KpiData;
  rowsLength: number;
  flipped: boolean;
  onFlip: (v: boolean) => void;
}) {
  const mh = 200;
  return (
    <div
      className="widget-flip-scene kpi-metric-flip w-full"
      style={{ position: 'relative' as const, minHeight: mh }}
    >
      <div
        className={`widget-flip-inner h-full ${flipped ? 'is-flipped' : ''}`}
        style={{ minHeight: mh }}
      >
        <div className="widget-face widget-face-front h-full">
          <div className="kpi-card relative h-full min-h-[200px] group" style={{ paddingBottom: 20 }}>
            <div className="kpi-icon">{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.color}`}>{k.value}</div>
            <div className={`kpi-delta ${k.dir}`}>▲ {k.delta}</div>
            <div className="kpi-bar-wrap">
              <div className="kpi-bar" style={{ width: `${k.pct}%`, background: k.bar }} />
            </div>
            <button
              type="button"
              className="widget-info-btn"
              title="Cómo se calcula"
              onClick={e => {
                e.stopPropagation();
                onFlip(true);
              }}
            >
              <Info size={16} />
            </button>
          </div>
        </div>
        <div className="widget-face widget-face-back h-full">
          <div className="kpi-card relative flex h-full min-h-[200px] flex-col">
            <div className="chart-hd" style={{ marginBottom: 8 }}>
              <div>
                <div className="chart-title">{k.label}</div>
                <div className="chart-sub" style={{ marginTop: 3 }}>Cómo se calcula</div>
              </div>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto"
              style={{ position: 'relative' as const, paddingBottom: 20 }}
            >
              <div className="calc-explain p-2 pb-10">
                <p className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>Cómo se calcula</p>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                  {k.isPercent ? (
                    <>
                      Se muestra el <strong style={{ color: 'var(--text)' }}>promedio</strong> de los valores
                      numéricos de la columna «{k.label}» cuando los datos se interpretan como porcentaje.
                    </>
                  ) : (
                    <>
                      Se <strong style={{ color: 'var(--text)' }}>suman</strong> todos los valores numéricos
                      de «{k.label}» en el dataset activo.
                    </>
                  )}{' '}
                  <strong style={{ color: 'var(--text)' }}>{k.valueCount}</strong> celdas con valor válido en
                  esa columna; el total de filas en el archivo es {rowsLength}.
                </p>
                <p className="text-[14px] leading-relaxed mt-2" style={{ color: 'var(--text2)' }}>
                  La barra inferior es un indicador visual (anchura relativa al total y al máximo), no una segunda
                  métrica.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="widget-info-btn"
              title="Volver al indicador"
              onClick={e => {
                e.stopPropagation();
                onFlip(false);
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {};
const badgeClass = (val: string) => {
  const v = String(val).toLowerCase();
  if (['completado','activo','aprobado','done','active'].some(k => v.includes(k))) return 'badge-g';
  if (['proceso','pendiente','proceso','review'].some(k => v.includes(k))) return 'badge-b';
  if (['cancelado','rechazado','error','failed'].some(k => v.includes(k))) return 'badge-o';
  return 'badge-p';
};

// ── Tabla dinámica ───────────────────────────────────────────────────────────
function DynamicTable({ rows, headers, numeric, categorical }: {
  rows: Record<string, any>[];
  headers: string[];
  numeric: string[];
  categorical: string[];
}) {
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const displayCols = headers;
  const lastCatCol  = categorical[categorical.length - 1];

  // Calcular registros a mostrar
  const itemsPerPage = pageSize === 'all' ? rows.length : pageSize;
  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const displayedRows = rows.slice(startIdx, endIdx);

  // Reset a página 1 cuando cambia pageSize
  const handlePageSizeChange = (newSize: number | 'all') => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="table-card">
      <div className="chart-hd">
        <div>
          <div className="chart-title">Detalle de datos — {displayedRows.length} de {rows.length} registros</div>
          <div className="chart-sub">{rows.length} registros totales · {headers.length} columnas</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-dm-mono)' }}>
            Mostrar por página:
          </label>
          <select
            value={pageSize === 'all' ? 'all' : pageSize}
            onChange={(e) => handlePageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              border: '1px solid var(--border2)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            <option value={10}>10 registros</option>
            <option value={20}>20 registros</option>
            <option value={50}>50 registros</option>
            <option value={100}>100 registros</option>
            <option value="all">Todos los registros</option>
          </select>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            {displayCols.map(h => <th key={h}>{h}</th>)}
            {lastCatCol && !displayCols.includes(lastCatCol) && <th>Estado</th>}
          </tr>
        </thead>
        <tbody>
          {displayedRows.map((row, ri) => (
            <tr key={ri}>
              {displayCols.map((col, ci) => {
                const val = row[col] ?? '—';
                const isNum = numeric.includes(col);
                const isLast = ci === displayCols.length - 1;
                const isStatus = categorical.includes(col) && isLast && String(val).length < 20;

                if (isStatus) {
                  return (
                    <td key={col}>
                      <span className={`td-badge ${badgeClass(String(val))}`}>{String(val)}</span>
                    </td>
                  );
                }
                if (isNum) {
                  const n = toNum(val);
                  const formatted = n > 100_000
                    ? `$${(n/1000).toFixed(1)}K`
                    : n > 0 && String(row[col]).includes('.')
                    ? n.toFixed(2)
                    : String(row[col]);
                  return <td key={col} className="td-num">{formatted}</td>;
                }
                return <td key={col} style={ci === 0 ? {fontWeight:600} : {}}>{String(val).slice(0,50)}</td>;
              })}
              {lastCatCol && !displayCols.includes(lastCatCol) && (
                <td>
                  <span className={`td-badge ${badgeClass(String(row[lastCatCol] ?? ''))}`}>
                    {String(row[lastCatCol] ?? '—').slice(0,20)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Controles de paginación */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderTop: '1px solid var(--border2)',
          fontSize: '12px',
          color: 'var(--text2)',
          fontFamily: 'var(--font-dm-mono)',
        }}>
          <div>
            Página {currentPage} de {totalPages}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                border: '1px solid var(--border2)',
                background: currentPage === 1 ? 'var(--surface3)' : 'transparent',
                color: currentPage === 1 ? 'var(--text3)' : 'var(--text)',
                borderRadius: '4px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else {
                const start = Math.max(1, currentPage - 2);
                pageNum = start + i;
                if (pageNum > totalPages) return null;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: currentPage === pageNum ? 'bold' : '500',
                    border: currentPage === pageNum ? '2px solid var(--accent)' : '1px solid var(--border2)',
                    background: currentPage === pageNum ? 'var(--surface2)' : 'transparent',
                    color: 'var(--text)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                border: '1px solid var(--border2)',
                background: currentPage === totalPages ? 'var(--surface3)' : 'transparent',
                color: currentPage === totalPages ? 'var(--text3)' : 'var(--text)',
                borderRadius: '4px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vista sin datos ──────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="ai-bar" style={{flexDirection:'column', alignItems:'center', textAlign:'center', padding:'32px 24px', gap:16}}>
      <div style={{fontSize:36}}>📂</div>
      <div>
        <div className="chart-title" style={{fontSize:16, marginBottom:6}}>Sin datos cargados aún</div>
        <div className="ai-text">
          Sube un archivo <strong>CSV o Excel</strong> usando el botón <strong>Cargar datos</strong> en el menú superior.
          La IA analizará tu información y generará el dashboard automáticamente.
        </div>
      </div>
    </div>
  );
}

// ── Visualizar vacío: sin dashboard guardado (no se usa el dataset de sesión aquí) ──
function NoSavedDashboardState({ sessionHasDatasets }: { sessionHasDatasets: boolean }) {
  return (
    <div
      className="ai-bar"
      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '20px 22px' }}
    >
      <div className="ai-chip" aria-hidden>—</div>
      <div>
        <div className="chart-title" style={{ fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>
          Ningún dashboard guardado
        </div>
        <div className="ai-text" style={{ maxWidth: 640, lineHeight: 1.55 }}>
          <strong>Visualizar</strong> no muestra análisis hasta que exista al menos un dashboard creado en el editor.{' '}
          {sessionHasDatasets
            ? 'Aún hay datos de sesión; para ver KPIs y gráficos otra vez, abre el canvas, arma el layout y guarda el dashboard.'
            : 'Sube un archivo, edita en el canvas y pulsa «Guardar dashboard».'}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal (inner, necesita Suspense) ──────────────────────────
function DashboardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [kpiFlipped, setKpiFlipped] = useState<Record<string, boolean>>({});
  const [hasSavedDashboard, setHasSavedDashboard] = useState(false);
  const [dashboardsListLoaded, setDashboardsListLoaded] = useState(false);
  const [savedVisualWidgets, setSavedVisualWidgets] = useState<SavedWidgetVM[]>([]);

  // Cargar datasets de la DB (también al abrir el modal «Cargar datos» o tras guardar un archivo)
  useEffect(() => {
    const loadDatasets = () => {
      fetch('/api/datasets')
        .then((r) => r.json())
        .then((data) => {
          const ds: Dataset[] = Array.isArray(data.datasets) ? data.datasets : [];
          setDatasets(ds);
          setActiveDatasetId((prev) => {
            if (prev && ds.some((d) => d.id === prev)) return prev;
            return ds[0]?.id ?? null;
          });
        })
        .catch(() => {});
    };
    loadDatasets();
    window.addEventListener('dashlify:datasets-changed', loadDatasets);
    return () => window.removeEventListener('dashlify:datasets-changed', loadDatasets);
  }, []);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboards')
        .then((r) => r.json())
        .then((data) => {
          setHasSavedDashboard(Array.isArray(data?.dashboards) && data.dashboards.length > 0);
        })
        .catch(() => {
          setHasSavedDashboard(false);
        })
        .finally(() => {
          setDashboardsListLoaded(true);
        });
    };
    load();
    window.addEventListener('dashlify:dashboards-changed', load);
    return () => window.removeEventListener('dashlify:dashboards-changed', load);
  }, []);

  // Último dashboard guardado → mismas vistas que en el canvas (rehidratadas con `datasets` del panel)
  useEffect(() => {
    if (!hasSavedDashboard) {
      setSavedVisualWidgets([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const listRes = await fetch('/api/dashboards');
        const list = await listRes.json();
        const dashId = list.dashboards?.[0]?.id;
        if (!dashId) {
          if (!cancelled) setSavedVisualWidgets([]);
          return;
        }
        const dRes = await fetch(`/api/dashboards/${dashId}`);
        const dJson = await dRes.json();
        if (cancelled || !dJson.dashboard?.widgets) return;
        setSavedVisualWidgets(hydrateDashboardWidgets(dJson.dashboard.widgets, datasets));
      } catch {
        if (!cancelled) setSavedVisualWidgets([]);
      }
    };
    void run();
    const onChange = () => void run();
    window.addEventListener('dashlify:dashboards-changed', onChange);
    window.addEventListener('dashlify:datasets-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('dashlify:dashboards-changed', onChange);
      window.removeEventListener('dashlify:datasets-changed', onChange);
    };
  }, [hasSavedDashboard, datasets]);

  // Redirigir al último dashboard si existe y no estamos en modo upload explícito ni en una vista específica
  useEffect(() => {
    if (params.get('action') === 'upload') {
      setLoading(false);
      const timer = setTimeout(() => {
        document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
      return () => clearTimeout(timer);
    } else if (params.has('view')) {
      // Si explícitamente pidió una vista (ej. Ejecutivo, Tendencias), nos quedamos en page.tsx para mostrarla
      setLoading(false);
    } else {
      // Vista principal genérica -> Redirigir al canvas si existe
      fetch('/api/dashboards')
        .then(r => r.json())
        .then(data => {
          if (data.dashboards?.length > 0) {
            // Ir al último modificado
            window.location.href = `/dashboard/canvas/${data.dashboards[0].id}`;
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    }
  }, [params]);

  // Dataset activo
  const viewParam = normalizeViewParam(params.get('view'));
  const activeDataset = datasets.find(d => d.id === activeDatasetId) ?? datasets[0];
  const rows    = (activeDataset?.rawSchema?.sampleData ?? []) as Record<string, any>[];
  const headers = activeDataset?.rawSchema?.headers ?? [];
  const types   = detectColumnTypes(headers, rows);
  const kpis    = rows.length > 0 && types.numeric.length > 0
    ? calcKPIs(rows, types.numeric, activeDataset?.name ?? '')
    : [];

  const hasData = rows.length > 0 && headers.length > 0;
  /** Con datos cargados, la subida solo se muestra con ?action=upload (clic en «Cargar datos» en el header). */
  const showUploadZone = !hasData || params.get('action') === 'upload';
  const [aiLayer, setAiLayer] = useState<AISchemaInterpretation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const headerSig = useMemo(() => buildHeadersSignature(headers), [headers]);

  const baseSemantic = useMemo(
    () => (hasData ? buildSemanticContext(headers, rows, types.dates) : null),
    [hasData, headers, rows, types.dates]
  );

  const semantic = useMemo(() => {
    if (!baseSemantic) return null;
    if (!aiLayer?.columnRoles || Object.keys(aiLayer.columnRoles).length === 0) return baseSemantic;
    return applyAIRoles(baseSemantic, aiLayer.columnRoles, headers);
  }, [baseSemantic, aiLayer, headers]);

  const availableViews = useMemo((): SemanticViewKey[] => {
    if (!semantic) return ['business'];
    return getViewsForDataset(semantic);
  }, [semantic]);

  useEffect(() => {
    if (!hasSavedDashboard || !hasData || !semantic) return;
    if (!availableViews.includes(viewParam)) {
      router.replace('/dashboard?view=business');
    }
  }, [hasSavedDashboard, hasData, semantic, availableViews, viewParam, router]);

  useEffect(() => {
    if (!hasSavedDashboard || !hasData || !activeDatasetId) {
      setAiLayer(null);
      setAiLoading(false);
      return;
    }
    const ds = datasets.find((d) => d.id === activeDatasetId);
    if (!ds) return;

    const ac = new AbortController();
    const sig = headerSig;
    if (!sig) {
      setAiLayer(null);
      setAiLoading(false);
      return;
    }

    const cached = ds.rawSchema?.interpretation;
    if (
      cached &&
      cached.headersSignature === sig &&
      (Boolean(cached.narrative) || (cached.columnRoles && Object.keys(cached.columnRoles).length > 0))
    ) {
      const { headersSignature: _hs, savedAt: _sa, ...rest } = cached;
      setAiLayer(rest);
      setAiLoading(false);
      return;
    }

    const uploadAn = ds.rawSchema?.analysis as
      | {
          narrative?: string;
          analysis?: { domain?: string; main_kpis?: string[] };
        }
      | undefined;
    if (uploadAn) {
      setAiLayer({
        domain: String(uploadAn.analysis?.domain ?? '—'),
        narrative: String(uploadAn.narrative ?? ''),
        priorityInsights: Array.isArray(uploadAn.analysis?.main_kpis) ? uploadAn.analysis.main_kpis : [],
        columnRoles: {},
      });
    } else {
      setAiLayer(null);
    }

    (async () => {
      setAiLoading(true);
      try {
        const columnStats = computeColumnStats(rows, headers);
        const res = await fetch('/api/interpret-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: ds.name ?? 'dataset',
            headers,
            sampleData: rows.slice(0, 20),
            columnStats,
          }),
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;

        if (res.status === 503) {
          return;
        }
        if (!res.ok) {
          if (!uploadAn) setAiLayer(null);
          return;
        }
        const data = (await res.json()) as AISchemaInterpretation;
        setAiLayer(data);

        const toSave: CachedSchemaInterpretation = {
          ...data,
          headersSignature: sig,
          savedAt: new Date().toISOString(),
        };
        const patch = await fetch(`/api/datasets/${activeDatasetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interpretation: toSave }),
        });
        if (patch.ok) {
          const p = (await patch.json().catch(() => ({}))) as { dataset?: Dataset };
          if (p?.dataset) {
            setDatasets((prev) => prev.map((d) => (d.id === p.dataset!.id ? (p.dataset as Dataset) : d)));
          } else {
            setDatasets((prev) =>
              prev.map((d) =>
                d.id === activeDatasetId
                  ? { ...d, rawSchema: { ...d.rawSchema, interpretation: toSave } as RawSchema }
                  : d
              )
            );
          }
        }
      } catch {
        if (!ac.signal.aborted && !uploadAn) setAiLayer(null);
      } finally {
        if (!ac.signal.aborted) setAiLoading(false);
      }
    })();

    return () => ac.abort();
  }, [
    hasSavedDashboard,
    hasData,
    activeDatasetId,
    activeDataset?.updatedAt,
    headerSig,
    datasets,
    rows,
    headers,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{color:'var(--text3)'}}>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent mr-3" />
        Cargando datos…
      </div>
    );
  }

  if (!dashboardsListLoaded) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text3)' }}>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent mr-3" />
        Cargando panel…
      </div>
    );
  }

  if (!hasSavedDashboard) {
    return (
      <>
        <NoSavedDashboardState sessionHasDatasets={datasets.length > 0} />
        <div className="sec-hd">
          <div className="sec-hd-l">
            <h2>Visualizar</h2>
            <p>REQUIERE UN DASHBOARD GUARDADO · SUBE Y GUARDA DESDE EL CANVAS</p>
          </div>
        </div>
        <div id="upload-zone" style={{ marginTop: 8 }}>
          <UploadZone />
        </div>
      </>
    );
  }

  return (
    <>
      {/* AI BAR — dinámica */}
      <div className="ai-bar">
        <span className="ai-chip">IA</span>
        <span className="ai-text">
          {hasData ? (
            <>
              <strong>Dataset activo: {activeDataset?.name}</strong>
              {' · '}{rows.length} registros · {headers.length} columnas
              {aiLoading && <> · <span style={{ color: 'var(--accent3)' }}>IA interpretando columnas…</span></>}
              {types.numeric.length > 0 && <> · Columnas numéricas: <strong>{types.numeric.join(', ')}</strong></>}
              {types.dates.length > 0 && <> · Fechas detectadas: <strong>{types.dates.join(', ')}</strong></>}
            </>
          ) : (
            <><strong>Listo para analizar.</strong> Sube un archivo CSV o Excel y la IA generará tu dashboard en segundos.</>
          )}
        </span>
        {/* Selector de dataset si hay varios */}
        {datasets.length > 1 && (
          <select
            value={activeDatasetId ?? ''}
            onChange={e => setActiveDatasetId(e.target.value)}
            className="btn-sm"
            style={{cursor:'pointer', minWidth:160}}
          >
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {hasSavedDashboard && hasData && (
        <DashboardViewTypeBlock
          className="main-view-modes"
          activeView={viewParam}
          showActive={pathname === '/dashboard'}
          onSelectView={(k) => router.push(`/dashboard?view=${k}`)}
          enabledViewKeys={semantic ? availableViews : null}
          hint={
            semantic && availableViews.length < VIEW_KEYS.length
              ? 'Las vistas mostradas dependen de las columnas del archivo activo. Visión general siempre incluye el resumen completo.'
              : undefined
          }
        />
      )}

      {hasData && aiLayer?.narrative && (
        <div
          className="chart-card"
          style={{
            marginTop: 4,
            marginBottom: 8,
            padding: '16px 20px',
            borderLeft: '3px solid var(--accent)',
            background: 'var(--surface2)',
          }}
        >
          {aiLayer.domain && (
            <div className="sb-label" style={{ marginBottom: 8 }}>
              // {aiLayer.domain} · mapeo con IA
            </div>
          )}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}>{aiLayer.narrative}</p>
        </div>
      )}

      {/* SECTION HEADER */}
      <div className="sec-hd">
        <div className="sec-hd-l">
          <h2>{hasData ? `Dashboard — ${activeDataset?.name}` : 'Panel — flujo con IA'}</h2>
          <p>
            {hasData
              ? `${rows.length} REGISTROS · ${headers.length} COLUMNAS · ${new Date(activeDataset?.updatedAt ?? '').toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}`
              : 'GENERADO EN TIEMPO REAL · SIN PROMPTS MANUALES'}
          </p>
        </div>
        <div className="sec-hd-r">
          <button type="button" className="btn-sm">📅 Rango</button>
          <button type="button" className="btn-sm">⚙ Filtros</button>
        </div>
      </div>

      {/* Vistas guardadas del canvas — Visión general: todas, agrupadas por categoría IA */}
      {hasData && viewParam === 'business' && savedVisualWidgets.length > 0 && (
        <div className="sb-block" style={{ marginBottom: 18 }}>
          <div className="sb-label">// Dashboard guardado</div>
          <p className="ai-text" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            {savedVisualWidgets.length} vista{savedVisualWidgets.length !== 1 ? 's' : ''} del último
            dashboard guardado, organizadas como en el constructor.
          </p>
        </div>
      )}
      {hasData && viewParam === 'business' && savedVisualWidgets.length > 0 && (
        <SavedDashboardWidgetsGrid widgets={savedVisualWidgets} />
      )}

      {/* KPI GRID — resumen en vista "Visión general" */}
      {hasData && viewParam === 'business' && kpis.length > 0 && (
        <div className="kpi-grid">
          {kpis.map(k => (
            <KpiFlippableCard
              key={k.label}
              k={k}
              rowsLength={rows.length}
              flipped={!!kpiFlipped[k.label]}
              onFlip={v => setKpiFlipped(prev => ({ ...prev, [k.label]: v }))}
            />
          ))}
        </div>
      )}

      {/* Exploración automática por columnas: solo si no hay vistas guardadas en Visión general, o en otras pestañas */}
      {hasData && semantic && (viewParam !== 'business' || savedVisualWidgets.length === 0) && (
        <SemanticViewCharts
          view={viewParam}
          rows={rows}
          sem={semantic}
          headers={headers}
          priorityInsightsFromAI={aiLayer?.priorityInsights}
        />
      )}

      {/* TABLE — dinámica */}
      {hasData && (
        <DynamicTable
          rows={rows}
          headers={headers}
          numeric={types.numeric}
          categorical={types.categorical}
        />
      )}

      {/* Estado vacío */}
      {!hasData && !loading && <EmptyState />}

      {showUploadZone && (
        <div id="upload-zone" style={{ marginTop: hasData ? 24 : 0 }}>
          <UploadZone />
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64" style={{color:'var(--text3)'}}>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent mr-3" />
        Cargando…
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

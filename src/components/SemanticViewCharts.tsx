'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer as RechartsRC,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
} from 'recharts';
import { Info, RotateCcw } from 'lucide-react';
import type { SemanticContext, SemanticViewKey } from '@/lib/semanticContext';
import { computeSemanticInsights, type Insight } from '@/lib/semanticInsights';

function toNum(val: any): number {
  return parseFloat(String(val).replace(/[$,\s%]/g, '')) || 0;
}

/** Fecha ISO, Excel serial, o dd/mm/aaaa; evita meses vacíos si solo `new Date(val)` falla. */
function parseDateish(val: any): Date | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && val > 20000 && val < 120000) {
    const epoch = new Date(1899, 11, 30).getTime();
    const d = new Date(epoch + val * 86400000);
    if (!isNaN(d.getTime())) return d;
  }
  const try1 = new Date(val);
  if (!isNaN(try1.getTime())) return try1;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const a = parseInt(m[1]!, 10);
    const b = parseInt(m[2]!, 10);
    let y = parseInt(m[3]!, 10);
    if (y < 100) y += 2000;
    let dMes: Date;
    if (a > 12) dMes = new Date(y, b - 1, a);
    else if (b > 12) dMes = new Date(y, a - 1, b);
    else dMes = new Date(y, b - 1, a);
    if (!isNaN(dMes.getTime())) return dMes;
  }
  return null;
}

/** Columnas útiles para gráficos cuando no hay categoría/marca en el contexto semántico (ej. solo ids + importes). */
function pickFallbackChartColumns(
  headers: string[],
  rows: Record<string, any>[]
): { bar: string | null; pie: string | null } {
  if (!headers.length || !rows.length) return { bar: null, pie: null };

  const normKey = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

  type Info = { h: string; uniq: number; nonEmpty: number; penal: number };
  const infos: Info[] = [];
  for (const h of headers) {
    const vals = rows.map((r) => String(r[h] ?? '').trim()).filter((v) => v !== '');
    if (vals.length < Math.max(3, Math.floor(rows.length * 0.15))) continue;
    const uniq = new Set(vals).size;
    if (uniq < 2) continue;
    const nk = normKey(h);
    let penal = 0;
    if (nk === 'id' || /^id_?(venta|trans|txn|order|factura|ticket)/.test(nk)) penal += 250;
    else if (nk.startsWith('id_') && uniq > Math.min(200, Math.max(50, Math.floor(rows.length * 0.9)))) penal += 120;
    infos.push({ h, uniq, nonEmpty: vals.length, penal });
  }
  if (!infos.length) return { bar: null, pie: null };

  const barPick = [...infos]
    .map((i) => {
      let score = 100 - i.penal;
      if (i.uniq >= 2 && i.uniq <= 35) score += 70;
      else if (i.uniq <= 80) score += 45;
      else if (i.uniq <= 200) score += 20;
      else score += 5;
      return { ...i, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  const bar = barPick?.h ?? null;

  const pieCandidates = infos
    .filter((i) => i.uniq >= 2 && i.uniq <= 14)
    .sort((a, b) => a.uniq - b.uniq || b.nonEmpty - a.nonEmpty);
  let pie = pieCandidates.find((p) => p.h !== bar)?.h ?? pieCandidates[0]?.h ?? null;
  if (pie === bar && infos.length > 1) {
    pie = infos.find((i) => i.h !== bar)?.h ?? pie;
  }
  return { bar, pie };
}

function findTotalLikeColumn(headers: string[]): string | null {
  for (const h of headers) {
    const n = h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (
      n.includes('total') ||
      n.includes('importe') ||
      n.includes('monto') ||
      n.includes('subtotal') ||
      n === 'venta' ||
      (n.includes('venta') && n.includes('total'))
    ) {
      return h;
    }
  }
  return null;
}

function groupCount(rows: Record<string, any>[], col: string, top = 12) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[col] ?? '—').trim().slice(0, 40) || '—';
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, value]) => ({ name, value }));
}

function groupSum(rows: Record<string, any>[], groupCol: string, valueCol: string, top = 12) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[groupCol] ?? '—').trim().slice(0, 40) || '—';
    m[k] = (m[k] ?? 0) + toNum(r[valueCol]);
  }
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

const axisProps = {
  axisLine: false,
  tickLine: false,
  fontSize: 9,
  tick: { fill: '#94a3b8', fontFamily: '"DM Mono",monospace' },
};
const gridProps = { strokeDasharray: '3 3' as const, stroke: '#e2e8f0' };
const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  fontFamily: '"DM Mono",monospace',
  fontSize: 11,
};
const PALETTE = ['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];

/** Recharts ResponsiveContainer: height "100%" falla si el padre no tiene altura (flex); usar px. */
const CHART_H = 280;

/** Franja bajo el gráfico: el (i) va aquí, sin superponerse a ejes/leyendas. */
const PANEL_CHART_FOOTER_H = 40;

/** Misma idea que SortableWidget (canvas): escena 3D con altura suficiente para gráfico + cabecera + franja acciones. */
const PANEL_FLIP_MIN = 360 + PANEL_CHART_FOOTER_H;

function ChartBox({ children }: { children: ReactNode }) {
  return (
    <div className="semantic-chart-box" style={{ width: '100%', height: CHART_H, minHeight: CHART_H, position: 'relative' }}>
      <RechartsRC width="100%" height={CHART_H} debounce={32}>
        {children}
      </RechartsRC>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center px-4 text-center text-sm"
      style={{ height: CHART_H, minHeight: CHART_H, color: 'var(--text2, #64748b)' }}
    >
      {message}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  back,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: ReactNode;
}) {
  const [flip, setFlip] = useState(false);

  if (!back) {
    return (
      <div className="chart-card group" style={{ minHeight: 120 }}>
        <div className="chart-hd">
          <div>
            <div className="chart-title">{title}</div>
            {subtitle && <div className="chart-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
          </div>
        </div>
        <div
          className="chart-wrap"
          style={{ height: CHART_H, minHeight: CHART_H, width: '100%', position: 'relative' }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="widget-flip-scene w-full"
      style={{ position: 'relative' as const, minHeight: PANEL_FLIP_MIN }}
    >
      <div
        className={`widget-flip-inner h-full ${flip ? 'is-flipped' : ''}`}
        style={{ minHeight: PANEL_FLIP_MIN }}
      >
        <div className="widget-face widget-face-front h-full">
          <div
            className="chart-card group flex h-full flex-col"
            style={{ minHeight: PANEL_FLIP_MIN }}
          >
            <div className="chart-hd">
              <div>
                <div className="chart-title">{title}</div>
                {subtitle && <div className="chart-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
              </div>
            </div>
            <div
              className="chart-wrap semantic-panel-chart-stack min-h-0 flex-1 flex flex-col"
              style={{ width: '100%' }}
            >
              <div
                className="semantic-panel-chart-plot min-h-0 w-full shrink-0"
                style={{ height: CHART_H, minHeight: CHART_H }}
              >
                {children}
              </div>
              <div
                className="semantic-panel-chart-footer flex w-full shrink-0 items-center justify-end"
                style={{
                  minHeight: PANEL_CHART_FOOTER_H,
                  padding: '2px 2px 0 8px',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  className="widget-info-btn semantic-panel-info-btn"
                  title="Cómo se calcula"
                  aria-pressed={flip}
                  aria-label="Ver cómo se calcula"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlip(true);
                  }}
                >
                  <Info size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="widget-face widget-face-back h-full">
          <div
            className="chart-card widget-flip-back relative flex h-full min-w-0 flex-col"
            style={{ minHeight: PANEL_FLIP_MIN }}
          >
            <div className="chart-hd">
              <div>
                <div className="chart-title">{title}</div>
                <div className="chart-sub" style={{ marginTop: 3 }}>
                  Cómo se calcula
                </div>
              </div>
            </div>
            <div
              className="widget-explain-body flex-1 overflow-y-auto pr-1 text-[13px] leading-relaxed"
              style={{ color: 'var(--text2)' }}
            >
              {back}
            </div>
            <button
              type="button"
              className="widget-info-btn"
              title="Volver al gráfico"
              aria-label="Volver al gráfico"
              onClick={(e) => {
                e.stopPropagation();
                setFlip(false);
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

function InsightBanner({ items }: { items: Insight[] }) {
  if (items.length === 0) return null;
  const bg: Record<Insight['level'], string> = {
    critical: 'rgba(220, 38, 38, 0.1)',
    warn: 'rgba(245, 158, 11, 0.12)',
    info: 'rgba(14, 165, 233, 0.1)',
    ok: 'rgba(16, 185, 129, 0.1)',
  };
  return (
    <div
      className="chart-card"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface2)',
        marginBottom: 16,
        padding: '14px 18px',
      }}
    >
      <div className="sb-label" style={{ marginBottom: 8 }}>
        // Prioridades (IA + reglas)
      </div>
      <ul className="m-0 list-none space-y-2 p-0" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-2 rounded-md px-3 py-2"
            style={{ background: bg[it.level] }}
          >
            <span aria-hidden>
              {it.level === 'critical' ? '🔥' : it.level === 'warn' ? '⚠' : it.level === 'ok' ? '✓' : '💡'}
            </span>
            <span style={{ color: 'var(--text)' }}>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MissingHint({ need }: { need: string[] }) {
  if (need.length === 0) return null;
  return (
    <p className="ai-text" style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
      Para afinar esta vista, conviene unir columnas: <strong>{need.join(' · ')}</strong>
    </p>
  );
}

type Props = {
  view: SemanticViewKey;
  rows: Record<string, any>[];
  sem: SemanticContext;
  headers: string[];
  /** Frases de prioridad generadas por el modelo (además de reglas heurísticas) */
  priorityInsightsFromAI?: string[] | null;
};

export function SemanticViewCharts({ view, rows, sem, headers: _h, priorityInsightsFromAI }: Props) {
  const insights = useMemo(() => {
    const fromAI: Insight[] = (priorityInsightsFromAI ?? [])
      .filter((t) => t && String(t).trim())
      .map((t) => ({ level: 'info' as const, text: String(t).trim() }));
    const heur = computeSemanticInsights(rows, sem);
    const seen = new Set<string>();
    const out: Insight[] = [];
    for (const it of fromAI) {
      if (!seen.has(it.text)) {
        out.push(it);
        seen.add(it.text);
      }
    }
    for (const it of heur) {
      if (!seen.has(it.text)) {
        out.push(it);
        seen.add(it.text);
      }
    }
    return out.slice(0, 8);
  }, [rows, sem, priorityInsightsFromAI]);

  const businessPieCol = useMemo(
    () => sem.subfamily ?? sem.family ?? sem.category,
    [sem]
  );
  const barCountCol = useMemo(() => sem.category ?? sem.brand, [sem]);

  const fallbackDims = useMemo(
    () => pickFallbackChartColumns(_h, rows),
    [_h, rows]
  );
  const effectiveBarCol = barCountCol ?? fallbackDims.bar;
  const effectivePieCol =
    businessPieCol ?? (fallbackDims.pie && fallbackDims.pie !== effectiveBarCol ? fallbackDims.pie : null);

  const totalLikeCol = useMemo(() => findTotalLikeColumn(_h), [_h]);

  const revenueByMonth = useMemo(() => {
    const candidates = [sem.dateField, ...(sem.dateColumns ?? [])].filter(Boolean) as string[];
    if (!totalLikeCol || candidates.length === 0) return [];
    for (const dcol of candidates) {
      const m: Record<string, number> = {};
      for (const r of rows) {
        const d = parseDateish(r[dcol]);
        if (!d) continue;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        m[k] = (m[k] ?? 0) + toNum(r[totalLikeCol]);
      }
      const keys = Object.keys(m);
      if (keys.length > 0) {
        return keys
          .sort((a, b) => a.localeCompare(b))
          .map((k) => ({ name: k, value: Math.round(m[k]! * 100) / 100 }));
      }
    }
    return [];
  }, [rows, sem.dateField, sem.dateColumns, totalLikeCol]);

  const invTotal = useMemo(() => {
    if (!sem.cost || !sem.stock) return null;
    let t = 0;
    for (const r of rows) {
      t += toNum(r[sem.cost]) * toNum(r[sem.stock]);
    }
    return t;
  }, [rows, sem.cost, sem.stock]);

  const marginRows = useMemo(() => {
    if (!sem.price || !sem.cost) return [];
    const out: { name: string; margin: number; profit: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const p = toNum(r[sem.price!]);
      const c = toNum(r[sem.cost!]);
      if (p <= 0) continue;
      const margin = (p - c) / p;
      const name = sem.productName
        ? String(r[sem.productName] ?? `Fila ${i + 1}`)
        : `Fila ${i + 1}`;
      out.push({ name, margin: margin * 100, profit: (p - c) * (sem.stock ? toNum(r[sem.stock]) : 1) });
    }
    return out.sort((a, b) => b.profit - a.profit).slice(0, 15);
  }, [rows, sem]);

  const priceCostPts = useMemo(() => {
    if (!sem.price || !sem.cost) return [];
    return rows
      .map((r, i) => ({
        x: toNum(r[sem.price!]),
        y: toNum(r[sem.cost!]),
        name: sem.productName ? String(r[sem.productName] ?? i) : `${i + 1}`,
      }))
      .filter((p) => p.x > 0 && p.y >= 0)
      .slice(0, 500);
  }, [rows, sem]);

  const riskRows = useMemo(() => {
    if (!sem.stock) return 0;
    if (sem.minStock) {
      let n = 0;
      for (const r of rows) {
        if (toNum(r[sem.stock]) < toNum(r[sem.minStock]) && toNum(r[sem.minStock]) > 0) n++;
      }
      return n;
    }
    return 0;
  }, [rows, sem]);

  const byMonth = useMemo(() => {
    const candidates = [sem.dateField, ...(sem.dateColumns ?? [])].filter(Boolean) as string[];
    if (candidates.length === 0) return [];
    for (const dcol of candidates) {
      const m: Record<string, number> = {};
      for (const r of rows) {
        const d = parseDateish(r[dcol]);
        if (!d) continue;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        m[k] = (m[k] ?? 0) + 1;
      }
      const keys = Object.keys(m);
      if (keys.length > 0) {
        return keys
          .sort((a, b) => a.localeCompare(b))
          .map((k) => ({ name: k, value: m[k]! }));
      }
    }
    return [];
  }, [rows, sem]);

  const pairData = useMemo(() => {
    if (!sem.stock || !sem.minStock) return [];
    return rows
      .map((r) => ({
        name: sem.productName ? String(r[sem.productName] ?? '—').slice(0, 10) : '—',
        stock: toNum(r[sem.stock!]),
        min: toNum(r[sem.minStock!]),
      }))
      .slice(0, 12);
  }, [rows, sem.stock, sem.minStock, sem.productName]);

  const leadBySup = useMemo(() => {
    if (!sem.supplier || !sem.leadDays) return [];
    const map: Record<string, { s: number; n: number }> = {};
    for (const r of rows) {
      const s = String(r[sem.supplier!] ?? '').trim();
      if (!s) continue;
      const d = toNum(r[sem.leadDays!]);
      if (d <= 0) continue;
      if (!map[s]) map[s] = { s: 0, n: 0 };
      map[s]!.s += d;
      map[s]!.n += 1;
    }
    return Object.entries(map)
      .map(([name, { s, n }]) => ({ name, value: Math.round((s / n) * 10) / 10 }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 12);
  }, [rows, sem]);

  const qualityPts = useMemo(() => {
    if (!sem.rating) return [];
    const rc = sem.reviews;
    return rows
      .map((r, i) => ({
        x: rc ? toNum(r[rc]) : i,
        y: toNum(r[sem.rating!]),
        z: sem.stock ? toNum(r[sem.stock!]) : 0,
        name: sem.productName ? String(r[sem.productName!] ?? i) : `P${i + 1}`,
      }))
      .filter((p) => p.y > 0)
      .slice(0, 400);
  }, [rows, sem]);

  const grid = (c: ReactNode) => <div className="charts-grid">{c}</div>;

  if (view === 'business') {
    const need: string[] = [];
    if (!barCountCol && !sem.brand && !fallbackDims.bar) need.push('Categoría o Marca');
    if (!businessPieCol && !sem.subfamily && !sem.family && !sem.category && !effectivePieCol)
      need.push('Familia / subfamilia');
    if (invTotal === null) need.push('Costo y Stock para valor de inventario');
    return (
      <>
        <InsightBanner items={insights} />
        <MissingHint need={need} />
        {grid(
          <>
            {effectiveBarCol && (
              <Panel
                title={barCountCol ? 'Productos por categoría (o eje comercial)' : 'Distribución por dimensión detectada'}
                subtitle={`Conteo por «${effectiveBarCol}»${!barCountCol ? ' (inferida del archivo)' : ''}`}
                back={
                  <p>
                    Cada barra es la cantidad de filas cuyo campo «{effectiveBarCol}» coincide. Útil para ver peso
                    de surtido o actividad por esa dimensión.
                  </p>
                }
              >
                <ChartBox>
                  <BarChart data={groupCount(rows, effectiveBarCol)} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 12)} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Conteo" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartBox>
              </Panel>
            )}
            {effectivePieCol && (
              <Panel
                title={businessPieCol ? 'Distribución por familia / subfamilia' : 'Distribución proporcional'}
                subtitle={`Segmento «${effectivePieCol}»${!businessPieCol ? ' (inferida)' : ''}`}
                back={
                  <p>Participación de cada valor en el total de filas. Ideal para ver concentración de surtido.</p>
                }
              >
                <ChartBox>
                  <PieChart>
                    <Pie
                      data={groupCount(rows, effectivePieCol, 8).map((d) => ({ name: d.name, value: d.value }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {groupCount(rows, effectivePieCol, 8).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ChartBox>
              </Panel>
            )}
            {revenueByMonth.length > 1 && totalLikeCol && (
              <Panel
                title="Evolución mensual"
                subtitle={`Suma de «${totalLikeCol}» por mes`}
                back={
                  <p>
                    Se agrupan las filas por mes según la columna de fecha detectada y se suman los valores de «
                    {totalLikeCol}».
                  </p>
                }
              >
                <ChartBox>
                  <LineChart data={revenueByMonth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 7)} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="value" name="Total" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartBox>
              </Panel>
            )}
            {invTotal !== null && (
              <div className="chart-card flex flex-col justify-center" style={{ minHeight: 200, padding: 24 }}>
                <div className="sb-label" style={{ marginBottom: 6 }}>
                  Valor total de inventario
                </div>
                <div className="kpi-value blue" style={{ fontSize: 28 }}>
                  {invTotal > 1_000_000
                    ? `${(invTotal / 1_000_000).toFixed(2)} M`
                    : invTotal > 1_000
                    ? `${(invTotal / 1_000).toFixed(1)} K`
                    : invTotal.toFixed(0)}
                </div>
                <div className="chart-sub" style={{ marginTop: 6 }}>
                  Σ (costo × stock) con columnas detectadas
                </div>
              </div>
            )}
            {sem.brand && (
              <Panel
                title="Top marcas por volumen"
                subtitle="Productos por marca"
                back={<p>Conteo de filas por columna de marca. Identifica liderazgo de surtido.</p>}
              >
                <ChartBox>
                  <BarChart layout="vertical" data={groupCount(rows, sem.brand, 10)} margin={{ top: 8, right: 8, left: 60, bottom: 0 }}>
                    <CartesianGrid {...gridProps} horizontal={false} />
                    <XAxis type="number" {...axisProps} />
                    <YAxis dataKey="name" type="category" width={88} {...axisProps} tickFormatter={(v) => String(v).slice(0, 16)} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                      {groupCount(rows, sem.brand, 10).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartBox>
              </Panel>
            )}
          </>
        )}
      </>
    );
  }

  if (view === 'financial') {
    return (
      <>
        <InsightBanner items={insights} />
        {!sem.price || !sem.cost ? <MissingHint need={['Precio de venta', 'Costo unitario']} /> : null}
        {sem.price && sem.cost
          ? grid(
              <>
                <Panel
                  title="Precio vs costo"
                  subtitle="Cada punto es un producto / fila"
                  back={
                    <p>La recta y=x sería costo= precio. Puntos abajo de la diagonal suelen implicar buen margen; por encima, margen ajustado o datos raros.</p>
                  }
                >
                  {priceCostPts.length === 0 ? (
                    <ChartEmpty message="No hay filas con precio y costo numéricos. Revisa formato de moneda o columnas detectadas." />
                  ) : (
                    <ChartBox>
                      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid />
                        <XAxis dataKey="x" name="Precio" type="number" unit="" {...axisProps} />
                        <YAxis dataKey="y" name="Costo" type="number" {...axisProps} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                        <Scatter name="Items" data={priceCostPts} fill="#0ea5e9" />
                      </ScatterChart>
                    </ChartBox>
                  )}
                </Panel>
                <Panel
                  title="Margen % aprox. por fila (ordenado)"
                  subtitle="(Precio − costo) / precio"
                  back={<p>Margen bruto aproximado. Valida nombres de columnas y moneda en origen.</p>}
                >
                  {marginRows.length === 0 ? (
                    <ChartEmpty message="Ninguna fila con precio &gt; 0 para calcular margen." />
                  ) : (
                    <ChartBox>
                      <BarChart data={marginRows.map((m) => ({ name: m.name.slice(0, 14), m: m.margin }))} margin={{ top: 8, right: 8, left: -10, bottom: 40 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} interval={0} angle={-20} textAnchor="end" height={50} tick={{ fontSize: 8 }} />
                        <YAxis {...axisProps} unit="%" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="m" name="Margen %" fill="#8b5cf6" maxBarSize={32} />
                      </BarChart>
                    </ChartBox>
                  )}
                </Panel>
                <Panel
                  title="Top filas por rentabilidad aproximada"
                  subtitle="(Precio − costo) × factor stock si existe"
                  back={<p>Ordena por mayor contribución aproximada. Revisa unidades (stock) en tu archivo.</p>}
                >
                  {marginRows.length === 0 ? (
                    <ChartEmpty message="Sin filas con precio y costo válidos para rentabilidad." />
                  ) : (
                    <ChartBox>
                      <BarChart
                        data={marginRows.map((m) => ({ name: m.name.slice(0, 12), p: m.profit }))}
                        margin={{ top: 8, right: 8, left: -10, bottom: 40 }}
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} interval={0} angle={-20} textAnchor="end" height={50} tick={{ fontSize: 8 }} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="p" name="Contrib. relativa" fill="#f97316" maxBarSize={32} />
                      </BarChart>
                    </ChartBox>
                  )}
                </Panel>
                <Panel
                  title="Dispersión de márgenes"
                  subtitle="Histograma de % margen"
                  back={<p>Agrupación de filas en rangos de margen. Detecta colas y outliers.</p>}
                >
                  {marginRows.length === 0 ? (
                    <ChartEmpty message="Sin márgenes calculables (se necesita precio &gt; 0 y costo)." />
                  ) : (
                    <ChartBox>
                      <BarChart
                        data={(() => {
                          const labels = ['0-10', '10-20', '20-30', '30-40', '40-50', '50+'];
                          const c = new Array(6).fill(0);
                          for (const m of marginRows) {
                            const p = m.margin;
                            if (p < 10) c[0]!++;
                            else if (p < 20) c[1]!++;
                            else if (p < 30) c[2]!++;
                            else if (p < 40) c[3]!++;
                            else if (p < 50) c[4]!++;
                            else c[5]!++;
                          }
                          return labels.map((name, i) => ({ name, value: c[i] }));
                        })()}
                        margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="#14b8a6" />
                      </BarChart>
                    </ChartBox>
                  )}
                </Panel>
              </>
            )
          : null}
      </>
    );
  }

  if (view === 'inventory') {
    return (
      <>
        <InsightBanner items={insights} />
        <p className="ai-text" style={{ fontSize: 12, marginBottom: 10 }}>
          {sem.minStock && sem.stock
            ? `Riesgo operativo: ${riskRows} fila(s) bajo mínimo (según columnas detectadas).`
            : 'Añade columnas de stock mínimo / reorden para ver alertas automáticas.'}
        </p>
        {grid(
          <>
            {pairData.length > 0 && (
              <Panel
                title="Stock vs mínimo (muestra)"
                subtitle="Comparación por fila / SKU"
                back={<p>Barras agrupadas: existencia frente a umbral. Amplía mínimos en el archivo para mayor precisión.</p>}
              >
                <ChartBox>
                  <BarChart data={pairData} margin={{ top: 8, right: 8, left: -10, bottom: 40 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} tick={{ fontSize: 8 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="stock" name="Stock" fill="#0ea5e9" />
                    <Bar dataKey="min" name="Mínimo" fill="#f97316" />
                  </BarChart>
                </ChartBox>
              </Panel>
            )}
            {sem.warehouse && sem.stock && (
              <Panel
                title="Stock por ubicación / almacén"
                subtitle={`Suma de «${sem.stock}»`}
                back={<p>Distribución de inventario físico o lógico.</p>}
              >
                <ChartBox>
                  <BarChart layout="vertical" data={groupSum(rows, sem.warehouse, sem.stock)} margin={{ top: 8, right: 8, left: 70, bottom: 0 }}>
                    <CartesianGrid {...gridProps} horizontal={false} />
                    <XAxis type="number" {...axisProps} />
                    <YAxis dataKey="name" type="category" width={64} {...axisProps} tickFormatter={(v) => String(v).slice(0, 12)} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ChartBox>
              </Panel>
            )}
            {sem.supplier && leadBySup.length > 0 && (
              <Panel
                title="Tiempo de entrega por proveedor (si existe en datos)"
                subtitle="Días promedio"
                back={<p>Requiere columnas de proveedor y días de entrega con valores numéricos.</p>}
              >
                <ChartBox>
                  <BarChart
                    data={leadBySup}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 70, bottom: 0 }}
                  >
                    <CartesianGrid {...gridProps} horizontal={false} />
                    <XAxis type="number" {...axisProps} />
                    <YAxis dataKey="name" type="category" width={64} {...axisProps} tickFormatter={(v) => String(v).slice(0, 12)} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#ec4899" />
                  </BarChart>
                </ChartBox>
              </Panel>
            )}
            {!sem.stock && <div className="ai-text p-4">Incluye columna de existencias (stock) para activar gráficos de inventario.</div>}
          </>
        )}
      </>
    );
  }

  if (view === 'suppliers') {
    return (
      <>
        <InsightBanner items={insights} />
        {sem.supplier
          ? grid(
              <>
                <Panel
                  title="Volumen por proveedor"
                  subtitle="Nº de filas / productos"
                  back={<p>Conteo de filas asociadas a cada proveedor en el catálogo.</p>}
                >
                  <ChartBox>
                    <BarChart data={groupCount(rows, sem.supplier)} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 10)} />
                      <YAxis {...axisProps} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#0ea5e9" />
                    </BarChart>
                  </ChartBox>
                </Panel>
                {leadBySup.length > 0 && (
                  <Panel
                    title="Lead time promedio por proveedor"
                    subtitle="Días (media simple)"
                    back={<p>Compara proveedores según días; útil negociar plazos.</p>}
                  >
                    <ChartBox>
                      <LineChart data={leadBySup} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 8)} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line dataKey="value" stroke="#8b5cf6" dot />
                      </LineChart>
                    </ChartBox>
                  </Panel>
                )}
                {sem.country && (
                  <Panel
                    title="Origen por país / región"
                    subtitle={sem.country}
                    back={<p>Concentración geográfica del surtido (riesgo, compliance, lead times).</p>}
                  >
                    <ChartBox>
                      <PieChart>
                        <Pie
                          data={groupCount(rows, sem.country, 8).map((d) => ({ name: d.name, value: d.value }))}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={90}
                        >
                          {groupCount(rows, sem.country, 8).map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ChartBox>
                  </Panel>
                )}
              </>
            )
          : (
            <MissingHint need={['Proveedor (nombre o clave)']} />
          )}
      </>
    );
  }

  if (view === 'quality') {
    return (
      <>
        <InsightBanner items={insights} />
        {sem.rating
          ? grid(
              <>
                {qualityPts.length > 0 && (
                  <Panel
                    title="Rating vs volumen (reseñas o índice)"
                    subtitle="Detecta sujetos con buena nota poca conversación, y al revés"
                    back={
                      <p>El eje Y es rating; eje X reseñas o índice. Puntos a la izquierda y arriba suelen ser activos a proteger en marca.</p>
                    }
                  >
                    <ChartBox>
                      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid />
                        <XAxis dataKey="x" name="Reseñas / x" type="number" {...axisProps} />
                        <YAxis dataKey="y" name="Rating" type="number" domain={[0, 5]} {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Scatter name="Items" data={qualityPts} fill="#f59e0b" />
                      </ScatterChart>
                    </ChartBox>
                  </Panel>
                )}
                <Panel
                  title="Top calificados (muestra)"
                  subtitle="Mayor rating"
                  back={<p>Orden por rating descendente. Si hay muchos empates, cruzar con reseñas o stock.</p>}
                >
                  <ChartBox>
                    <BarChart
                      data={rows
                        .map((r, i) => ({ name: (sem.productName && String(r[sem.productName!] ?? i).slice(0, 12)) || `F${i + 1}`, v: toNum(r[sem.rating!]) }))
                        .filter((d) => d.v > 0)
                        .sort((a, b) => b.v - a.v)
                        .slice(0, 12)}
                      margin={{ top: 8, right: 8, left: -10, bottom: 40 }}
                    >
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="name" {...axisProps} tick={{ fontSize: 8 }} angle={-20} textAnchor="end" height={50} />
                      <YAxis domain={[0, 5]} {...axisProps} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="v" fill="#10b981" />
                    </BarChart>
                  </ChartBox>
                </Panel>
                {sem.stock && (
                  <Panel
                    title="Riesgo: rating bajo y stock relevante (heurística)"
                    subtitle="Filas con rating bajo y stock alto"
                    back={<p>Combinación de columnas; úsalo para campañas o liquidación con cuidado de marca.</p>}
                  >
                    <p className="p-3 text-sm" style={{ color: 'var(--text2)' }}>
                      {rows.filter((r) => toNum(r[sem.rating!]) < 3 && toNum(r[sem.stock!]) > 50).length} fila(s) coinciden
                      aprox. con criterio de riesgo.
                    </p>
                  </Panel>
                )}
              </>
            )
          : (
            <MissingHint need={['Rating o puntuación', 'Reseñas (opcional)']} />
          )}
      </>
    );
  }

  if (view === 'temporal') {
    return (
      <>
        <InsightBanner items={insights} />
        {sem.dateField || sem.dateColumns[0]
          ? grid(
              <>
                <Panel
                  title="Altas o movimientos por mes"
                  subtitle="Frecuencia de filas por periodo (fecha detectada)"
                  back={<p>Se agrupa la columna de fecha al mes. Úsalo para ver ritmo de carga al catálogo.</p>}
                >
                  {byMonth.length === 0 ? (
                    <ChartEmpty message="No se pudieron leer fechas en las columnas detectadas. Prueba fechas en formato ISO, dd/mm/aaaa, o numérico Excel." />
                  ) : (
                    <ChartBox>
                      <AreaChart data={byMonth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="lgT2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 7)} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area dataKey="value" stroke="#0ea5e9" fill="url(#lgT2)" name="Eventos" />
                      </AreaChart>
                    </ChartBox>
                  )}
                </Panel>
                <Panel
                  title="Tendencia (línea) de incorporación"
                  subtitle="Mismo agregado mensual"
                  back={<p>Tendencia simple del número de filas con fecha en cada mes.</p>}
                >
                  {byMonth.length === 0 ? (
                    <ChartEmpty message="Sin fechas parseables: revisa el archivo o ajusta la columna de fecha en ajustes." />
                  ) : (
                    <ChartBox>
                      <LineChart data={byMonth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line dataKey="value" stroke="#10b981" strokeWidth={2} dot />
                      </LineChart>
                    </ChartBox>
                  )}
                </Panel>
              </>
            )
          : (
            <MissingHint need={['Fecha de alta / creado / modificado']} />
          )}
      </>
    );
  }

  return null;
}

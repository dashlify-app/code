'use client';

export const dynamic = 'force-dynamic';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Maximize2, Download } from 'lucide-react';
import { downloadSvgAsImage } from '@/lib/exportUtils';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface RawSchema {
  headers: string[];
  sampleData: Record<string, any>[];
  analysis?: any;
  fileMeta?: { size: string; type: string };
}
interface Dataset {
  id: string;
  name: string;
  rawSchema: RawSchema;
  createdAt: string;
  updatedAt: string;
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
    };
  });
}

function groupByCategory(rows: Record<string, any>[], catCol: string, numCol?: string) {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row[catCol] ?? 'Sin valor').slice(0, 30);
    if (numCol) {
      map[key] = (map[key] ?? 0) + toNum(row[numCol]);
    } else {
      map[key] = (map[key] ?? 0) + 1;
    }
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value: Math.round(value) }));
}

function groupByDate(rows: Record<string, any>[], dateCol: string, numCol?: string) {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const d = new Date(row[dateCol]);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (numCol) {
      map[key] = (map[key] ?? 0) + toNum(row[numCol]);
    } else {
      map[key] = (map[key] ?? 0) + 1;
    }
  }
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({
      name: name.replace(/^\d{4}-/, '').replace(/^0/, ''),
      value: Math.round(value),
    }));
}

// ── Estilos compartidos para Recharts ────────────────────────────────────────
const axisProps = {
  axisLine: false, tickLine: false,
  fontSize: 9,
  tick: { fill: '#94a3b8', fontFamily: '"DM Mono",monospace' },
};
const gridProps = { strokeDasharray: 'none', vertical: true, stroke: '#e2e8f0' };
const tooltipStyle = {
  backgroundColor: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  fontFamily: '"DM Mono",monospace', fontSize: 11,
};
const PALETTE = ['#0ea5e9','#10b981','#f97316','#8b5cf6','#f59e0b'];

const BADGE: Record<string, string> = {};
const badgeClass = (val: string) => {
  const v = String(val).toLowerCase();
  if (['completado','activo','aprobado','done','active'].some(k => v.includes(k))) return 'badge-g';
  if (['proceso','pendiente','proceso','review'].some(k => v.includes(k))) return 'badge-b';
  if (['cancelado','rechazado','error','failed'].some(k => v.includes(k))) return 'badge-o';
  return 'badge-p';
};

// ── Gráficas dinámicas ───────────────────────────────────────────────────────
function DynamicCharts({ rows, types, view }: { rows: Record<string, any>[]; types: ReturnType<typeof detectColumnTypes> & { headers?: string[] }; view: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const toggleFlip = (chartId: string) => {
    setFlipped(prev => ({ ...prev, [chartId]: !prev[chartId] }));
  };

  if (rows.length === 0) return null;

  const numCol = types.numeric[0];
  const numCol2 = types.numeric[1];
  const catCol = types.categorical[0];
  const dateCol = types.dates[0];

  const hasDate = !!dateCol;
  const hasCat  = !!catCol;
  const hasNum  = !!numCol;

  const timeData  = dateCol && hasNum ? groupByDate(rows, dateCol, numCol) : [];
  const catData   = catCol  && hasNum ? groupByCategory(rows, catCol, numCol) : groupByCategory(rows, catCol ?? types.headers?.[0] ?? '', undefined);
  const catData2  = catCol  && numCol2 ? groupByCategory(rows, catCol, numCol2) : [];

  const timeLabel  = dateCol ? `${numCol ?? 'Conteo'} por fecha` : '';
  const catLabel   = catCol  ? `${numCol ?? 'Conteo'} por ${catCol}` : '';

  const showTrends = ['auto', 'trends'].includes(view);
  const showDistribution = ['auto', 'distribution'].includes(view);
  const showComparison = ['auto', 'comparison'].includes(view);

  return (
    <>
      {expanded && (
        <div className="modal-bg open" style={{ zIndex: 999 }} onClick={() => setExpanded(null)}>
          <div className="chart-card full" style={{ width: '90vw', height: '80vh', maxWidth: 1200, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div className="chart-hd">
              <div>
                <div className="chart-title">Vista Extendida</div>
                <div className="chart-sub">Presiona ESC o haz clic fuera para cerrar</div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage(`chart-exp`, 'dashlify-export')}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded(null)}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: 'calc(100% - 60px)' }} id="chart-exp">
              {/* Contenido clonado más abajo */}
            </div>
          </div>
        </div>
      )}
      <div className="charts-grid">
        {/* Chart 1: Temporal o Barras */}
        {showTrends && timeData.length > 1 && (
          <div className="chart-card">
            <div className="chart-hd">
              <div>
                <div className="chart-title">{timeLabel}</div>
                <div className="chart-sub">Evolución temporal</div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => toggleFlip('time')} title="Información">
                  ℹ️
                </button>
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage('chart-time', 'evolucion-temporal')}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded('time')}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            {flipped['time'] ? (
              <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface2)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                  <strong>📈 Evolución Temporal</strong>
                  <p style={{ marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>
                    Este gráfico muestra cómo cambia <strong>{numCol}</strong> a lo largo del tiempo. La línea ascendente/descendente indica la tendencia general, mientras que los picos representan variaciones en fechas específicas.
                  </p>
                  <p style={{ marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                    Use este gráfico para identificar patrones temporales y detectar anomalías.
                  </p>
                </div>
              </div>
            ) : (
              <div className="chart-wrap" id="chart-time">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData} margin={{top:4,right:8,left:-15,bottom:0}}>
                  <defs>
                    <linearGradient id="lgT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} tickFormatter={v => String(v).slice(0, 10)} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" height={36} iconType="square" />
                  <Area type="monotone" dataKey="value" name={numCol} stroke="#0ea5e9" strokeWidth={3} fill="url(#lgT)" dot={false} activeDot={{r:5, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        )}

        {/* Chart 2: Distribución por categoría */}
        {(showDistribution || showComparison) && catData.length > 0 && (
          <div className="chart-card">
            <div className="chart-hd">
              <div>
                <div className="chart-title">{catLabel}</div>
                <div className="chart-sub">Distribución por {catCol}</div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => toggleFlip('cat')} title="Información">
                  ℹ️
                </button>
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage('chart-cat', 'distribucion-categoria')}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded('cat')}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            {flipped['cat'] ? (
              <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface2)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                  <strong>📊 Distribución por Categoría</strong>
                  <p style={{ marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>
                    Este gráfico muestra la distribución de <strong>{numCol}</strong> entre las diferentes categorías de <strong>{catCol}</strong>. Las barras más largas indican categorías con mayor valor o cantidad.
                  </p>
                  <p style={{ marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                    Use este gráfico para comparar el desempeño entre categorías e identificar cuál es la más relevante.
                  </p>
                </div>
              </div>
            ) : (
              <div className="chart-wrap" id="chart-cat">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData.slice(0,8)} layout="vertical" margin={{top:4,right:8,left:80,bottom:0}}>
                  <CartesianGrid {...gridProps} horizontal={false} />
                  <XAxis type="number" {...axisProps} />
                  <YAxis dataKey="name" type="category" {...axisProps} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" height={36} iconType="square" />
                  <Bar dataKey="value" name={numCol} stroke="#0ea5e9" strokeWidth={1} fill="rgba(14,165,233,0.85)" radius={[0,2,2,0]} maxBarSize={32}>
                    {catData.slice(0,8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        )}

        {/* Si no hay datos temporales o estamos en comparativa, mostrar segunda categoría o conteo */}
        {showComparison && timeData.length <= 1 && catData2.length > 0 && (
          <div className="chart-card">
            <div className="chart-hd">
              <div>
                <div className="chart-title">{numCol2} por {catCol}</div>
                <div className="chart-sub">Comparación de métrica secundaria</div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => toggleFlip('comp')} title="Información">
                  ℹ️
                </button>
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage('chart-comp', 'comparativa')}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded('comp')}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            {flipped['comp'] ? (
              <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface2)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                  <strong>📈 Comparación de Métrica Secundaria</strong>
                  <p style={{ marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>
                    Este gráfico compara <strong>{numCol2}</strong> entre las diferentes categorías de <strong>{catCol}</strong>, permitiendo analizar una segunda métrica importante.
                  </p>
                  <p style={{ marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                    Use este gráfico para comparar alternativas y tomar decisiones basadas en múltiples criterios.
                  </p>
                </div>
              </div>
            ) : (
              <div className="chart-wrap" id="chart-comp">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData2.slice(0,8)} margin={{top:4,right:8,left:-15,bottom:0}}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} tickFormatter={v => String(v).slice(0, 10)} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" height={36} iconType="square" />
                  <Bar dataKey="value" name={numCol2} stroke="#10b981" strokeWidth={1} fill="rgba(16,185,129,0.85)" radius={[2,2,0,0]} maxBarSize={42}>
                    {catData2.slice(0,8).map((_, i) => <Cell key={i} fill={PALETTE[(i+1) % PALETTE.length]} stroke={PALETTE[(i+1) % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Full-width: si hay fecha Y categoría → multi-métrica (o siempre si trends es true y hay data) */}
      {showTrends && timeData.length > 1 && catData.length > 0 && (
        <div className="charts-grid">
          <div className="chart-card full">
            <div className="chart-hd">
              <div>
                <div className="chart-title">Análisis de Tendencia — {numCol}</div>
                <div className="chart-sub">Vista consolidada · {rows.length} registros totales</div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => toggleFlip('full')} title="Información">
                  ℹ️
                </button>
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage('chart-full', 'tendencia-completa')}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded('full')}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            {flipped['full'] ? (
              <div className="chart-wrap" style={{height:220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface2)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                  <strong>📈 Análisis de Tendencia</strong>
                  <p style={{ marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>
                    Esta es la vista consolidada que muestra la tendencia completa de <strong>{numCol}</strong> a través del tiempo. Los puntos representan variaciones significativas, mientras que la línea general muestra la dirección del cambio.
                  </p>
                  <p style={{ marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                    Excelente para visualizar patrones a largo plazo y hacer pronósticos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="chart-wrap" style={{height:220}} id="chart-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeData} margin={{top:4,right:8,left:-15,bottom:0}}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} tickFormatter={v => String(v).slice(0, 10)} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="top" height={36} iconType="square" />
                    <Line type="monotone" dataKey="value" name={numCol} stroke="#0ea5e9" strokeWidth={3} dot={{r:4, fill:'#fff', stroke:'#0ea5e9', strokeWidth:2}} activeDot={{r:6, strokeWidth:0, fill:'#0ea5e9'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

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

// ── Componente principal (inner, necesita Suspense) ──────────────────────────
function DashboardContent() {
  const params = useSearchParams();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);

  // Cargar datasets de la DB
  useEffect(() => {
    fetch('/api/datasets')
      .then(r => r.json())
      .then(data => {
        const ds: Dataset[] = Array.isArray(data.datasets) ? data.datasets : [];
        setDatasets(ds);
        if (ds.length > 0) setActiveDatasetId(ds[0].id);
      })
      .catch(() => {});
  }, []);

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
  const viewParam = params.get('view') || 'auto';
  const activeDataset = datasets.find(d => d.id === activeDatasetId) ?? datasets[0];
  const rows    = (activeDataset?.rawSchema?.sampleData ?? []) as Record<string, any>[];
  const headers = activeDataset?.rawSchema?.headers ?? [];
  const types   = detectColumnTypes(headers, rows);
  const kpis    = rows.length > 0 && types.numeric.length > 0
    ? calcKPIs(rows, types.numeric, activeDataset?.name ?? '')
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{color:'var(--text3)'}}>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent mr-3" />
        Cargando datos…
      </div>
    );
  }

  const hasData = rows.length > 0 && headers.length > 0;

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

      {/* KPI GRID — dinámico */}
      {hasData && kpis.length > 0 && (
        <div className="kpi-grid">
          {kpis.map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className={`kpi-value ${k.color}`}>{k.value}</div>
              <div className={`kpi-delta ${k.dir}`}>▲ {k.delta}</div>
              <div className="kpi-bar-wrap">
                <div className="kpi-bar" style={{width:`${k.pct}%`, background:k.bar}} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHARTS — dinámicos */}
      {hasData && viewParam !== 'executive' && <DynamicCharts rows={rows} types={{...types, headers}} view={viewParam} />}

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

      {/* UPLOAD ZONE */}
      <div id="upload-zone" style={{marginTop: hasData ? 24 : 0}}>
        <UploadZone />
      </div>
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

'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Maximize2, RefreshCw, Download } from 'lucide-react';
import { downloadSvgAsImage } from '@/lib/exportUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

type ThemeId = 'modern' | 'enterprise' | 'dark';

interface Props {
  id: string;
  theme?: ThemeId;
  isDark?: boolean;
  widget: { title: string; type: string; config: any };
  onUpdate?: (newConfig: any) => void;
}

const PALETTE = {
  modern:     ['#0ea5e9','#10b981','#f97316','#8b5cf6','#f59e0b'],
  enterprise: ['#0052cc','#2684ff','#0065ff','#4c9aff','#b3d4ff'],
  dark:       ['#00d4ff','#00ff9d','#ff6b35','#a78bfa','#f59e0b'],
};

const TICK_COLOR   = { modern: '#94a3b8', enterprise: '#4a6b8a', dark: '#4a6b82' };
const GRID_COLOR   = { modern: 'rgba(226,232,240,0.8)', enterprise: 'rgba(220,230,245,0.6)', dark: 'rgba(26,42,58,0.55)' };
const TOOLTIP_BG   = { modern: '#ffffff', enterprise: '#ffffff', dark: '#111820' };
const TOOLTIP_BDR  = { modern: '#e2e8f0', enterprise: '#dce6f5', dark: '#1a2a3a' };

const SPARK_HEIGHTS = [40, 65, 52, 80, 60, 90, 45, 75];
/** Encuentra la columna real haciendo fuzzy match */
function findRealKey(obj: Record<string, any>, suggestedKeyRaw: any): string {
  if (!obj || !suggestedKeyRaw) return '';
  const suggestedKey = String(suggestedKeyRaw);
  const keys = Object.keys(obj);
  if (keys.includes(suggestedKey)) return suggestedKey;
  
  const lowerS = suggestedKey.toLowerCase();
  // Buscar coincidencia exacta ignorando mayúsculas
  const exactMatch = keys.find(k => k.toLowerCase() === lowerS);
  if (exactMatch) return exactMatch;

  // Buscar coincidencia parcial
  const partialMatch = keys.find(k => lowerS.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerS));
  return partialMatch || suggestedKey;
}

/** Convierte sampleData + config.x + config.y  en [{name, value}] */
function toChartData(config: any): { name: string; value: number; z?: number }[] {
  const rows: Record<string, any>[] = config?.sampleData ?? [];
  const rawX: string = config?.x || config?.xAxis || '';
  const rawY: string = config?.y || config?.yAxis || '';
  const rawZ: string = config?.z || '';

  if (!rows.length || !rawY) return [];

  const sampleObj = rows[0] || {};
  const xKey = findRealKey(sampleObj, rawX);
  const yKey = findRealKey(sampleObj, rawY);
  const zKey = findRealKey(sampleObj, rawZ);

  const parsed = rows
    .map(r => ({
      name:  xKey ? String(r[xKey] ?? '').slice(0, 30) : '—',
      value: parseFloat(String(r[yKey] ?? '0').replace(/[$,\s%a-zA-Z]/g, '')) || 0,
      ...(zKey ? { z: parseFloat(String(r[zKey] ?? '10').replace(/[$,\s%a-zA-Z]/g, '')) || 10 } : {}),
    }))
    .filter(d => !isNaN(d.value));
    
  return parsed;
}

/** Convierte sampleData en [{name, value}] agrupando por xKey (para barras/pie/donut) */
function toGrouped(config: any): { name: string; value: number }[] {
  const rows: Record<string, any>[] = config?.sampleData ?? [];
  const rawX: string = config?.x || config?.xAxis || '';
  const rawY: string = config?.y || config?.yAxis || '';

  if (!rows.length) return [];

  const sampleObj = rows[0] || {};
  const xKey = findRealKey(sampleObj, rawX);
  const yKey = findRealKey(sampleObj, rawY);

  if (!xKey) return toChartData(config);

  const map: Record<string, number> = {};
  for (const r of rows) {
    const key = String(r[xKey] ?? '—').slice(0, 35);
    // Si no hay yKey, contamos ocurrencias. Si hay yKey, sumamos.
    const val = yKey 
      ? (parseFloat(String(r[yKey] ?? '0').replace(/[$,\s%a-zA-Z]/g, '')) || 0)
      : 1;
    map[key] = (map[key] ?? 0) + val;
  }

  const grouped = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15) // Mostrar un poco más para que sea útil
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  return grouped;
}

export function SortableWidget({ id, widget, isDark, theme = 'modern', onUpdate }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const [expanded, setExpanded] = useState(false);

  const resolved: ThemeId = isDark ? 'dark' : theme;
  const pal        = PALETTE[resolved];
  const tickColor  = TICK_COLOR[resolved];
  const gridColor  = resolved === 'modern' ? '#e2e8f0' : GRID_COLOR[resolved];

  const tooltipStyle = {
    backgroundColor: TOOLTIP_BG[resolved],
    border: `1px solid ${TOOLTIP_BDR[resolved]}`,
    borderRadius: resolved === 'enterprise' ? '4px' : '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    color: resolved === 'dark' ? '#e8f4fd' : '#1e293b',
    fontFamily: 'var(--font-dm-mono,"DM Mono",monospace)',
    fontSize: 11,
  };

  const axisProps = {
    axisLine: false, tickLine: false,
    fontSize: 9,
    tick: { fill: tickColor, fontFamily: 'var(--font-dm-mono,"DM Mono",monospace)' },
  };

  const chartTypeLabel: Record<string, string> = {
    bar: 'BARRAS', line: 'LÍNEA', pie: 'DISTRIBUCIÓN', stat: 'KPI',
    area: 'ÁREA', scatter: 'SCATTER', bubble: 'BUBBLE', donut: 'DONUT',
  };

  const renderChart = () => {
    const radius = resolved === 'enterprise'
      ? [0,0,0,0] as [number,number,number,number]
      : [3,3,0,0] as [number,number,number,number];

    const cfg = widget.config ?? {};

    switch (widget.type) {

      /* ── BAR ─────────────────────────────────────────────────── */
      case 'bar': {
        const chartData = toGrouped(cfg);
        // Si hay muchas categorías o los nombres son largos, podría usarse layout vertical
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top:4, right:8, left:-15, bottom:0 }}>
              <CartesianGrid strokeDasharray="none" vertical={true} stroke={gridColor} />
              <XAxis dataKey="name" {...axisProps} tickFormatter={(val) => val.slice(0,10)} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend verticalAlign="top" height={36} iconType="square" />
              <Bar dataKey="value" fill={pal[0]} radius={[2,2,0,0]} maxBarSize={42} strokeWidth={1} stroke={pal[0]} fillOpacity={0.85}>
                {chartData.map((_, i) => <Cell key={i} fill={pal[i % pal.length]} stroke={pal[i % pal.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      /* ── LINE ────────────────────────────────────────────────── */
      case 'line': {
        const chartData = toChartData(cfg);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top:4, right:8, left:-15, bottom:0 }}>
              <CartesianGrid strokeDasharray="none" vertical={true} stroke={gridColor} />
              <XAxis dataKey="name" {...axisProps} tickFormatter={(val) => val.slice(0,10)} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} iconType="square" />
              <Line
                type="monotone" dataKey="value"
                stroke={pal[0]} strokeWidth={3}
                dot={{ r: 4, fill: '#fff', stroke: pal[0], strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0, fill: pal[0] }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      }

      /* ── AREA ────────────────────────────────────────────────── */
      case 'area': {
        const chartData = toChartData(cfg);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:4, right:8, left:-15, bottom:0 }}>
              <defs>
                <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={pal[0]} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={pal[0]} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="none" vertical={true} stroke={gridColor} />
              <XAxis dataKey="name" {...axisProps} tickFormatter={(val) => val.slice(0,10)} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} iconType="square" />
              <Area
                type="monotone" dataKey="value"
                stroke={pal[0]} strokeWidth={3}
                fill={`url(#lg-${id})`}
                dot={false} activeDot={{ r:5, fill: pal[0], stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      /* ── PIE / DONUT ─────────────────────────────────────────── */
      case 'pie':
      case 'donut': {
        const chartData = toGrouped(cfg);
        const inner = widget.type === 'donut' ? '48%' : '0%';
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={inner} outerRadius="72%"
                dataKey="value" paddingAngle={resolved === 'enterprise' ? 1 : 4}
                stroke="#1e293b" strokeWidth={1.5}
              >
                {chartData.map((_, i) => <Cell key={i} fill={pal[i % pal.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                iconSize={8} iconType="circle"
                formatter={(v) => (
                  <span style={{ color: tickColor, fontSize: 9, fontFamily: 'var(--font-dm-mono,"DM Mono",monospace)', letterSpacing:'0.5px' }}>
                    {v}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      /* ── SCATTER ─────────────────────────────────────────────── */
      case 'scatter': {
        const rows: Record<string, any>[] = cfg?.sampleData ?? [];
        const xKey = cfg?.x ?? '';
        const yKey = cfg?.y ?? '';
        const scatterData = rows.length && xKey && yKey
          ? rows.map(r => ({
              x: parseFloat(String(r[xKey] ?? '0').replace(/[$,\s%]/g, '')) || 0,
              y: parseFloat(String(r[yKey] ?? '0').replace(/[$,\s%]/g, '')) || 0,
            }))
          : [{ x:10,y:20 },{ x:30,y:50 },{ x:50,y:30 },{ x:70,y:80 },{ x:90,y:60 }];
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="x" type="number" name={xKey || 'X'} {...axisProps} />
              <YAxis dataKey="y" type="number" name={yKey || 'Y'} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray:'3 3' }} />
              <Scatter data={scatterData} fill={pal[0]} fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      /* ── BUBBLE ──────────────────────────────────────────────── */
      case 'bubble': {
        const rows: Record<string, any>[] = cfg?.sampleData ?? [];
        const xKey = cfg?.x ?? '';
        const yKey = cfg?.y ?? '';
        const zKey = cfg?.z ?? '';
        const bubbleData = rows.length && xKey && yKey
          ? rows.map(r => ({
              x: parseFloat(String(r[xKey] ?? '0').replace(/[$,\s%]/g, '')) || 0,
              y: parseFloat(String(r[yKey] ?? '0').replace(/[$,\s%]/g, '')) || 0,
              z: zKey ? (parseFloat(String(r[zKey] ?? '10').replace(/[$,\s%]/g, '')) || 10) : 20,
            }))
          : [{ x:10,y:20,z:30 },{ x:30,y:50,z:60 },{ x:50,y:30,z:20 },{ x:70,y:80,z:45 }];
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="x" type="number" name={xKey || 'X'} {...axisProps} />
              <YAxis dataKey="y" type="number" name={yKey || 'Y'} {...axisProps} />
              <ZAxis dataKey="z" range={[40, 400]} name={zKey || 'Z'} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray:'3 3' }} />
              <Scatter data={bubbleData} fill={pal[0]} fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      /* ── STAT / KPI ──────────────────────────────────────────── */
      case 'stat': {
        const rows: Record<string, any>[] = cfg?.sampleData ?? [];
        const yKey = cfg?.y ?? '';
        let statVal = '—';
        if (rows.length && yKey) {
          const sum = rows.reduce((acc, r) => acc + (parseFloat(String(r[yKey] ?? '0').replace(/[$,\s%]/g, '')) || 0), 0);
          statVal = sum > 1_000_000
            ? `$${(sum/1_000_000).toFixed(2)}M`
            : sum > 1_000
            ? `$${(sum/1_000).toFixed(1)}K`
            : sum.toFixed(0);
        }
        return (
          <div className="flex flex-col justify-center items-center h-full gap-3">
            <div style={{
              fontFamily: 'var(--font-syne,"Syne",system-ui,sans-serif)',
              fontSize: 38, fontWeight: 900, lineHeight: 1,
              color: pal[0], letterSpacing: '-1.5px',
            }}>
              {statVal}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono,monospace)', fontSize: 11,
                color: resolved === 'dark' ? '#00ff9d' : '#10b981',
                background: resolved === 'dark' ? 'rgba(0,255,157,0.1)' : 'rgba(16,185,129,0.1)',
                padding: '2px 8px', borderRadius: 6, letterSpacing: '0.5px',
              }}>
                ▲ {yKey || 'Total'}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:28, marginTop:4 }}>
              {SPARK_HEIGHTS.map((h, i) => (
                <div key={i} style={{
                  width:6, borderRadius:'2px 2px 0 0', height:`${h}%`,
                  background: i === SPARK_HEIGHTS.length-1 ? pal[0] : `${pal[0]}55`,
                }} />
              ))}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: tickColor }}>
            <span style={{ fontSize:28 }}>📊</span>
            <span style={{ fontSize:11 }}>Tipo: <strong>{widget.type}</strong></span>
          </div>
        );
    }
  };

  const colSpanClass = widget.config?.colSpan === 3 
    ? 'lg:col-span-3 md:col-span-2' 
    : widget.config?.colSpan === 2 
    ? 'lg:col-span-2' 
    : 'lg:col-span-1';

  return (
    <>
      {expanded && (
        <div className="modal-bg open" style={{ zIndex: 9999 }} onClick={() => setExpanded(false)}>
          <div className="chart-card full" style={{ width: '90vw', height: '80vh', maxWidth: 1200, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div className="chart-hd">
              <div>
                <div className="chart-title">{widget.title}</div>
                <div className="chart-sub">
                  {chartTypeLabel[widget.type] ?? widget.type.toUpperCase()}
                  {widget.config?.x && ` · X: ${widget.config.x}`}
                  {widget.config?.y && ` · Y: ${widget.config.y}`}
                </div>
              </div>
              <div className="chart-actions">
                <button type="button" className="chart-btn" onClick={() => downloadSvgAsImage(`widget-exp-${id}`, widget.title)}>
                  <Download size={13} />
                </button>
                <button type="button" className="chart-btn" onClick={() => setExpanded(false)}>
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: 'calc(100% - 60px)' }} id={`widget-exp-${id}`}>
              {renderChart()}
            </div>
          </div>
        </div>
      )}
      <div ref={setNodeRef} style={style} className={`chart-card group flex flex-col ${colSpanClass}`}>
        <div className="chart-hd">
          <div>
            <div
              className="chart-title"
              style={{ cursor:'grab' }}
              {...attributes}
              {...listeners}
            >
              {widget.title}
            </div>
            <div className="chart-sub" style={{ marginTop:3 }}>
              {chartTypeLabel[widget.type] ?? widget.type.toUpperCase()}
              {widget.config?.x && ` · X: ${widget.config.x}`}
              {widget.config?.y && ` · Y: ${widget.config.y}`}
            </div>
          </div>
          <div className="chart-actions opacity-0 group-hover:opacity-100 transition-opacity">
            <select
              value={widget.config?.colSpan || 1}
              onChange={(e) => {
                e.stopPropagation();
                onUpdate?.({ colSpan: Number(e.target.value) });
              }}
              onClick={e => e.stopPropagation()}
              className="chart-btn appearance-none text-center outline-none cursor-pointer"
              title="Ancho del Gráfico"
            >
              <option value={1}>1/3 Ancho</option>
              <option value={2}>2/3 Ancho</option>
              <option value={3}>Full Ancho</option>
            </select>
            <button className="chart-btn" title="Descargar" onClick={(e) => { e.stopPropagation(); downloadSvgAsImage(`widget-${id}`, widget.title); }}>
              <Download size={12} />
            </button>
            <button className="chart-btn" title="Expandir" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
        <div className="chart-wrap" style={{ flex:1 }} id={`widget-${id}`}>
          {renderChart()}
        </div>
      </div>
    </>
  );
}

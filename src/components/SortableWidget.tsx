'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Maximize2, RefreshCw, Download } from 'lucide-react';
import { downloadSvgAsImage } from '@/lib/exportUtils';
import ChartEngine from './ChartEngine';
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
    const cfg = widget.config ?? {};
    const chartData = widget.type === 'bar' || widget.type === 'pie' || widget.type === 'donut' 
      ? toGrouped(cfg) 
      : toChartData(cfg);

    if (!chartData.length) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Sin datos reales</span>
        </div>
      );
    }

    if (widget.type === 'stat') {
      const total = chartData.reduce((acc, d) => acc + d.value, 0);
      const displayVal = total > 1_000_000 
        ? `$${(total/1_000_000).toFixed(2)}M` 
        : total > 1_000 ? `$${(total/1_000).toFixed(1)}K` : total.toLocaleString();
      
      return (
        <div className="flex flex-col justify-center items-center h-full">
          <div className="kpi-value text-sky-500 dark:text-cyan-400" style={{ fontSize: 48 }}>
            {displayVal}
          </div>
          <div className="kpi-label">{widget.config?.y || 'Métrica Total'}</div>
          <div className="flex items-end gap-1 mt-4 h-8">
            {chartData.slice(-10).map((d, i) => (
              <div 
                key={i} 
                className="rounded-t-sm" 
                style={{ 
                  height: `${(d.value / Math.max(...chartData.map(v => v.value)) * 100) || 10}%`,
                  background: i === 9 ? 'var(--accent)' : 'var(--accent)33',
                  width: 5
                }} 
              />
            ))}
          </div>
        </div>
      );
    }

    // Usar el nuevo motor ChartEngine para todo lo demás
    return (
      <div className="w-full h-full p-2">
        <ChartEngine 
          type={widget.type} 
          data={chartData} 
          title={widget.title}
          theme={theme}
        />
      </div>
    );
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

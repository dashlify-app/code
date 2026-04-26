'use client';

import { useState, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Maximize2, Download, Info, X } from 'lucide-react';
import { downloadSvgAsImage } from '@/lib/exportUtils';
import ChartEngine from './ChartEngine';
import { useFilters } from './FilterContext';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

type ThemeId = 'modern' | 'enterprise' | 'dark';

interface Props {
  id: string;
  theme?: ThemeId;
  isDark?: boolean;
  widget: { title: string; type: string; config: any };
  onUpdate?: (newConfig: any) => void;
}

/** Encuentra la columna real haciendo fuzzy match */
function findRealKey(obj: Record<string, any>, suggestedKeyRaw: any): string {
  if (!obj || !suggestedKeyRaw) return '';
  const suggestedKey = String(suggestedKeyRaw);
  const keys = Object.keys(obj);
  if (keys.includes(suggestedKey)) return suggestedKey;

  const lowerS = suggestedKey.toLowerCase();
  const exact = keys.find(k => k.toLowerCase() === lowerS);
  if (exact) return exact;

  return keys.find(k => lowerS.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerS)) || suggestedKey;
}

function numericVal(raw: any): number {
  return parseFloat(String(raw ?? '0').replace(/[$,\s%]/g, '')) || 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function chronoSort(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const da = Date.parse(a), db = Date.parse(b);
    if (!isNaN(da) && !isNaN(db)) return da - db;
    return a.localeCompare(b);
  });
}

/** Motor de agregación central */
function processData(
  config: any,
  widgetType: string,
  activeFilters: Record<string, string>
): { labels: string[]; datasets: { label: string; data: (number | { x: number; y: number })[] }[] } {
  let rows: Record<string, any>[] = config?.sampleData ?? [];
  if (!rows.length) return { labels: [], datasets: [] };

  // Aplicar filtros cruzados activos
  if (Object.keys(activeFilters).length > 0) {
    rows = rows.filter(row =>
      Object.entries(activeFilters).every(([col, val]) => {
        const realKey = findRealKey(row, col);
        return String(row[realKey] ?? '') === val;
      })
    );
  }

  const xKey = findRealKey(rows[0], config?.x || config?.xAxis);
  const yAxisRaw = config?.y || config?.yAxis;
  const yKeys = Array.isArray(yAxisRaw)
    ? yAxisRaw.map(k => findRealKey(rows[0], k))
    : [findRealKey(rows[0], yAxisRaw)];
  const aggregate = (config?.aggregate || 'sum').toLowerCase();

  // ── SCATTER: no agrupar, devolver puntos {x, y} ──────────────────────────
  if (widgetType === 'scatter') {
    const firstY = yKeys[0];
    const points = rows
      .slice(0, 500)
      .map(r => ({
        x: numericVal(r[xKey]),
        y: numericVal(r[firstY]),
      }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y));

    return {
      labels: [],
      datasets: [{ label: `${firstY} vs ${xKey}`, data: points }],
    };
  }

  // ── Agrupar filas por xKey ────────────────────────────────────────────────
  const groups: Record<string, Record<string, any>[]> = {};
  rows.forEach(r => {
    const key = String(r[xKey] ?? 'Sin Categoría');
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const firstY = yKeys[0];
  let labels = Object.keys(groups);

  // Ordenar: cronológico para mom/cumulative, por valor para el resto
  if (aggregate === 'mom' || aggregate === 'cumulative') {
    labels = chronoSort(labels);
  } else if (aggregate !== 'count') {
    labels.sort((a, b) => {
      const sumA = groups[a].reduce((acc, r) => acc + numericVal(r[firstY]), 0);
      const sumB = groups[b].reduce((acc, r) => acc + numericVal(r[firstY]), 0);
      return sumB - sumA; // descendente → más altos primero
    });
  }

  const limitedLabels = labels.slice(0, 15);

  // ── AGGREGATE: mom ────────────────────────────────────────────────────────
  if (aggregate === 'mom') {
    const rawSums = limitedLabels.map(l =>
      groups[l].reduce((acc, r) => acc + numericVal(r[firstY]), 0)
    );
    const momData = rawSums.map((val, i) => {
      if (i === 0) return 0;
      const prev = rawSums[i - 1];
      return prev === 0 ? 0 : +((( val - prev) / Math.abs(prev)) * 100).toFixed(1);
    });
    return {
      labels: limitedLabels,
      datasets: [{ label: `${firstY} MoM %`, data: momData }],
    };
  }

  // ── AGGREGATE: cumulative ─────────────────────────────────────────────────
  if (aggregate === 'cumulative') {
    let running = 0;
    const cumData = limitedLabels.map(l => {
      running += groups[l].reduce((acc, r) => acc + numericVal(r[firstY]), 0);
      return +running.toFixed(2);
    });
    return {
      labels: limitedLabels,
      datasets: [{ label: `${firstY} Acumulado`, data: cumData }],
    };
  }

  // ── Generar un dataset por yKey ───────────────────────────────────────────
  const datasets = yKeys.map(yKey => {
    let data: number[];

    if (aggregate === 'count') {
      data = limitedLabels.map(l => groups[l].length);
    } else {
      // Calcular valor base por grupo
      const baseValues = limitedLabels.map(l => {
        const vals = groups[l].map(r => numericVal(r[yKey]));
        switch (aggregate) {
          case 'avg':    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
          case 'median': return median(vals);
          default:       return vals.reduce((a, b) => a + b, 0); // sum
        }
      });

      if (aggregate === 'outliers') {
        const sorted = [...baseValues].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length / 4)] ?? 0;
        const q3 = sorted[Math.floor(sorted.length * 3 / 4)] ?? 0;
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        data = baseValues.map(v => (v < lower || v > upper ? +v.toFixed(2) : 0));
      } else {
        data = baseValues.map(v => +v.toFixed(2));
      }
    }

    return { label: yKey || 'Valor', data };
  });

  return { labels: limitedLabels, datasets };
}

/** Formatea números de forma compacta ($1.2M, 45K, etc) */
function formatValue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

export function SortableWidget({ id, widget, isDark, theme = 'modern', onUpdate }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { activeFilters, setFilter } = useFilters();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const [expanded, setExpanded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const resolved: ThemeId = isDark ? 'dark' : theme;

  const chartTypeLabel: Record<string, string> = {
    bar: 'BARRAS', line: 'LÍNEA', pie: 'DISTRIBUCIÓN', stat: 'KPI',
    area: 'ÁREA', scatter: 'CORRELACIÓN', bubble: 'BUBBLE', donut: 'DONUT',
  };

  const chartExplanations: Record<string, string> = {
    bar: 'Gráfico de barras que compara valores entre categorías. Útil para visualizar comparaciones entre grupos.',
    line: 'Gráfico de línea que muestra tendencias a lo largo del tiempo o una secuencia. Ideal para observar cambios continuos.',
    pie: 'Gráfico de pastel que muestra la distribución proporcional de un total. Cada sección representa una parte del conjunto.',
    stat: 'Indicador clave de desempeño (KPI) que muestra una métrica principal y su tendencia reciente.',
    area: 'Gráfico de área que combina líneas con áreas rellenas para enfatizar magnitud. Bueno para mostrar tendencias y volumen.',
    scatter: 'Gráfico de dispersión que muestra la correlación entre dos variables. Cada punto representa una observación.',
    bubble: 'Gráfico de burbujas que visualiza tres dimensiones: posición X, posición Y y tamaño de la burbuja.',
    donut: 'Gráfico de rosquilla similar al pastel, mostrando proporciones con un espacio central.',
  };

  const renderChart = (forExpanded = false) => {
    // Mostrar explicación si está flipped
    if (flipped && !forExpanded) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <Info size={40} className="text-sky-500 dark:text-cyan-400 mb-4 opacity-70" />
          <p className="text-sm text-center opacity-80 leading-relaxed">
            {chartExplanations[widget.type] || 'Gráfico de visualización de datos.'}
          </p>
        </div>
      );
    }

    const cfg = widget.config ?? {};
    const rows: Record<string, any>[] = cfg?.sampleData ?? [];

    // Coerción de tipo: line en eje categórico → bar
    let finalType = widget.type;
    if (finalType === 'line') {
      const xKey = findRealKey(rows[0] ?? {}, cfg?.x || cfg?.xAxis);
      const sample = rows.slice(0, 5).map(r => String(r[xKey] ?? ''));
      const isDate = sample.every(s => s.length >= 6 && !isNaN(Date.parse(s)));
      if (!isDate) finalType = 'bar';
    }

    const { labels, datasets } = processData(cfg, finalType, activeFilters);

    if (!labels.length && finalType !== 'scatter') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
          <span className="text-[10px] font-mono uppercase tracking-widest">Sin datos</span>
        </div>
      );
    }

    if (widget.type === 'stat') {
      const allVals = datasets[0]?.data as number[] || [];
      const total = allVals.reduce((a, b) => a + (b as number), 0);
      return (
        <div className="flex flex-col justify-center items-center h-full">
          <div className="text-sky-500 dark:text-cyan-400 font-black" style={{ fontSize: 44 }}>
            {formatValue(total)}
          </div>
          <div className="text-xs font-mono opacity-50 mt-1">
            {cfg?.y || cfg?.yAxis || 'Métrica Total'}
          </div>
          <div className="flex items-end gap-1 mt-4 h-8">
            {allVals.slice(-10).map((val, i) => {
              const max = Math.max(...allVals.slice(-10) as number[], 1);
              return (
                <div
                  key={i}
                  className="rounded-t-sm"
                  style={{
                    height: `${((val as number) / max * 100) || 4}%`,
                    background: i === 9 ? 'var(--accent)' : 'var(--accent)33',
                    width: 5,
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    }

    const xAxisCol = cfg?.x || cfg?.xAxis;

    return (
      <div className="w-full h-full p-2">
        <ChartEngine
          type={finalType}
          labels={labels}
          datasets={datasets}
          title={widget.title}
          isDark={isDark ?? resolved === 'dark'}
          onElementClick={
            finalType !== 'scatter' && xAxisCol
              ? (label) => setFilter(String(xAxisCol), label)
              : undefined
          }
        />
      </div>
    );
  };

  const colSpanClass = widget.config?.colSpan === 3
    ? 'lg:col-span-3 md:col-span-2'
    : widget.config?.colSpan === 2
    ? 'lg:col-span-2'
    : 'lg:col-span-1';

  // Resaltar visualmente si este widget tiene un filtro activo
  const xAxisCol = widget.config?.x || widget.config?.xAxis;
  const isFiltered = xAxisCol && activeFilters[xAxisCol] !== undefined;

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
              <WidgetErrorBoundary widgetId={id} widgetTitle={widget.title}>
                {renderChart(true)}
              </WidgetErrorBoundary>
            </div>
          </div>
        </div>
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`chart-card group flex flex-col ${colSpanClass} ${
          isFiltered ? 'ring-2 ring-cyan-500/40' : ''
        }`}
      >
        <div className="chart-hd">
          <div>
            <div
              className="chart-title"
              style={{ cursor: 'grab' }}
              {...attributes}
              {...listeners}
            >
              {widget.title}
            </div>
            <div className="chart-sub" style={{ marginTop: 3 }}>
              {chartTypeLabel[widget.type] ?? widget.type.toUpperCase()}
              {isFiltered && (
                <span className="ml-2 text-cyan-400">
                  · {activeFilters[String(xAxisCol)]}
                </span>
              )}
            </div>
          </div>
          <div className="chart-actions opacity-100 transition-opacity flex gap-1">
            <button
              className="chart-btn"
              title="Explicación"
              onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }}
            >
              <Info size={12} />
            </button>
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

        <div className="chart-wrap" style={{ flex: 1 }} id={`widget-${id}`}>
          <WidgetErrorBoundary widgetId={id} widgetTitle={widget.title}>
            {renderChart()}
          </WidgetErrorBoundary>
        </div>
      </div>
    </>
  );
}

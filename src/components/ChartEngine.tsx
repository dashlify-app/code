'use client';

import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Bar, Line, Doughnut, Pie, Scatter, Chart as ReactChart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  type: string;
  labels: string[];
  datasets: { label: string; data: (number | { x: number; y: number })[] }[];
  title?: string;
  theme?: string;
  isDark?: boolean;
  onElementClick?: (label: string) => void;
  customColors?: string[];
  benchmarkMode?: 'auto' | 'previousPeriod' | 'globalAvg' | 'none';
  showDelta?: boolean;
  deltaLabel?: string;
  barColorMode?: 'autoMulti' | 'manualSingle';
  barSingleColor?: string;
  benchmarkColor?: string;
  compact?: boolean;
}

const PALETTE = [
  { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', glow: 'rgba(14, 165, 233, 0.5)' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', glow: 'rgba(139, 92, 246, 0.5)' },
  { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', glow: 'rgba(236, 72, 153, 0.5)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', glow: 'rgba(16, 185, 129, 0.5)' },
  { border: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', glow: 'rgba(249, 115, 22, 0.5)' },
];

export default function ChartEngine({
  type,
  labels,
  datasets,
  title,
  theme = 'modern',
  isDark = true,
  onElementClick,
  customColors,
  benchmarkMode: benchmarkModeProp,
  showDelta,
  deltaLabel,
  barColorMode,
  barSingleColor,
  benchmarkColor,
  compact,
}: Props) {
  const chartRef = useRef<any>(null);

  const formatExecutiveValue = (val: number): string => {
    const t = (title || '').toLowerCase();
    const isTime = t.includes('tiempo') || t.includes('entrega') || t.includes(' d.');
    const isPercent = t.includes('%') || t.includes('margen') || t.includes('mom');
    const isMoney =
      t.includes('costo') ||
      t.includes('precio') ||
      t.includes('salario') ||
      t.includes('cost') ||
      t.includes('price') ||
      t.includes('salary') ||
      t.includes('revenue') ||
      t.includes('ingreso') ||
      t.includes('venta');
    if (isTime) return `${Number(val).toFixed(1)} d`;
    if (isPercent) return `${Number(val).toFixed(1)}%`;
    if (isMoney && Number(val) >= 1000) return `$${Number(val).toLocaleString()}`;
    if (isMoney) return `$${Number(val).toFixed(2)}`;
    return Number(val).toLocaleString();
  };

  // Usar customColors si están disponibles, sino usar la paleta por defecto
  const colorPalette = customColors && customColors.length > 0
    ? customColors.map(color => ({
        border: color,
        bg: color.startsWith('#')
          ? color + '20'  // Agregar transparencia
          : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.1)`,
        glow: color.startsWith('#')
          ? color + '80'  // Más opacidad para el glow
          : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.5)`,
      }))
    : PALETTE;

  const isEnterprise = theme === 'enterprise';
  const tickColor = isEnterprise ? '#64748b' : isDark ? '#4a6b82' : '#94a3b8';
  const gridColor = isEnterprise ? 'rgba(226, 232, 240, 0.9)' : isDark ? 'rgba(26, 42, 58, 0.3)' : 'rgba(226, 232, 240, 0.5)';

  const execAnnotationsPlugin = (() => {
    if (!isEnterprise) return null;
    return {
      id: 'exec-annotations',
      afterDatasetsDraw(chart: any) {
        try {
          const ctx = chart.ctx as CanvasRenderingContext2D;
          const ds0Index = chart.data?.datasets?.findIndex((d: any) => !d?.__execRole);
          if (ds0Index == null || ds0Index < 0) return;

          const meta0 = chart.getDatasetMeta(ds0Index);
          if (!meta0 || meta0.hidden) return;

          const data0 = (chart.data.datasets[ds0Index]?.data || []) as any[];

          // ── BAR: labels top 3 ─────────────────────────────────────────────
          if (type === 'bar') {
            const vals = data0
              .map((v: any, i: number) => ({ i, v: typeof v === 'number' ? v : Number(v) }))
              .filter((x: any) => Number.isFinite(x.v));
            if (vals.length === 0) return;
            vals.sort((a: any, b: any) => b.v - a.v);
            const top = vals.slice(0, 3);

            ctx.save();
            ctx.font = '700 10px "DM Mono", ui-monospace, monospace';
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            for (const it of top) {
              const el = meta0.data?.[it.i];
              if (!el || typeof el.x !== 'number' || typeof el.y !== 'number') continue;
              const text = formatExecutiveValue(it.v);
              ctx.fillText(text, el.x, el.y - 6);
            }
            ctx.restore();
          }

          // ── LINE/AREA: callout último punto ──────────────────────────────
          if (type === 'line' || type === 'area') {
            let lastI = -1;
            let lastV: number | null = null;
            for (let i = data0.length - 1; i >= 0; i--) {
              const v = typeof data0[i] === 'number' ? (data0[i] as number) : Number(data0[i]);
              if (Number.isFinite(v)) {
                lastI = i;
                lastV = v;
                break;
              }
            }
            if (lastI >= 0 && lastV != null) {
              const el = meta0.data?.[lastI];
              if (el && typeof el.x === 'number' && typeof el.y === 'number') {
                const label = formatExecutiveValue(lastV);
                const padX = 8;
                ctx.save();
                ctx.font = '700 10px "DM Mono", ui-monospace, monospace';
                const w = ctx.measureText(label).width + padX * 2;
                const h = 18;
                const x = Math.min(Math.max(el.x + 10, chart.chartArea.left + 8), chart.chartArea.right - w - 8);
                const y = Math.min(Math.max(el.y - h - 10, chart.chartArea.top + 8), chart.chartArea.bottom - h - 8);

                // box
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
                ctx.lineWidth = 1;
                const r = 8;
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r);
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // text
                ctx.fillStyle = '#0f172a';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(label, x + padX, y + h / 2);
                ctx.restore();
              }
            }
          }
        } catch {
          // non-fatal
        }
      },
    } as const;
  })();

  const parseDateish = (s: unknown): number | null => {
    if (s == null) return null;
    const str = String(s).trim();
    if (!str) return null;
    const t = Date.parse(str);
    if (!Number.isNaN(t)) return t;
    const m = str.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) {
      const a = parseInt(m[1]!, 10);
      const b = parseInt(m[2]!, 10);
      let y = parseInt(m[3]!, 10);
      if (y < 100) y += 2000;
      const d = a > 12 ? new Date(y, b - 1, a) : b > 12 ? new Date(y, a - 1, b) : new Date(y, b - 1, a);
      const ms = d.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    return null;
  };

  const inferBenchmarkMode = (lbls: string[], vals: number[]): 'previousPeriod' | 'globalAvg' => {
    // Heurística “tipo IA”: si el eje X parece temporal y ordenable, usar periodo anterior; si no, promedio global.
    const dateMs = lbls.map(parseDateish);
    const ok = dateMs.filter((x) => x != null).length;
    if (lbls.length >= 4 && ok / Math.max(lbls.length, 1) >= 0.75) {
      const seq = dateMs.filter((x): x is number => x != null);
      let nonDecreasing = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i] >= seq[i - 1]) nonDecreasing++;
      if (nonDecreasing / Math.max(seq.length - 1, 1) >= 0.8) return 'previousPeriod';
    }
    return 'globalAvg';
  };

  const baseTooltip = {
    backgroundColor: isEnterprise ? 'rgba(255, 255, 255, 0.98)' : isDark ? 'rgba(17, 24, 32, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    titleColor: isEnterprise ? '#0f172a' : isDark ? '#e8f4fd' : '#1e293b',
    bodyColor: isEnterprise ? '#1f77b4' : isDark ? '#00d4ff' : '#0ea5e9',
    borderColor: isEnterprise ? 'rgba(148, 163, 184, 0.55)' : isDark ? 'rgba(0, 212, 255, 0.2)' : 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    padding: 15,
    cornerRadius: 12,
    titleFont: { family: 'Syne', size: 15, weight: 'bold' as const },
    bodyFont: { family: 'DM Mono', size: 14, weight: 'bold' as const },
    callbacks: {
      label: (context: any) => {
        const val = context.parsed?.y ?? context.parsed ?? 0;
        const t = (title || '').toLowerCase();
        const l = (context.dataset.label || '').toLowerCase();
        const label = context.dataset.label || '';

        // Detectar tipo de columna
        const isTime = t.includes('tiempo') || t.includes('entrega') || t.includes(' d.');
        const isPercent = t.includes('%') || t.includes('margen') || t.includes('mom') || l.includes('calificacion') || l.includes('rating');
        const isMoney = t.includes('costo') || t.includes('precio') || t.includes('salario') || t.includes('cost') || t.includes('price') || t.includes('salary') || t.includes('revenue') || t.includes('ingreso') || t.includes('venta') || l.includes('costo') || l.includes('precio') || l.includes('salario');

        if (isTime) return `${label}: ${Number(val).toFixed(1)} d`;
        if (isPercent) return `${label}: ${Number(val).toFixed(1)}%`;
        if (isMoney && Number(val) >= 1000) return `${label}: $${Number(val).toLocaleString()}`;
        if (isMoney) return `${label}: $${Number(val).toFixed(2)}`;
        return `${label}: ${Number(val).toLocaleString()}`;
      }
    }
  };

  const onClickHandler = onElementClick
    ? (_event: any, elements: any[]) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const label = labels[idx];
          if (label !== undefined) onElementClick(String(label));
        }
      }
    : undefined;

  // ──────────────────────────────────────────────
  // SCATTER
  // ──────────────────────────────────────────────
  if (type === 'scatter') {
    const scatterOptions: ChartOptions<'scatter'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { family: 'DM Mono', size: 12 },
            color: isEnterprise ? '#8bafc7' : isDark ? '#8bafc7' : '#64748b',
          }
        },
        tooltip: {
          ...baseTooltip,
          callbacks: {
            label: (ctx: any) => {
              const { x, y } = ctx.parsed;
              return `x: ${Number(x).toLocaleString()}  y: ${Number(y).toLocaleString()}`;
            }
          }
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          border: { display: false },
          ticks: { color: tickColor, font: { family: 'DM Mono', size: 12 } },
        },
        y: {
          grid: { color: gridColor },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { family: 'DM Mono', size: 12 },
            callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v,
          },
        },
      },
    };

    const scatterData = {
      datasets: datasets.map((ds, i) => {
        const color = colorPalette[i % colorPalette.length];
        return {
          label: ds.label,
          data: ds.data as { x: number; y: number }[],
          backgroundColor: color.glow,
          borderColor: color.border,
          borderWidth: 1.5,
          pointRadius: 5,
          pointHoverRadius: 8,
        };
      }),
    };

    return <Scatter ref={chartRef} data={scatterData} options={scatterOptions} />;
  }

  // ──────────────────────────────────────────────
  // CIRCULAR (pie / donut / doughnut)
  // ──────────────────────────────────────────────
  if (type === 'pie' || type === 'donut' || type === 'doughnut') {
    const circularOptions: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500, easing: 'easeOutQuart' },
      onClick: onClickHandler,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { family: 'DM Mono', size: 12 },
            color: isDark ? '#8bafc7' : '#64748b',
          }
        },
        tooltip: baseTooltip as any,
      },
    };

    const circularData = {
      labels,
      datasets: [{
        data: datasets[0]?.data as number[] || [],
        backgroundColor: labels.map((_, i) => colorPalette[i % colorPalette.length].border + 'cc'),
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 20,
      }]
    };

    // `pie` debe ser círculo completo; `Doughnut` aplica recorte por defecto y puede verse “vacío” con pocos datos.
    if (type === 'pie') {
      return <Pie ref={chartRef} data={circularData as any} options={circularOptions as any} />;
    }
    return <Doughnut ref={chartRef} data={circularData} options={circularOptions} />;
  }

  // ──────────────────────────────────────────────
  // BAR / LINE (shared options)
  // ──────────────────────────────────────────────
  const benchmarkMode = (() => {
    if (!isEnterprise) return null;
    if (type !== 'bar' && type !== 'line' && type !== 'area') return null;
    if (datasets.length !== 1) return null;
    const base = datasets[0];
    const values = (base?.data as any[] | undefined)?.map((n) => (typeof n === 'number' ? n : Number(n))) ?? [];
    const finite = values.filter((n) => Number.isFinite(n)) as number[];
    if (finite.length < 2) return null;
    if (benchmarkModeProp === 'none') return null;
    if (benchmarkModeProp === 'previousPeriod') return 'previousPeriod';
    if (benchmarkModeProp === 'globalAvg') return 'globalAvg';
    // auto o undefined → inferir
    return inferBenchmarkMode(labels, finite);
  })();

  const medianOf = (arr: number[]): number => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

  const shouldUseMedianBenchmark = (finite: number[], avg: number): boolean => {
    if (finite.length < 5) return false;
    const med = medianOf(finite);
    const max = Math.max(...finite);
    // Heurística: si hay outliers fuertes o avg se distorsiona, usa mediana.
    if (med !== 0 && max / Math.abs(med) >= 4) return true;
    if (avg !== 0 && Math.abs(avg - med) / Math.abs(avg) >= 0.25) return true;
    return false;
  };

  const effectiveDatasets = (() => {
    if (!isEnterprise) return datasets;
    if (type !== 'bar' && type !== 'line' && type !== 'area') return datasets;
    if (datasets.length !== 1) return datasets;
    const base = datasets[0];
    const values = (base?.data as any[] | undefined)?.map((n) => (typeof n === 'number' ? n : Number(n))) ?? [];
    const finite = values.filter((n) => Number.isFinite(n)) as number[];
    if (finite.length < 2) return datasets;
    const mode = benchmarkMode ?? 'globalAvg';
    const avg = finite.reduce((a, b) => a + b, 0) / finite.length;
    const med = medianOf(finite);
    const useMedian = mode === 'globalAvg' && shouldUseMedianBenchmark(finite, avg);
    const prev = values.map((v, i) => (i === 0 ? null : (Number.isFinite(values[i - 1]) ? values[i - 1] : null)));
    return [
      { ...base, label: base.label || 'Actual' },
      {
        label:
          mode === 'previousPeriod'
            ? 'Benchmark (periodo anterior)'
            : useMedian
              ? 'Benchmark (mediana)'
              : 'Benchmark (promedio)',
        data: mode === 'previousPeriod' ? prev : labels.map(() => (useMedian ? med : avg)),
        __execRole: 'benchmark',
      } as any,
    ];
  })();

  const sharedOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    // En Enterprise: bajamos el plot (más padding arriba) y quitamos aire abajo (leyenda es externa).
    layout: {
      padding: isEnterprise
        ? { top: 26, bottom: 10, left: 5, right: 10 }
        : { top: 10, bottom: 22, left: 5, right: 10 },
    },
    animation: { duration: 1800, easing: 'easeOutQuart' },
    onClick: onClickHandler,
    plugins: {
      legend: {
        // En Enterprise se usa leyenda externa (a la derecha) para ganar altura y no recortar
        display: !isEnterprise && effectiveDatasets.length > 1,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { family: 'DM Mono', size: 12, weight: '500' },
          color: isDark ? '#8bafc7' : '#64748b',
        }
      },
      tooltip: {
        ...baseTooltip,
        callbacks: {
          ...((baseTooltip as any).callbacks ?? {}),
          afterLabel: (ctx: any) => {
            if (!isEnterprise) return '';
            if (showDelta === false) return '';
            if (ctx?.dataset?.__execRole === 'benchmark') return '';
            const i = ctx.dataIndex;
            const bench = effectiveDatasets.find((d: any) => d?.__execRole === 'benchmark');
            if (!bench) return '';
            const b = Array.isArray(bench.data) ? (bench.data[i] as any) : null;
            const a = ctx.parsed?.y ?? ctx.parsed ?? null;
            const bn = typeof b === 'number' ? b : Number(b);
            const an = typeof a === 'number' ? a : Number(a);
            if (!Number.isFinite(bn) || !Number.isFinite(an) || bn === 0) return '';
            const pct = ((an - bn) / Math.abs(bn)) * 100;
            const label = (typeof deltaLabel === 'string' && deltaLabel.trim()) ? deltaLabel.trim() : 'vs Benchmark';
            const dir = pct >= 0 ? 'Arriba' : 'Abajo';
            const sign = pct >= 0 ? '+' : '';
            return `${dir} del ${label}: ${sign}${pct.toFixed(1)}%`;
          },
        },
      } as any,
    },
    scales: {
      x: {
        grid: { display: isEnterprise, color: gridColor },
        ticks: {
          color: tickColor,
          font: { family: 'DM Mono', size: compact ? 10 : 12 },
          display: compact ? false : true,
          autoSkip: true,
          maxTicksLimit: compact ? 6 : 10,
          padding: 8,
        }
      },
      y: {
        grid: { color: gridColor, drawTicks: false },
        border: { display: isEnterprise, color: 'rgba(26, 42, 58, 0.6)' },
        ticks: {
          color: tickColor,
          font: { family: 'DM Mono', size: compact ? 10 : 12 },
          callback: (value: any) => value >= 1000 ? (value / 1000).toFixed(0) + 'K' : value
        }
      }
    }
  };

  const chartPlugins = execAnnotationsPlugin ? [execAnnotationsPlugin] : undefined;

  const chartData: ChartData<any> = {
    labels,
    datasets: effectiveDatasets.map((ds: any, i) => {
      const isBenchmark = ds?.__execRole === 'benchmark';
      const color = colorPalette[i % colorPalette.length];
      const shouldAutoMultiBars =
        type === 'bar' &&
        !isBenchmark &&
        (barColorMode
          ? barColorMode === 'autoMulti'
          : // Default: solo Enterprise usa multicolor automático
            isEnterprise);
      return {
        label: ds.label,
        data: ds.data,
        type: isBenchmark ? 'line' : undefined,
        borderColor: isBenchmark
          ? isEnterprise
            ? (benchmarkColor || 'rgba(100, 116, 139, 0.9)')
            : isDark
            ? 'rgba(148, 163, 184, 0.85)'
            : 'rgba(100, 116, 139, 0.85)'
          : isEnterprise
          ? (barSingleColor || '#1f77b4')
          : color.border,
        backgroundColor:
          isBenchmark
            ? 'rgba(0,0,0,0)'
            : type === 'bar'
              ? shouldAutoMultiBars
                ? labels.map((_, j) => colorPalette[j % colorPalette.length].border + '66')
                : isEnterprise
                  ? (barSingleColor ? `${barSingleColor}66` : 'rgba(31, 119, 180, 0.35)')
                  : color.border + 'bb'
              : (context: any) => {
                  const ctx = context.chart?.ctx;
                  if (!ctx) return color.bg;
                  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
                  gradient.addColorStop(0, isEnterprise ? 'rgba(31, 119, 180, 0.06)' : color.bg);
                  gradient.addColorStop(1, 'rgba(0,0,0,0)');
                  return gradient;
                },
        borderWidth: isBenchmark ? 2 : type === 'line' || type === 'area' ? (isEnterprise ? 2 : 3) : 1,
        borderDash: isBenchmark ? [6, 4] : undefined,
        borderRadius: isBenchmark ? 0 : type === 'bar' ? 4 : 0,
        categoryPercentage: type === 'bar' ? (compact ? 0.92 : 0.8) : undefined,
        barPercentage: type === 'bar' ? (compact ? 0.9 : 0.7) : undefined,
        pointRadius: isBenchmark ? 0 : 0,
        pointHoverRadius: 6,
        fill: isBenchmark ? false : type === 'line' || type === 'area',
        tension: 0.4,
      };
    })
  };

  if (type === 'line' || type === 'area') {
    return <Line ref={chartRef} data={chartData} options={sharedOptions} plugins={chartPlugins as any} />;
  }

  const hasMixedTypes = Array.isArray(chartData.datasets) && chartData.datasets.some((d: any) => d?.type && d.type !== 'bar');
  if (type === 'bar' && hasMixedTypes) {
    // Para charts mixtos (bar + line benchmark) usa el componente genérico.
    return <ReactChart ref={chartRef} type="bar" data={chartData as any} options={sharedOptions as any} plugins={chartPlugins as any} />;
  }

  return <Bar ref={chartRef} data={chartData} options={sharedOptions} plugins={chartPlugins as any} />;
}

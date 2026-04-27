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
import { Bar, Line, Doughnut, Scatter } from 'react-chartjs-2';

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
}

const PALETTE = [
  { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', glow: 'rgba(14, 165, 233, 0.5)' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', glow: 'rgba(139, 92, 246, 0.5)' },
  { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', glow: 'rgba(236, 72, 153, 0.5)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', glow: 'rgba(16, 185, 129, 0.5)' },
  { border: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', glow: 'rgba(249, 115, 22, 0.5)' },
];

export default function ChartEngine({ type, labels, datasets, title, theme = 'modern', isDark = true, onElementClick }: Props) {
  const chartRef = useRef<any>(null);

  const isEnterprise = theme === 'enterprise';
  const tickColor = isEnterprise ? '#4a6b82' : isDark ? '#4a6b82' : '#94a3b8';
  const gridColor = isEnterprise ? 'rgba(26, 42, 58, 0.55)' : isDark ? 'rgba(26, 42, 58, 0.3)' : 'rgba(226, 232, 240, 0.5)';

  const baseTooltip = {
    backgroundColor: isEnterprise ? '#111820' : isDark ? 'rgba(17, 24, 32, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    titleColor: isEnterprise ? '#00d4ff' : isDark ? '#e8f4fd' : '#1e293b',
    bodyColor: isEnterprise ? '#8bafc7' : isDark ? '#00d4ff' : '#0ea5e9',
    borderColor: isEnterprise ? '#1a2a3a' : isDark ? 'rgba(0, 212, 255, 0.2)' : 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    padding: 15,
    cornerRadius: 12,
    titleFont: { family: 'Syne', size: 15, weight: 'bold' as const },
    bodyFont: { family: 'DM Mono', size: 14, weight: 'bold' as const },
    callbacks: {
      label: (context: any) => {
        const val = context.parsed?.y ?? context.parsed ?? 0;
        const t = (title || '').toLowerCase();
        const label = context.dataset.label || '';
        if (t.includes('tiempo') || t.includes('entrega') || t.includes(' d.')) return `${label}: ${Number(val).toFixed(1)} d`;
        if (t.includes('%') || t.includes('margen') || t.includes('mom')) return `${label}: ${Number(val).toFixed(1)}%`;
        if (Number(val) >= 1000) return `${label}: $${Number(val).toLocaleString()}`;
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
        const color = PALETTE[i % PALETTE.length];
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
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length].border + 'cc'),
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 20,
      }]
    };

    return <Doughnut ref={chartRef} data={circularData} options={circularOptions} />;
  }

  // ──────────────────────────────────────────────
  // BAR / LINE (shared options)
  // ──────────────────────────────────────────────
  const sharedOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, bottom: 5, left: 5, right: 10 } },
    animation: { duration: 1800, easing: 'easeOutQuart' },
    onClick: onClickHandler,
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { family: 'DM Mono', size: 12, weight: '500' },
          color: isDark ? '#8bafc7' : '#64748b',
        }
      },
      tooltip: baseTooltip,
    },
    scales: {
      x: {
        grid: { display: isEnterprise, color: gridColor },
        ticks: {
          color: tickColor,
          font: { family: 'DM Mono', size: 12 },
          autoSkip: true,
          maxTicksLimit: 10,
        }
      },
      y: {
        grid: { color: gridColor, drawTicks: false },
        border: { display: isEnterprise, color: 'rgba(26, 42, 58, 0.6)' },
        ticks: {
          color: tickColor,
          font: { family: 'DM Mono', size: 12 },
          callback: (value: any) => value >= 1000 ? (value / 1000).toFixed(0) + 'K' : value
        }
      }
    }
  };

  const chartData: ChartData<any> = {
    labels,
    datasets: datasets.map((ds, i) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        label: ds.label,
        data: ds.data,
        borderColor: isEnterprise ? '#00d4ff' : color.border,
        backgroundColor: (context: any) => {
          if (type === 'bar') return isEnterprise ? 'rgba(0, 212, 255, 0.35)' : color.border + 'bb';
          const ctx = context.chart?.ctx;
          if (!ctx) return color.bg;
          const gradient = ctx.createLinearGradient(0, 0, 0, 280);
          gradient.addColorStop(0, isEnterprise ? 'rgba(0, 212, 255, 0.06)' : color.bg);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          return gradient;
        },
        borderWidth: type === 'line' || type === 'area' ? (isEnterprise ? 2 : 3) : 1,
        borderRadius: type === 'bar' ? 4 : 0,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: type === 'line' || type === 'area',
        tension: 0.4,
      };
    })
  };

  if (type === 'line' || type === 'area') {
    return <Line ref={chartRef} data={chartData} options={sharedOptions} />;
  }

  return <Bar ref={chartRef} data={chartData} options={sharedOptions} />;
}

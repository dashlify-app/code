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
import { Bar, Line, Doughnut } from 'react-chartjs-2';

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
  datasets: { label: string; data: number[] }[];
  title?: string;
  theme?: string;
  isDark?: boolean;
}

const PALETTE = [
  { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', glow: 'rgba(14, 165, 233, 0.4)' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', glow: 'rgba(139, 92, 246, 0.4)' },
  { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', glow: 'rgba(236, 72, 153, 0.4)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', glow: 'rgba(16, 185, 129, 0.4)' },
];

export default function ChartEngine({ type, labels, datasets, title, isDark = true }: Props) {
  const chartRef = useRef<any>(null);

  const chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, bottom: 5, left: 5, right: 10 } },
    animation: { duration: 2000, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        display: datasets.length > 1 || type === 'pie' || type === 'donut' || type === 'doughnut',
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { family: 'DM Mono', size: 10, weight: '500' },
          color: isDark ? '#8bafc7' : '#64748b'
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(17, 24, 32, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e8f4fd' : '#1e293b',
        bodyColor: isDark ? '#00d4ff' : '#0ea5e9',
        borderColor: isDark ? 'rgba(0, 212, 255, 0.2)' : 'rgba(14, 165, 233, 0.2)',
        borderWidth: 1,
        padding: 15,
        cornerRadius: 12,
        titleFont: { family: 'Syne', size: 14, weight: '700' },
        bodyFont: { family: 'DM Mono', size: 13, weight: '600' },
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y ?? context.parsed;
            const t = (title || '').toLowerCase();
            const label = context.dataset.label || '';
            if (t.includes('tiempo') || t.includes('entrega')) return `${label}: ${val.toFixed(1)} d`;
            if (t.includes('%') || t.includes('margen')) return `${label}: ${val.toFixed(1)}%`;
            return `${label}: ${val >= 1000 ? '$' + val.toLocaleString() : val}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: type !== 'pie' && type !== 'donut' && type !== 'doughnut',
        grid: { display: false },
        ticks: {
          color: isDark ? '#4a6b82' : '#94a3b8',
          font: { family: 'DM Mono', size: 10 },
          autoSkip: true,
          maxTicksLimit: 8
        }
      },
      y: {
        display: type !== 'pie' && type !== 'donut' && type !== 'doughnut',
        grid: { color: isDark ? 'rgba(26, 42, 58, 0.3)' : 'rgba(226, 232, 240, 0.5)', drawTicks: false },
        border: { display: false },
        ticks: {
          color: isDark ? '#4a6b82' : '#94a3b8',
          font: { family: 'DM Mono', size: 10 },
          callback: (value: any) => value >= 1000 ? (value/1000).toFixed(0) + 'K' : value
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
        borderColor: color.border,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, color.bg);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          return gradient;
        },
        borderWidth: type === 'line' ? 4 : 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.45,
        borderRadius: 6,
      };
    })
  };

  if (type === 'pie' || type === 'donut' || type === 'doughnut') {
    // Para circulares, necesitamos una estructura de colores diferente (por segmento)
    const circularData = {
      labels,
      datasets: [{
        data: datasets[0]?.data || [],
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length].border + 'cc'),
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 20
      }]
    };
    return <Doughnut ref={chartRef} data={circularData} options={chartOptions} />;
  }

  if (type === 'line') {
    return <Line ref={chartRef} data={chartData} options={chartOptions} />;
  }

  return <Bar ref={chartRef} data={chartData} options={chartOptions} />;
}

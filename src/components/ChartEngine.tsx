'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartEngineProps {
  type: string;
  data: { name: string; value: number }[];
  title?: string;
  theme?: 'modern' | 'enterprise' | 'dark';
}

export default function ChartEngine({ type, data, title, theme = 'modern' }: ChartEngineProps) {
  const isDark = theme === 'dark' || (typeof window !== 'undefined' && document.body.classList.contains('dark-theme'));
  
  const labels = data.map(d => d.name);
  const values = data.map(d => d.value);

  // Colores Premium del Estático
  const colors = {
    blue:   { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', glow: 'rgba(14, 165, 233, 0.4)' },
    green:  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', glow: 'rgba(16, 185, 129, 0.4)' },
    orange: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', glow: 'rgba(249, 115, 22, 0.4)' },
    purple: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', glow: 'rgba(139, 92, 246, 0.4)' },
    dark:   { border: '#00d4ff', bg: 'rgba(0, 212, 255, 0.15)', glow: 'rgba(0, 212, 255, 0.4)' }
  };

  const activeColor = isDark ? colors.dark : colors.blue;

  const chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 10, bottom: 5, left: 5, right: 10 }
    },
    animation: {
      duration: 2000,
      easing: 'easeOutQuart'
    },
    plugins: {
      legend: {
        display: type === 'pie' || type === 'donut' || type === 'doughnut',
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
        displayColors: false,
        titleFont: { family: 'Syne', size: 14, weight: '700' },
        bodyFont: { family: 'DM Mono', size: 13, weight: '600' },
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            const title = (context.chart.options.plugins.title?.text || '').toLowerCase();
            const label = context.dataset.label || '';
            
            // Lógica de "Galleta": Detección de unidad por contexto
            if (title.includes('tiempo') || title.includes('entrega') || title.includes('días') || title.includes('days')) {
              return `${label}: ${val.toFixed(1)} días`;
            }
            if (title.includes('%') || title.includes('porcentaje') || title.includes('margen') || title.includes('tasa')) {
              return `${label}: ${val.toFixed(1)}%`;
            }
            if (title.includes('precio') || title.includes('venta') || title.includes('costo') || title.includes('monto') || title.includes('$')) {
              return `${label}: $${val.toLocaleString()}`;
            }
            
            return `${label}: ${val.toLocaleString()}`;
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
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      },
      y: {
        display: type !== 'pie' && type !== 'donut' && type !== 'doughnut',
        grid: {
          color: isDark ? 'rgba(26, 42, 58, 0.3)' : 'rgba(226, 232, 240, 0.5)',
          drawTicks: false
        },
        border: { display: false },
        ticks: {
          color: isDark ? '#4a6b82' : '#94a3b8',
          font: { family: 'DM Mono', size: 10 },
          padding: 10,
          callback: function(value: any) {
            const title = (this.chart.options.plugins.title?.text || '').toLowerCase();
            const isMoney = title.includes('precio') || title.includes('venta') || title.includes('costo') || title.includes('monto') || title.includes('$');
            const isTime = title.includes('tiempo') || title.includes('entrega') || title.includes('días');
            
            let formatted = value;
            if (value >= 1_000_000) formatted = (value / 1_000_000).toFixed(1) + 'M';
            else if (value >= 1_000) formatted = (value / 1_000).toFixed(0) + 'K';
            
            if (isMoney) return `$${formatted}`;
            if (isTime) return `${formatted}d`;
            return formatted;
          }
        }
      }
    }
  };

  const chartData: ChartData<any> = {
    labels,
    datasets: [{
      label: title || 'Métrica',
      data: values,
      borderColor: activeColor.border,
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, activeColor.bg);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        return gradient;
      },
      borderWidth: 4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: activeColor.border,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 3,
      fill: true,
      tension: 0.45,
      shadowBlur: 10,
      shadowColor: activeColor.glow,
    }]
  };

  switch (type) {
    case 'bar':
      return (
        <Bar 
          data={{
            ...chartData,
            datasets: [{
              ...chartData.datasets[0],
              borderRadius: 6,
              backgroundColor: data.map((_, i) => i === data.length - 1 ? activeColor.border : `${activeColor.border}33`),
              borderWidth: 0,
            }]
          }} 
          options={chartOptions} 
        />
      );
    case 'pie':
    case 'donut':
    case 'doughnut':
      return (
        <Doughnut 
          data={{
            ...chartData,
            datasets: [{
              ...chartData.datasets[0],
              backgroundColor: [
                '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#64748b'
              ],
              borderWidth: isDark ? 2 : 4,
              borderColor: isDark ? '#0d1219' : '#fff',
              hoverOffset: 15
            }]
          }}
          options={{
            ...chartOptions,
            cutout: type === 'pie' ? '0%' : '70%',
            plugins: { ...chartOptions.plugins, legend: { display: true, position: 'bottom', labels: { font: { family: 'DM Mono', size: 9 } } } }
          }}
        />
      );
    case 'line':
    case 'area':
    default:
      return <Line data={chartData} options={chartOptions} />;
  }
}

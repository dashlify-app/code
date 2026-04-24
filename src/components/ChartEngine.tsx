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
    animation: {
      duration: 1500,
      easing: 'easeOutQuart'
    },
    plugins: {
      legend: {
        display: false // Mantenemos minimalismo
      },
      tooltip: {
        backgroundColor: isDark ? '#111820' : '#ffffff',
        titleColor: isDark ? '#e8f4fd' : '#1e293b',
        bodyColor: isDark ? '#8bafc7' : '#475569',
        borderColor: isDark ? '#1a2a3a' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        bodyFont: { family: 'DM Mono' }
      }
    },
    scales: {
      x: {
        display: type !== 'pie' && type !== 'donut' && type !== 'doughnut',
        grid: { display: false },
        ticks: {
          color: isDark ? '#4a6b82' : '#94a3b8',
          font: { family: 'DM Mono', size: 9 },
          maxRotation: 0
        }
      },
      y: {
        display: type !== 'pie' && type !== 'donut' && type !== 'doughnut',
        grid: {
          color: isDark ? 'rgba(26, 42, 58, 0.4)' : 'rgba(226, 232, 240, 0.6)',
          drawTicks: false
        },
        ticks: {
          color: isDark ? '#4a6b82' : '#94a3b8',
          font: { family: 'DM Mono', size: 9 },
          padding: 8
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
      backgroundColor: activeColor.bg,
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: activeColor.border,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      fill: true,
      tension: 0.4, // Curva suave de "Doctorado"
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

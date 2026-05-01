'use client';

import React from 'react';

interface AddChartCardProps {
  theme?: 'modern' | 'enterprise' | 'dark';
  isDark?: boolean;
  onClick: () => void;
}

export function AddChartCard({ theme = 'modern', isDark = false, onClick }: AddChartCardProps) {
  const borderColor = isDark ? 'var(--border, #334155)' : 'var(--border, #cbd5e1)';
  const hoverBorderColor = 'var(--accent, #0ea5e9)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const bgColor = isDark ? 'var(--surface2, #1e293b)' : 'var(--surface2, #f1f5f9)';
  const hoverBgColor = isDark ? 'var(--surface3, #334155)' : 'var(--surface3, #e2e8f0)';

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: '12px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: bgColor,
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = hoverBorderColor;
        el.style.background = hoverBgColor;
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = borderColor;
        el.style.background = bgColor;
        el.style.transform = 'translateY(0)';
      }}
      aria-label="Crear nueva gráfica"
    >
      <div style={{ fontSize: '48px', fontWeight: 'bold', color: hoverBorderColor }}>
        +
      </div>
      <div
        style={{
          textAlign: 'center',
          color: textColor,
          fontSize: '14px',
          lineHeight: '1.4',
          fontWeight: 500,
        }}
      >
        Crear una nueva gráfica
        <br />
        con los datos del dashboard
      </div>
    </div>
  );
}

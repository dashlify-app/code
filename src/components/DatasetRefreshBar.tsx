'use client';

import React, { useState, useEffect } from 'react';
import { GoogleSheetsDataset } from '@/types/dataset';
import { formatLastRefreshTime, getTimeUntilNextRefresh } from '@/lib/googleSheetsSync';

interface DatasetRefreshBarProps {
  dataset: GoogleSheetsDataset;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

export function DatasetRefreshBar({ dataset, onRefresh, isRefreshing = false }: DatasetRefreshBarProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState<{ minutes: number; seconds: number } | null>(null);

  // Actualizar contador de próximo refresh
  useEffect(() => {
    const interval = setInterval(() => {
      const timeUntil = getTimeUntilNextRefresh(dataset);
      setNextRefreshIn(timeUntil);
    }, 1000);

    return () => clearInterval(interval);
  }, [dataset]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Error refrescando dataset:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const lastRefreshText = formatLastRefreshTime(dataset.lastRefreshedAt);
  const isLoading = refreshing || isRefreshing;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 16px',
        background: 'var(--surface2)',
        borderRadius: '8px',
        fontSize: '13px',
        flexWrap: 'wrap',
      }}
    >
      {/* Info de última actualización */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
        <span>🕐</span>
        <span>
          Última actualización: <strong>{lastRefreshText}</strong>
        </span>
      </div>

      {/* Botón de refresh manual */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        style={{
          padding: '6px 12px',
          background: isLoading ? 'var(--surface3)' : 'var(--accent)',
          color: isLoading ? 'var(--text2)' : 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: isLoading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.opacity = '1';
          }
        }}
      >
        {isLoading ? (
          <>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            Sincronizando...
          </>
        ) : (
          <>
            <span>🔄</span>
            Refrescar ahora
          </>
        )}
      </button>

      {/* Badge de auto-refresh */}
      {dataset.isAutoRefresh && dataset.refreshInterval && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            color: 'var(--text2)',
            fontSize: '12px',
          }}
        >
          <span>⏰</span>
          <span>Auto: cada {dataset.refreshInterval} min</span>
          {nextRefreshIn && nextRefreshIn.minutes > 0 && (
            <span style={{ opacity: 0.7 }}>
              (en {nextRefreshIn.minutes}:{String(nextRefreshIn.seconds).padStart(2, '0')})
            </span>
          )}
        </div>
      )}

      {/* Spinner CSS */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

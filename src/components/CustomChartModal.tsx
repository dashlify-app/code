'use client';

import React, { useState } from 'react';
import { devLog } from '@/lib/logger';

export interface PendingChart {
  title: string;
  type: string;
  x: string;
  y: string;
  aggregate: string;
  description: string;
  config: Record<string, any>;
}

interface CustomChartModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (chart: PendingChart) => void;
  availableFields: string[];
  datasetName: string;
}

export function CustomChartModal({
  open,
  onClose,
  onConfirm,
  availableFields,
  datasetName,
}: CustomChartModalProps) {
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [validating, setValidating] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [error, setError] = useState('');

  const handleValidateWithAI = async () => {
    if (!xField || !yField || !userDescription.trim()) {
      setError('Por favor completa todos los campos');
      return;
    }

    setValidating(true);
    setError('');
    try {
      const res = await fetch('/api/validate-custom-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xField,
          yField,
          userDescription,
          datasetName,
          availableFields,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Validation failed');
      }

      const data = await res.json();
      setAiResponse(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error validando con IA. Intenta nuevamente.'
      );
    } finally {
      setValidating(false);
    }
  };

  const handleConfirm = () => {
    devLog('[CustomChartModal] handleConfirm called, aiResponse:', aiResponse);

    if (!aiResponse?.approved) {
      devLog('[CustomChartModal] IA did not approve, setting error');
      setError('IA debe aprobar antes de confirmar');
      return;
    }

    const config: Record<string, any> = {
      x: xField,
      y: yField,
      aggregate: aiResponse.aggregate || 'sum',
      sampleData: [],
      datasetName,
      datasetIndex: 0,
    };

    devLog('[CustomChartModal] Calling onConfirm with:', { title: aiResponse.title, type: aiResponse.chartType });

    onConfirm({
      title: aiResponse.title || `${yField} por ${xField}`,
      type: aiResponse.chartType || 'bar',
      x: xField,
      y: yField,
      aggregate: aiResponse.aggregate || 'sum',
      description: userDescription,
      config,
    });

    devLog('[CustomChartModal] onConfirm called, cleaning up and closing');
    setXField('');
    setYField('');
    setUserDescription('');
    setAiResponse(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg, #f8fafc)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
          }}
        >
          <div style={{ fontSize: '24px' }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)' }}>
              Crear Gráfica Personalizada
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text2)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!aiResponse && (
            <>
              {/* X-Axis Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  Eje X (Dimensión)
                </label>
                <select
                  value={xField}
                  onChange={(e) => {
                    setXField(e.target.value);
                    setError('');
                  }}
                  disabled={validating}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '8px',
                    background: 'var(--bg, white)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: validating ? 'not-allowed' : 'pointer',
                    opacity: validating ? 0.6 : 1,
                  }}
                >
                  <option value="">— Selecciona columna —</option>
                  {availableFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Y-Axis Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  Eje Y (Métrica)
                </label>
                <select
                  value={yField}
                  onChange={(e) => {
                    setYField(e.target.value);
                    setError('');
                  }}
                  disabled={validating}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '8px',
                    background: 'var(--bg, white)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: validating ? 'not-allowed' : 'pointer',
                    opacity: validating ? 0.6 : 1,
                  }}
                >
                  <option value="">— Selecciona columna —</option>
                  {availableFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  ¿Qué quieres analizar?
                </label>
                <textarea
                  value={userDescription}
                  onChange={(e) => {
                    setUserDescription(e.target.value);
                    setError('');
                  }}
                  placeholder="Ej: Quiero ver el promedio de salarios por departamento..."
                  disabled={validating}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '8px',
                    background: 'var(--bg, white)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    opacity: validating ? 0.6 : 1,
                    cursor: validating ? 'not-allowed' : 'text',
                  }}
                />
                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: 4, color: 'var(--text2)' }}>
                  Describe qué insight esperas obtener
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ color: '#ef4444', fontSize: '14px', padding: '8px 12px', background: '#fee2e2', borderRadius: '6px' }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={onClose}
                  disabled={validating}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: validating ? 'not-allowed' : 'pointer',
                    opacity: validating ? 0.6 : 1,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleValidateWithAI}
                  disabled={validating || !xField || !yField || !userDescription.trim()}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background:
                      validating || !xField || !yField || !userDescription.trim()
                        ? 'var(--accent, #0ea5e9)'
                        : 'var(--accent, #0ea5e9)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor:
                      validating || !xField || !yField || !userDescription.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      validating || !xField || !yField || !userDescription.trim() ? 0.5 : 1,
                  }}
                >
                  {validating ? 'Validando...' : 'Validar con IA'}
                </button>
              </div>
            </>
          )}

          {/* AI Confirmation Stage */}
          {aiResponse && (
            <>
              <div
                style={{
                  padding: '12px',
                  background: 'var(--surface3, #e2e8f0)',
                  borderRadius: '8px',
                  borderLeft: '4px solid var(--accent, #0ea5e9)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text)' }}>
                  ✅ IA Validó tu solicitud:
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, opacity: 0.9, color: 'var(--text2)' }}>
                  {aiResponse.suggestion}
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  opacity: 0.7,
                  color: 'var(--text2)',
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>Tipo:</strong> {aiResponse.chartType || 'bar'}
                </span>
                <span>
                  <strong>Agregación:</strong> {aiResponse.aggregate || 'sum'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => {
                    setAiResponse(null);
                    setError('');
                  }}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ← Volver
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'var(--accent, #0ea5e9)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Crear Gráfica
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { MultiDatasetAnalysis, ProposedWidget } from '@/lib/types/multiDataset';
import RelationshipDiagram from './RelationshipDiagram';

interface Props {
  analysis: MultiDatasetAnalysis;
  files: Array<{ name: string; headers: string[]; sampleData: any[] }>;
  onCreateWidgets: (widgets: ProposedWidget[]) => void;
  onBack: () => void;
}

export default function MultiDatasetAnalysisResult({
  analysis,
  files,
  onCreateWidgets,
  onBack,
}: Props) {
  const [selectedWidgets, setSelectedWidgets] = useState<Set<number>>(
    new Set(analysis.proposedWidgets.map((_, i) => i))
  );

  const toggleWidget = (idx: number) => {
    const next = new Set(selectedWidgets);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedWidgets(next);
  };

  const handleCreate = () => {
    const selected = Array.from(selectedWidgets)
      .map(idx => analysis.proposedWidgets[idx])
      .filter(w => w);
    onCreateWidgets(selected);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="text-sm font-mono underline opacity-60 hover:opacity-100 transition-opacity"
        >
          ← Volver
        </button>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Análisis Cruzado Multi-Dataset
        </h2>
        <p className="text-sm opacity-70">{analysis.narrative}</p>
      </div>

      {/* Resumen de Datasets y Relaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Datasets */}
        <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
          <div className="text-xs font-mono mb-3 opacity-70">📊 DATASETS ANALIZADOS ({analysis.datasets.length})</div>
          <div className="space-y-2">
            {analysis.datasets.map((ds, i) => (
              <div key={i} className="text-xs">
                <div className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {ds.name}
                </div>
                <div className="text-[11px] opacity-60 mt-0.5">
                  Rol: <span className="font-mono">{ds.role}</span> • {ds.columnCount} columnas • {ds.recordCount.toLocaleString()} registros
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPIs y Dominio */}
        <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
          <div className="text-xs font-mono mb-3 opacity-70">🎯 DOMINIO & KPIs</div>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {analysis.domain}
            </div>
            <div className="mt-2 space-y-1">
              {analysis.mainKPIs.map((kpi, i) => (
                <div key={i} className="text-xs flex items-start gap-2">
                  <span className="text-[#4ade80] mt-0.5">✓</span>
                  <span>{kpi}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Relaciones Detectadas - Diagrama Visual */}
      {analysis.relationships.length > 0 && (
        <RelationshipDiagram
          datasets={analysis.datasets}
          relationships={analysis.relationships}
        />
      )}

      {/* Gráficos Propuestos */}
      <div className="space-y-3">
        <div className="text-xs font-mono opacity-70">📈 GRÁFICOS PROPUESTOS ({analysis.proposedWidgets.length})</div>

        <div className="grid grid-cols-1 gap-3">
          {analysis.proposedWidgets.map((widget, idx) => {
            const isSelected = selectedWidgets.has(idx);
            return (
              <div
                key={idx}
                onClick={() => toggleWidget(idx)}
                className="p-4 rounded-lg border-2 cursor-pointer transition-all"
                style={{
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  background: isSelected ? 'var(--surface3)' : 'var(--surface2)',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div
                    className="mt-1 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={16} style={{ color: 'var(--bg)' }} />}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>
                      {widget.title}
                    </div>
                    {widget.description && (
                      <p className="text-xs opacity-70 mt-1">{widget.description}</p>
                    )}

                    {/* Config */}
                    <div className="mt-2 space-y-1 text-xs opacity-60 font-mono">
                      <div>Tipo: {widget.type}</div>
                      {widget.datasetConfig.primary && (
                        <div>
                          Datos: <span className="opacity-90">{widget.datasetConfig.primary}</span>
                          {widget.datasetConfig.joins && widget.datasetConfig.joins.length > 0 && (
                            <>
                              {' '}
                              {widget.datasetConfig.joins.map((j, jidx) => (
                                <span key={jidx}>
                                  {' '}
                                  + <span className="opacity-90">{j.dataset}</span>
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                      {widget.config.xAxis && <div>X-Axis: {widget.config.xAxis}</div>}
                      {widget.config.yAxis && (
                        <div>Y-Axis: {Array.isArray(widget.config.yAxis) ? widget.config.yAxis.join(', ') : widget.config.yAxis}</div>
                      )}
                      {widget.config.aggregate && <div>Agregación: {widget.config.aggregate}</div>}
                    </div>
                  </div>

                  {/* Badge de prioridad */}
                  <div className="flex-shrink-0 text-xs text-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{
                        background: widget.priority >= 8 ? '#dc2626' : widget.priority >= 5 ? '#f59e0b' : '#6b7280',
                        color: 'white',
                      }}
                    >
                      {widget.priority}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-lg border transition-all"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text2)',
            background: 'transparent',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={selectedWidgets.size === 0}
          className="flex-1 px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: selectedWidgets.size > 0 ? 'var(--accent)' : 'var(--surface3)',
            color: selectedWidgets.size > 0 ? 'var(--bg)' : 'var(--text)',
          }}
        >
          Crear {selectedWidgets.size} Gráfico{selectedWidgets.size === 1 ? '' : 's'}
        </button>
      </div>

      {analysis.followUpQuestion && (
        <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--surface3)', borderLeft: '3px solid var(--accent)', color: 'var(--text2)' }}>
          💡 <span className="italic">{analysis.followUpQuestion}</span>
        </div>
      )}
    </div>
  );
}

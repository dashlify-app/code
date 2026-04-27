'use client';

import { useState } from 'react';
import { ArrowRight, Check, X, ChevronDown } from 'lucide-react';
import { MultiDatasetAnalysis, ProposedWidget } from '@/lib/types/multiDataset';
import RelationshipDiagram from './RelationshipDiagram';

interface Props {
  analysis: MultiDatasetAnalysis;
  files: Array<{ name: string; headers: string[]; sampleData: any[] }>;
  onCreateWidgets: (widgets: ProposedWidget[]) => void;
  onBack: () => void;
}

interface ExpandedWidget {
  [key: number]: boolean;
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
  const [expandedDetails, setExpandedDetails] = useState<ExpandedWidget>({});

  const toggleWidget = (idx: number) => {
    const next = new Set(selectedWidgets);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedWidgets(next);
  };

  const toggleDetails = (idx: number) => {
    setExpandedDetails(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Agrupar gráficos por categoría
  const groupedWidgets = analysis.proposedWidgets.reduce((acc, widget, idx) => {
    const category = widget.category || '💡 General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ widget, idx });
    return acc;
  }, {} as Record<string, Array<{ widget: ProposedWidget; idx: number }>>);

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

      {/* Gráficos Propuestos - Agrupados por Categoría */}
      <div className="space-y-4">
        <div className="text-xs font-mono opacity-70">📈 GRÁFICOS PROPUESTOS ({analysis.proposedWidgets.length})</div>

        {Object.entries(groupedWidgets).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <div className="text-sm font-semibold px-1" style={{ color: 'var(--accent)' }}>
              {category}
            </div>
            <div className="space-y-2">
              {items.map(({ widget, idx }) => {
                const isSelected = selectedWidgets.has(idx);
                const isExpanded = expandedDetails[idx] || false;

                return (
                  <div key={idx} className="rounded-lg border overflow-hidden transition-all"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--surface3)' : 'var(--surface2)',
                    }}>

                    {/* Header clickeable */}
                    <div
                      onClick={() => toggleWidget(idx)}
                      className="p-4 cursor-pointer hover:opacity-80 transition-opacity flex items-start gap-3"
                    >
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

                      {/* Contenido Principal */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                          {widget.title}
                          <span className="text-xs opacity-60 font-mono">({widget.type})</span>
                        </div>
                        {widget.description && (
                          <p className="text-xs opacity-70 mt-1">{widget.description}</p>
                        )}
                      </div>

                      {/* Badge de prioridad */}
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                          style={{
                            background: widget.priority >= 8 ? '#dc2626' : widget.priority >= 5 ? '#f59e0b' : '#6b7280',
                            color: 'white',
                          }}
                        >
                          {widget.priority}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDetails(idx);
                          }}
                          className="p-1 hover:opacity-70"
                        >
                          <ChevronDown
                            size={16}
                            style={{
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detalles Técnicos - Acordeón */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        <div className="space-y-2 text-xs font-mono opacity-70">
                          <div className="space-y-1">
                            <div className="font-semibold opacity-100" style={{ color: 'var(--accent)' }}>Fuente de Datos</div>
                            <div>Dataset principal: <span className="opacity-100">{widget.datasetConfig.primary}</span></div>
                            {widget.datasetConfig.joins && widget.datasetConfig.joins.length > 0 && (
                              <div>
                                <div>Joins ({widget.datasetConfig.joins.length}):</div>
                                <div className="ml-2 space-y-1">
                                  {widget.datasetConfig.joins.map((j, jidx) => (
                                    <div key={jidx}>
                                      → {j.dataset} ({j.type || 'left'} join)
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                            <div className="font-semibold opacity-100" style={{ color: 'var(--accent)' }}>Configuración</div>
                            {widget.config.xAxis && <div>Eje X: {widget.config.xAxis}</div>}
                            {widget.config.yAxis && (
                              <div>Eje Y: {Array.isArray(widget.config.yAxis) ? widget.config.yAxis.join(', ') : widget.config.yAxis}</div>
                            )}
                            {widget.config.aggregate && <div>Agregación: {widget.config.aggregate}</div>}
                          </div>

                          {widget.datasetConfig.calculations && widget.datasetConfig.calculations.length > 0 && (
                            <div className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                              <div className="font-semibold opacity-100" style={{ color: 'var(--accent)' }}>Cálculos</div>
                              {widget.datasetConfig.calculations.map((calc, cidx) => (
                                <div key={cidx}>
                                  {calc.name}: {calc.aggregate}({calc.column})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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

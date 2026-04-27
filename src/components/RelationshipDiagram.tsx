'use client';

import { useMemo } from 'react';
import { RelationshipDetected } from '@/lib/types/multiDataset';

interface Dataset {
  name: string;
  role: 'transactions' | 'dimension' | 'fact' | 'other';
  columnCount: number;
}

interface RelationshipDiagramProps {
  datasets: Dataset[];
  relationships: RelationshipDetected[];
}

export default function RelationshipDiagram({ datasets, relationships }: RelationshipDiagramProps) {
  // Calcular posiciones de los datasets en el diagrama
  const layout = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const yStep = 100;
    const xSpacing = 250;

    // Posicionar datasets en círculo
    datasets.forEach((ds, idx) => {
      const angle = (idx / datasets.length) * Math.PI * 2;
      const radius = 150;
      const centerX = 300;
      const centerY = 200;
      positions[ds.name] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    return positions;
  }, [datasets]);

  const roleColor: Record<string, string> = {
    transactions: '#ef4444', // red
    dimension: '#3b82f6', // blue
    fact: '#f59e0b', // amber
    other: '#6b7280', // gray
  };

  const roleLabel: Record<string, string> = {
    transactions: 'Hechos',
    dimension: 'Dimensión',
    fact: 'Hecho',
    other: 'Otro',
  };

  const svgWidth = 600;
  const svgHeight = 450;

  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
      <div className="text-xs font-mono mb-3 opacity-70">🔗 DIAGRAMA DE RELACIONES</div>

      <svg width={svgWidth} height={svgHeight} className="border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {/* Líneas de relaciones */}
        {relationships.map((rel, idx) => {
          const fromPos = layout[rel.from];
          const toPos = layout[rel.to];
          if (!fromPos || !toPos) return null;

          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;

          // Calcular ángulo para rotar texto
          const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x) * (180 / Math.PI);

          return (
            <g key={`rel-${idx}`}>
              {/* Línea de relación */}
              <line
                x1={fromPos.x + 50}
                y1={fromPos.y}
                x2={toPos.x - 50}
                y2={toPos.y}
                stroke={rel.confidence > 0.8 ? '#10b981' : '#f59e0b'}
                strokeWidth="2"
                markerEnd={`url(#arrowhead-${rel.confidence > 0.8 ? 'green' : 'yellow'})`}
              />

              {/* Etiqueta de la relación */}
              <text
                x={midX}
                y={midY - 5}
                fontSize="11"
                fill="var(--text2)"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {rel.relationship}
              </text>
              <text
                x={midX}
                y={midY + 10}
                fontSize="10"
                fill="var(--text3)"
                textAnchor="middle"
                fontFamily="monospace"
                style={{ pointerEvents: 'none' }}
              >
                {Object.values(rel.keys)[0]?.split('.')[1] || ''}
              </text>
            </g>
          );
        })}

        {/* Datasets */}
        {datasets.map((ds) => {
          const pos = layout[ds.name];
          if (!pos) return null;

          const width = 100;
          const height = 70;

          return (
            <g key={`dataset-${ds.name}`}>
              {/* Caja del dataset */}
              <rect
                x={pos.x - width / 2}
                y={pos.y - height / 2}
                width={width}
                height={height}
                rx="6"
                fill={roleColor[ds.role]}
                fillOpacity="0.15"
                stroke={roleColor[ds.role]}
                strokeWidth="2"
              />

              {/* Nombre */}
              <text
                x={pos.x}
                y={pos.y - 10}
                fontSize="12"
                fontWeight="bold"
                fill="var(--text)"
                textAnchor="middle"
              >
                {ds.name.substring(0, 20)}
              </text>

              {/* Rol */}
              <text
                x={pos.x}
                y={pos.y + 8}
                fontSize="10"
                fill={roleColor[ds.role]}
                textAnchor="middle"
              >
                {roleLabel[ds.role]}
              </text>

              {/* Columnas */}
              <text
                x={pos.x}
                y={pos.y + 22}
                fontSize="9"
                fill="var(--text3)"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {ds.columnCount} cols
              </text>
            </g>
          );
        })}

        {/* Flechas */}
        <defs>
          <marker
            id="arrowhead-green"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
          </marker>
          <marker
            id="arrowhead-yellow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>

      {/* Leyenda */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: '#10b981' }}></span>
          <span style={{ color: 'var(--text2)' }}>Relación fuerte (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: '#f59e0b' }}></span>
          <span style={{ color: 'var(--text2)' }}>Relación débil (&lt;80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: roleColor['transactions'], opacity: 0.3 }}></span>
          <span style={{ color: 'var(--text3)' }}>Transacciones</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: roleColor['dimension'], opacity: 0.3 }}></span>
          <span style={{ color: 'var(--text3)' }}>Dimensión</span>
        </div>
      </div>
    </div>
  );
}

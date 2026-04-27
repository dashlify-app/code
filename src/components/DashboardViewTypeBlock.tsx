'use client';

import type { SemanticViewKey } from '@/lib/semanticContext';

const VIEW_MODES: {
  key: SemanticViewKey;
  icon: string;
  name: string;
  sub: string;
}[] = [
  { key: 'business', icon: '🔥', name: 'Visión general', sub: 'Negocio primero' },
  { key: 'financial', icon: '💰', name: 'Financiero', sub: 'Precio, costo, margen' },
  { key: 'inventory', icon: '📦', name: 'Inventario', sub: 'Stock y riesgo' },
  { key: 'suppliers', icon: '🌍', name: 'Proveedores', sub: 'Origen y plazos' },
  { key: 'quality', icon: '⭐', name: 'Calidad / marca', sub: 'Rating y riesgo' },
  { key: 'temporal', icon: '📅', name: 'Temporal', sub: 'Evolución en el tiempo' },
];

type Props = {
  activeView: string;
  onSelectView: (key: SemanticViewKey) => void;
  showActive: boolean;
  hint?: string;
  className?: string;
  /** Si se pasa, solo se muestran estas vistas (p. ej. según columnas del archivo). Si no, todas. */
  enabledViewKeys?: SemanticViewKey[] | null;
};

export function DashboardViewTypeBlock({
  activeView,
  onSelectView,
  showActive,
  hint,
  className = '',
  enabledViewKeys = null,
}: Props) {
  const modes =
    enabledViewKeys && enabledViewKeys.length > 0
      ? VIEW_MODES.filter((v) => enabledViewKeys.includes(v.key))
      : VIEW_MODES;

  return (
    <div className={className}>
      <div className="sb-block" style={hint ? { marginBottom: 8 } : undefined}>
        <div className="sb-label">// Tipo de vista</div>
        <div className="dash-view-type-buttons" role="list">
          {modes.map((v) => (
            <button
              key={v.key}
              type="button"
              role="listitem"
              className={`viz-btn${showActive && activeView === v.key ? ' active' : ''}`}
              onClick={() => onSelectView(v.key)}
            >
              <span className="vb-icon">{v.icon}</span>
              <div>
                <div className="vb-name">{v.name}</div>
                <div className="vb-sub">{v.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {hint ? <p className="dash-canvas-view-hint">{hint}</p> : null}
    </div>
  );
}

export { VIEW_MODES };

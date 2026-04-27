'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Sparkles, Save, Palette, Share2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { SortableWidget } from './SortableWidget';
import { FilterProvider, useFilters } from './FilterContext';
import { cleanWidgetForSave, estimatePayloadSize } from '@/lib/cleanWidgetForSave';

const THEME_CONFIG: Record<ThemeId, { canvas: string; header: string; grid: string; select: string; saveBtn: string; titleInput: string; subtitle: string }> = {
  modern: {
    canvas:     'bg-slate-50 font-sans text-slate-900',
    header:     'bg-white border border-slate-200 shadow-sm',
    grid:       'bg-transparent',
    select:     'bg-white border border-slate-200 text-slate-700 rounded-xl',
    saveBtn:    'bg-slate-900 text-white hover:bg-slate-700 rounded-xl shadow-md',
    titleInput: 'text-slate-900',
    subtitle:   'text-slate-500',
  },
  enterprise: {
    canvas:     'bg-transparent font-sans text-slate-800',
    header:     'bg-white/90 border border-slate-200 shadow-sm backdrop-blur-xl',
    grid:       'bg-transparent',
    select:     'bg-white border border-slate-200 text-slate-700 rounded-lg',
    saveBtn:    'bg-sky-500 text-slate-950 hover:bg-white rounded-lg shadow-sky-500/20 shadow-lg',
    titleInput: 'text-slate-800',
    subtitle:   'text-slate-400',
  },
  dark: {
    canvas:     'bg-slate-950 font-sans text-white',
    header:     'bg-slate-900 border border-slate-800 shadow-none',
    grid:       'bg-transparent',
    select:     'bg-slate-800 border border-slate-700 text-slate-300 rounded-xl',
    saveBtn:    'bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded-xl font-black shadow-cyan-500/30 shadow-lg',
    titleInput: 'text-white',
    subtitle:   'text-slate-500',
  },
};

interface Widget {
  id: string;
  title: string;
  type: string;
  config: any;
}

type ThemeId = 'modern' | 'enterprise' | 'dark';

function normalizeTheme(t: string | undefined): ThemeId {
  if (t === 'enterprise' || t === 'dark' || t === 'modern') return t;
  return 'modern';
}

/** Barra de filtros activos — lee el FilterContext */
function FilterBar({ theme }: { theme: ThemeId }) {
  const { activeFilters, clearFilter, clearAll } = useFilters();
  const entries = Object.entries(activeFilters);
  if (!entries.length) return null;

  const chipStyle =
    theme === 'dark'
      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20'
      : theme === 'enterprise'
      ? 'bg-blue-600/10 text-blue-300 border border-blue-500/30 hover:bg-blue-600/20'
      : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100';

  const labelStyle =
    theme === 'dark' ? 'text-slate-400' : theme === 'enterprise' ? 'text-[#94b8e0]' : 'text-slate-400';

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-1 animate-in fade-in duration-300">
      <span className={`text-[10px] font-mono uppercase tracking-widest ${labelStyle}`}>
        Filtros activos:
      </span>
      {entries.map(([col, val]) => (
        <button
          key={col}
          onClick={() => clearFilter(col)}
          className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1 rounded-full transition-colors ${chipStyle}`}
        >
          <span className="opacity-60">{col}:</span>
          <span className="font-bold">{val}</span>
          <X size={10} className="ml-0.5 opacity-60" />
        </button>
      ))}
      <button
        onClick={clearAll}
        className={`text-[10px] font-mono underline underline-offset-2 transition-opacity opacity-50 hover:opacity-100 ${labelStyle}`}
      >
        Limpiar todo
      </button>
    </div>
  );
}

/** Contenido interno del canvas (usa FilterContext) */
function CanvasInner({
  initialWidgets,
  onSave,
  dashboardId,
  initialTitle,
  initialTemplateId,
}: {
  initialWidgets: any[];
  onSave: (widgets: any[]) => void;
  dashboardId?: string;
  initialTitle?: string;
  initialTemplateId?: string;
}) {
  const [widgets, setWidgets] = useState<Widget[]>(
    initialWidgets.map((w, i) => ({
      ...w,
      id: typeof w.id === 'string' && w.id ? w.id : `widget-${i}`,
    }))
  );
  const [theme, setTheme] = useState<ThemeId>(normalizeTheme(initialTemplateId));
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialTitle?.trim() || 'Nuevo Dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWidgets(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      // Construye widgets con metadata y los limpia (remueve sampleData/headers/etc).
      // Esto evita 413 Content Too Large: los datos pesados se recargan al visualizar
      // mediante hydrateDashboardWidgets() usando datasetIndex/datasetName.
      const builtWidgets = widgets.map((w) => {
        const meta = w as { category?: string; description?: string };
        return {
          type: w.type,
          title: w.title,
          category: meta.category,
          description: meta.description,
          config: {
            ...w.config,
            category: meta.category ?? (w.config as { category?: string })?.category,
            description: meta.description ?? (w.config as { description?: string })?.description,
          },
        };
      });

      const payload = {
        title,
        templateId: theme,
        widgets: builtWidgets.map(cleanWidgetForSave),
      };

      // Logging de seguridad: alerta si el payload se acerca al límite
      const payloadBytes = estimatePayloadSize(payload);
      if (payloadBytes > 500_000) {
        console.warn(
          `[DashboardCanvas] Payload grande: ${(payloadBytes / 1024).toFixed(1)} KB ` +
          `(${widgets.length} widgets). Si supera 1MB causará 413.`
        );
      }

      const res = dashboardId
        ? await fetch(`/api/dashboards/${dashboardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/dashboards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(typeof data?.error === 'string' ? data.error : 'Error al guardar', 'error');
      } else {
        showToast(dashboardId ? '¡Cambios guardados!' : '¡Dashboard guardado con éxito!');
        onSave(widgets);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dashlify:dashboards-changed'));
        }
      }
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tc = THEME_CONFIG[theme];

  return (
    <div className={`space-y-4 animate-in fade-in duration-700 p-8 transition-all ${
      theme === 'enterprise' ? 'dash-canvas-enterprise rounded-[13px]' : 'rounded-4xl'
    } ${tc.canvas}`}>

      {/* Enterprise banner */}
      {theme === 'enterprise' && (
        <div className="flex items-center gap-3 px-5 py-2 rounded-t-[13px] border border-slate-200 bg-white/70 text-[10px] tracking-[2px] uppercase font-bold text-slate-400 font-mono backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Dashlify Enterprise · Business Intelligence
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between p-4 transition-all ${
        theme === 'enterprise' ? 'rounded-b-[13px]' : 'rounded-2xl'
      } ${tc.header}`}>
        <div className="flex items-center gap-4">
          <div className="bg-amber-50 text-amber-600 p-2 rounded-lg">
            <Sparkles size={20} />
          </div>
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`font-black tracking-tight bg-transparent border-none outline-none focus:ring-0 text-lg w-full ${tc.titleInput}`}
            />
            <p className={`text-xs font-medium ${
              theme === 'enterprise' ? 'font-mono tracking-widest uppercase text-[10px]' : ''
            } ${tc.subtitle}`}>
              {theme === 'enterprise'
                ? '// DASHBOARD BUILDER · DRAG TO REORDER · CLICK BARS TO FILTER'
                : 'Arrastra para reorganizar · Haz clic en una barra para filtrar'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            className={`px-4 py-2 text-sm font-bold border transition-all outline-none cursor-pointer ${tc.select}`}
          >
            <option value="modern">Tema Moderno</option>
            <option value="enterprise">Tema Enterprise</option>
            <option value="dark">Tema Oscuro (Noir)</option>
          </select>
          <button className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all ${
            theme === 'enterprise' ? 'rounded-lg text-slate-500 hover:bg-slate-100 hover:text-sky-600' :
            theme === 'dark' ? 'rounded-xl text-slate-300 hover:bg-slate-800' :
            'rounded-xl text-slate-600 hover:bg-slate-50'
          }`}>
            <Share2 size={18} /> Compartir
          </button>
          <button
            onClick={saveDashboard}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-black transition-all disabled:opacity-50 ${tc.saveBtn}`}
          >
            {saving ? 'Guardando...' : <><Save size={18} /> Guardar Dashboard</>}
          </button>
        </div>
      </div>

      {/* Filtros activos */}
      <FilterBar theme={theme} />

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-h-[400px] ${
          theme === 'enterprise' ? 'gap-3' : 'gap-6'
        }`}>
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
            {widgets.map(widget => (
              <SortableWidget
                key={widget.id}
                id={widget.id}
                widget={widget}
                theme={theme}
                isDark={theme === 'dark'}
                onUpdate={(newConfig) => {
                  setWidgets(prev => prev.map(w =>
                    w.id === widget.id ? { ...w, config: { ...w.config, ...newConfig } } : w
                  ));
                }}
                onDelete={() => {
                  setWidgets(prev => prev.filter(w => w.id !== widget.id));
                }}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 right-8 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 fade-in duration-300 z-9999 text-sm font-bold text-white max-w-sm ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={20} className="text-emerald-400" />
            : <AlertCircle size={20} className="text-white" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

/** Wrapper público — provee el contexto de filtros al árbol */
export default function DashboardCanvas(props: {
  initialWidgets: any[];
  onSave: (widgets: any[]) => void;
  dashboardId?: string;
  initialTitle?: string;
  initialTemplateId?: string;
}) {
  return (
    <FilterProvider>
      <CanvasInner {...props} />
    </FilterProvider>
  );
}

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
import { SortableWidget } from './SortableWidget';

const THEME_CONFIG: Record<ThemeId, { canvas: string; header: string; grid: string; select: string; saveBtn: string; titleInput: string; subtitle: string }> = {
  modern: {
    canvas:  'bg-slate-50 font-sans text-slate-900',
    header:  'bg-white border border-slate-200 shadow-sm',
    grid:    'bg-transparent',
    select:  'bg-white border border-slate-200 text-slate-700 rounded-xl',
    saveBtn: 'bg-slate-900 text-white hover:bg-slate-700 rounded-xl shadow-md',
    titleInput: 'text-slate-900',
    subtitle: 'text-slate-500',
  },
  enterprise: {
    canvas:  'bg-[#f0f4f8] font-sans text-[#1a2b45]',
    header:  'bg-[#1a2b45] border border-[#1a2b45] shadow-md',
    grid:    'bg-transparent',
    select:  'bg-[#243755] border border-[#2e4870] text-[#94b8e0] rounded-md',
    saveBtn: 'bg-[#0052cc] text-white hover:bg-[#0041a8] rounded-md shadow-lg',
    titleInput: 'text-white',
    subtitle: 'text-[#94b8e0]',
  },
  dark: {
    canvas:  'bg-slate-950 font-sans text-white',
    header:  'bg-slate-900 border border-slate-800 shadow-none',
    grid:    'bg-transparent',
    select:  'bg-slate-800 border border-slate-700 text-slate-300 rounded-xl',
    saveBtn: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded-xl font-black shadow-cyan-500/30 shadow-lg',
    titleInput: 'text-white',
    subtitle: 'text-slate-500',
  },
};
import { Sparkles, Save, Palette, Share2, CheckCircle2, AlertCircle } from 'lucide-react';

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

export default function DashboardCanvas({
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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        templateId: theme,
        widgets: widgets.map((w) => ({
          type: w.type,
          title: w.title,
          config: w.config,
        })),
      };

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
        showToast(dashboardId ? '¡Cambios guardados!' : '¡Dashboard guardado con éxito!', 'success');
        onSave(widgets);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dashlify:dashboards-changed'));
        }
      }
    } catch (err) {
      console.error('Error al guardar:', err);
    } finally {
      setSaving(false);
    }
  };

  const tc = THEME_CONFIG[theme];

  return (
    <div className={`space-y-6 animate-in fade-in duration-700 p-8 transition-all duration-500 ${
      theme === 'enterprise' ? 'rounded-lg' : 'rounded-[2rem]'
    } ${tc.canvas}`}>
      {/* Canvas Header */}
      {/* Enterprise banner strip */}
      {theme === 'enterprise' && (
        <div className="flex items-center gap-3 px-5 py-2 bg-[#0052cc] rounded-t-md text-[10px] tracking-[2px] uppercase font-bold text-white/70 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Dashlify Enterprise · Business Intelligence
        </div>
      )}
      <div className={`flex items-center justify-between p-4 transition-all ${
        theme === 'enterprise' ? 'rounded-b-md' : 'rounded-2xl'
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
              {theme === 'enterprise' ? '// DASHBOARD BUILDER · DRAG TO REORDER' : 'Arrastra y suelta para organizar tus vistas.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value as any)}
            className={`px-4 py-2 text-sm font-bold border transition-all outline-none cursor-pointer ${tc.select}`}
          >
            <option value="modern">Tema Moderno</option>
            <option value="enterprise">Tema Enterprise</option>
            <option value="dark">Tema Oscuro (Noir)</option>
          </select>
          <button className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all ${
            theme === 'enterprise' ? 'rounded-md text-[#94b8e0] hover:bg-[#243755]' :
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

      {/* Grid Canvas */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-h-[400px] ${
          theme === 'enterprise' ? 'gap-3' : 'gap-6'
        }`}>
          <SortableContext 
            items={widgets.map(w => w.id)}
            strategy={rectSortingStrategy}
          >
            {widgets.map((widget) => (
              <SortableWidget 
                key={widget.id} 
                id={widget.id} 
                widget={widget} 
                theme={theme} 
                onUpdate={(newConfig) => {
                  setWidgets(prev => prev.map(w => 
                    w.id === widget.id 
                      ? { ...w, config: { ...w.config, ...newConfig } } 
                      : w
                  ));
                }}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 right-8 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 fade-in duration-300 z-[9999] text-sm font-bold text-white max-w-sm ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertCircle size={20} className="text-white" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

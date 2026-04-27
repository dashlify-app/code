'use client';

import { useState } from 'react';
import { BarChart2, PieChart, LineChart, TrendingUp, ChartScatter, Check, LayoutGrid, Plus, Trash2, Settings2, Sparkles } from 'lucide-react';

interface WidgetSuggestion {
  title: string;
  type: string;
  description: string;
  config: any;
  category?: string;
}

interface CustomWidget {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'stat' | 'area';
  config: {
    x?: string;
    y?: string;
    dimension?: string;
    metric?: string;
  };
  description: string;
}

const CHART_TYPES = [
  { key: 'bar',  label: 'Barras',      icon: '▊', desc: 'Comparación entre categorías' },
  { key: 'line', label: 'Línea',       icon: '╱', desc: 'Tendencias en el tiempo' },
  { key: 'pie',  label: 'Pastel',      icon: '◕', desc: 'Distribución proporcional' },
  { key: 'stat', label: 'Estadístico', icon: '#', desc: 'KPI o número destacado' },
] as const;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  bar:  <BarChart2 size={20} />,
  pie:  <PieChart size={20} />,
  line: <LineChart size={20} />,
  area: <LineChart size={20} />,
  stat: <TrendingUp size={20} />,
  scatter: <ChartScatter size={20} />,
  donut: <PieChart size={20} />,
};

let customIdCounter = 0;
const newId = () => `custom-${++customIdCounter}-${Date.now()}`;

export default function WidgetCatalog({
  suggestions,
  onSave,
  availableHeaders = [],
  sampleData = [],
  sampleDataByFile = {},
  defaultDatasetName,
}: {
  suggestions: WidgetSuggestion[];
  onSave: (selected: any[]) => void;
  availableHeaders?: string[];
  sampleData?: Record<string, any>[];
  /** Por nombre de archivo: filas para que cada widget use el dataset correcto en cargas múltiples */
  sampleDataByFile?: Record<string, Record<string, any>[]>;
  /** Nombre del dataset activo, usado como fallback para widgets que no especifiquen origen */
  defaultDatasetName?: string;
}) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [customWidgets, setCustomWidgets] = useState<CustomWidget[]>([]);
  const [activeTab, setActiveTab] = useState<'ai' | 'custom'>('ai');
  const [overriddenTypes, setOverriddenTypes] = useState<Record<number, string>>({});

  // ── Builder form state ────────────────────────────────────────────────────
  const [form, setForm] = useState<{
    title: string;
    type: 'bar' | 'line' | 'pie' | 'stat';
    colX: string;
    colY: string;
  }>({ title: '', type: 'bar', colX: '', colY: '' });
  const [formError, setFormError] = useState('');

  const toggleAiSelect = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const removeCustom = (id: string) => {
    setCustomWidgets(prev => prev.filter(w => w.id !== id));
  };

  const addCustomWidget = () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    if (form.type !== 'stat' && !form.colX) { setFormError('Selecciona la columna del eje X.'); return; }
    if (!form.colY && form.type !== 'pie') { setFormError('Selecciona la columna de la métrica.'); return; }

    const config: CustomWidget['config'] =
      form.type === 'pie'
        ? { dimension: form.colX }
        : form.type === 'stat'
        ? { metric: form.colY || form.colX }
        : { x: form.colX, y: form.colY };

    const newWidget: CustomWidget = {
      id: newId(),
      title: form.title.trim(),
      type: form.type,
      config,
      description: `Gráfico personalizado: ${form.type} de ${form.colX || form.colY}`,
    };

    setCustomWidgets(prev => [...prev, newWidget]);
    setForm({ title: '', type: 'bar', colX: '', colY: '' });
  };

  const totalSelected = selectedIndices.length + customWidgets.length;

  const resolveSampleForWidget = (cfg: any) => {
    const src =
      (typeof cfg?.sourceFile === 'string' && cfg.sourceFile) ||
      (typeof cfg?.datasetName === 'string' && cfg.datasetName) ||
      '';
    if (src && sampleDataByFile[src]?.length) return sampleDataByFile[src];
    return sampleData;
  };

  const handleBuild = () => {
    const aiSelected = suggestions
      .map((w, i) => ({
        ...w,
        type: overriddenTypes[i] || w.type,
        config: {
          ...w.config,
          sampleData: resolveSampleForWidget(w.config),
          datasetIndex: 0,
          datasetName:
            (typeof w.config?.sourceFile === 'string' && w.config.sourceFile) ||
            (typeof w.config?.datasetName === 'string' && w.config.datasetName) ||
            defaultDatasetName ||
            undefined,
        },
      }))
      .filter((_, i) => selectedIndices.includes(i));
    const customWithData = customWidgets.map(w => ({
      ...w,
      config: {
        ...w.config,
        sampleData,
        datasetIndex: 0,
        datasetName: defaultDatasetName ?? undefined,
      },
    }));
    onSave([...aiSelected, ...customWithData]);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full min-w-0 space-y-3 overflow-x-hidden px-0.5 pb-2">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200/60">
              <LayoutGrid size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold tracking-tight text-slate-900">Constructor de Dashboard</h3>
              <p className="line-clamp-2 text-xs font-medium text-slate-500">Sugerencias de IA o vistas personalizadas.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'ai' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles size={14} />
              IA
              {selectedIndices.length > 0 && (
                <span className="rounded-full bg-indigo-600 px-1 py-0.5 text-[9px] font-black text-white">
                  {selectedIndices.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings2 size={14} />
              Manual
              {customWidgets.length > 0 && (
                <span className="rounded-full bg-indigo-600 px-1 py-0.5 text-[9px] font-black text-white">
                  {customWidgets.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Tab: IA Suggestions ─────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="space-y-5">
            {Object.entries(
              suggestions.reduce((acc, widget, i) => {
                const cat = widget.category || '💡 Sugerencias Generales';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push({ widget, i });
                return acc;
              }, {} as Record<string, { widget: WidgetSuggestion; i: number }[]>)
            ).map(([category, items]) => (
              <div
                key={category}
                className="grid grid-cols-2 content-start gap-2.5 md:grid-cols-3 xl:grid-cols-4"
              >
                <h4 className="col-span-full border-b border-slate-100 pb-1 text-sm font-bold text-slate-800">
                  {category}
                </h4>
                {items.map(({ widget, i }) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleAiSelect(i);
                      }
                    }}
                    onClick={() => toggleAiSelect(i)}
                    className={`group relative flex min-h-0 cursor-pointer flex-col gap-2 rounded-2xl border-2 p-3 transition-all ${
                      selectedIndices.includes(i)
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          selectedIndices.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        {TYPE_ICONS[overriddenTypes[i] || widget.type] ?? <BarChart2 size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold leading-snug text-slate-900">{widget.title}</h4>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-500">{widget.description}</p>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100/80 pt-2">
                      <div className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">Tipo</span>
                        <select
                          value={overriddenTypes[i] || widget.type}
                          onChange={(e) => setOverriddenTypes((prev) => ({ ...prev, [i]: e.target.value }))}
                          className="max-w-[100px] cursor-pointer rounded border-0 bg-indigo-50 px-1 py-0.5 text-[9px] font-bold uppercase text-indigo-600 outline-none hover:bg-indigo-100 focus:ring-0"
                        >
                          {CHART_TYPES.map((ct) => (
                            <option key={ct.key} value={ct.key}>
                              {ct.key}
                            </option>
                          ))}
                          <option value="donut">donut</option>
                          <option value="area">area</option>
                          <option value="scatter">scatter</option>
                        </select>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          selectedIndices.includes(i)
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 text-transparent'
                        }`}
                      >
                        <Check size={10} strokeWidth={4} />
                      </div>
                    </div>
                    {selectedIndices.includes(i) && (
                      <div className="absolute right-1.5 top-1.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[8px] font-black text-white">
                        OK
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Custom Builder ─────────────────────────────────────────── */}
        {activeTab === 'custom' && (
          <div className="space-y-3">
            {/* Builder Form */}
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-4">
              <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-700">
                <Plus size={16} />
                Nuevo widget
              </div>

            {/* Título */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Título</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="ej. Ventas por región"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Tipo</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CHART_TYPES.map((ct) => (
                    <button
                      key={ct.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: ct.key }))}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 text-center transition-all ${
                        form.type === ct.key
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-mono text-lg font-black leading-none">{ct.icon}</span>
                      <span className="text-[10px] font-bold">{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {availableHeaders.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {form.type !== 'stat' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {form.type === 'pie' ? 'Dimensión' : 'Eje X'}
                      </label>
                      <select
                        value={form.colX}
                        onChange={(e) => setForm((f) => ({ ...f, colX: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">— Columna —</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {form.type === 'stat' ? 'Métrica' : 'Eje Y'}
                    </label>
                    <select
                      value={form.colY}
                      onChange={(e) => setForm((f) => ({ ...f, colY: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                    >
                      <option value="">— Columna —</option>
                      {availableHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-slate-400">Las columnas aparecerán al analizar el archivo.</p>
              )}

              {formError && <p className="text-xs font-semibold text-red-500">⚠ {formError}</p>}

              <button
                type="button"
                onClick={addCustomWidget}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 sm:w-auto sm:px-4"
              >
                <Plus size={15} /> Agregar
              </button>
            </div>

            {customWidgets.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Creados ({customWidgets.length})</p>
                {customWidgets.map((w) => (
                  <div
                    key={w.id}
                    className="group flex items-center justify-between rounded-xl border-2 border-indigo-100 bg-white px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        {TYPE_ICONS[w.type] ?? <BarChart2 size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{w.title}</p>
                        <p className="truncate font-mono text-[9px] uppercase tracking-wider text-slate-400">
                          {w.type}
                          {w.config.x && ` · ${w.config.x}`}
                          {w.config.y && ` · ${w.config.y}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustom(w.id)}
                      className="shrink-0 rounded p-1.5 text-red-400 opacity-70 hover:bg-red-50 hover:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400">
                <Settings2 size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Añade widgets con el formulario arriba.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-[var(--surface)] pt-3">
        {totalSelected > 0 && (
          <p className="mb-1.5 text-center text-[11px] font-medium text-slate-500">
            {selectedIndices.length > 0 && `${selectedIndices.length} de IA`}
            {selectedIndices.length > 0 && customWidgets.length > 0 && ' + '}
            {customWidgets.length > 0 && `${customWidgets.length} manual`}
          </p>
        )}
        <button
          type="button"
          onClick={handleBuild}
          disabled={totalSelected === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:opacity-40"
        >
          {totalSelected === 0
            ? 'Selecciona al menos una vista'
            : `Construir con ${totalSelected} vista${totalSelected !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { BarChart2, PieChart, LineChart, TrendingUp, Check, LayoutGrid, Plus, Trash2, Settings2, Sparkles } from 'lucide-react';

interface WidgetSuggestion {
  title: string;
  type: string;
  description: string;
  config: any;
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
  stat: <TrendingUp size={20} />,
};

let customIdCounter = 0;
const newId = () => `custom-${++customIdCounter}-${Date.now()}`;

export default function WidgetCatalog({
  suggestions,
  onSave,
  availableHeaders = [],
  sampleData = [],
}: {
  suggestions: WidgetSuggestion[];
  onSave: (selected: any[]) => void;
  availableHeaders?: string[];
  sampleData?: Record<string, any>[];
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

  const handleBuild = () => {
    const aiSelected = suggestions
      .map((w, i) => ({
        ...w,
        type: overriddenTypes[i] || w.type,
        config: { ...w.config, sampleData }
      }))
      .filter((_, i) => selectedIndices.includes(i));
    const customWithData = customWidgets.map(w => ({
      ...w,
      config: { ...w.config, sampleData },
    }));
    onSave([...aiSelected, ...customWithData]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
            <LayoutGrid size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Constructor de Dashboard</h3>
            <p className="text-slate-500 text-sm font-medium">Usa las sugerencias de la IA o crea tus propias vistas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'ai'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={15} />
            IA Sugiere
            {selectedIndices.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {selectedIndices.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'custom'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings2 size={15} />
            Mis vistas
            {customWidgets.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {customWidgets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab: IA Suggestions ─────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((widget, i) => (
            <div
              key={i}
              onClick={() => toggleAiSelect(i)}
              className={`border-2 transition-all p-6 rounded-3xl cursor-pointer relative group flex flex-col justify-between h-full ${
                selectedIndices.includes(i)
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  selectedIndices.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'
                }`}>
                  {TYPE_ICONS[overriddenTypes[i] || widget.type] ?? <BarChart2 size={20} />}
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{widget.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">{widget.description}</p>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo:</span>
                  <select
                    value={overriddenTypes[i] || widget.type}
                    onChange={(e) => setOverriddenTypes(prev => ({ ...prev, [i]: e.target.value }))}
                    className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border-none rounded px-1.5 py-0.5 cursor-pointer outline-none hover:bg-indigo-100 transition-colors focus:ring-0 appearance-none text-center"
                    style={{ textAlignLast: 'center' }}
                  >
                    {CHART_TYPES.map(ct => (
                      <option key={ct.key} value={ct.key}>{ct.key}</option>
                    ))}
                    <option value="donut">donut</option>
                    <option value="area">area</option>
                  </select>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedIndices.includes(i) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-transparent'
                }`}>
                  <Check size={12} strokeWidth={4} />
                </div>
              </div>
              {selectedIndices.includes(i) && (
                <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-lg">
                  SELECCIONADO
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Custom Builder ─────────────────────────────────────────── */}
      {activeTab === 'custom' && (
        <div className="space-y-6">

          {/* Builder Form */}
          <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
              <Plus size={18} />
              Nuevo widget personalizado
            </div>

            {/* Título */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Título del widget</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="ej. Ventas por Región"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Tipo de gráfico */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Tipo de gráfico</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: ct.key }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all ${
                      form.type === ct.key
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl font-mono font-black leading-none">{ct.icon}</span>
                    <span className="text-[11px] font-bold">{ct.label}</span>
                    <span className="text-[9px] text-slate-400">{ct.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Columnas */}
            {availableHeaders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.type !== 'stat' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      {form.type === 'pie' ? 'Dimensión (categoría)' : 'Eje X (categoría / fecha)'}
                    </label>
                    <select
                      value={form.colX}
                      onChange={e => setForm(f => ({ ...f, colX: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Selecciona columna —</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    {form.type === 'stat' ? 'Columna a mostrar' : 'Eje Y (métrica / valor)'}
                  </label>
                  <select
                    value={form.colY}
                    onChange={e => setForm(f => ({ ...f, colY: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— Selecciona columna —</option>
                    {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Las columnas de tu dataset aparecerán aquí automáticamente una vez analizado el archivo.
              </p>
            )}

            {formError && (
              <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                ⚠ {formError}
              </p>
            )}

            <button
              type="button"
              onClick={addCustomWidget}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
            >
              <Plus size={16} /> Agregar widget
            </button>
          </div>

          {/* Custom Widgets List */}
          {customWidgets.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Widgets creados ({customWidgets.length})
              </p>
              {customWidgets.map(w => (
                <div key={w.id} className="flex items-center justify-between bg-white border-2 border-indigo-100 rounded-2xl px-5 py-4 group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                      {TYPE_ICONS[w.type] ?? <BarChart2 size={18} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{w.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                        {w.type}
                        {w.config.x && ` · X: ${w.config.x}`}
                        {w.config.y && ` · Y: ${w.config.y}`}
                        {w.config.dimension && ` · ${w.config.dimension}`}
                        {w.config.metric && ` · ${w.config.metric}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustom(w.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Settings2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aún no has creado ningún widget.</p>
              <p className="text-xs mt-1">Usa el formulario de arriba para agregar tus propias vistas.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Build Button ────────────────────────────────────────────────── */}
      <div className="pt-2 space-y-2">
        {totalSelected > 0 && (
          <p className="text-center text-xs text-slate-500 font-medium">
            {selectedIndices.length > 0 && `${selectedIndices.length} de IA`}
            {selectedIndices.length > 0 && customWidgets.length > 0 && ' + '}
            {customWidgets.length > 0 && `${customWidgets.length} personalizados`}
          </p>
        )}
        <button
          onClick={handleBuild}
          disabled={totalSelected === 0}
          className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl disabled:opacity-40 flex items-center justify-center gap-2 text-lg"
        >
          {totalSelected === 0
            ? 'Selecciona o crea al menos una vista'
            : `Construir Dashboard con ${totalSelected} vista${totalSelected !== 1 ? 's' : ''} →`
          }
        </button>
      </div>
    </div>
  );
}

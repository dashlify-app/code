'use client';

import { useEffect, useState } from 'react';
import { CreditCard, BarChart, HardDrive, ShieldCheck, Zap, Type } from 'lucide-react';
import { useTextScale } from '@/components/TextScaleProvider';
import { TEXT_SCALE_OPTIONS, type TextScalePercent } from '@/lib/textScale';

interface UsageData {
  tier: string;
  usage: {
    dashboards: { used: number; limit: number; percentage: number };
    widgets: { used: number; limit: number; percentage: number };
  };
  organization: any;
}

function TextScaleControl() {
  const { scalePercent, setScalePercent } = useTextScale();
  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
        Aumenta o reduce el tamaño de textos, botones y gráficos en toda la plataforma (inicio, login y
        dashboard). La preferencia se guarda en este navegador.
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Tamaño de texto de la plataforma"
      >
        {TEXT_SCALE_OPTIONS.map((opt) => {
          const selected = scalePercent === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setScalePercent(opt.value as TextScalePercent)}
              className={[
                'rounded-2xl border px-4 py-3 text-left transition-all',
                'min-w-30 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2',
                selected
                  ? 'border-sky-500 bg-sky-50 shadow-sm shadow-sky-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="text-sm font-black text-slate-900">{opt.label}</div>
              <div className="text-xs font-bold text-slate-400 tabular-nums">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex animate-pulse space-x-4">
      <div className="flex-1 space-y-6 py-1">
        <div className="h-24 bg-slate-200 rounded-3xl"></div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-48 bg-slate-200 rounded-3xl"></div>
          <div className="h-48 bg-slate-200 rounded-3xl"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Configuración y Consumo</h2>
        <p className="text-slate-500 font-medium font-sans">Administra tu plan SaaS y monitorea tus límites de uso.</p>
      </div>

      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem]">
        <h4 className="font-black text-slate-900 mb-2 flex items-center gap-2">
          <Type className="text-sky-500" size={20} strokeWidth={2.5} aria-hidden />
          Tamaño de texto
        </h4>
        <TextScaleControl />
      </div>

      {/* Plan Card */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-slate-200 border border-slate-800">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <span className="bg-sky-500/20 text-sky-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-sky-500/30 flex items-center gap-1">
              <Zap size={12} fill="currentColor" /> Plan {data?.tier}
            </span>
          </div>
          <h3 className="text-4xl font-black mb-2 tracking-tight">Tu Negocio a Escala IA</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-8 leading-relaxed">
            Estás utilizando el plan {data?.tier}. Desbloquea cruces de datos ilimitados y dashboards avanzados con Dashlify Pro.
          </p>
          <button className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all flex items-center gap-2 shadow-lg shadow-white/5">
            <CreditCard size={18} /> Actualizar Plan
          </button>
        </div>
        <div className="absolute -bottom-12 -right-12 text-white/5 rotate-12 scale-150">
          <ShieldCheck size={280} strokeWidth={1} />
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UsageCard 
          icon={<BarChart className="text-sky-500" />}
          label="Dashboards Activos"
          used={data?.usage.dashboards.used || 0}
          limit={data?.usage.dashboards.limit || 0}
          percentage={data?.usage.dashboards.percentage || 0}
        />
        <UsageCard 
          icon={<HardDrive className="text-indigo-500" />}
          label="Estadísticas (Widgets)"
          used={data?.usage.widgets.used || 0}
          limit={data?.usage.widgets.limit || 0}
          percentage={data?.usage.widgets.percentage || 0}
        />
      </div>

      {/* Subscription Status */}
      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem]">
        <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2">
          <ShieldCheck className="text-emerald-500" /> Seguridad y Facturación
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-4 border-b border-slate-50">
            <div>
              <p className="text-sm font-black text-slate-900">Método de Pago</p>
              <p className="text-xs text-slate-400">Visa terminada en **** 4242</p>
            </div>
            <button className="text-xs font-black text-sky-500 hover:underline">Cambiar</button>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-slate-50">
            <div>
              <p className="text-sm font-black text-slate-900">Próximo Ciclo</p>
              <p className="text-xs text-slate-400">22 de Mayo, 2026</p>
            </div>
            <p className="text-sm font-black text-slate-900">$0.00</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageCard({ icon, label, used, limit, percentage }: { icon: React.ReactNode, label: string, used: number, limit: number, percentage: number }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm shadow-slate-100">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 text-slate-400">
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-end gap-1 mb-6">
        <span className="text-4xl font-black text-slate-900">{used}</span>
        <span className="text-slate-400 font-bold border-l border-slate-100 pl-2 mb-1">/ {limit}</span>
      </div>
      
      <div className="space-y-2">
        <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-sky-500 rounded-full transition-all duration-1000" 
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>{percentage.toFixed(1)}% utilizado</span>
          <span>{limit - used} restantes</span>
        </div>
      </div>
    </div>
  );
}

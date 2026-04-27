'use client';

import { useState } from 'react';
import { GitCompare, Check, AlertCircle, ArrowRightLeft, Sparkles, Plus } from 'lucide-react';

interface Relationship {
  sourceDataset: string;
  targetDataset: string;
  sourceColumn: string;
  targetColumn: string;
  reason: string;
  matchType: 'Exact' | 'Similar';
  normalizationNeeded: boolean;
}

interface CorrelationResult {
  possibleRelationships: Relationship[];
  recommendedLabel: string;
}

export default function CorrelationUI({ 
  correlation, 
  onApprove 
}: { 
  correlation: CorrelationResult; 
  onApprove: (approved: Relationship[]) => void;
}) {
  const [approvedIndices, setApprovedIndices] = useState<number[]>([]);

  const toggleApprove = (index: number) => {
    setApprovedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleConfirm = () => {
    onApprove(correlation.possibleRelationships.filter((_, i) => approvedIndices.includes(i)));
  };

  return (
    <div className="bg-white border-2 border-sky-500/20 rounded-3xl p-8 space-y-6 shadow-xl shadow-sky-500/5 ring-4 ring-sky-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-200">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Propuestas Inteligentes de Cruce</h3>
            <p className="text-slate-500 text-sm font-medium">La IA ha detectado conexiones entre tus archivos.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {correlation.possibleRelationships.map((rel, i) => (
          <div 
            key={i} 
            onClick={() => toggleApprove(i)}
            className={`border-2 transition-all p-5 rounded-2xl cursor-pointer flex items-center justify-between group ${
              approvedIndices.includes(i) 
              ? 'border-sky-500 bg-sky-50' 
              : 'border-slate-100 hover:border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{rel.sourceDataset}</span>
                <span className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold">{rel.sourceColumn}</span>
              </div>

              <div className="text-sky-500 animate-pulse">
                <ArrowRightLeft size={20} />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{rel.targetDataset}</span>
                <span className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold">{rel.targetColumn}</span>
              </div>

              <div className="ml-4 max-w-xs">
                <p className="text-xs font-bold text-slate-700">{rel.reason}</p>
                {rel.normalizationNeeded && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    <AlertCircle size={10} /> REQUIERE NORMALIZACIÓN
                  </span>
                )}
              </div>
            </div>

            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              approvedIndices.includes(i) ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 text-transparent'
            }`}>
              <Check size={16} strokeWidth={4} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4">
        <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400">
          <GitCompare size={20} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiqueta unificada sugerida</p>
          <p className="text-sm font-bold text-slate-900">{correlation.recommendedLabel}</p>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <button 
          onClick={handleConfirm}
          disabled={approvedIndices.length === 0}
          className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          Aprobar {approvedIndices.length} Cruces y Crear Vista
        </button>
        <button
          type="button"
          onClick={() => onApprove([])}
          className="px-6 border-2 border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}

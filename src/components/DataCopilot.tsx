'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, LayoutGrid, Check, BarChart2, PieChart, LineChart, TrendingUp } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
}

interface GeneratedWidget {
  title: string;
  type: string;
  description: string;
  config: any;
  category?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  bar:  <BarChart2 size={16} />,
  pie:  <PieChart size={16} />,
  line: <LineChart size={16} />,
  stat: <TrendingUp size={16} />,
};

export default function DataCopilot({
  files,
  onProceed
}: {
  files: any[];
  onProceed: (selectedWidgets: GeneratedWidget[]) => void;
}) {
  const analysis = files[0]?.analysis;
  const initialText = analysis?.narrative || analysis?.description || 'He analizado tus datos.';
  const followUp = analysis?.followUpQuestion || '¿Qué enfoque te gustaría darle al dashboard? Puedes pedirme un gráfico específico, por ejemplo: "Hazme un pie con las familias de productos".';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      content: `${initialText}\n\n${followUp}`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [widgets, setWidgets] = useState<GeneratedWidget[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar widgets propuestos automáticamente al inicio
  useEffect(() => {
    if (analysis?.proposedWidgets && Array.isArray(analysis.proposedWidgets) && widgets.length === 0) {
      const formatted = analysis.proposedWidgets.map((w: any) => ({
        ...w,
        description: w.description || `Análisis de ${w.config?.yAxis || 'datos'} por ${w.config?.xAxis || 'categoría'}.`
      }));
      setWidgets(formatted);
    }
  }, [analysis, widgets.length]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, widgets]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      const combinedSchema = files.flatMap(f => f.headers);
      
      const res = await fetch('/api/chat-widget', {
        method: 'POST',
        body: JSON.stringify({
          message: userText,
          schema: combinedSchema,
          chatHistory: messages
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        content: data.text || 'Entendido.' 
      }]);

      if (data.widget) {
        setWidgets(prev => [...prev, data.widget]);
      }
    } catch (error) {
      console.error('Error en Copilot:', error);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        content: 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const removeWidget = (index: number) => {
    setWidgets(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-[80vh] w-full bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* LEFT: Chat Area */}
      <div className="w-1/2 flex flex-col border-r border-slate-100 bg-slate-50/50">
        <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Dashlify Copilot</h3>
            <p className="text-xs text-slate-500">Tu analista de datos IA</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-slate-100 text-slate-500 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span className="text-sm">Pensando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="relative flex items-center">
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pide un gráfico o haz una pregunta..."
              className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-600 resize-none outline-none"
              rows={1}
            />
            <button 
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">Presiona Enter para enviar</p>
        </div>
      </div>

      {/* RIGHT: Generated Widgets Tray */}
      <div className="w-1/2 flex flex-col bg-white relative">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <LayoutGrid size={18} className="text-indigo-600" />
              Gráficos Generados ({widgets.length})
            </h3>
            <p className="text-xs text-slate-500">Estos gráficos se añadirán a tu Dashboard</p>
          </div>
          <button
            onClick={() => onProceed(widgets)}
            disabled={widgets.length === 0}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:scale-105 transition-transform"
          >
            Ir al Dashboard <Check size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {widgets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <LayoutGrid size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-500 text-sm max-w-xs">
                Aún no hay gráficos. Pídele al asistente que genere gráficas para ti y aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {widgets.map((widget, i) => (
                <div key={i} className="border-2 border-indigo-100 bg-indigo-50/30 p-4 rounded-2xl relative group flex flex-col animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                      {TYPE_ICONS[widget.type] || <BarChart2 size={16} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">{widget.title}</h4>
                      {widget.category && (
                        <span className="text-[10px] font-black text-indigo-600">{widget.category}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 flex-1">{widget.description}</p>
                  
                  <div className="flex justify-end">
                    <button 
                      onClick={() => removeWidget(i)}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors font-semibold"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

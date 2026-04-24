'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { File, X, ChevronRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import CorrelationUI from './CorrelationUI';
import WidgetCatalog from './WidgetCatalog';
import DashboardCanvas from './DashboardCanvas';

interface DatasetPreview {
  id?: string;
  name: string;
  size: string;
  type: string;
  headers: string[];
  sampleData: any[];
  analysis?: any;
}

export default function UploadZone() {
  const { data: session, status: sessionStatus } = useSession();
  const [files, setFiles] = useState<DatasetPreview[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [correlation, setCorrelation] = useState<any>(null);
  const [showCorrelation, setShowCorrelation] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<any[]>([]);
  const [showCanvas, setShowCanvas] = useState(false);

  const hasLoadedFromDb = useRef(false);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      hasLoadedFromDb.current = false;
      setFiles([]);
      return;
    }
    if (hasLoadedFromDb.current) return;
    hasLoadedFromDb.current = true;

    (async () => {
      try {
        const res = await fetch('/api/datasets', { method: 'GET' });
        const data = await res.json();
        if (!res.ok) return;
        const rows = Array.isArray(data?.datasets) ? data.datasets : [];
        const restored: DatasetPreview[] = rows.map((d: any) => {
          const raw = d.rawSchema || {};
          return {
            id: d.id,
            name: d.name,
            size: raw?.fileMeta?.size || '',
            type: raw?.fileMeta?.type || '',
            headers: raw?.headers || [],
            sampleData: raw?.sampleData || [],
            analysis: raw?.analysis,
          };
        });
        setFiles(restored);
      } catch {
        // ignore
      }
    })();
  }, [sessionStatus, session?.user]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const data = e.target?.result;
        let headers: string[] = [];
        let sampleData: any[] = [];

        if (file.name.endsWith('.csv')) {
          const results = Papa.parse(data as string, { header: true, preview: 5000, skipEmptyLines: true });
          headers = results.meta.fields || [];
          sampleData = results.data;
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // sheet_to_json sin `header:1` devuelve objetos con keys = headers de la hoja
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
          headers = json.length > 0 ? Object.keys(json[0]) : [];
          sampleData = json.slice(0, 5000); // guardar hasta 5000 filas para que los gráficos sean robustos
        }

        setFiles(prev => [...prev, {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.name.split('.').pop() || '',
          headers,
          sampleData
        }]);
      };

      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const target = prev[index];
      if (target?.id) {
        fetch(`/api/datasets/${target.id}`, { method: 'DELETE' }).catch(() => {});
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const saveDatasetToDb = async (file: DatasetPreview) => {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        rawSchema: {
          headers: file.headers,
          sampleData: file.sampleData,
          analysis: file.analysis,
          fileMeta: { size: file.size, type: file.type },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = typeof data?.error === 'string' ? data.error : 'Error al guardar dataset';
      throw new Error(msg);
    }
    return data?.dataset as { id: string };
  };

  const analyzeFiles = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          if (file.analysis) return file;
          
          const res = await fetch('/api/analyze', {
            method: 'POST',
            body: JSON.stringify({
              headers: file.headers,
              sampleData: file.sampleData.slice(0, 5), // Solo enviar muestra a la IA para ahorrar tokens
              fileName: file.name
            }),
            headers: { 'Content-Type': 'application/json' }
          });
          const analysis = await res.json();
          if (!res.ok) {
            const msg = typeof analysis?.error === 'string' ? analysis.error : 'Error al analizar con IA';
            throw new Error(msg);
          }
          const analyzed = { ...file, analysis };
          try {
            const created = await saveDatasetToDb(analyzed);
            return { ...analyzed, id: created.id };
          } catch (e) {
            // If DB save fails, still keep analysis in UI
            console.error('Error guardando dataset:', e);
            return analyzed;
          }
        })
      );
      setFiles(results);
    } catch (err) {
      console.error('Error al analizar:', err);
      const msg = err instanceof Error ? err.message : 'Error al analizar con IA';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const findCorrelations = async () => {
    if (files.length < 2) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/correlate', {
        method: 'POST',
        body: JSON.stringify({ 
          datasets: files.map(f => ({ ...f, sampleData: f.sampleData.slice(0, 5) })) 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Error al correlacionar con IA';
        throw new Error(msg);
      }
      setCorrelation(data);
      setShowCorrelation(true);
    } catch (err) {
      console.error('Error al correlacionar:', err);
      const msg = err instanceof Error ? err.message : 'Error al correlacionar con IA';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const getWidgetSuggestions = async (approvedRels: any[] = []) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/suggest-charts', {
        method: 'POST',
        body: JSON.stringify({ 
          combinedSchema: files.map(f => ({ name: f.name, columns: f.headers })),
          approvedRelationships: approvedRels 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Error al sugerir widgets con IA';
        throw new Error(msg);
      }
      setSuggestions(data.suggestedWidgets);
      setShowCatalog(true);
      setShowCorrelation(false);
    } catch (err) {
      console.error('Error al sugerir widgets:', err);
      const msg = err instanceof Error ? err.message : 'Error al sugerir widgets con IA';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  if (showCanvas && selectedWidgets.length > 0) {
    return <DashboardCanvas 
      initialWidgets={selectedWidgets} 
      onSave={(final) => {
        console.log('Dashboard final guardado:', final);
      }}
    />;
  }

  if (showCatalog && suggestions) {
    // Combinar y deduplican headers de todos los archivos cargados
    const allHeaders = Array.from(
      new Set(files.flatMap(f => f.headers))
    );
    // Combinar sampleData de todos los archivos
    const allSampleData = files.flatMap(f => f.sampleData ?? []);
    return <WidgetCatalog
      suggestions={suggestions}
      availableHeaders={allHeaders}
      sampleData={allSampleData}
      onSave={(selected) => {
        setSelectedWidgets(selected);
        setShowCanvas(true);
        setShowCatalog(false);
      }}
    />;
  }

  if (showCorrelation && correlation) {
    return <CorrelationUI 
      correlation={correlation} 
      onApprove={getWidgetSuggestions} 
    />;
  }

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`upload-zone-dash ${isDragActive ? 'drag' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-3">📂</div>
        <div className="font-[family-name:var(--font-syne),sans-serif] text-[15px] font-bold" style={{ color: 'var(--text)' }}>
          Suelta tus archivos aquí
        </div>
        <p className="text-[13px] mt-2" style={{ color: 'var(--text2)' }}>
          CSV, Excel (.xlsx, .xls)
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-4">
          {['CSV', 'XLSX', 'XLS'].map((t) => (
            <span
              key={t}
              className="font-[family-name:var(--font-dm-mono),monospace] text-[9px] tracking-wide px-2 py-0.5 rounded border uppercase"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="sb-label">// Archivos cargados ({files.length})</div>
          <div className="grid grid-cols-1 gap-2">
            {files.map((file, i) => (
              <div key={i} className="file-row-dash">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--surface3)', color: 'var(--accent)' }}>
                    <File size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {file.name}
                    </p>
                    <p className="text-[11px] font-[family-name:var(--font-dm-mono),monospace]" style={{ color: 'var(--text3)' }}>
                      {file.size} · {file.headers.length} columnas
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-sm" onClick={() => removeFile(i)} aria-label="Quitar archivo">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Botón principal de acción */}
          {(() => {
            const allAnalyzed = files.every(f => f.analysis);
            const hasUnanalyzed = files.some(f => !f.analysis);
            
            return (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => {
                  if (hasUnanalyzed) return analyzeFiles();
                  // Con 1+ archivos analizados → ir directo a sugerir widgets
                  return getWidgetSuggestions([]);
                }}
                className="btn-analyze-dash flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Procesando con IA…
                  </>
                ) : (
                  <>
                    {hasUnanalyzed ? 'Analizar datos' : 'Generar dashboard con IA'}
                    {' '}<ChevronRight size={18} />
                  </>
                )}
              </button>
            );
          })()}

          {/* Botón secundario: correlación opcional si hay 2+ archivos analizados */}
          {files.filter(f => f.analysis).length >= 2 && (
            <button
              type="button"
              disabled={analyzing}
              onClick={findCorrelations}
              className="btn-analyze-dash flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)' }}
            >
              🔗 Vincular datasets (opcional)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

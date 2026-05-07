'use client';

/**
 * Flujo multi–Google Sheets paralelo a UploadZone: mismo pipeline de IA
 * (analizar → sugerencias / vincular / análisis cruzado → canvas) sin tocar UploadZone.
 */

import { useState, useCallback, useEffect } from 'react';
import { FileSpreadsheet, X, ChevronRight } from 'lucide-react';
import { GoogleSheetsModal, type ImportedSheet } from './GoogleSheetsModal';
import CorrelationUI from './CorrelationUI';
import WidgetCatalog from './WidgetCatalog';
import DashboardCanvas from './DashboardCanvas';
import MultiDatasetAnalysisResult from './MultiDatasetAnalysisResult';
import { computeColumnStats } from '@/lib/columnStats';
import { devLog } from '@/lib/logger';
import { MultiDatasetAnalysis, ProposedWidget } from '@/lib/types/multiDataset';
import { saveDatasetToDb } from '@/lib/datasetAnalysis';

export interface SheetDatasetPreview {
  id?: string;
  name: string;
  size: string;
  type: string;
  headers: string[];
  sampleData: any[];
  analysis?: any;
  sheetId: string;
  sourceUrl: string;
  isAutoRefresh?: boolean;
  refreshInterval?: number;
}

type Props = { onWideChange?: (wide: boolean) => void };

export default function GoogleSheetsWorkbench({ onWideChange }: Props) {
  const [sheets, setSheets] = useState<SheetDatasetPreview[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [correlation, setCorrelation] = useState<any>(null);
  const [showCorrelation, setShowCorrelation] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<any[]>([]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [multiDatasetAnalysis, setMultiDatasetAnalysis] = useState<MultiDatasetAnalysis | null>(null);
  const [showMultiAnalysis, setShowMultiAnalysis] = useState(false);

  useEffect(() => {
    const wide =
      (showCatalog && Boolean(suggestions)) ||
      (showCorrelation && Boolean(correlation)) ||
      (showCanvas && selectedWidgets.length > 0) ||
      (showMultiAnalysis && Boolean(multiDatasetAnalysis));
    onWideChange?.(wide);
  }, [
    showCatalog,
    showCorrelation,
    showCanvas,
    suggestions,
    correlation,
    selectedWidgets.length,
    showMultiAnalysis,
    multiDatasetAnalysis,
    onWideChange,
  ]);

  const appendSheet = useCallback((sheetData: ImportedSheet) => {
    setSheets((prev) => {
      if (prev.some((s) => s.sheetId === sheetData.id)) {
        alert('Esta hoja ya está en la lista.');
        return prev;
      }
      const rows = (sheetData.data || []).slice(0, 5000);
      return [
        ...prev,
        {
          name: sheetData.name,
          size: '0 KB',
          type: 'google-sheets',
          headers: sheetData.headers,
          sampleData: rows,
          sheetId: sheetData.id,
          sourceUrl: sheetData.sourceUrl,
          isAutoRefresh: sheetData.isAutoRefresh,
          refreshInterval: sheetData.refreshInterval,
        },
      ];
    });
  }, []);

  const removeSheet = (index: number) => {
    setSheets((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllSheets = () => {
    setSheets([]);
  };

  const clearViewsOnly = () => {
    setShowCanvas(false);
    setShowMultiAnalysis(false);
    setShowCatalog(false);
    setShowCorrelation(false);
    setSuggestions(null);
    setCorrelation(null);
    setMultiDatasetAnalysis(null);
    setSelectedWidgets([]);
  };

  const analyzeSheets = async () => {
    if (sheets.length === 0) return;
    setAnalyzing(true);
    try {
      const results = await Promise.all(
        sheets.map(async (s) => {
          if (s.analysis) return s;
          const columnStats = computeColumnStats(s.sampleData, s.headers);
          const res = await fetch('/api/analyze', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({
              headers: s.headers,
              sampleData: s.sampleData.slice(0, 5),
              fileName: s.name,
              columnStats,
            }),
            headers: { 'Content-Type': 'application/json' },
          });
          const analysis = await res.json();
          if (!res.ok) {
            const msg = typeof analysis?.error === 'string' ? analysis.error : 'Error al analizar con IA';
            throw new Error(msg);
          }
          const analyzed = { ...s, analysis };
          try {
            const created = await saveDatasetToDb({
              name: analyzed.name,
              headers: analyzed.headers,
              sampleData: analyzed.sampleData,
              analysis: analyzed.analysis,
              size: analyzed.size,
              type: analyzed.type,
              sourceType: 'google-sheets',
              sheetId: analyzed.sheetId,
              sourceUrl: analyzed.sourceUrl,
            });
            return { ...analyzed, id: created.id };
          } catch (e) {
            console.error('Error guardando dataset (sheet):', e);
            return analyzed;
          }
        })
      );
      setSheets(results);
      const uploadedIds = results.filter((r) => r.id).map((r) => r.id);
      if (uploadedIds.length > 0) {
        localStorage.setItem('dashlify_recent_files', JSON.stringify(uploadedIds));
      }
      window.dispatchEvent(new CustomEvent('dashlify:datasets-changed'));
    } catch (err) {
      console.error('Error al analizar sheets:', err);
      const msg = err instanceof Error ? err.message : 'Error al analizar con IA';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const findCorrelations = async () => {
    if (sheets.length < 2) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/correlate', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          datasets: sheets.map((s) => ({ ...s, sampleData: s.sampleData.slice(0, 5) })),
        }),
        headers: { 'Content-Type': 'application/json' },
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

  const analyzeMultiDataset = async () => {
    if (sheets.length < 2) return;
    setAnalyzing(true);
    try {
      const datasetsForAnalysis = sheets.map((s) => {
        const allRows = s.sampleData || [];
        const first5 = allRows.slice(0, 5);
        const remaining = allRows.slice(5);
        const random5 = remaining.slice(0, Math.min(5, remaining.length));
        const sampleData = [...first5, ...random5].slice(0, 10);
        return {
          id: s.id || s.name,
          name: s.name,
          headers: s.headers,
          sampleData,
          columnStats: computeColumnStats(sampleData, s.headers),
        };
      });

      const res = await fetch('/api/analyze-multi', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ datasets: datasetsForAnalysis }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Error al analizar con IA';
        throw new Error(msg);
      }

      setMultiDatasetAnalysis(data.analysis);
      setShowMultiAnalysis(true);
    } catch (err) {
      console.error('Error al analizar multi-dataset:', err);
      const msg = err instanceof Error ? err.message : 'Error en análisis cruzado';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateMultiDatasetWidgets = (widgets: ProposedWidget[]) => {
    const dashboardWidgets = widgets.map((w, idx) => ({
      id: `widget-multi-${idx}`,
      title: w.title,
      type: w.type,
      config: {
        ...w.config,
        multiDatasetConfig: w.datasetConfig,
        allDatasets: Object.fromEntries(sheets.map((s) => [s.name, s.sampleData || []])),
      },
      category: w.category,
      description: w.description,
    }));

    setSelectedWidgets(dashboardWidgets);
    setShowCanvas(true);
    setShowMultiAnalysis(false);
  };

  const getWidgetSuggestions = async (approvedRels: any[] = []) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/suggest-charts', {
        method: 'POST',
        body: JSON.stringify({
          combinedSchema: sheets.map((s) => {
            const a = s.analysis as Record<string, any> | undefined;
            const inner = a?.analysis;
            const proposed = Array.isArray(a?.proposedWidgets) ? a.proposedWidgets : [];
            return {
              name: s.name,
              columns: s.headers,
              domain: inner?.domain,
              mainKpis: inner?.main_kpis,
              narrative: a?.narrative,
              perFileWidgetIdeas: proposed.map((w: any) => ({
                title: w.title,
                type: w.type,
                xAxis: w.config?.xAxis,
                yAxis: w.config?.yAxis,
                aggregate: w.config?.aggregate,
              })),
            };
          }),
          approvedRelationships: approvedRels,
        }),
        headers: { 'Content-Type': 'application/json' },
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
    return (
      <DashboardCanvas
        initialWidgets={selectedWidgets}
        sourceType="google-sheets"
        onSave={(final) => {
          devLog('Dashboard guardado (Sheets):', final);
          clearAllSheets();
          clearViewsOnly();
        }}
        onBack={() => {
          setShowCanvas(false);
          clearAllSheets();
          clearViewsOnly();
        }}
      />
    );
  }

  if (showMultiAnalysis && multiDatasetAnalysis) {
    return (
      <MultiDatasetAnalysisResult
        analysis={multiDatasetAnalysis}
        files={sheets}
        onCreateWidgets={handleCreateMultiDatasetWidgets}
        onBack={() => {
          setShowMultiAnalysis(false);
          setMultiDatasetAnalysis(null);
          clearViewsOnly();
        }}
      />
    );
  }

  if (showCatalog && suggestions) {
    const allHeaders = Array.from(new Set(sheets.flatMap((s) => s.headers)));
    const allSampleData = sheets.flatMap((s) => s.sampleData ?? []);
    return (
      <WidgetCatalog
        suggestions={suggestions}
        availableHeaders={allHeaders}
        sampleData={allSampleData}
        sampleDataByFile={Object.fromEntries(sheets.map((s) => [s.name, s.sampleData ?? []] as const))}
        defaultDatasetName={sheets[0]?.name}
        onSave={(selected) => {
          setSelectedWidgets(selected);
          setShowCanvas(true);
          setShowCatalog(false);
        }}
        onBack={() => {
          setShowCatalog(false);
          setSuggestions(null);
          clearViewsOnly();
        }}
      />
    );
  }

  if (showCorrelation && correlation) {
    return (
      <CorrelationUI
        correlation={correlation}
        onApprove={getWidgetSuggestions}
        onBack={() => {
          setShowCorrelation(false);
          setCorrelation(null);
          clearViewsOnly();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
      >
        <div className="sb-label mb-3">// Hojas cargadas ({sheets.length})</div>
        {sheets.length === 0 ? (
          <ol className="list-inside list-decimal space-y-2 text-sm opacity-85" style={{ color: 'var(--text2)' }}>
            <li>
              Por cada libro/hoja que quieras cruzar: pega URL o ID y pulsa <strong>Vista previa (Cargar Sheet)</strong>.
            </li>
            <li>
              Revisa la vista previa y pulsa <strong>Añadir a la lista</strong>: el contador «Hojas cargadas»
              aumentará.
            </li>
            <li>
              Vacía mentalmente el flujo y repite desde el paso 1 con <strong>otra URL</strong> (no se puede pegar dos
              URLs a la vez; son importaciones una tras otra en la misma sesión).
            </li>
            <li>Cuando tengas todas, usa <strong>Analizar datos</strong> como con archivos locales.</li>
          </ol>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((s, i) => (
              <div
                key={`${s.sheetId}-${i}`}
                className="flex items-start justify-between gap-2 rounded-lg border p-3"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded"
                    style={{ background: 'var(--surface3)', color: 'var(--accent)' }}
                  >
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      {s.name}
                    </p>
                    <p className="truncate font-mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      {s.headers.length} col · {s.sampleData.length} filas
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-sm flex-shrink-0" onClick={() => removeSheet(i)} aria-label="Quitar hoja">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 18, background: 'var(--surface2)', borderRadius: 12 }}>
        <GoogleSheetsModal open={true} mode="inline-url" onClose={() => {}} onImport={appendSheet} />
      </div>

      {sheets.length > 0 && (
        <div className="space-y-3">
          {(() => {
            const hasUnanalyzed = sheets.some((s) => !s.analysis);
            const analyzedCount = sheets.filter((s) => s.analysis).length;
            const allAnalyzed = analyzedCount === sheets.length && sheets.length > 0;

            return (
              <>
                {allAnalyzed && (
                  <div
                    className="rounded-lg p-2 text-center text-xs transition-all"
                    style={{ background: 'var(--surface3)', color: 'var(--accent)' }}
                  >
                    Hojas analizadas. Elige análisis cruzado, vincular o generar dashboard.
                  </div>
                )}

                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => {
                    if (hasUnanalyzed) return analyzeSheets();
                    return getWidgetSuggestions([]);
                  }}
                  className="btn-analyze-dash flex w-full items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Procesando con IA…
                    </>
                  ) : (
                    <>
                      {hasUnanalyzed ? 'Analizar datos' : 'Generar dashboard con IA'} <ChevronRight size={18} />
                    </>
                  )}
                </button>

                {sheets.length >= 2 && (
                  <div
                    className={`grid grid-cols-2 gap-2 transition-all ${analyzedCount >= 2 ? 'opacity-100' : 'opacity-75'}`}
                  >
                    <button
                      type="button"
                      disabled={analyzing || analyzedCount < 2}
                      onClick={analyzeMultiDataset}
                      className="btn-analyze-dash flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      title={analyzedCount < 2 ? 'Requiere 2+ hojas analizadas' : 'Análisis cruzado entre hojas'}
                    >
                      <span>📊</span>
                      <span className="hidden sm:inline">Análisis cruzado</span>
                      <span className="sm:hidden text-xs">Cruzado</span>
                    </button>
                    <button
                      type="button"
                      disabled={analyzing || analyzedCount < 2}
                      onClick={findCorrelations}
                      className="btn-analyze-dash flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      title={analyzedCount < 2 ? 'Requiere 2+ hojas analizadas' : 'Vincular datasets'}
                    >
                      <span>🔗</span>
                      <span className="hidden sm:inline">Vincular</span>
                      <span className="sm:hidden text-xs">Vincular</span>
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

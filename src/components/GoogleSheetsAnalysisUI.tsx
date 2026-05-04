'use client';

import { useState, useCallback } from 'react';
import WidgetCatalog from './WidgetCatalog';
import DashboardCanvas from './DashboardCanvas';
import { computeColumnStats } from '@/lib/columnStats';

export interface GoogleSheetData {
  id: string;
  name: string;
  headers: string[];
  data: Record<string, any>[];
  analysis?: any;
}

interface GoogleSheetsAnalysisUIProps {
  sheetData: GoogleSheetData;
  onClose: () => void;
}

export function GoogleSheetsAnalysisUI({ sheetData, onClose }: GoogleSheetsAnalysisUIProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [selectedWidgets, setSelectedWidgets] = useState<any[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  /**
   * Obtener sugerencias de gráficas desde la IA
   */
  const getWidgetSuggestions = useCallback(async () => {
    setAnalyzing(true);
    try {
      const analysis = sheetData.analysis;
      const proposed = Array.isArray(analysis?.proposedWidgets) ? analysis.proposedWidgets : [];

      const res = await fetch('/api/suggest-charts', {
        method: 'POST',
        body: JSON.stringify({
          combinedSchema: [
            {
              name: sheetData.name,
              columns: sheetData.headers,
              domain: analysis?.analysis?.domain,
              mainKpis: analysis?.analysis?.main_kpis,
              narrative: analysis?.narrative,
              perFileWidgetIdeas: proposed.map((w: any) => ({
                title: w.title,
                type: w.type,
                xAxis: w.config?.xAxis,
                yAxis: w.config?.yAxis,
                aggregate: w.config?.aggregate,
              })),
            },
          ],
          approvedRelationships: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Error al sugerir gráficas');
      }

      setSuggestions(data.suggestedWidgets);
      setShowCatalog(true);
    } catch (err) {
      console.error('Error al sugerir widgets:', err);
      const msg = err instanceof Error ? err.message : 'Error al sugerir gráficas';
      alert(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [sheetData]);

  /**
   * Manejador cuando el usuario guarda/selecciona widgets del catálogo
   */
  const handleSaveWidgets = useCallback((widgets: any[]) => {
    setSelectedWidgets(widgets);
    setShowCatalog(false);
    setShowCanvas(true);
  }, []);

  /**
   * Vista de catálogo de gráficas
   */
  if (showCatalog && suggestions) {
    return (
      <WidgetCatalog
        suggestions={suggestions}
        availableHeaders={sheetData.headers}
        sampleData={sheetData.data}
        sampleDataByFile={{ [sheetData.name]: sheetData.data }}
        onSave={handleSaveWidgets}
        onBack={() => {
          setShowCatalog(false);
          setSuggestions(null);
        }}
      />
    );
  }

  /**
   * Vista de canvas (creador de dashboard)
   */
  if (showCanvas && selectedWidgets.length > 0) {
    return (
      <DashboardCanvas
        initialWidgets={selectedWidgets}
        sourceType="google-sheets"
        onSave={() => {
          console.log('✅ Dashboard creado desde Google Sheet');
          onClose();
        }}
        onBack={() => {
          setShowCanvas(false);
          setShowCatalog(true);
        }}
      />
    );
  }

  /**
   * Vista principal: opciones después del análisis
   */
  return (
    <div className="dlf-analysis-container" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      padding: '24px',
      maxWidth: '900px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '8px' }}>
          <img src="/icons/dashboard-sheets.svg" alt="Google Sheets" style={{ width: '40px', height: '40px' }} />
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
            {sheetData.name}
          </h2>
        </div>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>
          {sheetData.data.length} filas • {sheetData.headers.length} columnas
        </p>
      </div>

      {/* Análisis si existe */}
      {sheetData.analysis?.analysis && (
        <div style={{
          padding: '16px',
          background: 'var(--surface2)',
          borderRadius: '8px',
          borderLeft: '4px solid var(--accent)',
        }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>Dominio detectado:</strong> {sheetData.analysis.analysis.domain || 'General'}
          </p>
          {sheetData.analysis.narrative && (
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
              {sheetData.analysis.narrative}
            </p>
          )}
        </div>
      )}

      {/* Opciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Generar Dashboard */}
        <button
          onClick={getWidgetSuggestions}
          disabled={analyzing}
          style={{
            padding: '20px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: analyzing ? 'not-allowed' : 'pointer',
            opacity: analyzing ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {analyzing ? '⏳ Analizando...' : '✨ Generar Dashboard'}
        </button>

        {/* Cancelar */}
        <button
          onClick={onClose}
          disabled={analyzing}
          style={{
            padding: '20px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ❌ Cancelar
        </button>
      </div>

      {/* Info */}
      <p style={{ textAlign: 'center', fontSize: '12px', opacity: 0.6 }}>
        La IA analizará tu sheet y sugará gráficas automáticas
      </p>
    </div>
  );
}

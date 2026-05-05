'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import UploadZone from './UploadZone';
import { GoogleSheetsModal, type ImportedSheet } from './GoogleSheetsModal';
import { GoogleSheetsAnalysisUI, type GoogleSheetData } from './GoogleSheetsAnalysisUI';
import { processDataset } from '@/lib/datasetAnalysis';
import { devLog } from '@/lib/logger';

type TabType = 'upload' | 'google';

export function DataSourceSelector({ onWideChange }: { onWideChange?: (wide: boolean) => void }) {
  const params = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = params?.get('tab');
    return tab === 'google' ? 'google' : 'upload';
  });
  const [googleSheetAnalysis, setGoogleSheetAnalysis] = useState<GoogleSheetData | null>(null);

  // Solo renderizar en cliente para evitar hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    setGoogleEnabled(localStorage.getItem('dashlify-google-enabled') === '1');
  }, []);

  // Permite navegar a /dashboard?action=upload&tab=google para abrir la pestaña correcta.
  useEffect(() => {
    if (!googleEnabled && activeTab === 'google') setActiveTab('upload');
    const tab = params?.get('tab');
    if (tab === 'google' && googleEnabled) setActiveTab('google');
    else if (tab === 'upload') setActiveTab('upload');
  }, [params, googleEnabled, activeTab]);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const enabled = (e as CustomEvent<{ enabled: boolean }>).detail?.enabled;
      setGoogleEnabled(Boolean(enabled));
      if (!enabled) setActiveTab('upload');
    };
    window.addEventListener('dashlify:google-enabled-changed', onToggle as EventListener);
    return () => window.removeEventListener('dashlify:google-enabled-changed', onToggle as EventListener);
  }, []);

  // Manejar importación de Google Sheets
  const handleGoogleSheetImport = useCallback(async (sheetData: ImportedSheet) => {
    devLog('📥 [DataSourceSelector] Google Sheet importado:', {
      nombre: sheetData.name,
      filas: sheetData.data.length,
      columnas: sheetData.headers.length,
    });

    try {
      devLog('⏳ [DataSourceSelector] Analizando Google Sheet con IA...');

      // Procesar el Google Sheet igual que un archivo
      const processed = await processDataset({
        name: sheetData.name,
        headers: sheetData.headers,
        sampleData: sheetData.data,
        type: 'google-sheets',
        size: '0 KB',
        sourceType: 'google-sheets',
        sheetId: sheetData.id,
        sourceUrl: sheetData.sourceUrl,
      });

      devLog('✅ [DataSourceSelector] Google Sheet procesado:', {
        id: processed.id,
        nombre: processed.name,
        filas: processed.sampleData?.length,
        analisisCompleto: !!processed.analysis,
      });

      // Crear objeto GoogleSheetData con análisis
      const googleSheetData: GoogleSheetData = {
        id: processed.id,
        name: processed.name,
        headers: processed.headers,
        data: processed.sampleData || [],
        analysis: processed.analysis, // Aquí está el análisis completo
      };

      // Guardar en estado para mostrar la UI de análisis
      setGoogleSheetAnalysis(googleSheetData);

      // Cambiar a pestaña de análisis
      setActiveTab('google');
    } catch (error) {
      console.error('❌ Error importando Google Sheet:', error);
      alert('❌ Error al procesar Google Sheet: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }, []);

  // Manejar cierre de análisis de Google Sheets
  const handleCloseGoogleAnalysis = useCallback(() => {
    setGoogleSheetAnalysis(null);
    setActiveTab('upload');
  }, []);

  // Evitar hydration mismatch: no renderizar hasta que esté montado
  if (!isMounted) {
    return null;
  }

  // Si hay análisis de Google Sheets activo, mostrar esa UI
  if (googleSheetAnalysis) {
    return (
      <GoogleSheetsAnalysisUI
        sheetData={googleSheetAnalysis}
        onClose={handleCloseGoogleAnalysis}
      />
    );
  }

  return (
    <div className="data-source-selector">
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'upload' ? 'var(--accent)' : 'var(--text2)',
            borderBottom: activeTab === 'upload' ? '3px solid var(--accent)' : 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: activeTab === 'upload' ? 'bold' : 'normal',
            marginBottom: '-2px',
            transition: 'color 0.2s',
          }}
        >
          📁 Subir archivos
        </button>
        {googleEnabled && (
          <button
            onClick={() => setActiveTab('google')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'google' ? 'var(--accent)' : 'var(--text2)',
              borderBottom: activeTab === 'google' ? '3px solid var(--accent)' : 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: activeTab === 'google' ? 'bold' : 'normal',
              marginBottom: '-2px',
              transition: 'color 0.2s',
            }}
          >
            🔗 Google Sheets
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div>
          <UploadZone onWideChange={onWideChange} />
        </div>
      )}

      {googleEnabled && activeTab === 'google' && (
        <div style={{ padding: 18, background: 'var(--surface2)', borderRadius: 12 }}>
          <GoogleSheetsModal
            open={true}
            mode="inline-url"
            onClose={() => {}}
            onImport={handleGoogleSheetImport}
          />
        </div>
      )}
    </div>
  );
}

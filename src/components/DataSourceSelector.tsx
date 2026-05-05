'use client';

import React, { useState, useEffect, useCallback } from 'react';
import UploadZone from './UploadZone';
import { GoogleSheetsModal, type ImportedSheet } from './GoogleSheetsModal';
import { GoogleSheetsAnalysisUI, type GoogleSheetData } from './GoogleSheetsAnalysisUI';
import { processDataset } from '@/lib/datasetAnalysis';

type TabType = 'upload' | 'google';

export function DataSourceSelector({ onWideChange }: { onWideChange?: (wide: boolean) => void }) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);
  const [googleSheetAnalysis, setGoogleSheetAnalysis] = useState<GoogleSheetData | null>(null);

  // Solo renderizar en cliente para evitar hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Manejar importación de Google Sheets
  const handleGoogleSheetImport = useCallback(async (sheetData: ImportedSheet) => {
    console.log('📥 [DataSourceSelector] Google Sheet importado:', {
      nombre: sheetData.name,
      filas: sheetData.data.length,
      columnas: sheetData.headers.length,
    });

    try {
      console.log('⏳ [DataSourceSelector] Analizando Google Sheet con IA...');

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

      console.log('✅ [DataSourceSelector] Google Sheet procesado:', {
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

      // Cerrar modal
      setGoogleSheetsModalOpen(false);

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
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div>
          <UploadZone onWideChange={onWideChange} />
        </div>
      )}

      {activeTab === 'google' && (
        <div
          style={{
            padding: '20px',
            background: 'var(--surface2)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>
              Conectar Google Sheets
            </div>
            <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: 0 }}>
              Importa datos directamente desde tus Google Sheets. Puedes hacer búsquedas en Drive o pegar una URL/ID.
            </p>
          </div>
          <button
            onClick={() => setGoogleSheetsModalOpen(true)}
            className="btn btn-primary"
            style={{ marginTop: 12 }}
          >
            🔐 Conectar con Google Sheets
          </button>
        </div>
      )}

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        open={googleSheetsModalOpen}
        onClose={() => setGoogleSheetsModalOpen(false)}
        onImport={handleGoogleSheetImport}
      />
    </div>
  );
}

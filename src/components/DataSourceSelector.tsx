'use client';

import React, { useState } from 'react';
import UploadZone from './UploadZone';
import { GoogleSheetsModal, ImportedSheet } from './GoogleSheetsModal';
import { GoogleSheetsDataset } from '@/types/dataset';

type TabType = 'upload' | 'google';

export function DataSourceSelector() {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);

  // Manejar importación de Google Sheets
  const handleGoogleSheetImport = async (sheetData: ImportedSheet) => {
    try {
      // Nota: El dataset de Google Sheets se guarda en localStorage y en la BD
      // El evento 'dashlify:datasets-changed' dispara la recarga en el dashboard

      // Disparar evento personalizado (igual que UploadZone)
      // Esto permite que el dashboard se entere de los cambios
      window.dispatchEvent(new CustomEvent('dashlify:datasets-changed'));

      setGoogleSheetsModalOpen(false);
    } catch (error) {
      console.error('Error importando Google Sheet:', error);
    }
  };

  // UploadZone maneja sus datos de forma diferente (mediante eventos)
  // DataSourceSelector solo necesita renderizar UploadZone sin callbacks adicionales

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
          <UploadZone />
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

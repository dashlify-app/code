'use client';

import React, { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';

export interface ImportedSheet {
  id: string;
  name: string;
  data: Record<string, any>[];
  headers: string[];
  sourceUrl: string;
  refreshInterval?: number;
  isAutoRefresh: boolean;
}

interface GoogleSheetsModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (sheetData: ImportedSheet) => void;
}

type TabType = 'drive' | 'url';
type RefreshMode = 'manual' | 'auto';

export function GoogleSheetsModal({ open, onClose, onImport }: GoogleSheetsModalProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('drive');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [refreshMode, setRefreshMode] = useState<RefreshMode>('manual');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    data: Record<string, any>[];
    headers: string[];
    name: string;
    id: string;
  } | null>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [showFileList, setShowFileList] = useState(false);

  // Extraer ID de Google Sheets desde URL
  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Manejar URL/ID directo
  const handleDirectInput = () => {
    let id = sheetId || extractSheetId(sheetUrl);
    if (!id) {
      setError('Por favor ingresa una URL o ID válido de Google Sheets');
      return;
    }

    fetchSheetData(id, sheetUrl || `https://docs.google.com/spreadsheets/d/${id}`);
  };

  // Obtener datos de la sheet
  const fetchSheetData = async (id: string, url: string) => {
    const accessToken = (session as any)?.accessToken;
    if (!accessToken) {
      setError('Sesión de Google no disponible. Por favor inicia sesión primero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/google-sheets/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: id,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener datos de la sheet');
      }

      const result = await response.json();

      setPreview({
        data: result.data || [],
        headers: result.headers || [],
        name: result.name || 'Google Sheet',
        id: id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener datos de la sheet');
    } finally {
      setLoading(false);
    }
  };

  // Listar archivos de Google Drive
  const handleListDriveFiles = async () => {
    const accessToken = (session as any)?.accessToken;
    if (!accessToken) {
      setError('Sesión de Google no disponible. Por favor inicia sesión primero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/google-sheets/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al listar archivos de Drive');
      }

      const result = await response.json();
      setDriveFiles(result.files || []);
      setShowFileList(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al listar archivos de Drive');
    } finally {
      setLoading(false);
    }
  };

  // Seleccionar archivo de Drive
  const handleSelectFile = (file: any) => {
    fetchSheetData(file.id, file.webViewLink);
    setShowFileList(false);
  };

  // Confirmar importación
  const handleConfirmImport = () => {
    if (!preview) {
      setError('Por favor carga una sheet antes de confirmar');
      return;
    }

    const importedSheet: ImportedSheet = {
      id: preview.id,
      name: preview.name,
      data: preview.data,
      headers: preview.headers,
      sourceUrl: `https://docs.google.com/spreadsheets/d/${preview.id}`,
      refreshInterval: refreshMode === 'auto' ? refreshInterval : undefined,
      isAutoRefresh: refreshMode === 'auto',
    };

    onImport(importedSheet);
    handleReset();
    onClose();
  };

  // Resetear formulario
  const handleReset = () => {
    setActiveTab('drive');
    setSheetUrl('');
    setSheetId('');
    setRefreshMode('manual');
    setRefreshInterval(5);
    setError('');
    setPreview(null);
    setDriveFiles([]);
    setShowFileList(false);
  };

  if (!open) return null;

  if (!session) {
    return (
      <div className="dlf-share-backdrop" onClick={onClose}>
        <div className="dlf-share-card" onClick={(e) => e.stopPropagation()}>
          <div className="dlf-share-header">
            <div className="dlf-share-icon">🔗</div>
            <div className="dlf-share-title">Conectar Google Sheets</div>
            <button className="dlf-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="dlf-share-body">
            <p style={{ marginBottom: '16px' }}>Necesitas iniciar sesión con Google para conectar Google Sheets.</p>
            <button
              onClick={() => signIn('google')}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              🔐 Iniciar sesión con Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dlf-share-backdrop" onClick={onClose}>
      <div className="dlf-share-card" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dlf-share-header">
          <div className="dlf-share-icon">📊</div>
          <div className="dlf-share-title">Conectar Google Sheets</div>
          <button className="dlf-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="dlf-share-body" style={{ gap: 16 }}>
          {/* Pestañas */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => { setActiveTab('drive'); setShowFileList(false); }}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'drive' ? 'var(--accent)' : 'var(--text2)',
                borderBottom: activeTab === 'drive' ? '2px solid var(--accent)' : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === 'drive' ? 'bold' : 'normal',
              }}
            >
              📁 Buscar en Drive
            </button>
            <button
              onClick={() => { setActiveTab('url'); setShowFileList(false); }}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'url' ? 'var(--accent)' : 'var(--text2)',
                borderBottom: activeTab === 'url' ? '2px solid var(--accent)' : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === 'url' ? 'bold' : 'normal',
              }}
            >
              🔗 Pegar URL/ID
            </button>
          </div>

          {/* Tab: Buscar en Drive */}
          {activeTab === 'drive' && !showFileList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: 0 }}>
                Haz clic en "Listar Sheets" para ver tus Google Sheets en Drive y selecciona uno para importar.
              </p>
              <button
                onClick={handleListDriveFiles}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '⏳ Cargando...' : '📂 Listar Sheets en Drive'}
              </button>
            </div>
          )}

          {/* Tab: Pegar URL/ID */}
          {activeTab === 'url' && !showFileList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">URL de Google Sheets o ID</label>
                <input
                  type="text"
                  placeholder="Ej: https://docs.google.com/spreadsheets/d/SHEET_ID/edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="form-input w-full"
                  style={{ marginBottom: 8 }}
                />
                <input
                  type="text"
                  placeholder="O pega solo el ID: SHEET_ID"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className="form-input w-full"
                />
                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: 4 }}>
                  Puedes usar la URL completa o solo el ID de la sheet
                </div>
              </div>
              <button
                onClick={handleDirectInput}
                disabled={loading || (!sheetUrl && !sheetId)}
                className="btn btn-primary"
              >
                {loading ? '⏳ Cargando...' : '⬇️ Cargar Sheet'}
              </button>
            </div>
          )}

          {/* Mostrar lista de archivos Drive */}
          {showFileList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setShowFileList(false)}
                style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
              >
                ← Volver
              </button>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                {driveFiles.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text2)' }}>
                    No se encontraron Google Sheets
                  </div>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{file.name}</div>
                      <div style={{ fontSize: '12px', opacity: 0.6 }}>{file.id}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Vista previa de datos */}
          {preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px', background: 'var(--surface3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 8 }}>
                  ✅ Sheet cargada: <strong>{preview.name}</strong>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {preview.headers.length} columnas | {preview.data.length} filas
                </div>
              </div>

              {/* Preview tabla */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface3)', borderBottom: '1px solid var(--border)' }}>
                      {preview.headers.map((header) => (
                        <th
                          key={header}
                          style={{
                            padding: '8px',
                            textAlign: 'left',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            color: 'var(--accent)',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.slice(0, 5).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        {preview.headers.map((header) => (
                          <td key={`${idx}-${header}`} style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                            {String(row[header] || '').substring(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Configuración de refresh */}
              <div>
                <label className="form-label">Actualización de datos</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      value="manual"
                      checked={refreshMode === 'manual'}
                      onChange={(e) => setRefreshMode(e.target.value as RefreshMode)}
                    />
                    🔘 Manual (Refrescar manualmente)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      value="auto"
                      checked={refreshMode === 'auto'}
                      onChange={(e) => setRefreshMode(e.target.value as RefreshMode)}
                    />
                    ⏰ Automático
                  </label>
                </div>

                {refreshMode === 'auto' && (
                  <div style={{ marginTop: 8 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Cada cuántos minutos refrescar</label>
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="form-select w-full"
                    >
                      <option value={5}>5 minutos</option>
                      <option value={10}>10 minutos</option>
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--error)',
              borderRadius: '8px',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button
              onClick={onClose}
              className="btn btn-outline"
              disabled={loading}
            >
              Cancelar
            </button>
            {preview && (
              <button
                onClick={handleConfirmImport}
                className="btn btn-primary"
                disabled={loading}
              >
                ✅ Importar Sheet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { devLog } from '@/lib/logger';

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
  onImport: (sheetData: ImportedSheet) => void | Promise<void>;
  /**
   * - modal: renderiza como overlay (comportamiento actual)
   * - inline-url: renderiza embebido (sin backdrop) y enfocado en pegar URL/ID
   */
  mode?: 'modal' | 'inline-url';
  /** Texto del botón que confirma y añade la hoja (p. ej. lista multi-sheet) */
  confirmImportLabel?: string;
}

type RefreshMode = 'manual' | 'auto';

export function GoogleSheetsModal({
  open,
  onClose,
  onImport,
  mode = 'modal',
  confirmImportLabel,
}: GoogleSheetsModalProps) {
  const confirmLabel =
    confirmImportLabel ?? (mode === 'inline-url' ? '➕ Añadir a la lista' : '✅ Importar Sheet');
  const { data: session } = useSession();
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

    // Siempre cargar los datos del API (funciona con o sin autenticación de Google)
    fetchSheetData(id, sheetUrl || `https://docs.google.com/spreadsheets/d/${id}`);
  };

  // Obtener datos de la sheet
  const fetchSheetData = async (id: string, url: string) => {
    const accessToken = (session as any)?.accessToken;

    setLoading(true);
    setError('');

    try {
      // Intentar sin autenticación primero (para sheets públicas)
      const response = await fetch('/api/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch',
          sheetId: id,
          accessToken: accessToken || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Si es privado y no tiene autenticación, mostrar botón para conectar
        if (response.status === 403 && !accessToken) {
          setError('Este Google Sheet es privado. Conecta tu cuenta para acceder.');
          setPreview(null);
          setLoading(false);
          return;
        }

        throw new Error(errorData.error || 'Error al obtener datos de la sheet');
      }

      const result = await response.json();

      devLog('✅ [GoogleSheetsModal] Sheet data received:', {
        rowCount: result.data?.length,
        headerCount: result.headers?.length,
        name: result.name,
      });

      setPreview({
        data: result.data || [],
        headers: result.headers || [],
        name: result.name || 'Google Sheet',
        id: id,
      });
    } catch (err) {
      console.error('❌ [GoogleSheetsModal] Error loading sheet:', err);
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
      const response = await fetch('/api/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
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
    devLog('🔍 [GoogleSheetsModal] handleConfirmImport clicked');

    if (!preview) {
      console.error('❌ [GoogleSheetsModal] No preview available');
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

    devLog('📤 [GoogleSheetsModal] Preparando para enviar:', {
      nombre: importedSheet.name,
      filas: importedSheet.data.length,
      columnas: importedSheet.headers.length,
    });

    try {
      // Llamar callback - es síncrono
      onImport(importedSheet);
      devLog('✅ [GoogleSheetsModal] onImport llamado');
    } catch (error) {
      console.error('❌ [GoogleSheetsModal] Error in onImport:', error);
      setError('Error al importar: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      return;
    }

    handleReset();
    onClose();
  };

  // Resetear formulario
  const handleReset = () => {
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

  const content = (
    <div className="dlf-share-body" style={{ gap: 16 }}>
      {/* Pegar URL/ID (inline-url fuerza este flujo) */}
      {(!showFileList || mode === 'inline-url') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              padding: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            <p style={{ fontSize: '13px', margin: 0, opacity: 0.9 }}>
              💡 <strong>URLs públicas</strong> funcionan sin conectar Google.
            </p>
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: 'var(--surface)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(248, 250, 252, 0.6)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
                Opción A
              </div>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Pega la URL de Google Sheets
              </label>
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/SHEET_ID/edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="form-input w-full"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
              <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>o</div>
              <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            </div>

            <div
              style={{
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(248, 250, 252, 0.6)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
                Opción B
              </div>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Pega solo el ID
              </label>
              <input
                type="text"
                placeholder="SHEET_ID"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                className="form-input w-full"
              />
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                Tip: el ID es la parte entre <strong>/d/</strong> y <strong>/edit</strong> en la URL.
              </div>
            </div>
          </div>
          <button onClick={handleDirectInput} disabled={loading || (!sheetUrl && !sheetId)} className="btn btn-primary">
            {loading ? '⏳ Cargando...' : mode === 'inline-url' ? '1️⃣ Vista previa (descargar hoja)' : '⬇️ Cargar Sheet'}
          </button>
        </div>
      )}

      {/* Mostrar lista de archivos Drive (solo en modal) */}
      {mode !== 'inline-url' && showFileList && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setShowFileList(false)}
            style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
          >
            ← Volver
          </button>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            {driveFiles.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text2)' }}>No se encontraron Google Sheets</div>
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

          {mode === 'inline-url' && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '2px solid #0ea5e9',
                background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#0f172a', lineHeight: 1.5 }}>
                <strong>Paso 2 — Añadir a la lista:</strong> confirma para guardar esta hoja en el análisis y luego
                pega <strong>otra URL</strong>.
              </p>
              <button
                type="button"
                className="dlf-share-btn-primary"
                data-testid="sheets-add-to-list"
                onClick={handleConfirmImport}
                disabled={loading}
                style={{
                  width: '100%',
                  minHeight: 52,
                  fontSize: 15,
                  boxSizing: 'border-box',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          )}

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
                <input type="radio" value="auto" checked={refreshMode === 'auto'} onChange={(e) => setRefreshMode(e.target.value as RefreshMode)} />
                ⏰ Automático
              </label>
            </div>

            {refreshMode === 'auto' && (
              <div style={{ marginTop: 8 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>
                  Cada cuántos minutos refrescar
                </label>
                <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))} className="form-select w-full">
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

      {error && (
        <div>
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--error)',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
          {error.includes('privado') && !session && (
            <button onClick={() => signIn('google')} className="btn btn-primary" style={{ width: '100%' }}>
              🔐 Conectar Google Sheets
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 8 }}>
        {mode !== 'inline-url' ? (
          <button onClick={onClose} className="btn btn-outline" disabled={loading}>
            Cancelar
          </button>
        ) : null}
        {preview && mode !== 'inline-url' && (
          <button type="button" onClick={handleConfirmImport} className="btn btn-primary" disabled={loading}>
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  );

  if (mode === 'inline-url') {
    return <div>{content}</div>;
  }

  return (
    <div className="dlf-share-backdrop" onClick={onClose}>
      <div className="dlf-share-card" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="dlf-share-header">
          <div className="dlf-share-icon">🔗</div>
          <div className="dlf-share-title">Importar Google Sheets</div>
          <button className="dlf-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}

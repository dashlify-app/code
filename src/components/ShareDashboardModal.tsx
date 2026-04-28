'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, X, Shield, Clock, Activity, Loader2 } from 'lucide-react';

interface EmbedTokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
}

interface Props {
  dashboardId: string;
  dashboardTitle: string;
  open: boolean;
  onClose: () => void;
}

export default function ShareDashboardModal({ dashboardId, dashboardTitle, open, onClose }: Props) {
  const [tokens, setTokens] = useState<EmbedTokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState<'never' | '7' | '30' | '90' | '365'>('never');
  const [error, setError] = useState<string | null>(null);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/embed-tokens`);
      const data = await res.json();
      if (res.ok) setTokens(data.tokens || []);
      else setError(data.error || 'No se pudo cargar la lista');
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setError(null);
      void loadTokens();
    }
  }, [open, dashboardId]);

  const handleDownload = async () => {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (label.trim()) params.set('label', label.trim());
      if (expires !== 'never') params.set('expiresInDays', expires);
      const res = await fetch(`/api/dashboards/${dashboardId}/download?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo generar el archivo');
      }
      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `dashboard-${dashboardId.slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLabel('');
      await loadTokens();
    } catch (err: any) {
      setError(err?.message || 'Error al descargar');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Revocar este token? El HTML descargado dejará de funcionar.')) return;
    try {
      const res = await fetch(
        `/api/dashboards/${dashboardId}/embed-tokens?tokenId=${tokenId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo revocar');
      }
      await loadTokens();
    } catch (err: any) {
      setError(err?.message || 'Error al revocar');
    }
  };

  if (!open) return null;

  return (
    <div className="dlf-share-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dlf-share-card" onClick={(e) => e.stopPropagation()}>
        <button className="dlf-share-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="dlf-share-header">
          <div className="dlf-share-icon">
            <Download size={20} />
          </div>
          <div>
            <h2 className="dlf-share-title">Compartir dashboard</h2>
            <p className="dlf-share-sub">«{dashboardTitle}»</p>
          </div>
        </div>

        <div className="dlf-share-body">
          <div className="dlf-share-section">
            <div className="dlf-share-section-title">
              <Download size={14} /> Descargar HTML standalone
            </div>
            <p className="dlf-share-section-text">
              Genera un archivo .html con datos en vivo. Cada descarga crea un token único
              que puedes revocar después.
            </p>
            <div className="dlf-share-form">
              <label className="dlf-share-label">
                Etiqueta (opcional)
                <input
                  type="text"
                  className="dlf-share-input"
                  placeholder="Cliente A · Q1 2026"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  disabled={generating}
                />
              </label>
              <label className="dlf-share-label">
                Caducidad
                <select
                  className="dlf-share-input"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value as any)}
                  disabled={generating}
                >
                  <option value="never">Sin caducidad</option>
                  <option value="7">7 días</option>
                  <option value="30">30 días</option>
                  <option value="90">90 días</option>
                  <option value="365">1 año</option>
                </select>
              </label>
              <button
                className="dlf-share-btn-primary"
                onClick={handleDownload}
                disabled={generating}
              >
                {generating ? <Loader2 size={16} className="dlf-spin" /> : <Download size={16} />}
                {generating ? 'Generando…' : 'Descargar HTML'}
              </button>
            </div>
          </div>

          {error && (
            <div className="dlf-share-error" role="alert">
              {error}
            </div>
          )}

          <div className="dlf-share-section">
            <div className="dlf-share-section-title">
              <Shield size={14} /> Tokens activos ({tokens.filter((t) => !t.revokedAt).length})
            </div>
            {loading ? (
              <div className="dlf-share-empty">Cargando…</div>
            ) : tokens.length === 0 ? (
              <div className="dlf-share-empty">
                Aún no has descargado ningún HTML. Descarga uno arriba para empezar.
              </div>
            ) : (
              <div className="dlf-share-tokens">
                {tokens.map((t) => (
                  <div
                    key={t.id}
                    className={`dlf-share-token ${t.revokedAt ? 'is-revoked' : ''}`}
                  >
                    <div className="dlf-share-token-main">
                      <div className="dlf-share-token-label">
                        {t.label || 'Sin etiqueta'}
                      </div>
                      <div className="dlf-share-token-meta">
                        <span title="Creado">
                          <Clock size={11} /> {fmtDate(t.createdAt)}
                        </span>
                        <span title="Usos">
                          <Activity size={11} /> {t.useCount} usos
                        </span>
                        {t.expiresAt && (
                          <span title="Caduca">
                            ⏳ {fmtDate(t.expiresAt)}
                          </span>
                        )}
                        {t.revokedAt && <span className="dlf-share-token-revoked">REVOCADO</span>}
                      </div>
                    </div>
                    {!t.revokedAt && (
                      <button
                        className="dlf-share-token-revoke"
                        onClick={() => handleRevoke(t.id)}
                        title="Revocar token"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

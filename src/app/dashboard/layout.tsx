'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Minus } from 'lucide-react';
import UploadZone from '@/components/UploadZone';

type DashboardRow = { id: string; title: string; updatedAt: string };

function DeleteDashboardModal({
  open,
  title,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="dash-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dash-confirm-del-title"
      onClick={busy ? undefined : onCancel}
    >
      <div className="dash-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="dash-confirm-del-title" className="dash-confirm-title">
          Eliminar dashboard
        </h2>
        <p className="dash-confirm-text">
          ¿Seguro que deseas eliminar <strong>«{title}»</strong>? Esta acción no se puede deshacer.
        </p>
        {error ? (
          <p className="dash-confirm-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dash-confirm-actions">
          <button type="button" className="btn-sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn-confirm-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [liveSec, setLiveSec] = useState(8);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalWide, setUploadModalWide] = useState(false);
  const onUploadZoneWideChange = useCallback((wide: boolean) => {
    setUploadModalWide(wide);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (localStorage.getItem('dash-theme') === 'dark') setDark(true);
    if (localStorage.getItem('dashlify-sidebar') === '0') setSidebarOpen(false);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      const next = !open;
      localStorage.setItem('dashlify-sidebar', next ? '1' : '0');
      return next;
    });
  };

  const fetchDashboards = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/dashboards');
      const data = await res.json();
      if (!res.ok) return;
      setDashboards(Array.isArray(data.dashboards) ? data.dashboards : []);
    } catch {
      /* ignore */
    }
  }, [status]);

  const cancelDelete = useCallback(() => {
    if (deletingId != null) return;
    setPendingDelete(null);
    setDeleteError(null);
  }, [deletingId]);

  const openDelete = useCallback((e: React.MouseEvent, dashboardId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleteInFlight.current) return;
    setDeleteError(null);
    setPendingDelete({ id: dashboardId, title });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleteInFlight.current) return;
    deleteInFlight.current = true;
    const { id: dashboardId } = pendingDelete;
    setDeletingId(dashboardId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(typeof data?.error === 'string' ? data.error : 'No se pudo eliminar');
        return;
      }
      setPendingDelete(null);
      setDashboards((prev) => prev.filter((d) => d.id !== dashboardId));
      window.dispatchEvent(new CustomEvent('dashlify:dashboards-changed'));
      if (pathname === `/dashboard/canvas/${dashboardId}`) {
        router.push('/dashboard');
      }
    } catch {
      setDeleteError('No se pudo eliminar. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  }, [pendingDelete, pathname, router]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  useEffect(() => {
    const onDashChange = () => fetchDashboards();
    window.addEventListener('dashlify:dashboards-changed', onDashChange);
    return () => window.removeEventListener('dashlify:dashboards-changed', onDashChange);
  }, [fetchDashboards]);

  useEffect(() => {
    const t = setInterval(() => setLiveSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deletingId == null) cancelDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete, deletingId, cancelDelete]);

  useEffect(() => {
    if (!uploadModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUploadModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploadModalOpen]);

  useEffect(() => {
    if (!uploadModalOpen) setUploadModalWide(false);
  }, [uploadModalOpen]);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('dash-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  /** Igual que legacy `openUpload()`: modal centrado (no solo scroll a la página). */
  const openUpload = () => {
    setUploadModalOpen(true);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b0f] text-[#00d4ff]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00d4ff] border-t-transparent" />
      </div>
    );
  }

  const rootClass = [dark ? 'dash-dark' : '', sidebarOpen ? '' : 'sidebar-collapsed'].filter(Boolean).join(' ');

  return (
    <div id="dash-admin" className={rootClass}>
      <header className="dash-admin-header">
        <Link href="/dashboard" className="logo">
          Dashlify<span>.app</span>
          <span className="logo-tag">LIVE</span>
        </Link>
        <nav className="nav-pills" aria-label="Vista principal">
          <button type="button" className="nav-pill" onClick={openUpload}>
            ⬆ Cargar datos
          </button>
          <button type="button" className={`nav-pill ${pathname === '/dashboard' ? 'active' : ''}`} onClick={() => router.push('/dashboard')}>
            📊 Visualizar
          </button>
          <button type="button" className={`nav-pill ${pathname?.includes('settings') ? 'active' : ''}`} onClick={() => router.push('/dashboard/settings')}>
            ⚙ Ajustes
          </button>
        </nav>
        <div className="header-right">
          <div className="live-badge">
            <div className="live-dot" />
            <span>LIVE · {liveSec}s</span>
          </div>
          <button type="button" className="btn-sm" onClick={toggleTheme} title="Tema">
            🌓
          </button>
          <button type="button" className="btn-sm" onClick={() => setLiveSec(0)}>
            ↻ Actualizar
          </button>
          <Link href="/" className="btn-sm">
            ← Sitio
          </Link>
          <button type="button" className="btn-primary" onClick={() => router.push('/dashboard/settings')}>
            Plan / uso
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={async () => {
              await signOut({ callbackUrl: '/login' });
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {!sidebarOpen && (
        <button
          type="button"
          className="sidebar-reopen"
          onClick={toggleSidebar}
          title="Mostrar menú"
          aria-label="Mostrar menú lateral"
        >
          <span aria-hidden>›</span>
          <span className="sidebar-reopen-text">Menú</span>
        </button>
      )}

      <div className="app">
        <aside className="sidebar" aria-hidden={!sidebarOpen}>
          <div className="sb-head">
            <span className="sb-head-title">Navegación</span>
            <button
              type="button"
              className="sb-collapse"
              onClick={toggleSidebar}
              title="Ocultar menú"
              aria-label="Ocultar menú lateral"
            >
              ‹
            </button>
          </div>

          <div className="sb-block">
            <div className="sb-label">// Dataset activo</div>
            <div className="dataset-card">
              <div className="dataset-name">
                <span>📊</span> sesión actual
              </div>
              <div className="dataset-meta">
                <div className="dm-row">
                  <span>Usuario</span>
                  <span className="dm-val truncate max-w-[120px] text-right">{session?.user?.email ?? '—'}</span>
                </div>
                <div className="dm-row">
                  <span>Tipo IA</span>
                  <span className="dm-val">Auto</span>
                </div>
                <div className="dm-row">
                  <span>Sync</span>
                  <span className="dm-val" style={{ color: 'var(--accent3)' }}>
                    ● hace {liveSec}s
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="sb-block">
            <div className="sb-label">// Mis dashboards</div>
            {dashboards.length === 0 ? (
              <p className="dash-list-empty">
                Ninguno aún. Al guardar desde el canvas, aparecerá aquí.
              </p>
            ) : (
              <nav className="dash-list" aria-label="Mis dashboards">
                {dashboards.map((d) => {
                  const href = `/dashboard/canvas/${d.id}`;
                  const active = pathname === href;
                  return (
                    <div key={d.id} className="dash-list-row">
                      <Link
                        href={href}
                        className={`dash-list-item${active ? ' active' : ''}`}
                        title={d.title}
                      >
                        <span className="dli-icon" aria-hidden>
                          📐
                        </span>
                        <span className="dli-body">
                          <span className="dli-name truncate">{d.title}</span>
                          <span className="dli-sub truncate">
                            {new Date(d.updatedAt).toLocaleDateString(undefined, {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="dash-list-delete"
                        title="Eliminar dashboard"
                        aria-label={`Eliminar dashboard ${d.title}`}
                        disabled={deletingId != null || pendingDelete != null}
                        onClick={(e) => {
                          openDelete(e, d.id, d.title);
                        }}
                      >
                        <Minus className="dash-list-delete-minus" size={12} strokeWidth={3} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="sb-block">
            <div className="sb-label">// Conectores</div>
            <div className="conn-row">
              <div className="conn-info">
                <span>📊</span>
                <div>
                  <div className="conn-name">Archivos locales</div>
                  <div className="conn-status on">● Activo</div>
                </div>
              </div>
              <div className="toggle on" />
            </div>
            <div className="conn-row">
              <div className="conn-info">
                <span>🌐</span>
                <div>
                  <div className="conn-name">API / Sheets</div>
                  <div className="conn-status">○ Próximamente</div>
                </div>
              </div>
              <div className="toggle" />
            </div>
          </div>
        </aside>

        <main className="content">{children}</main>
      </div>
      <DeleteDashboardModal
        open={pendingDelete != null}
        title={pendingDelete?.title ?? ''}
        error={deleteError}
        busy={deletingId != null}
        onCancel={cancelDelete}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      {uploadModalOpen ? (
        <div
          className="dash-upload-modal-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-upload-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUploadModalOpen(false);
          }}
        >
          <div
            className={`dash-upload-modal${uploadModalWide ? ' dash-upload-modal--wide' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="dash-upload-modal-title" className="dash-upload-modal-title">
              Cargar nuevo archivo
            </h3>
            <p className="dash-upload-modal-lead" hidden={uploadModalWide}>
              La IA interpreta tu archivo y genera un dashboard en segundos.
            </p>
            <div className="dash-upload-modal-body">
              <UploadZone onWideChange={onUploadZoneWideChange} />
            </div>
            <div className="dash-upload-modal-foot">
              <button type="button" className="btn-sm" onClick={() => setUploadModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type DashboardRow = { id: string; title: string; updatedAt: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = searchParams.get('view') ?? 'auto';
  const [dark, setDark] = useState(false);
  const [liveSec, setLiveSec] = useState(8);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);

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

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('dash-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const openUpload = () => {
    if (pathname === '/dashboard') {
      // Ya estamos en el dashboard: hacer scroll directo
      document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Navegar al dashboard con param para disparar scroll tras carga
      router.push('/dashboard?action=upload');
    }
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
                    <Link
                      key={d.id}
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
                  );
                })}
              </nav>
            )}
          </div>

          <div className="sb-block">
            <div className="sb-label">// Tipo de vista</div>
            {([
              { key: 'auto',         icon: '🤖', name: 'IA Automático',   sub: 'Recomendado' },
              { key: 'executive',    icon: '📈', name: 'Ejecutivo / KPI', sub: 'Métricas clave' },
              { key: 'trends',       icon: '📉', name: 'Tendencias',      sub: 'Evolución temporal' },
              { key: 'distribution', icon: '🥧', name: 'Distribución',    sub: 'Proporciones' },
              { key: 'comparison',   icon: '📊', name: 'Comparación',     sub: 'Categorías' },
            ] as const).map((v) => (
              <button
                key={v.key}
                type="button"
                className={`viz-btn ${activeView === v.key && pathname === '/dashboard' ? 'active' : ''}`}
                onClick={() => router.push(`/dashboard?view=${v.key}`)}
              >
                <span className="vb-icon">{v.icon}</span>
                <div>
                  <div className="vb-name">{v.name}</div>
                  <div className="vb-sub">{v.sub}</div>
                </div>
              </button>
            ))}
            <button
              type="button"
              className={`viz-btn ${pathname?.includes('settings') ? 'active' : ''}`}
              onClick={() => router.push('/dashboard/settings')}
            >
              <span className="vb-icon">⚙️</span>
              <div>
                <div className="vb-name">Consumo SaaS</div>
                <div className="vb-sub">Plan y límites</div>
              </div>
            </button>
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

      <div className="export-bar">
        <div className="export-info">
          <span>📄</span>
          <div>
            <strong>dashlify-session</strong>
            <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 8 }}>IA + builder · guarda en la nube</span>
          </div>
        </div>
        <div className="export-actions">
          <button type="button" className="btn-sm" onClick={openUpload}>
            ⬆ Cargar datos
          </button>
          <button type="button" className="btn-primary" onClick={() => router.push('/dashboard/settings')}>
            Ver plan
          </button>
        </div>
      </div>
    </div>
  );
}

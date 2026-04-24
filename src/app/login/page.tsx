'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') setDark(true);
  }, []);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError('Credenciales inválidas');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);

    if (!email.trim() || !password) {
      setError('Introduce email y contraseña para registrarte.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        alert('¡Registro exitoso! Ya puedes iniciar sesión.');
      }
    } catch {
      setError('Error en el servidor');
    }
    setLoading(false);
  };

  return (
    <div id="dlf-root" className={`min-h-screen flex flex-col ${dark ? 'dlf-dark' : ''}`}>
      <div className="dlf-marquee-wrap shrink-0">
        <div className="dlf-marquee-inner">
          {Array(8)
            .fill(['Accede a tu panel', 'Misma estética Dashlify', 'IA + dashboards'])
            .flat()
            .map((t, i) => (
              <span key={i} className="dlf-marquee-item">
                {t}
              </span>
            ))}
        </div>
      </div>

      <nav className="dlf-nav dlf-nav-static border-b border-[var(--paper3)]">
        <Link href="/" className="dlf-nav-logo">
          <span className="dlf-nav-logo-dot" />
          Dashlify.app
        </Link>
        <div className="dlf-nav-links">
          <Link href="/" className="dlf-nav-link">
            Inicio
          </Link>
          <button type="button" className="dlf-nav-link" onClick={toggleTheme}>
            🌓
          </button>
        </div>
        <Link href="/" className="dlf-nav-cta">
          ← Volver al sitio
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-32">
        <div className="dlf-login-panel w-full">
          <h1 className="font-['Cabinet_Grotesk',var(--font-bricolage),sans-serif] text-3xl font-black tracking-tight mb-2 text-[var(--ink)]">
            Entrar
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-8">Accede a tu espacio de trabajo.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-1">
            <label className="dlf-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="dlf-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
            <label className="dlf-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              className="dlf-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="dlf-btn-hero dlf-btn-hero-primary mt-6 w-full justify-center !py-4 disabled:opacity-50"
            >
              {loading ? 'Cargando…' : 'Entrar'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="dlf-btn-hero dlf-btn-hero-secondary mt-4 w-full justify-center !py-4 disabled:opacity-50"
          >
            Registrarse
          </button>
        </div>
      </div>
    </div>
  );
}

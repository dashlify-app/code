'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const MARQUEE_ITEMS = [
  'Dashboards con IA',
  'Sin prompts. Sin esfuerzo.',
  'Carga. Analiza. Descarga.',
  'Conectores en tiempo real',
  'Ya lo hicimos por ti',
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') setDark(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="dlf-root" className={dark ? 'dlf-dark' : ''}>
      <div className="dlf-marquee-wrap fixed top-0 left-0 right-0 z-[600]">
        <div className="dlf-marquee-inner">
          {/* Dos mitades idénticas para translateX(-50%) del keyframe (como el HTML legacy) */}
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((t, i) => (
            <span key={i} className="dlf-marquee-item">
              {t}
            </span>
          ))}
        </div>
      </div>

      <nav className={`dlf-nav ${scrolled ? 'dlf-scrolled' : ''}`}>
        <a href="/" className="dlf-nav-logo">
          <span className="dlf-nav-logo-dot" />
          Dashlify.app
        </a>
        <div className="dlf-nav-links">
          <a href="#como-funciona" className="dlf-nav-link">
            Cómo funciona
          </a>
          <a href="#beneficios" className="dlf-nav-link">
            Beneficios
          </a>
          <a href="#precios" className="dlf-nav-link">
            Precios
          </a>
          <a href="https://dashlify.app/blog" className="dlf-nav-link" target="_blank" rel="noopener noreferrer">
            Blog
          </a>
          <button type="button" className="dlf-nav-link" onClick={toggleTheme} title="Cambiar tema">
            🌓
          </button>
        </div>
        <Link href="/login" className="dlf-nav-cta">
          Ver Demo en vivo →
        </Link>
      </nav>

      <section className="dlf-hero">
        <div className="dlf-hero-bg-grid" />
        <div className="dlf-hero-badge">
          <span className="dlf-nav-logo-dot inline-block scale-75" />
          IA ya configurada · Zero prompts necesarios
        </div>
        <h1 className="dlf-hero-headline">
          <span className="block text-[var(--ink)]">Tus datos.</span>
          <span className="dlf-hl-outline">Tu dashboard.</span>
          <span className="dlf-hl-lime">Listo al instante.</span>
        </h1>
        <p className="dlf-hero-sub">
          Sube tu Excel, CSV o JSON. La IA de Dashlify <strong>interpreta, propone y construye</strong> el dashboard perfecto
          para tu información. Descárgalo, alójalo, compártelo. <strong>Sin escribir un solo prompt.</strong>
        </p>
        <div className="dlf-hero-actions">
          <Link href="/login" className="dlf-btn-hero dlf-btn-hero-primary">
            <span>⚡</span> Ver demo en vivo
          </Link>
          <button type="button" className="dlf-btn-hero dlf-btn-hero-secondary" onClick={() => scrollToId('como-funciona')}>
            Cómo funciona
          </button>
        </div>

        <div className="mt-8 flex items-center gap-4 relative z-[1]">
          <div className="flex">
            {['👩‍💼', '👨‍💻', '👩‍🔬', '👨‍🎨', '+'].map((a, i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-full border-2 -ml-2 first:ml-0 flex items-center justify-center text-base"
                style={{
                  borderColor: 'var(--paper)',
                  background: 'var(--ink2)',
                  color: 'var(--paper)',
                }}
              >
                {a}
              </div>
            ))}
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>+2,400 equipos</strong> ya generaron su primer dashboard en menos de 60
            segundos.
          </p>
        </div>

        {/* Right-side mock (como legacy) */}
        <div className="dlf-hero-visual" aria-hidden="true">
          <div className="dlf-hero-visual-inner">
            <div className="dlf-ai-tag">✦ IA activa</div>
            <div className="dlf-hero-visual-bar">
              <div className="dlf-hv-dot" />
              <div className="dlf-hv-dot" />
              <div className="dlf-hv-dot" />
              <span className="dlf-hv-title">// VENTAS_2024.XLSX — INTERPRETANDO...</span>
            </div>
            <div className="dlf-hv-kpi-row">
              <div className="dlf-hv-kpi">
                <div className="dlf-hv-kpi-label">Ventas YTD</div>
                <div className="dlf-hv-kpi-val c1">$4.77M</div>
                <div className="dlf-hv-kpi-delta">▲ +18.4%</div>
              </div>
              <div className="dlf-hv-kpi">
                <div className="dlf-hv-kpi-label">Clientes</div>
                <div className="dlf-hv-kpi-val c2">13,347</div>
                <div className="dlf-hv-kpi-delta">▲ +12.1%</div>
              </div>
              <div className="dlf-hv-kpi">
                <div className="dlf-hv-kpi-label">Margen</div>
                <div className="dlf-hv-kpi-val c3">31.2%</div>
                <div className="dlf-hv-kpi-delta">▲ +2.8pp</div>
              </div>
            </div>
            <div className="dlf-hv-chart-row">
              <div className="dlf-hv-chart">
                <div className="dlf-hv-chart-title">VENTAS vs COSTOS — 2024</div>
                <div className="dlf-hv-bars">
                  {[
                    52, 48, 57, 66, 70, 74, 65, 78, 85, 80, 89, 98,
                  ].map((h, i) => (
                    <div
                      key={i}
                      className="dlf-hv-bar"
                      style={{
                        height: `${h}%`,
                        background:
                          i === 11
                            ? 'rgba(200,247,58,0.9)'
                            : i === 10
                              ? 'rgba(0,255,157,0.8)'
                              : `rgba(0,212,255,${0.55 + i * 0.03})`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="dlf-hv-chart">
                <div className="dlf-hv-chart-title">PARTICIPACIÓN REGIONAL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {[
                    ['Latam N.', '34%', '#00d4ff', 34],
                    ['Latam S.', '22%', '#00ff9d', 22],
                    ['España', '18%', '#c8f73a', 18],
                    ['USA H.', '15%', '#a78bfa', 15],
                    ['México', '11%', '#ff6b35', 11],
                  ].map(([lbl, pct, color, w]) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: `${w}%`, height: 6, background: String(color), borderRadius: 3 }} />
                      <span
                        style={{
                          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                          fontSize: 9,
                          color: '#4a6b82',
                        }}
                      >
                        {lbl} {pct}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="dlf-logos-band">
        <div className="dlf-logos-label">Compatible con los formatos que ya usas</div>
        <div className="dlf-logos-row">
          {['Excel', 'Google Sheets', 'CSV', 'JSON', 'Airtable', 'MySQL', 'REST API', 'PDF'].map((x) => (
            <span key={x} className="dlf-logo-item">
              {x}
            </span>
          ))}
        </div>
      </div>

      <section className="dlf-section dlf-problem">
        <div className="dlf-section-eyebrow">El problema</div>
        <h2 className="dlf-section-title">
          ¿Cuánto tiempo pierdes
          <br />
          construyendo dashboards?
        </h2>
        <p className="dlf-section-sub">
          El mundo tiene demasiados datos y muy poco tiempo. Aquí el problema que todos conocen pero nadie había resuelto
          bien.
        </p>
        <div className="dlf-pain-grid">
          {[
            {
              n: '01',
              icon: '😵',
              t: 'Horas configurando gráficos a mano',
              d: 'Elegir el tipo de gráfico correcto, los colores, las métricas. Un trabajo de diseñador que le cae al analista o al director.',
            },
            {
              n: '02',
              icon: '🤯',
              t: 'Prompts interminables a la IA',
              d: '"Hazme un dashboard de ventas con… espera, no así… con barras, no líneas… y el KPI arriba…". Eso ya no va más.',
            },
            {
              n: '03',
              icon: '🔄',
              t: 'Dashboards que no se actualizan',
              d: 'Cada semana, el mismo proceso. Exportar, actualizar, reformatear. Los datos cambian, el dashboard queda viejo.',
            },
          ].map((p) => (
            <div key={p.n} className="dlf-pain-card">
              <div className="dlf-pain-num">{p.n}</div>
              <div className="text-3xl mb-4">{p.icon}</div>
              <div className="dlf-pain-title">{p.t}</div>
              <div className="dlf-pain-text">{p.d}</div>
            </div>
          ))}
        </div>

        <div
          className="mt-16 rounded-[20px] p-12 flex items-center justify-between gap-8 flex-wrap"
          style={{ background: 'var(--lime)', color: 'var(--ink)' }}
        >
          <div
            className="text-[28px] font-black leading-tight max-w-[600px]"
            style={{ fontFamily: 'Cabinet Grotesk, var(--font-bricolage), system-ui, sans-serif' }}
          >
            &quot;Dashlify ya resolvió todo eso por ti. Solo sube tu archivo y listo.&quot;
          </div>
          <div
            className="text-5xl font-black"
            style={{ fontFamily: 'Cabinet Grotesk, var(--font-bricolage), system-ui, sans-serif', transform: 'rotate(-45deg)' }}
          >
            →
          </div>
        </div>
      </section>

      <section className="dlf-section dlf-how" id="como-funciona">
        <div className="dlf-section-eyebrow">Cómo funciona</div>
        <h2 className="dlf-section-title">
          Tres pasos.
          <br />
          Un dashboard perfecto.
        </h2>
        <p className="dlf-section-sub">
          Sin configuración, sin curva de aprendizaje, sin código. La IA hace el trabajo pesado.
        </p>
        <div className="dlf-steps-grid">
          {[
            {
              num: '1',
              icon: '📂',
              title: 'Sube tu archivo',
              text: 'Excel, CSV, JSON, Google Sheets o conéctate directo a tu base de datos. Dashlify acepta cualquier formato que ya uses en tu trabajo.',
              tag: '⬆ Upload o conector',
            },
            {
              num: '2',
              icon: '🧠',
              title: 'La IA lo interpreta',
              text: 'Nuestro motor de IA analiza la estructura, detecta patrones, identifica KPIs clave y propone automáticamente el dashboard más adecuado para tus datos.',
              tag: '🤖 Zero prompts',
            },
            {
              num: '3',
              icon: '⬇',
              title: 'Descarga y despliega',
              text: 'Exporta tu dashboard como un HTML completo. Alójalo donde quieras, conéctalo a tu fuente de datos en tiempo real y compártelo con tu equipo.',
              tag: '📦 HTML portable',
            },
          ].map((s) => (
            <div key={s.num} className="dlf-step-card">
              <div className="dlf-step-number">{s.num}</div>
              <div className="text-4xl mb-5 w-16 h-16 rounded-2xl bg-[var(--ink)] text-[var(--lime)] flex items-center justify-center">
                {s.icon}
              </div>
              <div className="dlf-step-title">{s.title}</div>
              <div className="dlf-step-text">{s.text}</div>
              <div
                className="inline-block mt-4 rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
                style={{
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                }}
              >
                {s.tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dlf-section dlf-features" id="beneficios">
        <div className="dlf-section-eyebrow">Beneficios</div>
        <h2 className="dlf-section-title">
          Todo lo que necesitas.
          <br />
          Nada de lo que no.
        </h2>
        <div className="dlf-feat-row">
          <div className="dlf-feat-card dlf-feat-dark">
            <div className="text-4xl mb-4">🤖</div>
            <div className="dlf-feat-title">IA que ya sabe qué mostrarte</div>
            <p className="text-[15px] leading-relaxed text-white/55">
              No necesitas indicarle qué tipo de gráfico usar ni qué columnas son importantes. La IA detecta si tienes
              datos financieros, operativos, de marketing o de ventas — y propone la visualización ideal.
            </p>
            <div className="mt-6 font-['DM_Mono',monospace] text-[80px] font-black leading-none text-[var(--lime)]">0</div>
            <div className="text-[13px] text-white/35 font-['DM_Mono',monospace] tracking-wide mt-1">
              PROMPTS NECESARIOS
            </div>
          </div>
          <div className="dlf-feat-card dlf-feat-lime">
            <div className="text-4xl mb-4">⬇</div>
            <div className="dlf-feat-title">Tu dashboard, tuyo de verdad</div>
            <p className="text-[15px] leading-relaxed text-black/70">
              Descarga el HTML completo. Sin dependencias de nube, sin subscripción para ver los datos. Alójalo en tu
              servidor, en Google Drive, en Notion. Es tuyo.
            </p>
            <div className="mt-6 font-['DM_Mono',monospace] text-[80px] font-black leading-none text-[var(--ink)]">
              100%
            </div>
            <div className="text-[13px] text-black/45 font-['DM_Mono',monospace] tracking-wide mt-1">
              TUYO. SIN LOCK-IN.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {[
            {
              icon: '⚡',
              title: 'Conectores en tiempo real',
              text: 'Google Sheets, REST API, MySQL, Airtable. Tu dashboard se actualiza solo. Sin volver a exportar ni reformatear.',
              chip: '🔗 Live sync',
            },
            {
              icon: '📊',
              title: '5 tipos de vista inteligentes',
              text: 'Ejecutivo, Tendencias, Distribución, Comparación, o que la IA elija. Cambia la vista en un clic — los datos no cambian, la historia sí.',
              chip: '🎨 Multi-vista',
            },
            {
              icon: '🔒',
              title: 'Tus datos no salen de tu control',
              text: 'Procesamos para interpretar, no para almacenar. El dashboard exportado funciona completamente local si así lo prefieres.',
              chip: '🛡 Privacy first',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-[20px] border-2 p-10 bg-white"
              style={{ borderColor: 'var(--paper3)' }}
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <div className="dlf-feat-title" style={{ fontSize: 22 }}>
                {f.title}
              </div>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {f.text}
              </p>
              <div
                className="inline-flex items-center gap-2 mt-5 rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
                style={{
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                }}
              >
                {f.chip}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <div
            className="rounded-[20px] border-2 p-10 bg-white"
            style={{ borderColor: 'var(--paper3)', borderLeft: '5px solid var(--lime)' }}
          >
            <div className="text-4xl mb-4">🚀</div>
            <div className="dlf-feat-title">De archivo a dashboard en menos de 60 segundos</div>
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Carga tu CSV. La IA analiza. El dashboard aparece. Sin onboarding de 40 pasos, sin tutorial de 3 horas, sin
              necesitar un ingeniero de datos. Si tienes datos, en 60 segundos tienes insights.
            </p>
            <div
              className="inline-flex items-center gap-2 mt-5 rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
              style={{
                background: 'var(--lime)',
                color: 'var(--ink)',
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
              }}
            >
              ⏱ 60 segundos
            </div>
          </div>

          <div className="rounded-[20px] border-2 p-10" style={{ background: 'var(--ink)', color: 'white', borderColor: 'var(--ink3)' }}>
            <div className="text-4xl mb-4">💬</div>
            <div className="dlf-feat-title" style={{ color: 'white' }}>
              Insights en lenguaje natural
            </div>
            <p className="text-[15px] leading-relaxed text-white/55">
              La IA no solo grafica — explica. &quot;Tu región norte creció 41% sobre el promedio. El margen de canal directo
              es el más alto.&quot; Insights que antes tardaban días.
            </p>
            <div
              className="inline-flex items-center gap-2 mt-5 rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
              style={{
                background: 'rgba(200,247,58,0.15)',
                color: 'var(--lime)',
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
              }}
            >
              🧠 AI insights
            </div>

            <div className="mt-6 rounded-xl border px-4 py-4" style={{ background: '#111', borderColor: '#222' }}>
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                  fontSize: 10,
                  color: '#4a6b82',
                  marginBottom: 8,
                  letterSpacing: '1.5px',
                }}
              >
                // INSIGHT AUTOMÁTICO
              </div>
              <div className="text-[13px] leading-relaxed text-white/70">
                &quot;Latam Norte lidera con <span style={{ color: '#c8f73a', fontWeight: 700 }}>34%</span> del revenue. Canal
                E-commerce creció <span style={{ color: '#00ff9d', fontWeight: 700 }}>+31%</span> interanual.&quot;
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dlf-section dlf-testimonials">
        <div className="dlf-section-eyebrow">Lo que dicen</div>
        <h2 className="dlf-section-title">
          Equipos que ya
          <br />
          dejaron de sufrir.
        </h2>
        <div className="dlf-testi-grid">
          {[
            {
              quote: (
                <>
                  &quot;Antes tardaba <strong>3 horas</strong> en armar el reporte semanal de ventas. Con Dashlify lo tengo en{' '}
                  <strong>45 segundos</strong>. No exagero.&quot;
                </>
              ),
              name: 'Carolina V.',
              role: 'DIRECTORA COMERCIAL · RETAIL',
              avatar: '👩‍💼',
            },
            {
              quote: (
                <>
                  &quot;Le envié el CSV al equipo directivo con el dashboard ya generado. Me preguntaron{' '}
                  <strong>qué herramienta usé</strong>. La respuesta: Dashlify y 40 segundos.&quot;
                </>
              ),
              name: 'Mateo R.',
              role: 'ANALISTA DE DATOS · FINTECH',
              avatar: '👨‍💻',
            },
            {
              quote: (
                <>
                  &quot;Lo que más me sorprendió: <strong>no tuve que escribir nada</strong>. La IA entendió que mis datos eran
                  de operaciones y propuso exactamente las métricas que necesitaba.&quot;
                </>
              ),
              name: 'Isabel M.',
              role: 'OPS MANAGER · LOGÍSTICA',
              avatar: '👩‍🔬',
            },
          ].map((t, i) => (
            <div key={i} className="dlf-testi-card">
              <div className="dlf-testi-stars">★★★★★</div>
              <div className="dlf-testi-text">{t.quote}</div>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 rounded-full bg-[#222] border-2 border-[#333] flex items-center justify-center text-lg">
                  {t.avatar}
                </div>
                <div>
                  <div className="dlf-testi-name">{t.name}</div>
                  <div className="dlf-testi-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-[1px] rounded-[20px] overflow-hidden"
          style={{ background: '#1a1a1a' }}
        >
          {[
            { val: '60s', color: 'var(--lime)', lbl: 'Tiempo promedio' },
            { val: '0', color: 'var(--cyan)', lbl: 'Prompts necesarios' },
            { val: '5', color: 'var(--gold)', lbl: 'Tipos de vista IA' },
            { val: '∞', color: 'var(--coral)', lbl: 'Archivos por mes' },
          ].map((s) => (
            <div key={s.lbl} className="text-center px-8 py-10" style={{ background: '#111' }}>
              <div
                style={{
                  fontFamily: 'Cabinet Grotesk, var(--font-bricolage), system-ui, sans-serif',
                  fontSize: 52,
                  fontWeight: 900,
                  color: s.color,
                  letterSpacing: '-2px',
                }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                  fontSize: 10,
                  color: '#444',
                  letterSpacing: '2px',
                  marginTop: 8,
                  textTransform: 'uppercase',
                }}
              >
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dlf-section" id="precios">
        <div className="dlf-section-eyebrow">Precios</div>
        <h2 className="dlf-section-title">
          Elige tu plan.
          <br />
          Empieza hoy.
        </h2>
        <p className="dlf-section-sub">Sin tarjeta de crédito para empezar. Sin sorpresas al crecer.</p>
        <div className="dlf-pricing-grid">
          <div className="dlf-price-card">
            <div className="font-['DM_Mono',monospace] text-[11px] tracking-[2px] uppercase text-[var(--text-muted)] mb-3">Starter</div>
            <div className="dlf-price-num">$0</div>
            <div className="text-[13px] text-[var(--text-muted)] mb-6">Gratis para siempre · 3 dashboards/mes</div>
            <ul className="text-sm text-[var(--text-muted)] space-y-2">
              <li>✓ <strong>3 dashboards</strong> por mes</li>
              <li>✓ CSV y JSON hasta 10MB</li>
              <li>
                ✓ <strong>5 tipos de vista</strong> con IA
              </li>
              <li>✓ Exportación HTML</li>
              <li style={{ opacity: 0.35 }}>✗ Conectores en tiempo real</li>
              <li style={{ opacity: 0.35 }}>✗ Google Sheets y API</li>
            </ul>
            <Link href="/login" className="dlf-btn-price dlf-btn-price-outline">
              Empezar gratis
            </Link>
          </div>
          <div className="dlf-price-card dlf-featured">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--lime)] text-[var(--ink)] font-['DM_Mono',monospace] text-[10px] tracking-wide px-4 py-1 rounded-full uppercase font-medium whitespace-nowrap">
              🔥 Más popular
            </div>
            <div className="font-['DM_Mono',monospace] text-[11px] tracking-[2px] uppercase text-white/50 mb-3">Pro</div>
            <div className="dlf-price-num">$29</div>
            <div className="text-[13px] text-white/40 mb-6">por mes · Facturación anual (-20%)</div>
            <ul className="text-sm text-white/65 space-y-2">
              <li>✓ <strong className="text-white">Dashboards ilimitados</strong></li>
              <li>✓ Todos los formatos hasta 100MB</li>
              <li>✓ <strong className="text-white">Conectores en tiempo real</strong></li>
              <li>✓ <strong className="text-white">Google Sheets, API, MySQL</strong></li>
              <li>✓ Insights en lenguaje natural</li>
              <li>✓ Exportación HTML + marca propia</li>
            </ul>
            <Link href="/login" className="dlf-btn-price dlf-btn-price-solid">
              Empezar con Pro →
            </Link>
          </div>
          <div className="dlf-price-card">
            <div className="font-['DM_Mono',monospace] text-[11px] tracking-[2px] uppercase text-[var(--text-muted)] mb-3">Enterprise</div>
            <div className="dlf-price-num">$99</div>
            <div className="text-[13px] text-[var(--text-muted)] mb-6">por mes · Equipos de 10+</div>
            <ul className="text-sm text-[var(--text-muted)] space-y-2">
              <li>✓ Todo lo de Pro</li>
              <li>
                ✓ <strong>Usuarios ilimitados</strong>
              </li>
              <li>✓ SSO y permisos por rol</li>
              <li>
                ✓ <strong>Dashboards compartidos</strong> por equipo
              </li>
              <li>✓ API pública para integración</li>
              <li>✓ Onboarding y soporte dedicado</li>
            </ul>
            <a href="mailto:hola@dashlify.app" className="dlf-btn-price dlf-btn-price-outline">
              Hablar con ventas
            </a>
          </div>
        </div>
      </section>

      <section className="dlf-cta-final">
        <div className="dlf-section-eyebrow">Empieza ahora</div>
        <h2 className="dlf-section-title max-w-[800px] mx-auto">
          El dashboard que necesitas
          <br />
          ya está hecho.
        </h2>
        <p className="text-lg text-black/60 mb-12 max-w-xl mx-auto">Sube tu archivo. La IA se encarga del resto. Sin excusas.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] text-[var(--lime)] px-12 py-5 font-['Cabinet_Grotesk','Space_Grotesk',sans-serif] font-black text-base hover:bg-white hover:text-[var(--ink)] transition-all hover:-translate-y-1 shadow-xl"
          >
            <span>⚡</span> Ver demo en vivo ahora
          </Link>
          <button
            type="button"
            onClick={() => scrollToId('como-funciona')}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--ink)] text-[var(--ink)] px-10 py-[18px] font-['Cabinet_Grotesk','Space_Grotesk',sans-serif] font-extrabold hover:bg-[var(--ink)] hover:text-[var(--lime)] transition-all"
          >
            Cómo funciona →
          </button>
        </div>
        <p className="mt-6 text-[13px] opacity-45 font-[family-name:var(--font-dm-mono),monospace] tracking-wider">
          GRATIS · SIN TARJETA · LISTO EN 60 SEGUNDOS
        </p>
      </section>

      <footer className="dlf-site-footer">
        <div className="dlf-footer-logo">
          Dashlify<span>.</span>app
        </div>
        <div className="flex gap-6 flex-wrap">
          <a href="#" className="dlf-footer-link">
            Producto
          </a>
          <a href="#precios" className="dlf-footer-link" onClick={(e) => { e.preventDefault(); scrollToId('precios'); }}>
            Precios
          </a>
          <a href="#" className="dlf-footer-link">
            Blog
          </a>
          <a href="#" className="dlf-footer-link">
            Docs
          </a>
          <a href="mailto:hola@dashlify.app" className="dlf-footer-link">
            Contacto
          </a>
        </div>
        <div className="font-['DM_Mono',monospace] text-[11px] tracking-wide">© 2025 Dashlify.app — Dashboards con IA</div>
      </footer>

      <Link href="/login" className="dlf-demo-float">
        <span className="w-2 h-2 rounded-full bg-[var(--lime)] animate-pulse" />
        Ver demo en vivo
      </Link>
    </div>
  );
}

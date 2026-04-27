'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardCanvas from '@/components/DashboardCanvas';
import { DashboardViewTypeBlock } from '@/components/DashboardViewTypeBlock';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';

export default function DashboardCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    title: string;
    templateId: string;
    widgets: { id: string; title: string; type: string; config: any }[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch dashboard layout & widgets
      const res = await fetch(`/api/dashboards/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'No se pudo cargar');
        setPayload(null);
        return;
      }
      const d = data.dashboard;

      // 2. Fetch datasets
      const dsRes = await fetch('/api/datasets');
      const dsData = await dsRes.json();
      const datasets = Array.isArray(dsData?.datasets) ? dsData.datasets : [];

      // 3. Inject sampleData: el índice vive en config (guardado con el widget), no en la raíz
      const widgetsWithData = hydrateDashboardWidgets(d.widgets || [], datasets);

      setPayload({
        title: d.title,
        templateId: d.templateId,
        widgets: widgetsWithData,
      });
    } catch {
      setError('Error de red');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!id) {
    return (
      <div className="rounded-xl border p-8" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
        ID inválido.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-3" style={{ color: 'var(--accent)' }}>
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="font-[family-name:var(--font-dm-mono),monospace] text-xs uppercase tracking-widest">
          Cargando canvas…
        </span>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="space-y-4 rounded-xl border p-8" style={{ borderColor: 'var(--border)' }}>
        <p style={{ color: 'var(--text2)' }}>{error || 'Sin datos'}</p>
        <button type="button" className="btn-sm" onClick={() => router.push('/dashboard')}>
          Volver al panel
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-view-modes w-full min-w-0">
      <DashboardViewTypeBlock
        activeView="business"
        showActive={false}
        onSelectView={(k) => router.push(`/dashboard?view=${k}`)}
        hint="Abre el análisis en el panel (Visualizar) con el modo de vista elegido; misma sesión de datos."
      />
      <DashboardCanvas
        key={`${id}-${payload.widgets.map((w) => w.id).join(',')}`}
        dashboardId={id}
        initialTitle={payload.title}
        initialTemplateId={payload.templateId}
        initialWidgets={payload.widgets}
        onSave={async () => {
          await load();
          router.refresh();
        }}
      />
    </div>
  );
}

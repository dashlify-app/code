'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardCanvas from '@/components/DashboardCanvas';

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

      // 2. Fetch datasets to inject sampleData into widgets
      const dsRes = await fetch('/api/datasets');
      const dsData = await dsRes.json();
      const allSampleData = (Array.isArray(dsData?.datasets) ? dsData.datasets : [])
        .flatMap((ds: any) => ds.rawSchema?.sampleData || []);

      // 3. Inject sampleData into every widget's config
      const widgetsWithData = (d.widgets || []).map((w: any) => ({
        ...w,
        config: { ...w.config, sampleData: allSampleData },
      }));

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
    <DashboardCanvas
      dashboardId={id}
      initialTitle={payload.title}
      initialTemplateId={payload.templateId}
      initialWidgets={payload.widgets}
      onSave={() => router.refresh()}
    />
  );
}

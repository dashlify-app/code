'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardCanvas from '@/components/DashboardCanvas';
import { DashboardViewTypeBlock } from '@/components/DashboardViewTypeBlock';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';
import { buildSemanticContext, getViewsForDataset, type SemanticViewKey } from '@/lib/semanticContext';

/** Detectar tipos de columnas en un dataset */
function detectColumnTypes(headers: string[], rows: Record<string, any>[]) {
  const sample = rows.slice(0, 20);
  const numeric: string[] = [];
  const categorical: string[] = [];
  const dates: string[] = [];

  for (const h of headers) {
    const vals = sample.map((r) => {
      const v = r[h];
      return v !== null && v !== undefined && v !== '' ? String(v).trim() : null;
    }).filter((v) => v !== null);

    if (vals.length === 0) continue; // Sin datos, pasar a la siguiente columna

    // Detectar si es numérico
    const numVals = vals.map((v) => {
      const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
      return !isNaN(n) ? n : null;
    }).filter((v) => v !== null);

    const numRatio = numVals.length / vals.length;

    // Detectar si es fecha
    const dateVals = vals.filter((v) => !isNaN(Date.parse(String(v))));
    const dateRatio = dateVals.length / vals.length;

    if (dateRatio > 0.5) {
      dates.push(h);
    } else if (numRatio > 0.5) {
      numeric.push(h);
    } else {
      categorical.push(h);
    }
  }

  return { numeric, categorical, dates };
}

export default function DashboardCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    title: string;
    templateId: string;
    sourceType?: 'upload' | 'google-sheets';
    widgets: { id: string; title: string; type: string; config: any }[];
    headers?: string[];
    rows?: Record<string, any>[];
  } | null>(null);

  // Calcular vistas disponibles basadas en los datos del dataset
  const enabledViews = useMemo((): SemanticViewKey[] => {
    // En canvas nunca queremos mostrar las 6 por default; si faltan datos, solo “Visión general”.
    if (!payload?.headers || !payload?.rows) return ['business'];

    const types = detectColumnTypes(payload.headers, payload.rows);
    const semantic = buildSemanticContext(payload.headers, payload.rows, types.dates);
    return getViewsForDataset(semantic);
  }, [payload?.headers, payload?.rows]);

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

      // 4. Determine sourceType from the dashboard's datasets
      let sourceType: 'upload' | 'google-sheets' = 'upload';
      let datasetHeaders: string[] | undefined;
      let datasetRows: Record<string, any>[] | undefined;

      if (d.widgets && d.widgets.length > 0) {
        const firstWidget = d.widgets[0];
        const datasetId = firstWidget.datasetId;
        if (datasetId) {
          const dataset = datasets.find((ds: any) => ds.id === datasetId);
          if (dataset && dataset.sourceType) {
            sourceType = dataset.sourceType;
          }
          // Extract headers and rows for semantic context
          if (dataset?.rawSchema) {
            datasetHeaders = dataset.rawSchema.headers;
            datasetRows = dataset.rawSchema.sampleData;
          }
        }
      }

      setPayload({
        title: d.title,
        templateId: d.templateId,
        sourceType,
        widgets: widgetsWithData,
        headers: datasetHeaders,
        rows: datasetRows,
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
        enabledViewKeys={enabledViews}
      />
      <DashboardCanvas
        key={`${id}-${payload.widgets.map((w) => w.id).join(',')}`}
        dashboardId={id}
        initialTitle={payload.title}
        initialTemplateId={payload.templateId}
        sourceType={payload.sourceType}
        initialWidgets={payload.widgets}
        onSave={async () => {
          await load();
          router.refresh();
        }}
      />
    </div>
  );
}

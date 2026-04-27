import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/admin/widget-health
 *
 * Reports widgets whose dataset reference is broken:
 *   - orphan_by_id:   datasetId points to a non-existent Dataset
 *   - orphan_by_name: datasetName has no matching Dataset in same org
 *   - no_reference:   widget has neither datasetId nor datasetName
 *   - heavy_config:   widget config still has sampleData/headers (legacy)
 *
 * Used to detect data integrity issues after migration to datasetId FK.
 * Scoped to current user's organization (or all if none set).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // 1. Get all dashboards for this user
    const { data: dashboards } = await supabaseAdmin
      .from('Dashboard')
      .select('id, organizationId')
      .eq('userId', userId);

    const dashboardIds = (dashboards || []).map((d) => d.id);
    if (dashboardIds.length === 0) {
      return NextResponse.json({
        totalWidgets: 0,
        orphan_by_id: [],
        orphan_by_name: [],
        no_reference: [],
        heavy_config: [],
      });
    }

    // 2. Get all widgets for those dashboards
    const { data: widgets } = await supabaseAdmin
      .from('Widget')
      .select('id, dashboardId, type, datasetId, datasetName, dataSourceConfig')
      .in('dashboardId', dashboardIds);

    // 3. Get all datasets for the user's orgs
    const orgIds = Array.from(
      new Set((dashboards || []).map((d) => d.organizationId).filter(Boolean))
    );
    const { data: datasets } = await supabaseAdmin
      .from('Dataset')
      .select('id, name, organizationId')
      .or(
        orgIds.length > 0
          ? `organizationId.in.(${orgIds.join(',')}),organizationId.is.null`
          : 'organizationId.is.null'
      );

    const datasetById = new Map((datasets || []).map((d) => [d.id, d]));
    const datasetByName = new Map((datasets || []).map((d) => [d.name, d]));

    const orphan_by_id: any[] = [];
    const orphan_by_name: any[] = [];
    const no_reference: any[] = [];
    const heavy_config: any[] = [];

    for (const w of widgets || []) {
      const cfg: any = w.dataSourceConfig || {};
      const hasHeavy = ['sampleData', 'headers', 'rawSchema', 'analysis'].some((k) => k in cfg);
      if (hasHeavy) {
        const size = JSON.stringify(cfg).length;
        heavy_config.push({ id: w.id, type: w.type, dashboardId: w.dashboardId, configSizeBytes: size });
      }

      if (w.datasetId) {
        if (!datasetById.has(w.datasetId)) {
          orphan_by_id.push({ id: w.id, type: w.type, datasetId: w.datasetId });
        }
        continue;
      }
      if (w.datasetName) {
        if (!datasetByName.has(w.datasetName)) {
          orphan_by_name.push({ id: w.id, type: w.type, datasetName: w.datasetName });
        }
        continue;
      }
      no_reference.push({ id: w.id, type: w.type, dashboardId: w.dashboardId });
    }

    return NextResponse.json({
      totalWidgets: widgets?.length ?? 0,
      totalDatasets: datasets?.length ?? 0,
      orphan_by_id,
      orphan_by_name,
      no_reference,
      heavy_config,
      summary: {
        healthy:
          (widgets?.length ?? 0) -
          orphan_by_id.length -
          orphan_by_name.length -
          no_reference.length,
        needsAttention: orphan_by_id.length + orphan_by_name.length + no_reference.length,
        heavyConfigsRemaining: heavy_config.length,
      },
    });
  } catch (err: any) {
    console.error('GET /api/admin/widget-health error:', err);
    return NextResponse.json({ error: err?.message || 'Error desconocido' }, { status: 500 });
  }
}

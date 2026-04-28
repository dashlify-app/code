import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashToken, isWellFormed } from '@/lib/embedToken';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';

/**
 * Maps a widget from the database format to canvas format.
 * This is the same logic used in /api/dashboards/[id] GET endpoint.
 */
function mapWidgetForCanvas(w: { id: string; type: string; dataSourceConfig: unknown; datasetIndex?: number; datasetName?: string | null; datasetId?: string | null }) {
  const cfg = (w.dataSourceConfig && typeof w.dataSourceConfig === 'object'
    ? (w.dataSourceConfig as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const { title: storedTitle, ...config } = cfg;
  const title =
    typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type;
  const fromConfig =
    typeof config.datasetIndex === 'number' ? config.datasetIndex : undefined;
  const di = w.datasetIndex != null && w.datasetIndex !== undefined ? w.datasetIndex : (fromConfig ?? 0);
  const dn = w.datasetName != null && w.datasetName !== undefined && w.datasetName !== ''
    ? w.datasetName
    : (typeof config.datasetName === 'string' ? config.datasetName : null);
  const dId = w.datasetId != null && w.datasetId !== undefined && w.datasetId !== ''
    ? w.datasetId
    : (typeof config.datasetId === 'string' ? config.datasetId : null);
  const category = typeof config.category === 'string' ? config.category : undefined;
  const description = typeof config.description === 'string' ? config.description : undefined;
  return {
    id: w.id,
    title,
    type: w.type,
    category,
    description,
    config: { ...config, datasetIndex: di, datasetName: dn, datasetId: dId },
  };
}

/**
 * GET /api/embed/{dashboardId}?t={plaintextToken}
 *
 * PUBLIC endpoint consumed by downloaded HTML files.
 * Authenticates via embed token (NOT user session).
 *
 * Returns the same shape as the internal dashboard load, hydrated:
 *   { dashboard: { id, title, templateId, widgets: [...], updatedAt } }
 *
 * Each widget already includes its sampleData (rehydrated from Dataset).
 *
 * Security:
 *   - Token must be well-formed prefix dlf_ + 48 hex chars
 *   - Hash is compared against EmbedToken.tokenHash
 *   - Token must NOT be revoked
 *   - Token must NOT be expired
 *   - Token must match the dashboardId in the URL
 *   - On success, lastUsedAt + useCount are bumped
 *   - Generic 401 returned for any failure (no info leak)
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dashboardId } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? '';

  if (!isWellFormed(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401, headers: cors });
  }

  const tokenHash = hashToken(token);

  // Look up token by hash
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from('EmbedToken')
    .select('id, dashboardId, revokedAt, expiresAt')
    .eq('tokenHash', tokenHash)
    .single();

  if (tokenErr || !tokenRow) {
    console.error('[embed] Token lookup failed:', { tokenErr, tokenHash: tokenHash.slice(0, 8) + '...' });
    return NextResponse.json({ error: 'Token inválido' }, { status: 401, headers: cors });
  }

  // Validate ownership of this URL's dashboardId
  if (tokenRow.dashboardId !== dashboardId) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401, headers: cors });
  }

  // Check revoked
  if (tokenRow.revokedAt) {
    return NextResponse.json({ error: 'Token revocado' }, { status: 401, headers: cors });
  }

  // Check expired
  if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Token expirado' }, { status: 401, headers: cors });
  }

  // Load dashboard
  const { data: dashboard, error: dashErr } = await supabaseAdmin
    .from('Dashboard')
    .select('id, title, templateId, organizationId, updatedAt')
    .eq('id', dashboardId)
    .single();

  if (dashErr || !dashboard) {
    console.error('[embed] Dashboard query failed:', dashErr);
    return NextResponse.json({ error: 'Dashboard no encontrado' }, { status: 404, headers: cors });
  }

  // Load widgets separately (more reliable than nested select)
  const { data: widgets, error: widgetErr } = await supabaseAdmin
    .from('Widget')
    .select('*')
    .eq('dashboardId', dashboardId);

  if (widgetErr) {
    console.error('[embed] Widget query failed:', widgetErr);
    return NextResponse.json({ error: 'No se pudieron cargar los widgets' }, { status: 500, headers: cors });
  }

  const dashboardWithWidgets = { ...dashboard, widgets: widgets || [] };

  // Load datasets in same scope (organization or null)
  let datasetQuery = supabaseAdmin
    .from('Dataset')
    .select('id, name, rawSchema');

  if (dashboard.organizationId) {
    datasetQuery = datasetQuery.or(`organizationId.eq.${dashboard.organizationId},organizationId.is.null`);
  } else {
    datasetQuery = datasetQuery.is('organizationId', null);
  }

  const { data: datasets, error: datasetErr } = await datasetQuery;
  if (datasetErr) {
    console.error('[embed] Dataset query failed:', datasetErr);
  }

  // Sort widgets by createdAt to keep stable ordering
  const sortedWidgets = (dashboardWithWidgets.widgets || []).sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Map to canvas shape using the same function as GET /api/dashboards/[id]
  const mapped = sortedWidgets.map(mapWidgetForCanvas);

  // Hydrate with dataset sampleData
  const hydrated = hydrateDashboardWidgets(mapped, datasets || []);

  // Bump usage stats (fire-and-forget; don't block response)
  void supabaseAdmin
    .from('EmbedToken')
    .update({
      lastUsedAt: new Date().toISOString(),
      useCount: (await getCurrentUseCount(tokenRow.id)) + 1,
    })
    .eq('id', tokenRow.id);

  return NextResponse.json(
    {
      dashboard: {
        id: dashboard.id,
        title: dashboard.title,
        templateId: dashboard.templateId,
        updatedAt: dashboard.updatedAt,
        widgets: hydrated,
      },
    },
    { headers: cors }
  );
}

async function getCurrentUseCount(tokenId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('EmbedToken')
    .select('useCount')
    .eq('id', tokenId)
    .single();
  return data?.useCount ?? 0;
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashToken, isWellFormed } from '@/lib/embedToken';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';

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
  const { data: tokenRow } = await supabaseAdmin
    .from('EmbedToken')
    .select('id, dashboardId, revokedAt, expiresAt')
    .eq('tokenHash', tokenHash)
    .single();

  if (!tokenRow) {
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

  // Load dashboard + widgets
  const { data: dashboard, error: dashErr } = await supabaseAdmin
    .from('Dashboard')
    .select('id, title, templateId, organizationId, updatedAt, widgets:Widget(*)')
    .eq('id', dashboardId)
    .single();

  if (dashErr || !dashboard) {
    return NextResponse.json({ error: 'Dashboard no encontrado' }, { status: 404, headers: cors });
  }

  // Load datasets in same scope (organization or null)
  const { data: datasets } = await supabaseAdmin
    .from('Dataset')
    .select('id, name, rawSchema')
    .or(
      dashboard.organizationId
        ? `organizationId.eq.${dashboard.organizationId},organizationId.is.null`
        : 'organizationId.is.null'
    );

  // Sort widgets by createdAt to keep stable ordering
  const sortedWidgets = (dashboard.widgets || []).sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Map to canvas shape (same logic as /api/dashboards/[id])
  const mapped = sortedWidgets.map((w: any) => {
    const cfg = w.dataSourceConfig || {};
    const { title: storedTitle, ...config } = cfg;
    return {
      id: w.id,
      type: w.type,
      title: typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type,
      category: typeof config.category === 'string' ? config.category : undefined,
      description: typeof config.description === 'string' ? config.description : undefined,
      config: {
        ...config,
        datasetIndex: w.datasetIndex ?? config.datasetIndex ?? 0,
        datasetName: w.datasetName ?? config.datasetName ?? null,
        datasetId: w.datasetId ?? config.datasetId ?? null,
      },
    };
  });

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

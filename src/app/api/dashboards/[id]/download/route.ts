import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { generateToken } from '@/lib/embedToken';
import { buildEmbedHtml, assembleHtml } from '@/lib/embedTemplate';
import { hydrateDashboardWidgets } from '@/lib/hydrateDashboardWidgets';

/**
 * GET /api/dashboards/{id}/download?label=Foo&expiresInDays=30
 *
 * Generates a fresh embed token + standalone HTML file with the token
 * embedded (and obfuscated). Returns the HTML as a download.
 *
 * Token rotation: each download generates a NEW token. The user can
 * revoke specific tokens later from the Compartir/tokens UI.
 *
 * Required: authenticated session, ownership of the dashboard.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: dashboardId } = await ctx.params;
  const url = new URL(req.url);
  const label = url.searchParams.get('label')?.slice(0, 80) || 'Download HTML';
  const expiresInDaysParam = url.searchParams.get('expiresInDays');
  const expiresInDays =
    expiresInDaysParam && !isNaN(parseInt(expiresInDaysParam))
      ? Math.min(Math.max(parseInt(expiresInDaysParam), 1), 365)
      : null;

  // Verify ownership and load full dashboard with widgets + datasets
  const { data: dash, error: dashErr } = await supabaseAdmin
    .from('Dashboard')
    .select('id, title, organizationId, updatedAt')
    .eq('id', dashboardId)
    .eq('userId', userId)
    .single();
  if (dashErr || !dash) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  // Load widgets separately
  const { data: widgets } = await supabaseAdmin
    .from('Widget')
    .select('*')
    .eq('dashboardId', dashboardId);

  // Load datasets
  let datasetQuery = supabaseAdmin
    .from('Dataset')
    .select('id, name, rawSchema');

  if (dash.organizationId) {
    datasetQuery = datasetQuery.or(`organizationId.eq.${dash.organizationId},organizationId.is.null`);
  } else {
    datasetQuery = datasetQuery.is('organizationId', null);
  }

  const { data: datasets } = await datasetQuery;

  // Map widgets to canvas shape
  const mapWidgetForCanvas = (w: any) => {
    const cfg = (w.dataSourceConfig && typeof w.dataSourceConfig === 'object'
      ? (w.dataSourceConfig as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const { title: storedTitle, ...config } = cfg;
    const title = typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type;
    const di = w.datasetIndex != null ? w.datasetIndex : 0;
    const dn = w.datasetName != null && w.datasetName !== '' ? w.datasetName : null;
    const dId = w.datasetId != null && w.datasetId !== '' ? w.datasetId : null;
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
  };

  const mapped = (widgets || [])
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(mapWidgetForCanvas);

  // Hydrate with snapshot data
  const hydrated = hydrateDashboardWidgets(mapped, datasets || []);
  const snapshotData = {
    id: dash.id,
    title: dash.title,
    updatedAt: dash.updatedAt,
    widgets: hydrated,
  };

  // Generate token, persist hash
  const { plaintext, hash } = generateToken();
  const tokenId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error: insErr } = await supabaseAdmin.from('EmbedToken').insert({
    id: tokenId,
    dashboardId,
    userId,
    tokenHash: hash,
    label,
    createdAt: now.toISOString(),
    expiresAt,
  });
  if (insErr) {
    console.error('Token insert failed:', insErr);
    return NextResponse.json({ error: 'No se pudo crear el token' }, { status: 500 });
  }

  // Determine API URL (the same origin where this request landed)
  // Use the Host header which contains the actual request host (IP or domain)
  const host = req.headers.get('host') || 'localhost:3000';
  let origin = req.headers.get('origin');

  if (!origin) {
    // Use the host header directly - this will be:
    // - 192.168.x.x:3000 if accessed via IP (works across network)
    // - localhost:3000 if accessed via localhost (works locally)
    // - dashlify.app if in production
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    origin = `${protocol}://${host}`;
  }

  // Build template + raw JS
  const { html: shell, js: rawJs } = buildEmbedHtml({
    apiUrl: origin,
    dashboardId,
    token: plaintext,
    title: dash.title || 'Dashboard',
  });

  // Obfuscate the JS portion only
  // Note: Simplified obfuscation for better performance. Full obfuscation can take 20+ seconds.
  const obfuscated = JavaScriptObfuscator.obfuscate(rawJs, {
    compact: true,
    // Disable slow obfuscation techniques
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: false,
    // Keep basic string obfuscation for readability
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();

  // Inyect snapshot data into the obfuscated JS
  const snapshotJson = JSON.stringify(snapshotData);
  const withSnapshot = obfuscated + `\n_DLF.snapshotData = ${snapshotJson};\ndlf_render(_DLF.snapshotData);`;

  const finalHtml = assembleHtml(shell, withSnapshot);

  // Slugify dashboard title for filename
  const slug = (dash.title || 'dashboard')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'dashboard';
  const filename = `${slug}-${dashboardId.slice(0, 8)}.html`;

  return new NextResponse(finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

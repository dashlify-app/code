import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { generateToken } from '@/lib/embedToken';
import { buildEmbedHtml, assembleHtml } from '@/lib/embedTemplate';

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

  // Verify ownership and get dashboard title
  const { data: dash, error: dashErr } = await supabaseAdmin
    .from('Dashboard')
    .select('id, title')
    .eq('id', dashboardId)
    .eq('userId', userId)
    .single();
  if (dashErr || !dash) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

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
  const host = req.headers.get('host') || 'localhost:3000';
  const origin = req.headers.get('origin') || `https://${host}`;

  // Build template + raw JS
  const { html: shell, js: rawJs } = buildEmbedHtml({
    apiUrl: origin,
    dashboardId,
    token: plaintext,
    title: dash.title || 'Dashboard',
  });

  // Obfuscate the JS portion only
  const obfuscated = JavaScriptObfuscator.obfuscate(rawJs, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.7,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    debugProtection: false, // avoid breaking in user's devtools — protection is via token, not anti-debug
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 6,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayShuffle: true,
    stringArrayThreshold: 0.85,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();

  const finalHtml = assembleHtml(shell, obfuscated);

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

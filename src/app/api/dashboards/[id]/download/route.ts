import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { generateToken } from '@/lib/embedToken';
import { buildEmbedHtml, assembleHtml } from '@/lib/embedTemplate';
import { devLog, devVerbose } from '@/lib/logger';

/**
 * POST /api/dashboards/{id}/download
 *
 * Genera un token embed fresco + archivo HTML standalone con los datos actuales
 * que el cliente envía (snapshot del momento actual del dashboard).
 *
 * Esto asegura que el HTML descargado es una copia EXACTA de lo que ve el usuario.
 *
 * Body esperado:
 * {
 *   label?: string,
 *   expiresInDays?: number,
 *   snapshotData: { // Los datos ACTUALES del dashboard desde el cliente
 *     id: string,
 *     title: string,
 *     updatedAt: string,
 *     widgets: Array<{ id, type, title, category?, description?, config }>
 *   }
 * }
 *
 * Requerido: sesión autenticada, propiedad del dashboard
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: dashboardId } = await ctx.params;
    const body = await req.json().catch(() => null);

    if (!body?.snapshotData) {
      return NextResponse.json({ error: 'snapshotData requerido en el body' }, { status: 400 });
    }

    const label = (typeof body.label === 'string' ? body.label : 'Download HTML').slice(0, 80);
    const expiresInDaysParam = body.expiresInDays;
    const expiresInDays =
      expiresInDaysParam && !isNaN(parseInt(expiresInDaysParam))
        ? Math.min(Math.max(parseInt(expiresInDaysParam), 1), 365)
        : null;

    // Verificar propiedad del dashboard
    const { data: dash, error: dashErr } = await supabaseAdmin
      .from('Dashboard')
      .select('id, title, updatedAt')
      .eq('id', dashboardId)
      .eq('userId', userId)
      .single();
    if (dashErr || !dash) {
      return NextResponse.json({ error: 'Dashboard no encontrado' }, { status: 404 });
    }

    // Usar los datos que el cliente envió (snapshot actual)
    const snapshotData = body.snapshotData;
    devLog('[download] Usando snapshot del cliente:', {
      widgets: snapshotData.widgets?.length || 0,
      title: snapshotData.title,
    });

    // El snapshot ya tiene todos los datos del cliente, listo para inyectar
    devLog('[download] Snapshot ready with', snapshotData.widgets?.length || 0, 'widgets');

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

    // Inject snapshot data into the obfuscated JS
    // The snapshot data must be assigned BEFORE dlf_init() is called in the obfuscated code
    const snapshotJson = JSON.stringify(snapshotData);
    devLog('[download] Snapshot JSON size:', snapshotJson.length, 'bytes');
    devVerbose('[download] Snapshot JSON (first 500 chars):', snapshotJson.substring(0, 500));

    // Check if dlf_init() exists in obfuscated code
    const hasInit = obfuscated.includes('dlf_init();');
    devVerbose('[download] obfuscated code contains dlf_init();?', hasInit);

    const withSnapshot = obfuscated.replace(
      'dlf_init();',
      `_DLF.snapshotData = ${snapshotJson};\ndlf_init();`
    );

    devVerbose('[download] After replacement, injection succeeded?', withSnapshot !== obfuscated);

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
  } catch (err: any) {
    console.error('[download] Error:', err.message, err.stack);
    return NextResponse.json({
      error: err?.message || 'Error generando HTML',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

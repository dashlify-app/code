import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { generateToken } from '@/lib/embedToken';

/**
 * GET /api/dashboards/{id}/embed-tokens
 * Lists all tokens (active + revoked) for a dashboard owned by current user.
 * Never returns plaintext — only metadata.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;

  // Verify ownership
  const { data: dash } = await supabaseAdmin
    .from('Dashboard')
    .select('id')
    .eq('id', id)
    .eq('userId', userId)
    .single();
  if (!dash) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { data: tokens, error } = await supabaseAdmin
    .from('EmbedToken')
    .select('id, label, createdAt, expiresAt, revokedAt, lastUsedAt, useCount')
    .eq('dashboardId', id)
    .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tokens: tokens || [] });
}

/**
 * POST /api/dashboards/{id}/embed-tokens
 * Generates a new embed token. Returns plaintext ONCE.
 * Body: { label?: string, expiresInDays?: number }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : null;
  const expiresInDays =
    typeof body?.expiresInDays === 'number' && body.expiresInDays > 0
      ? Math.min(body.expiresInDays, 365)
      : null;

  // Verify ownership
  const { data: dash } = await supabaseAdmin
    .from('Dashboard')
    .select('id, title')
    .eq('id', id)
    .eq('userId', userId)
    .single();
  if (!dash) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { plaintext, hash } = generateToken();
  const tokenId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error: insErr } = await supabaseAdmin.from('EmbedToken').insert({
    id: tokenId,
    dashboardId: id,
    userId,
    tokenHash: hash,
    label,
    createdAt: now.toISOString(),
    expiresAt,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    id: tokenId,
    token: plaintext, // ⚠️ Only time plaintext is returned
    label,
    createdAt: now.toISOString(),
    expiresAt,
    dashboardTitle: dash.title,
  });
}

/**
 * DELETE /api/dashboards/{id}/embed-tokens?tokenId=xxx
 * Revokes a token (marks revokedAt; doesn't delete row, for audit trail).
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const tokenId = url.searchParams.get('tokenId');
  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId requerido' }, { status: 400 });
  }

  // Verify ownership via dashboard
  const { data: dash } = await supabaseAdmin
    .from('Dashboard')
    .select('id')
    .eq('id', id)
    .eq('userId', userId)
    .single();
  if (!dash) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('EmbedToken')
    .update({ revokedAt: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('dashboardId', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

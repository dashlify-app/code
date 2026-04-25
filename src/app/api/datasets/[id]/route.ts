import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await ctx.params;

  // Obtener organización del usuario
  const { data: user, error: userError } = await supabaseAdmin
    .from('User')
    .select('organizationId')
    .eq('id', userId)
    .single();

  if (userError || !user?.organizationId) {
    return NextResponse.json({ error: 'Organización no asignada' }, { status: 400 });
  }

  // Eliminar dataset
  const { error: deleteError } = await supabaseAdmin
    .from('Dataset')
    .delete()
    .eq('id', id)
    .eq('organizationId', user.organizationId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

async function getOrCreateOrganizationIdForUser(userId: string) {
  const { data: user, error: userError } = await supabaseAdmin
    .from('User')
    .select('id, email, organizationId')
    .eq('id', userId)
    .single();

  if (userError || !user) return null;
  if (user.organizationId) return user.organizationId;

  // Crear organización si no tiene
  const orgName = user.email?.split('@')[0] ? `${user.email.split('@')[0]} Org` : 'Mi organización';
  const { data: org, error: orgError } = await supabaseAdmin
    .from('Organization')
    .insert({ name: orgName })
    .select('id')
    .single();

  if (orgError || !org) return null;

  // Vincular usuario a la nueva organización
  await supabaseAdmin
    .from('User')
    .update({ organizationId: org.id })
    .eq('id', userId);

  return org.id;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const organizationId = await getOrCreateOrganizationIdForUser(userId);
  if (!organizationId) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const { data: datasets, error } = await supabaseAdmin
    .from('Dataset')
    .select('id, name, rawSchema, createdAt, updatedAt')
    .eq('organizationId', organizationId)
    .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ datasets: datasets || [] });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const organizationId = await getOrCreateOrganizationIdForUser(userId);
  if (!organizationId) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.rawSchema) {
    return NextResponse.json({ error: 'name y rawSchema requeridos' }, { status: 400 });
  }

  const { data: dataset, error } = await supabaseAdmin
    .from('Dataset')
    .insert({
      name: String(body.name),
      rawSchema: body.rawSchema,
      organizationId,
    })
    .select('id, name, rawSchema')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dataset });
}


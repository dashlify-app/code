import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

async function getOrganizationIdForUser(userId: string) {
  const { data: user, error: userError } = await supabaseAdmin
    .from('User')
    .select('id, email, organizationId')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError);
    return null;
  }

  if (!user) {
    console.error('User not found:', userId);
    return null;
  }

  if (!user.organizationId) {
    console.error('User has no organizationId:', userId, user.email);
    return null;
  }

  return user.organizationId;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  console.log('GET /api/datasets - session:', { userId, email: session?.user?.email });

  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const organizationId = await getOrganizationIdForUser(userId);
  console.log('organizationId result:', organizationId);

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

  console.log('POST /api/datasets - session:', { userId, email: session?.user?.email });

  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const organizationId = await getOrganizationIdForUser(userId);
  console.log('organizationId result:', organizationId);

  if (!organizationId) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.rawSchema) {
    return NextResponse.json({ error: 'name y rawSchema requeridos' }, { status: 400 });
  }

  const { data: dataset, error } = await supabaseAdmin
    .from('Dataset')
    .insert({
      id: crypto.randomUUID(),
      name: String(body.name),
      rawSchema: body.rawSchema,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select('id, name, rawSchema')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dataset });
}


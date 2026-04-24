import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

async function getOrCreateOrganizationIdForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, organizationId: true },
  });

  if (!user) return null;
  if (user.organizationId) return user.organizationId;

  const org = await prisma.organization.create({
    data: { name: user.email?.split('@')[0] ? `${user.email.split('@')[0]} Org` : 'Mi organización' },
    select: { id: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id },
  });

  return org.id;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const organizationId = await getOrCreateOrganizationIdForUser(userId);
  if (!organizationId) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const datasets = await prisma.dataset.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, rawSchema: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ datasets });
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

  const dataset = await prisma.dataset.create({
    data: {
      name: String(body.name),
      rawSchema: body.rawSchema,
      organizationId,
    },
    select: { id: true, name: true, rawSchema: true },
  });

  return NextResponse.json({ dataset });
}


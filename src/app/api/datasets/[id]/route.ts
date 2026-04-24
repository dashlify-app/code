import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ error: 'Organización no asignada' }, { status: 400 });
  }

  await prisma.dataset.deleteMany({
    where: { id, organizationId: user.organizationId },
  });

  return NextResponse.json({ ok: true });
}


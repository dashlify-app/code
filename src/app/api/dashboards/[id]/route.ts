import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

function mapWidgetForCanvas(w: { id: string; type: string; dataSourceConfig: unknown }) {
  const cfg = (w.dataSourceConfig && typeof w.dataSourceConfig === 'object'
    ? (w.dataSourceConfig as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const { title: storedTitle, ...config } = cfg;
  const title =
    typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type;
  return { id: w.id, title, type: w.type, config };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id, userId },
    include: { widgets: { orderBy: { createdAt: 'asc' } } },
  });

  if (!dashboard) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json({
    dashboard: {
      id: dashboard.id,
      title: dashboard.title,
      templateId: dashboard.templateId,
      layoutConfig: dashboard.layoutConfig,
      widgets: dashboard.widgets.map(mapWidgetForCanvas),
    },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.widgets || !Array.isArray(body.widgets)) {
    return NextResponse.json({ error: 'widgets requerido' }, { status: 400 });
  }

  const existing = await prisma.dashboard.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const title = typeof body.title === 'string' ? body.title : undefined;
  const templateId = typeof body.templateId === 'string' ? body.templateId : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.widget.deleteMany({ where: { dashboardId: id } });
    await tx.dashboard.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(templateId ? { templateId } : {}),
      },
    });
    if (body.widgets.length > 0) {
      await tx.widget.createMany({
        data: body.widgets.map((w: any) => ({
          dashboardId: id,
          type: w.type,
          dataSourceConfig: { ...(w.config || {}), title: w.title || w.type },
          stylingOptions: w.styling || {},
        })),
      });
    }
  });

  const updated = await prisma.dashboard.findFirst({
    where: { id, userId },
    include: { widgets: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json({
    dashboard: updated
      ? {
          id: updated.id,
          title: updated.title,
          templateId: updated.templateId,
          widgets: updated.widgets.map(mapWidgetForCanvas),
        }
      : null,
  });
}

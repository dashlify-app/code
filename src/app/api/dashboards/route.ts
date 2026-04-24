import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const dashboards = await prisma.dashboard.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ dashboards });
  } catch (e) {
    console.error('GET /api/dashboards', e);
    return NextResponse.json({ error: 'Error al listar dashboards' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, widgets, templateId, orgId } = await req.json();

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Check usage limits (SaaS Logic)
    const activeWidgets = await prisma.widget.count({
      where: {
        dashboard: {
          userId: user.id
        }
      }
    });

    // Limit example: 20 widgets for Free plan
    if (activeWidgets + widgets.length > 20) {
      return NextResponse.json({ 
        error: 'Límite de gráficas excedido para tu plan gratuito. Actualiza a Pro.' 
      }, { status: 403 });
    }

    // Create Dashboard and Widgets in a single transaction
    const dashboard = await prisma.dashboard.create({
      data: {
        title,
        templateId,
        userId: user.id,
        organizationId: orgId || null,
        layoutConfig: {},
        widgets: {
          create: widgets.map((w: any) => ({
            type: w.type,
            dataSourceConfig: { ...(w.config || {}), title: w.title || w.type },
            stylingOptions: w.styling || {},
          }))
        }
      },
      include: {
        widgets: true
      }
    });

    return NextResponse.json(dashboard);
  } catch (error: any) {
    console.error('Error al guardar dashboard:', error);
    return NextResponse.json({ error: 'Error al persistir el dashboard' }, { status: 500 });
  }
}

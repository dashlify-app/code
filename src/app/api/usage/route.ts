import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

export async function GET() {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        organization: true,
        dashboards: {
          include: {
            _count: {
              select: { widgets: true }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const totalDashboards = user.dashboards.length;
    const totalWidgets = user.dashboards.reduce((acc, d) => acc + d._count.widgets, 0);
    
    // Limits based on tier (mocked logic)
    const tier = user.organization?.tier || 'Free';
    const widgetLimit = tier === 'Pro' ? 100 : 20;
    const dashboardLimit = tier === 'Pro' ? 10 : 3;

    return NextResponse.json({
      tier,
      usage: {
        dashboards: {
          used: totalDashboards,
          limit: dashboardLimit,
          percentage: (totalDashboards / dashboardLimit) * 100
        },
        widgets: {
          used: totalWidgets,
          limit: widgetLimit,
          percentage: (totalWidgets / widgetLimit) * 100
        }
      },
      organization: user.organization
    });
  } catch (error: any) {
    console.error('Error al obtener consumo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

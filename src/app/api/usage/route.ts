import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener usuario con organización
    const { data: user, error: userError } = await supabaseAdmin
      .from('User')
      .select('id, organizationId, Organization(*)')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Obtener dashboards del usuario
    const { data: dashboards, error: dashError } = await supabaseAdmin
      .from('Dashboard')
      .select('id')
      .eq('userId', user.id);

    if (dashError) {
      return NextResponse.json({ error: 'Error al obtener dashboards' }, { status: 500 });
    }

    const totalDashboards = dashboards?.length || 0;

    // Contar widgets en todos los dashboards
    const dashboardIds = dashboards?.map((d: any) => d.id) || [];
    let totalWidgets = 0;

    if (dashboardIds.length > 0) {
      const { count, error: widgetError } = await supabaseAdmin
        .from('Widget')
        .select('*', { count: 'exact', head: true })
        .in('dashboardId', dashboardIds);

      if (!widgetError) {
        totalWidgets = count || 0;
      }
    }

    // Límites basados en tier
    const organization = (user as any).Organization;
    const tier = organization?.tier || 'Free';
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
      organization
    });
  } catch (error: any) {
    console.error('Error al obtener consumo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

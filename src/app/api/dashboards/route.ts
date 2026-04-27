import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: dashboards, error } = await supabaseAdmin
      .from('Dashboard')
      .select('id, title, updatedAt')
      .eq('userId', userId)
      .order('updatedAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ dashboards: dashboards || [] });
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

    // Check usage limits (SaaS Logic)
    const { data: dashIds } = await supabaseAdmin
      .from('Dashboard')
      .select('id')
      .eq('userId', userId);
    
    const dashboardIds = (dashIds || []).map(d => d.id);
    
    const { count: activeWidgets } = await supabaseAdmin
      .from('Widget')
      .select('*', { count: 'exact', head: true })
      .in('dashboardId', dashboardIds);

    const totalWidgets = activeWidgets || 0;

    // No limits for this user
    // if (totalWidgets + (widgets?.length || 0) > 20) {
    //   return NextResponse.json({
    //     error: 'Límite de gráficas excedido para tu plan gratuito. Actualiza a Pro.'
    //   }, { status: 403 });
    // }

    // Create Dashboard
    const dashboardId = crypto.randomUUID();
    const { data: dashboard, error: dashError } = await supabaseAdmin
      .from('Dashboard')
      .insert({
        id: dashboardId,
        title,
        templateId,
        userId: userId,
        organizationId: orgId || null,
        layoutConfig: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dashError || !dashboard) throw dashError || new Error('No se pudo crear el dashboard');

    // Create Widgets
    if (widgets && widgets.length > 0) {
      const now = new Date().toISOString();
      const widgetsToInsert = widgets.map((w: any) => {
        const c = w.config && typeof w.config === 'object' ? w.config : {};
        const datasetIndex = typeof c.datasetIndex === 'number' ? c.datasetIndex : w.datasetIndex ?? 0;
        const datasetName =
          typeof c.datasetName === 'string' && c.datasetName
            ? c.datasetName
            : (w.datasetName || null);
        const category =
          typeof w.category === 'string' && w.category
            ? w.category
            : typeof c.category === 'string'
              ? c.category
              : undefined;
        const description =
          typeof w.description === 'string' && w.description
            ? w.description
            : typeof c.description === 'string'
              ? c.description
              : undefined;
        return {
          id: crypto.randomUUID(),
          dashboardId: dashboard.id,
          type: w.type,
          dataSourceConfig: {
            ...c,
            title: w.title || w.type,
            ...(category ? { category } : {}),
            ...(description ? { description } : {}),
          },
          stylingOptions: w.styling || {},
          datasetIndex,
          datasetName,
          createdAt: now,
          updatedAt: now,
        };
      });

      const { error: widgetsError } = await supabaseAdmin
        .from('Widget')
        .insert(widgetsToInsert);

      if (widgetsError) throw widgetsError;
    }

    // Recuperar el dashboard completo con widgets
    const { data: finalDashboard } = await supabaseAdmin
      .from('Dashboard')
      .select('*, widgets:Widget(*)')
      .eq('id', dashboard.id)
      .single();

    return NextResponse.json(finalDashboard);
  } catch (error: any) {
    console.error('Error al guardar dashboard:', error);
    return NextResponse.json({ error: 'Error al persistir el dashboard: ' + error.message }, { status: 500 });
  }
}

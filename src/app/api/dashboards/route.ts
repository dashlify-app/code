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

    // Limit example: 20 widgets for Free plan
    if (totalWidgets + (widgets?.length || 0) > 20) {
      return NextResponse.json({ 
        error: 'Límite de gráficas excedido para tu plan gratuito. Actualiza a Pro.' 
      }, { status: 403 });
    }

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
      })
      .select('id')
      .single();

    if (dashError || !dashboard) throw dashError || new Error('No se pudo crear el dashboard');

    // Create Widgets
    if (widgets && widgets.length > 0) {
      const widgetsToInsert = widgets.map((w: any) => ({
        id: crypto.randomUUID(),
        dashboardId: dashboard.id,
        type: w.type,
        dataSourceConfig: { ...(w.config || {}), title: w.title || w.type },
        stylingOptions: w.styling || {},
      }));

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

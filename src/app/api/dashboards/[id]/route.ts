import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

function mapWidgetForCanvas(w: { id: string; type: string; dataSourceConfig: unknown; datasetIndex?: number; datasetName?: string }) {
  const cfg = (w.dataSourceConfig && typeof w.dataSourceConfig === 'object'
    ? (w.dataSourceConfig as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const { title: storedTitle, ...config } = cfg;
  const title =
    typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type;
  return {
    id: w.id,
    title,
    type: w.type,
    config: { ...config, datasetIndex: w.datasetIndex ?? 0, datasetName: w.datasetName },
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;

  const { data: dashboard, error } = await supabaseAdmin
    .from('Dashboard')
    .select('*, widgets:Widget(*)')
    .eq('id', id)
    .eq('userId', userId)
    .single();

  if (error || !dashboard) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Ordenar widgets manualmente ya que Supabase no soporta order en include directo fácilmente
  const sortedWidgets = (dashboard.widgets || []).sort((a: any, b: any) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return NextResponse.json({
    dashboard: {
      id: dashboard.id,
      title: dashboard.title,
      templateId: dashboard.templateId,
      layoutConfig: dashboard.layoutConfig,
      widgets: sortedWidgets.map(mapWidgetForCanvas),
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

  const { data: existing, error: existError } = await supabaseAdmin
    .from('Dashboard')
    .select('id')
    .eq('id', id)
    .eq('userId', userId)
    .single();

  if (existError || !existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const title = typeof body.title === 'string' ? body.title : undefined;
  const templateId = typeof body.templateId === 'string' ? body.templateId : undefined;

  try {
    // Eliminar widgets antiguos
    await supabaseAdmin.from('Widget').delete().eq('dashboardId', id);

    // Actualizar dashboard
    const updateData: any = {};
    if (title) updateData.title = title;
    if (templateId) updateData.templateId = templateId;

    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin.from('Dashboard').update(updateData).eq('id', id);
    }

    // Insertar nuevos widgets
    if (body.widgets.length > 0) {
      const widgetsToInsert = body.widgets.map((w: any) => ({
        dashboardId: id,
        type: w.type,
        dataSourceConfig: { ...(w.config || {}), title: w.title || w.type },
        stylingOptions: w.styling || {},
        datasetIndex: w.datasetIndex ?? 0,
        datasetName: w.datasetName || null,
      }));
      await supabaseAdmin.from('Widget').insert(widgetsToInsert);
    }

    // Recuperar actualizado
    const { data: updated } = await supabaseAdmin
      .from('Dashboard')
      .select('*, widgets:Widget(*)')
      .eq('id', id)
      .single();

    const sortedWidgets = (updated?.widgets || []).sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({
      dashboard: updated
        ? {
            id: updated.id,
            title: updated.title,
            templateId: updated.templateId,
            widgets: sortedWidgets.map(mapWidgetForCanvas),
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

function mapWidgetForCanvas(w: { id: string; type: string; dataSourceConfig: unknown; datasetIndex?: number; datasetName?: string | null }) {
  const cfg = (w.dataSourceConfig && typeof w.dataSourceConfig === 'object'
    ? (w.dataSourceConfig as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const { title: storedTitle, ...config } = cfg;
  const title =
    typeof storedTitle === 'string' && storedTitle.trim() ? storedTitle : w.type;
  const fromConfig =
    typeof config.datasetIndex === 'number' ? config.datasetIndex : undefined;
  const di = w.datasetIndex != null && w.datasetIndex !== undefined ? w.datasetIndex : (fromConfig ?? 0);
  const dn = w.datasetName != null && w.datasetName !== undefined && w.datasetName !== ''
    ? w.datasetName
    : (typeof config.datasetName === 'string' ? config.datasetName : null);
  const category = typeof config.category === 'string' ? config.category : undefined;
  const description = typeof config.description === 'string' ? config.description : undefined;
  return {
    id: w.id,
    title,
    type: w.type,
    category,
    description,
    config: { ...config, datasetIndex: di, datasetName: dn },
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

    // Insertar nuevos widgets (datasetIndex / datasetName vienen en w.config desde el canvas)
    if (body.widgets.length > 0) {
      const now = new Date().toISOString();
      const widgetsToInsert = body.widgets.map((w: any) => {
        const c = w.config && typeof w.config === 'object' ? w.config : {};

        // ⚠️ Remove sampleData and headers to reduce payload size
        // These will be loaded from the original Dataset when rendering
        const cleanConfig = { ...c };
        delete cleanConfig.sampleData;
        delete cleanConfig.headers;

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
          dashboardId: id,
          type: w.type,
          dataSourceConfig: {
            ...cleanConfig,
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
      const { error: insErr } = await supabaseAdmin.from('Widget').insert(widgetsToInsert);
      if (insErr) throw insErr;
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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;

  const { data: row, error: findErr } = await supabaseAdmin
    .from('Dashboard')
    .select('id')
    .eq('id', id)
    .eq('userId', userId)
    .single();

  if (findErr || !row) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { error: wErr } = await supabaseAdmin.from('Widget').delete().eq('dashboardId', id);
  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  const { error: dErr } = await supabaseAdmin.from('Dashboard').delete().eq('id', id).eq('userId', userId);
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

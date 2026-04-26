import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener todos los dashboards del usuario
    const { data: dashboards, error: dashError } = await supabaseAdmin
      .from('Dashboard')
      .select('id')
      .eq('userId', userId);

    if (dashError) throw dashError;

    if (dashboards && dashboards.length > 0) {
      const dashboardIds = dashboards.map(d => d.id);

      // Eliminar todos los widgets de esos dashboards
      const { error: widgetError } = await supabaseAdmin
        .from('Widget')
        .delete()
        .in('dashboardId', dashboardIds);

      if (widgetError) throw widgetError;

      // Eliminar todos los dashboards
      const { error: deleteDashError } = await supabaseAdmin
        .from('Dashboard')
        .delete()
        .in('id', dashboardIds);

      if (deleteDashError) throw deleteDashError;
    }

    return NextResponse.json({
      message: 'Dashboards eliminados correctamente',
      deletedCount: dashboards?.length || 0
    });
  } catch (error) {
    console.error('Error limpiando dashboards:', error);
    return NextResponse.json({ error: 'Error al limpiar' }, { status: 500 });
  }
}

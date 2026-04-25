import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const email = 'test@dashlify.app';
    const password = 'MasterDash2025!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buscar usuario existente
    const { data: existingUser } = await supabaseAdmin
      .from('User')
      .select('id, organizationId')
      .eq('email', email)
      .single();

    let userId: string;
    let orgId: string;

    if (existingUser) {
      // Actualizar contraseña
      await supabaseAdmin
        .from('User')
        .update({ password: hashedPassword })
        .eq('id', existingUser.id);

      userId = existingUser.id;
      orgId = existingUser.organizationId;
    } else {
      // Crear organización
      const { data: org, error: orgError } = await supabaseAdmin
        .from('Organization')
        .insert({ name: 'Dashlify Master Org' })
        .select('id')
        .single();

      if (orgError || !org) {
        return NextResponse.json({ error: 'Error al crear organización' }, { status: 500 });
      }

      // Crear usuario
      const { data: user, error: userError } = await supabaseAdmin
        .from('User')
        .insert({
          email,
          password: hashedPassword,
          organizationId: org.id,
        })
        .select('id')
        .single();

      if (userError || !user) {
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
      }

      userId = user.id;
      orgId = org.id;
    }

    return NextResponse.json({
      status: '✅ Usuario Maestro Listo',
      email,
      password,
      message: 'Usa estas credenciales para entrar ahora mismo.'
    });
  } catch (e: any) {
    console.error('Error en master reset:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

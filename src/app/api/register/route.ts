import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const orgName = email.split('@')[0] ? `${email.split('@')[0]} Org` : 'Mi organización';

    // Crear organización primero
    const { data: org, error: orgError } = await supabaseAdmin
      .from('Organization')
      .insert({ name: orgName })
      .select('id')
      .single();

    if (orgError || !org) {
      console.error('orgError:', orgError);
      return NextResponse.json({ error: orgError?.message || 'Error al crear la organización' }, { status: 500 });
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
      return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Usuario creado con éxito', userId: user.id });
  } catch (error: any) {
    console.error('Error en registro:', error);
    return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 });
  }
}

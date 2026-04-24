import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        organization: {
          create: {
            name: email.split('@')[0] ? `${email.split('@')[0]} Org` : 'Mi organización',
          },
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ message: 'Usuario creado con éxito', userId: user.id });
  } catch (error: any) {
    console.error('Error en registro:', error);
    return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 });
  }
}

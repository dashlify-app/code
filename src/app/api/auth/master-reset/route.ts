import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const email = 'test@dashlify.app';
    const password = 'MasterDash2025!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        organization: {
          create: { name: 'Dashlify Master Org' }
        }
      }
    });

    return NextResponse.json({ 
      status: '✅ Usuario Maestro Listo',
      email,
      password,
      message: 'Usa estas credenciales para entrar ahora mismo.'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

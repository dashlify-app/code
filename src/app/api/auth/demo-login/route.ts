import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Demo endpoint - crea una sesión sin verificar base de datos
    return NextResponse.json({
      success: true,
      message: '✅ Usa las credenciales: 2005.ivan@gmail.com / 123456'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

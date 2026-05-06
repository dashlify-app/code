import { NextResponse } from 'next/server';

/** Indica si el login demo está activo (misma lógica que en auth; sin exponer credenciales). */
function demoConfigured() {
  return (
    process.env.AUTH_DEMO_LOGIN_ENABLED === 'true' &&
    Boolean(process.env.AUTH_DEMO_USER_EMAIL?.trim()) &&
    Boolean(process.env.AUTH_DEMO_USER_PASSWORD) &&
    Boolean(process.env.AUTH_DEMO_USER_ID?.trim())
  );
}

export async function POST() {
  try {
    return NextResponse.json({
      success: true,
      demoEnabled: demoConfigured(),
      message: demoConfigured()
        ? 'Login demo habilitado: usa las credenciales configuradas en AUTH_DEMO_* en tu entorno.'
        : 'Login demo desactivado. Configura AUTH_DEMO_LOGIN_ENABLED y AUTH_DEMO_USER_* o regístrate.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

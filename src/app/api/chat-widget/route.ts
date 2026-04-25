import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logAIUsage } from '@/lib/aiLogger';
import { checkRateLimit, logApiCall } from '@/lib/rateLimiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const allowed = await checkRateLimit(session.user.id, 'chat-widget');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de llamadas excedido. Máximo 10 por minuto.' },
        { status: 429 }
      );
    }

    const { message, schema, chatHistory } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const systemPrompt = `
      Actúa como un Asistente Copilot de Dashlify (Un Experto en BI).
      El usuario tiene un dataset con estas columnas: ${JSON.stringify(schema)}.
      El usuario te pedirá que crees un gráfico o responderá a tus preguntas.
      
      Si el usuario te pide un gráfico (ej: "Hazme un pie con las familias"), DEBES devolver un objeto JSON con:
      - text: Tu respuesta amigable en texto.
      - widget: (Opcional) Un objeto con la configuración del gráfico, que incluye:
         - title: Título del gráfico.
         - type: "bar", "line", "pie", "area", "stat"
         - category: Categoría (Ej: "💰 Financiero", "📦 Inventario")
         - description: Breve insight.
         - config: { x: "nombre_columna_dimension", y: "nombre_columna_metrica" } (o dimension/metric para pie/stat).

      Si el usuario solo está conversando o respondiendo una pregunta sin pedir un gráfico claro, devuelve solo "text" sin el "widget".
      
      Historial de conversación:
      ${chatHistory.map((msg: any) => `${msg.role === 'ai' ? 'Asistente' : 'Usuario'}: ${msg.content}`).join('\n')}
      
      Último mensaje del usuario: "${message}"
      
      Devuelve ESTRICTAMENTE el JSON con { "text": string, "widget"?: { ... } }.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: systemPrompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    if (response.usage) {
      logAIUsage({
        userId: session.user.id,
        actionType: 'chat-copilot',
        usage: response.usage,
        requestPayload: { message },
        responsePayload: result,
      });
    }

    await logApiCall(session.user.id, 'chat-widget');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en Chat Copilot:', error);
    return NextResponse.json({ error: 'Error al procesar con IA' }, { status: 500 });
  }
}

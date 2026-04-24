import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logAIUsage } from '@/lib/aiLogger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { combinedSchema, approvedRelationships } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const prompt = `
      Actúa como un Director de Business Intelligence (BI).
      He cruzado varios datasets mediante estas relaciones: ${JSON.stringify(approvedRelationships)}.
      Aquí tienes un resumen de las columnas disponibles en el dataset: ${JSON.stringify(combinedSchema)}.

      Basado en estos datos, quiero que generes una lista avanzada de gráficos (widgets) e indicadores clave de rendimiento (KPIs). 
      NO sugieras gráficos básicos irrelevantes. Piensa en reglas de negocio reales:
      - Margen por categoría (Costo vs Precio).
      - Productos con bajo stock vs alta demanda.
      - Proveedores más rentables.
      - Alertas automáticas (ej: "Si stock < mínimo").

      Devuelve estrictamente un JSON con:
      1. Una lista de "suggestedWidgets", cada uno con:
         - title: Título del gráfico o KPI (Ej: "Alerta: Stock Crítico por Familia").
         - type: "bar", "line", "pie", "area", "stat"
         - category: La categoría del dashboard al que pertenece (Ej: "💰 Financiero", "📦 Inventario", "🧠 Comercial"). ¡ESTE CAMPO ES OBLIGATORIO Y DEBE TENER UN EMOJI!
         - description: El insight de negocio o regla que resuelve este gráfico.
         - config: Un objeto ficticio con las dimensiones y métricas (ej: { x: "Familia", y: "Margen %" }).
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const suggestions = JSON.parse(response.choices[0].message.content || '{}');

    if (response.usage) {
      const session = await getServerSession(authOptions);
      logAIUsage({
        userId: session?.user?.id,
        actionType: 'chart-suggestion',
        usage: response.usage,
        requestPayload: { prompt },
        responsePayload: suggestions,
      });
    }

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('Error en sugerencia de gráficos:', error);
    return NextResponse.json({ error: 'Error al sugerir gráficos con IA' }, { status: 500 });
  }
}

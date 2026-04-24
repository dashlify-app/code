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
      Actúa como un experto en BI (Business Intelligence).
      He cruzado varios datasets mediante estas relaciones: ${JSON.stringify(approvedRelationships)}.
      Aquí tienes un resumen de las columnas disponibles: ${JSON.stringify(combinedSchema)}.

      Basado en estos datos cruzados, genera una lista de los MEJORES gráficos (widgets) para visualizar.
      
      Devuelve un JSON con:
      1. Una lista de "suggestedWidgets", cada uno con:
         - title: Título del gráfico
         - type: "bar", "line", "pie", "area", "stat"
         - description: Por qué este gráfico es útil.
         - config: Un objeto ficticio con las dimensiones y métricas (ej: { x: "Mes", y: "Suma de Ventas" }).
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

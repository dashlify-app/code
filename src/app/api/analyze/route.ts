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
    const { headers, sampleData, fileName } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const prompt = `
      Eres un Estratega de Datos y Diseñador de Dashboards de Clase Mundial.
      Archivo: "${fileName}"
      Columnas: ${headers.join(', ')}
      Muestra: ${JSON.stringify(sampleData)}

      INSTRUCCIONES:
      1. Realiza una "Auditoría Estratégica": Identifica el valor de negocio de este archivo.
      2. Crea una PROPUESTA DE DASHBOARD PROFESIONAL que compita con los mejores analíticos del mercado.
      3. Sugiere exactamente 6 gráficas (widgets) de alto impacto.

      DEVUELVE UN JSON CON ESTA ESTRUCTURA:
      {
        "narrative": "Un resumen ejecutivo potente (2-3 frases) sobre el potencial de estos datos.",
        "analysis": {
          "domain": "Ventas/Finanzas/Logística/etc.",
          "main_kpis": ["KPI 1", "KPI 2"]
        },
        "proposedWidgets": [
          {
            "title": "Título de la Gráfica (ej: Distribución de Ingresos por Región)",
            "type": "bar | line | pie | kpi",
            "config": {
              "xAxis": "columna_x",
              "yAxis": "columna_y",
              "aggregate": "sum | count | avg"
            },
            "styling": {
              "colorScheme": "modern | sunset | ocean | forest",
              "priority": 1
            }
          }
        ],
        "followUpQuestion": "¿Te gustaría que profundizara en algún aspecto específico, como [Sugerencia 1] o [Sugerencia 2]?"
      }
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    if (response.usage) {
      const session = await getServerSession(authOptions);
      // Execute without awaiting to avoid blocking response
      logAIUsage({
        userId: session?.user?.id,
        actionType: 'dataset-analysis',
        usage: response.usage,
        requestPayload: { prompt },
        responsePayload: analysis,
      });
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Error en análisis de IA:', error);
    return NextResponse.json({ error: 'Error al procesar con IA' }, { status: 500 });
  }
}

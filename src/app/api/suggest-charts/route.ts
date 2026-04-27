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

    const allowed = await checkRateLimit(session.user.id, 'suggest-charts');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de llamadas excedido. Máximo 10 por minuto.' },
        { status: 429 }
      );
    }

    const { combinedSchema, approvedRelationships } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const prompt = `
      Actúa como un Director de Business Intelligence (BI).

      Relaciones aprobadas entre archivos (puede estar vacío si el usuario no vinculó datasets): ${JSON.stringify(approvedRelationships)}.

      Esquema enriquecido por archivo (nombres de columnas REALES, contexto de dominio y ideas del análisis previo): ${JSON.stringify(combinedSchema)}.

      REQUISITOS OBLIGATORIOS:
      1. Genera AL MENOS 15 y como máximo 22 entradas en "suggestedWidgets". Si hay pocos datos, sigue proponiendo vistas útiles variando la métrica, la dimensión o el tipo de gráfico.
      2. Cada widget debe usar ÚNICAMENTE nombres de columnas que existan en "columns" del archivo correspondiente en el esquema (campo "sourceFile" en config indica de qué archivo salen x e y).
      3. Prioriza ideas alineadas con domain, mainKpis, narrative y perFileWidgetIdeas del esquema; si hay relaciones aprobadas, incluye al menos 3 widgets que explícitamente cruchen esas claves entre datasets.
      4. Tipos permitidos para "type": "bar", "line", "pie", "area", "stat", "scatter", "donut".
         - "line" o "area": solo si el eje X es claramente temporal/fecha según los nombres de columnas o el contexto.
         - "scatter": correlación entre dos columnas numéricas del mismo archivo (o del cruce si aplica).
         - "stat": un solo número (KPI) con aggregate adecuado en config.
         - "pie" o "donut": distribución con pocas categorías; si hay muchas categorías, prefiere "bar".
      5. En "config" incluye siempre:
         - x o xAxis, y o yAxis (nombres exactos de columnas; para stat puede omitirse x y usar solo y/yAxis como métrica).
         - sourceFile: nombre del archivo (.xlsx/.csv) al que pertenecen esas columnas.
         - aggregate cuando aplique: uno de "sum" | "avg" | "count" | "median" | "cumulative" | "mom" | "outliers".

      Piensa en reglas de negocio (margen, stock, rentabilidad, alertas, comparativas entre tablas vinculadas).

      Devuelve estrictamente un JSON con:
      - "suggestedWidgets": array (mínimo 15 elementos), cada uno con:
         - title: Título accionable.
         - type: uno de los tipos permitidos.
         - category: categoría con emoji obligatorio (ej. "💰 Financiero", "📦 Inventario").
         - description: insight o regla de negocio (1-2 frases).
         - config: objeto con columnas reales, sourceFile, aggregate si aplica.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const suggestions = JSON.parse(response.choices[0].message.content || '{}');

    if (response.usage) {
      await logAIUsage({
        userId: session.user.id,
        actionType: 'chart-suggestion',
        usage: response.usage,
        requestPayload: { prompt: prompt.substring(0, 500) },
        responsePayload: suggestions,
      });
    }

    await logApiCall(session.user.id, 'suggest-charts');

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('Error en sugerencia de gráficos:', error);
    return NextResponse.json({ error: 'Error al sugerir gráficos con IA' }, { status: 500 });
  }
}

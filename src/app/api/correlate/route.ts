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

    const allowed = await checkRateLimit(session.user.id, 'correlate');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de llamadas excedido. Máximo 10 por minuto.' },
        { status: 429 }
      );
    }

    const { datasets } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const prompt = `
      Actúa como un arquitecto de datos senior. Tengo los siguientes datasets cargados:
      
      ${datasets.map((d: any, i: number) => `Dataset ${i+1} (${d.name}):
      Encabezados: ${d.headers.join(', ')}
      Descripción IA: ${d.analysis?.description || 'N/A'}`).join('\n\n')}

      Tu tarea es encontrar posibles relaciones (JOINS) entre estos datasets para compararlos o cruzarlos.
      Considera normalizaciones (ej: Empresa A usa 'Empleado' y Empresa B usa 'Colaborador').

      Devuelve un JSON con:
      1. Una lista de "possibleRelationships", cada una con:
         - sourceDataset: nombre del dataset 1
         - targetDataset: nombre del dataset 2
         - sourceColumn: columna en dataset 1
         - targetColumn: columna en dataset 2
         - reason: por qué deberían cruzarse (ej: "Identificador común de cliente")
         - matchType: "Exact" o "Similar"
         - normalizationNeeded: boolean (si los términos son diferentes pero significan lo mismo)
      2. Una recomendación sobre qué "Etiqueta Predominante" usar para campos similares.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const correlation = JSON.parse(response.choices[0].message.content || '{}');

    if (response.usage) {
      logAIUsage({
        userId: session.user.id,
        actionType: 'dataset-correlation',
        usage: response.usage,
        requestPayload: { prompt },
        responsePayload: correlation,
      });
    }

    await logApiCall(session.user.id, 'correlate');

    return NextResponse.json(correlation);
  } catch (error: any) {
    console.error('Error en correlación de IA:', error);
    return NextResponse.json({ error: 'Error al correlacionar con IA' }, { status: 500 });
  }
}

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
      Actúa como un experto analista de datos. He cargado un archivo llamado "${fileName}".
      Aquí tienes los encabezados de las columnas: ${headers.join(', ')}.
      Y una muestra de las primeras 5 filas (el archivo completo tiene hasta 5000 filas): ${JSON.stringify(sampleData)}.

      Por favor, analiza el esquema basándote en esta pequeña muestra y devuelve un JSON con:
      1. Una descripción breve de qué trata el dataset.
      2. Una lista de objetos representando las columnas, cada uno con:
         - name: nombre original
         - type: tipo detectado (number, date, string, boolean, category)
         - confidence: nivel de confianza del 0 al 1
         - recommendation: para qué se puede usar esta columna (ej: "KPI de ventas", "Dimensión temporal")
      3. Sugerencias de al menos 3 tipos de visualizaciones o KPIs que se podrían generar.
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

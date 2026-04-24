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
      Actúa como un Consultor Senior de Business Intelligence (BI) y Arquitecto de Datos. He cargado un archivo llamado "${fileName}".
      Aquí tienes los encabezados de las columnas: ${headers.join(', ')}.
      Y una muestra de las primeras 5 filas (el archivo completo tiene hasta 5000 filas): ${JSON.stringify(sampleData)}.

      Tu objetivo es auditar este dataset buscando valor estratégico (Márgenes, Rentabilidad, Alertas de Stock, Análisis Comercial, Proveedores).
      Por favor, devuelve estrictamente un JSON con:
      1. "description": Una descripción breve y gerencial de qué trata el dataset y su potencial de negocio.
      2. "columns": Una lista de objetos representando las columnas clave, cada uno con:
         - name: nombre original
         - type: tipo detectado (number, date, string, boolean, category)
         - confidence: nivel de confianza del 0 al 1
         - recommendation: para qué se puede usar esta columna (ej: "Métrica Financiera (Rentabilidad)", "Dimensión Operativa (Stock)", "Dimensión Comercial")
      3. "dashboardSuggestions": Sugerencias de al menos 3 *Tipos de Dashboards* completos que se podrían generar (ej: "Dashboard Financiero", "Dashboard de Inventario").
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

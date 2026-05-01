import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { xField, yField, userDescription, datasetName, availableFields } = await request.json();

    // Validate inputs
    if (
      !xField ||
      !yField ||
      !userDescription?.trim() ||
      !Array.isArray(availableFields) ||
      !availableFields.includes(xField) ||
      !availableFields.includes(yField)
    ) {
      return NextResponse.json(
        { error: 'Campos inválidos o no disponibles' },
        { status: 400 }
      );
    }

    // Build prompt for AI validation
    const prompt = `El usuario quiere crear una gráfica personalizada en su dashboard.

Columnas disponibles: ${availableFields.join(', ')}
Eje X (dimensión): ${xField}
Eje Y (métrica): ${yField}
Intención del usuario: "${userDescription}"

IMPORTANTE: Tu objetivo es AYUDAR al usuario a crear una gráfica viable, no rechazar su solicitud.
Si la solicitud original no es posible exactamente como se describe, SUGIERE la gráfica más cercana que tenga sentido.
Siempre aprueba (approved: true) si puedes crear algo útil.

Responde con:
1. approved: SIEMPRE true si hay una gráfica viable que podamos crear
2. chartType: el tipo de gráfica que mejor se ajusta (bar, line, pie, stat, area)
3. aggregate: la agregación apropiada (sum, avg, count, median, cumulative, mom)
4. title: un título descriptivo para la gráfica
5. suggestion: explicación en español de qué gráfica se creará

Responde SOLO con JSON válido (sin markdown):
{
  "approved": true,
  "chartType": "bar|line|pie|stat|area",
  "aggregate": "sum|avg|count|median|cumulative|mom",
  "title": "string",
  "suggestion": "string en español explicando la gráfica"
}`;

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI error:', error);
      throw new Error(`OpenAI error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      // Validate response structure
      if (typeof parsed.approved !== 'boolean') {
        throw new Error('Invalid approved value');
      }

      return NextResponse.json({
        approved: parsed.approved,
        chartType: parsed.chartType || 'bar',
        aggregate: parsed.aggregate || 'sum',
        title: parsed.title || `${yField} por ${xField}`,
        suggestion: parsed.suggestion || 'Gráfica creada correctamente',
      });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  } catch (error) {
    console.error('Error en /api/validate-custom-chart:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al validar gráfica' },
      { status: 500 }
    );
  }
}

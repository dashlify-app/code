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
    console.log('[/api/analyze] Recibiendo solicitud...');

    const session = await getServerSession(authOptions);
    console.log('[/api/analyze] Session:', session);
    console.log('[/api/analyze] Session.user:', session?.user);
    console.log('[/api/analyze] Session.user.id:', session?.user?.id);

    if (!session?.user?.id) {
      console.log('[/api/analyze] ❌ 401: No hay sesión válida');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[/api/analyze] ✓ Usuario autenticado:', session.user.id);

    const allowed = await checkRateLimit(session.user.id, 'analyze');
    console.log('[/api/analyze] Rate limit check:', allowed);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de llamadas excedido. Máximo 10 por minuto.' },
        { status: 429 }
      );
    }

    const { headers, sampleData, fileName, columnStats } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 500 });
    }

    const statsBlock = columnStats
      ? `\nESTADÍSTICAS POR COLUMNA (calculadas sobre el dataset completo):\n${JSON.stringify(columnStats, null, 2)}\n`
      : '';

    const prompt = `
Eres un Estratega de Datos y Diseñador de Dashboards de Clase Mundial.

Archivo: "${fileName}"
Columnas disponibles: ${headers.join(', ')}
Muestra de datos (5 filas): ${JSON.stringify(sampleData)}
${statsBlock}

═══════════════════════════════════════════════
INSTRUCCIONES — EJECUTAR EN ESTE ORDEN:
═══════════════════════════════════════════════

PASO 1 — AUDITORÍA ESTRATÉGICA
Identifica el dominio de negocio (Ventas, Logística, RRHH, Finanzas, etc.) y los KPIs más valiosos para un CEO.

PASO 2 — DETECCIÓN DE CORRELACIONES
Examina pares de columnas numéricas en las estadísticas. Si dos columnas numéricas tienen rangos coherentes y podrían correlacionarse (e.g., Precio_Lista ↔ Margen_%, Stock ↔ Tiempo_Entrega_dias), propón un widget tipo "scatter" para visualizar esa relación. Máximo 1-2 scatter.

PASO 3 — PROPUESTA DE 6 WIDGETS DE ALTO IMPACTO
Diseña exactamente 6 widgets usando las reglas siguientes.

═══════════════════════════════════════════════
REGLAS CRÍTICAS DE TIPO DE GRÁFICA:
═══════════════════════════════════════════════
- "bar"      → xAxis categórico (uniqueCount < 50). TIPO POR DEFECTO para la mayoría.
- "line"     → SOLO si xAxis.type === 'date' en las estadísticas. NUNCA uses 'line' con xAxis categórico.
- "pie"      → SOLO si xAxis.uniqueCount <= 8. Si hay más valores, usa 'bar'.
- "scatter"  → Correlación entre 2 columnas numéricas. xAxis y yAxis ambas numéricas.
- "stat"     → KPI de un solo número (sum o avg de una columna numérica). Sin xAxis.

═══════════════════════════════════════════════
REGLAS DE AGGREGATE:
═══════════════════════════════════════════════
- "sum"        → Total de yAxis por grupo (dinero, stock, cantidades)
- "avg"        → Promedio de yAxis por grupo (precios, tasas, porcentajes, tiempos)
- "count"      → Contar filas por xAxis. Para usar con yAxis = columna de ID o nombre. El motor IGNORARÁ yAxis al renderizar.
- "median"     → Mediana de yAxis por grupo (más robusta que avg ante outliers)
- "cumulative" → Suma acumulada ordenada por xAxis (para tendencias de crecimiento)
- "mom"        → Crecimiento Mes-a-Mes en % (requiere xAxis.type === 'date')
- "outliers"   → Mostrar solo valores atípicos por IQR (para detectar anomalías)

═══════════════════════════════════════════════
REGLAS DE ORO PARA TÍTULOS:
═══════════════════════════════════════════════
- Dinero → incluye "$"
- Tiempo → incluye "días" o "d."
- Porcentaje → incluye "%"
- Volumen/Cantidad → incluye "Uds." o "cant."
- Los títulos deben ser descriptivos y accionables para un CEO.

═══════════════════════════════════════════════
DEVUELVE EXACTAMENTE ESTE JSON (sin markdown, sin bloques de código):
═══════════════════════════════════════════════
{
  "narrative": "Resumen ejecutivo de 2-3 frases con insights reales basados en las estadísticas proporcionadas.",
  "analysis": {
    "domain": "Ventas/Finanzas/Logística/RRHH/etc.",
    "main_kpis": ["KPI 1 descriptivo", "KPI 2 descriptivo"]
  },
  "proposedWidgets": [
    {
      "title": "Título accionable para CEO",
      "type": "bar | line | pie | scatter | stat",
      "config": {
        "xAxis": "nombre_exacto_de_columna",
        "yAxis": "nombre_exacto_de_columna_o_array_de_columnas",
        "aggregate": "sum | avg | count | median | cumulative | mom | outliers"
      },
      "styling": {
        "colorScheme": "modern | sunset | ocean | forest",
        "priority": 1
      }
    }
  ],
  "followUpQuestion": "¿Te gustaría que profundizara en [aspecto concreto basado en los datos]?"
}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    console.log('--- GPT-4o PROPOSAL JSON ---');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('-----------------------------');

    if (response.usage) {
      await logAIUsage({
        userId: session?.user?.id,
        actionType: 'dataset-analysis',
        usage: response.usage,
        requestPayload: { prompt: prompt.substring(0, 500) },
        responsePayload: { domain: analysis.analysis?.domain, main_kpis: analysis.analysis?.main_kpis },
      });
    }

    // Log la llamada API para rate limiting
    await logApiCall(session.user.id, 'analyze');

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Error en análisis de IA:', error);
    return NextResponse.json({ error: 'Error al procesar con IA' }, { status: 500 });
  }
}

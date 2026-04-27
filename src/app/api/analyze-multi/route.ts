import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logAIUsage } from '@/lib/aiLogger';
import {
  MultiDatasetAnalysisRequest,
  MultiDatasetAnalysis,
  DatasetForAnalysis,
} from '@/lib/types/multiDataset';

/**
 * POST /api/analyze-multi
 * Analiza múltiples datasets para detectar relaciones cruzadas
 * y proponer gráficos que combinen datos
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: MultiDatasetAnalysisRequest = await request.json();

    // Validar entrada
    if (!body.datasets || body.datasets.length === 0) {
      return NextResponse.json({ error: 'Sin datasets proporcionados' }, { status: 400 });
    }

    if (body.datasets.length > 10) {
      return NextResponse.json(
        { error: 'Máximo 10 archivos permitidos para análisis cruzado' },
        { status: 400 }
      );
    }

    // Validar cada dataset
    for (const ds of body.datasets) {
      if (!ds.name || !ds.headers || !ds.sampleData) {
        return NextResponse.json(
          { error: `Dataset ${ds.name} inválido` },
          { status: 400 }
        );
      }
      if (ds.sampleData.length > 10) {
        return NextResponse.json(
          { error: `Dataset ${ds.name} tiene más de 10 filas de muestra` },
          { status: 400 }
        );
      }
    }

    // Construir prompt para IA
    const prompt = buildAnalysisPrompt(body.datasets);

    // Llamar a OpenAI
    const { analysis, usage, promptTruncated } = await analyzeWithAI(prompt);

    // Registrar uso en AILog
    if (usage) {
      await logAIUsage({
        userId: ((session?.user as { id?: string })?.id || undefined) as string | undefined,
        actionType: 'multi-dataset-analysis',
        usage,
        requestPayload: {
          datasetCount: body.datasets.length,
          totalColumns: body.datasets.reduce((s, d) => s + d.headers.length, 0),
          totalSampleRows: body.datasets.reduce((s, d) => s + d.sampleData.length, 0),
        },
        responsePayload: {
          domain: analysis.domain,
          relationshipCount: analysis.relationships.length,
          proposedWidgetCount: analysis.proposedWidgets.length,
          mainKPIs: analysis.mainKPIs,
        },
      });
    }

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Error en /api/analyze-multi:', error);
    return NextResponse.json(
      { error: 'Error al analizar datasets' },
      { status: 500 }
    );
  }
}

/**
 * Construye el prompt para que IA analice relaciones cruzadas
 */
function buildAnalysisPrompt(datasets: DatasetForAnalysis[]): string {
  const datasetDescriptions = datasets
    .map(
      (ds, i) => `
Dataset ${i + 1}: ${ds.name}
Columnas: ${ds.headers.join(', ')}
Muestra (${ds.sampleData.length} filas):
${JSON.stringify(ds.sampleData, null, 2)}

Estadísticas:
${ds.columnStats.map(col => `- ${col.name}: tipo=${col.type}, únicos=${col.uniqueCount}, nulos=${col.nullCount}`).join('\n')}
`
    )
    .join('\n---\n');

  return `Eres un analista de datos experto. He cargado ${datasets.length} datasets relacionados.
Tu tarea es:

1. **Detectar relaciones**: Identifica claves comunes (ID, CustomerID, ProductID, etc.) entre datasets
2. **Roles de tabla**: Clasifica cada dataset como "transactions" (hechos), "dimension" (dimensiones), u "other"
3. **Proponer métricas**: Sugiere métricas derivadas que combinen datos:
   - Sumas cruzadas (Ej: Ingresos por Cliente)
   - Promedios (Ej: Promedio de compra por segmento)
   - Conteos (Ej: Clientes por región)
   - Tendencias (Ej: Crecimiento mes a mes)

4. **Gráficos**: Para cada métrica, propón un gráfico (bar, line, pie, scatter, stat)
   - Máximo 6 gráficos propuestos
   - Prioriza por impacto: 1=crítico, 10=nice-to-have

IMPORTANTE para los gráficos:
- Solo proporciona la CONFIGURACIÓN (qué campos usar, qué agregación)
- NO hagas el procesamiento/cálculo - eso lo hace el motor local
- config.xAxis y config.yAxis son nombres de COLUMNAS (después del join)
- aggregate es cómo procesarlas: sum, avg, count, median

Datasets proporcionados:
${datasetDescriptions}

Responde SIEMPRE con este JSON válido (sin markdown, sin comentarios):
{
  "domain": "Retail|Finanzas|RRHH|etc",
  "narrative": "Resumen ejecutivo en 2-3 oraciones",
  "datasets": [
    {
      "name": "nombre_archivo.csv",
      "role": "transactions|dimension|fact|other",
      "recordCount": 5000,
      "columnCount": ${datasets[0]?.headers.length || 0}
    }
  ],
  "relationships": [
    {
      "from": "dataset1.csv",
      "to": "dataset2.csv",
      "keys": {
        "dataset1.column_id": "dataset2.id"
      },
      "relationship": "many-to-one|one-to-many|one-to-one|many-to-many",
      "confidence": 0.95
    }
  ],
  "mainKPIs": ["KPI1", "KPI2", "KPI3"],
  "proposedWidgets": [
    {
      "title": "Título descriptivo y accionable",
      "description": "Qué insight proporciona",
      "type": "bar|line|pie|scatter|stat|area|donut",
      "category": "📊 Análisis Ejecutivo|🔍 Detalles|etc",
      "priority": 1,
      "datasetConfig": {
        "primary": "archivo_principal.csv",
        "joins": [
          {
            "dataset": "archivo_secundario.csv",
            "type": "left|inner",
            "on": {
              "dataset1.column": "dataset2.column"
            },
            "selectColumns": ["column_a", "column_b"]
          }
        ],
        "calculations": [
          {
            "name": "metric_name",
            "column": "columna_a_agregar",
            "aggregate": "sum|avg|count|median|min|max|count_distinct",
            "groupBy": "columna_para_agrupar"
          }
        ]
      },
      "config": {
        "xAxis": "columna_para_eje_x",
        "yAxis": ["columna_para_eje_y"],
        "aggregate": "sum|avg|count"
      }
    }
  ],
  "followUpQuestion": "¿Profundizo en [tema específico]?"
}

Sé creativo pero práctico. Enfócate en gráficos que el usuario realmente necesita.`;
}

/**
 * Llamar a OpenAI API
 */
async function analyzeWithAI(prompt: string): Promise<{
  analysis: MultiDatasetAnalysis;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  promptTruncated?: boolean;
}> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('OpenAI error:', error);
    throw new Error(`OpenAI API error: ${error.error?.message}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  const usage = data.usage;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parsear JSON de la respuesta
  try {
    // Limpiar markdown si lo hay
    const jsonStr = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(jsonStr) as MultiDatasetAnalysis;
    return {
      analysis: parsed,
      usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }
}

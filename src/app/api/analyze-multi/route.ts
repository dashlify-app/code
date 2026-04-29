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
 * VERSIÓN MEJORADA: Más agresiva en detección de relaciones, fuzzy matching avanzado
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

  return `Eres un analista de datos EXPERTO en detectar relaciones entre datasets, incluso cuando los nombres no coinciden exactamente.

Tu objetivo: ENCONTRAR TODAS LAS RELACIONES POSIBLES y crear gráficos accionables. No dejes campos en blanco.

REGLAS CRÍTICAS PARA FUZZY MATCHING:
1. **Variaciones de ID**: Busca patrones: id, _id, ID, Id, numero, code, codigo, clave
   Ejemplo: "id_empleado" (Dataset1) conecta con "empleado_id" (Dataset2)
   Ejemplo: "customer_id" conecta con "customerID", "cust_id", "ClientID"

2. **Campos de dimensión**: person, customer, product, employee, store, region, category
   Ejemplo: "person_name" conecta con "name" en tabla de personas
   Ejemplo: "product_code" conecta con "sku" o "product_id"

3. **Patrones de valor**: Si los valores son similares (mismo rango, mismo formato), probablemente conectan
   Ejemplo: si Dataset1.customer_num tiene valores 1001-2500 y Dataset2.cust tiene 1001-2500, conectan

4. **Contexto de negocio**:
   - Busca campos con nombres de tablas en ellos (customer_*, product_*, order_*)
   - Si un dataset es "transacciones", busca campos de referencia
   - Si un dataset es "maestro" (clientes, productos, empleados), sus IDs conectan

5. **CUANDO HAYA AMBIGÜEDAD**:
   - Si no estás 100% seguro, AÚN INCLÚYELO pero con confidence < 0.8
   - Agrega un "clarificationNeeded" indicando qué campo es ambiguo
   - Ejemplo: {"from": "ventas.id_empleado", "to": "empleados.empleado_id", "confidence": 0.75, "clarificationNeeded": "¿Confirma que id_empleado de ventas conecta con empleado_id de empleados?"}

Datasets proporcionados:
${datasetDescriptions}

INSTRUCCIONES ESPECÍFICAS:
1. **Detecta TODAS las relaciones posibles** - no solo las obvias
   - Busca activamente campos que puedan ser claves (IDs, códigos)
   - Compara tipos de datos y cardinalidad
   - Busca campos con patrones similares aunque los nombres difieran

2. **Roles de tabla**: Clasifica como:
   - "transactions": tablas de hechos, eventos, transacciones (muchas filas)
   - "dimension": tablas maestro, catálogos (menos filas, más uniques)
   - "fact": similar a transactions
   - "other": si no está claro

3. **Propone MÍNIMO 5, MÁXIMO 8 gráficos accionables** (SÍ, mínimo 5):
   - Sumas cruzadas: Total/Subtotal por dimensión (2-3 gráficos)
   - Promedios: Métrica promedio por categoría (1-2 gráficos)
   - Conteos: Volumen de transacciones por grupo (1-2 gráficos)
   - Top-N: Top 10 productos, clientes, empleados (1-2 gráficos)
   - Distribuciones: Histogramas, scatter plots si hay correlaciones (1-2 gráficos)
   - Tendencias: Evolución temporal si hay fechas (1-2 gráficos)

   ASEGÚRATE DE GENERAR AL MENOS 5. Si tienes duda, GENERA MÁS.

4. **Para cada gráfico propuesto**:
   - xAxis y yAxis DEBEN tener valores reales (nunca nulos/vacíos)
   - Si necesitas un join, especifica exactamente qué columnas conectan
   - groupBy debe ser una columna que existe en los datos
   - Usa aggregate: sum, avg, count, median, min, max, count_distinct

5. **Validación de campos** (CRÍTICO):
   - ANTES de incluir un campo en xAxis/yAxis, VERIFICA que existe en los datos
   - Incluye el nombre exacto de la columna tal como aparece en los datos (case-sensitive)
   - NUNCA dejes xAxis o yAxis en blanco - si no encontraste campo, propón otro gráfico
   - Si necesitas un cálculo (ej: suma), usa field existente con aggregate
   - Ejemplo CORRECTO: {"xAxis": "category", "yAxis": "sales", "aggregate": "sum"}
   - Ejemplo INCORRECTO: {"xAxis": "", "yAxis": "total_sales"} ← ESTO SERÁ FILTRADO

6. **Gráficos de Línea (line)** - Regla Especial:
   - SOLO propón type:"line" si tienes una columna de FECHA/DATETIME/AÑO-MES
   - Busca columnas con: fecha, date, mes, month, año, year, timestamp, datetime, period
   - Si la columna de fecha NO existe directamente, NO uses "line" - usa "bar" en su lugar
   - Ejemplo CORRECTO: xAxis="fecha_venta", type="line", aggregate="count"
   - Ejemplo INCORRECTO: xAxis="mes_no_existe", type="line" ← Esto quedará vacío

Responde SIEMPRE con este JSON válido (sin markdown, sin comentarios):
{
  "domain": "Retail|Finanzas|RRHH|Logística|etc",
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
      "confidence": 0.95,
      "clarificationNeeded": "opcional - si hay ambigüedad, pregunta al usuario aquí"
    }
  ],
  "mainKPIs": ["KPI1", "KPI2", "KPI3"],
  "proposedWidgets": [
    {
      "title": "Título descriptivo y accionable",
      "description": "Qué insight proporciona",
      "type": "bar|line|pie|scatter|stat|area|donut",
      "category": "📊 Análisis Ejecutivo|🔍 Detalles|💡 Insights|etc",
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
        "yAxis": "columna_para_eje_y",
        "aggregate": "sum|avg|count"
      },
      "clarificationNeeded": "opcional - si necesitas confirmación del usuario sobre los campos usados, pregunta aquí"
    }
  ],
  "clarificationQuestions": [
    {
      "relationship": "ventas.id_empleado → empleados.empleado_id",
      "question": "¿Confirma que id_empleado de ventas conecta con empleado_id de empleados?",
      "suggestedAnswer": "sí"
    }
  ],
  "followUpQuestion": "¿Profundizo en [tema específico]?"
}

CHECKLIST FINAL (MUY IMPORTANTE):
✅ Propusiste MÍNIMO 5 gráficos (preferentemente 6-8)?
✅ Cada gráfico tiene xAxis con valor real (no vacío)?
✅ Cada gráfico tiene yAxis con valor real (no vacío) EXCEPTO si type='stat'?
✅ Todos los nombres de columnas existen exactamente como aparecen en los datos?
✅ Si usaste type:'line', verificaste que existe una columna de FECHA en los datos?
✅ Ningún gráfico quedará vacío (todos tienen campos válidos y datos)?
✅ Las relaciones detectadas tienen confidence > 0.7 o clarificationNeeded?
✅ Los gráficos son ACCIONABLES para negocio (no random)?

Si respondiste NO a cualquiera: REVISA Y CORRIGE antes de responder.

El objetivo es dar al usuario gráficos LISTOS PARA USAR (5-8), no un blanco en su dashboard.`;
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
      temperature: 0.8,
      max_tokens: 6000,
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

    let parsed = JSON.parse(jsonStr) as MultiDatasetAnalysis;

    // Validar y limpiar widgets: asegurar que no tengan campos en blanco
    parsed = validateAndCleanWidgets(parsed);

    return {
      analysis: parsed,
      usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }
}

/**
 * Valida que todos los widgets tengan xAxis y yAxis válidos (no vacíos)
 * Filtra widgets con campos críticos en blanco
 */
function validateAndCleanWidgets(analysis: MultiDatasetAnalysis): MultiDatasetAnalysis {
  const validatedWidgets = analysis.proposedWidgets.filter(widget => {
    // Verificar que xAxis no esté vacío
    if (!widget.config.xAxis || widget.config.xAxis.trim() === '') {
      console.warn(`Widget "${widget.title}" tiene xAxis vacío - será filtrado`);
      return false;
    }

    // Para widgets que no sean tipo 'stat', verificar yAxis
    if (widget.type !== 'stat') {
      const yAxis = widget.config.yAxis;
      if (!yAxis || (typeof yAxis === 'string' && yAxis.trim() === '')) {
        console.warn(`Widget "${widget.title}" tiene yAxis vacío - será filtrado`);
        return false;
      }
    }

    return true;
  });

  // Si filtramos widgets, avisar
  if (validatedWidgets.length < analysis.proposedWidgets.length) {
    console.warn(
      `Se filtraron ${analysis.proposedWidgets.length - validatedWidgets.length} widgets con campos vacíos`
    );
  }

  return {
    ...analysis,
    proposedWidgets: validatedWidgets.length > 0 ? validatedWidgets : analysis.proposedWidgets,
  };
}

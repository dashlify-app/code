# API: Análisis Cruzado Multi-Dataset

## Descripción General

El endpoint `/api/analyze-multi` utiliza IA (GPT-4o) para analizar múltiples datasets cargados simultáneamente, detectar relaciones cruzadas, identificar KPIs principales y proponer gráficos que combinen datos de diferentes fuentes.

**Diferencia clave:** Mientras que `/api/analyze` analiza un solo dataset, `/api/analyze-multi` analiza relaciones ENTRE datasets.

## Endpoint

```
POST /api/analyze-multi
```

## Autenticación

**Requerido:** NextAuth session válida

```typescript
// La solicitud debe incluir una cookie de sesión válida
// Generada automáticamente por NextAuth al iniciar sesión
```

**Respuesta sin autenticación:**
```json
{
  "error": "No autorizado"
}
```

## Límites y Restricciones

| Límite | Valor | Razón |
|--------|-------|-------|
| Máximo de datasets | 10 | Evitar timeouts y costos excesivos de IA |
| Máximo de filas por dataset | 10 | 5 primeras + 5 random para muestra representativa |
| Máximo de columnas totales | ~150 | Límite de tokens de entrada |
| Máximo de llamadas por usuario | 10/minuto | Rate limiting implementado |
| Máximo de campos en requestPayload | Sin límite | Truncado a 500 chars en AILog |

## Request Schema

### Body (application/json)

```typescript
{
  datasets: DatasetForAnalysis[]
}
```

### DatasetForAnalysis

```typescript
interface DatasetForAnalysis {
  id: string;                      // Identificador único del dataset
  name: string;                    // Nombre del archivo (ej: "ventas.csv")
  headers: string[];               // Nombres de columnas
  sampleData: Record<string, any>[]; // Array de objetos (máx 10 filas)
  columnStats: ColumnStat[];       // Estadísticas de cada columna
}

interface ColumnStat {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'unknown';
  nullCount: number;
  uniqueCount: number;
  min?: number;                    // Para columnas numéricas
  max?: number;
  avg?: number;
  stddev?: number;
  top5?: { value: string; count: number }[];  // Para categóricas
}
```

### Ejemplo de Request

```bash
curl -X POST http://localhost:3000/api/analyze-multi \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "datasets": [
      {
        "id": "ds-1",
        "name": "ventas.csv",
        "headers": ["id", "customer_id", "amount", "date"],
        "sampleData": [
          {"id": 1, "customer_id": 101, "amount": 1000, "date": "2024-01-01"},
          {"id": 2, "customer_id": 102, "amount": 2000, "date": "2024-01-02"}
        ],
        "columnStats": [
          {
            "name": "amount",
            "type": "numeric",
            "nullCount": 0,
            "uniqueCount": 2,
            "min": 1000,
            "max": 2000,
            "avg": 1500
          }
        ]
      },
      {
        "id": "ds-2",
        "name": "clientes.csv",
        "headers": ["id", "name", "segment"],
        "sampleData": [
          {"id": 101, "name": "Alice", "segment": "Premium"},
          {"id": 102, "name": "Bob", "segment": "Basic"}
        ],
        "columnStats": [
          {
            "name": "segment",
            "type": "categorical",
            "nullCount": 0,
            "uniqueCount": 2,
            "top5": [
              {"value": "Premium", "count": 1},
              {"value": "Basic", "count": 1}
            ]
          }
        ]
      }
    ]
  }'
```

## Response Schema

### Success (200 OK)

```typescript
{
  success: true;
  analysis: MultiDatasetAnalysis;
}

interface MultiDatasetAnalysis {
  domain: string;                  // Dominio detectado (Retail, Finanzas, etc)
  narrative: string;               // Resumen ejecutivo en 2-3 oraciones
  datasets: Array<{
    name: string;
    role: 'transactions' | 'dimension' | 'fact' | 'other';
    recordCount: number;
    columnCount: number;
  }>;
  relationships: RelationshipDetected[];
  mainKPIs: string[];              // KPIs principales detectados
  proposedWidgets: ProposedWidget[];  // Gráficos sugeridos
  followUpQuestion?: string;       // Pregunta de seguimiento opcional
}

interface RelationshipDetected {
  from: string;                    // Nombre dataset origen
  to: string;                      // Nombre dataset destino
  keys: Record<string, string>;    // { "dataset1.col": "dataset2.col" }
  relationship: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  confidence: number;              // 0-1, probabilidad de relación correcta
}

interface ProposedWidget {
  title: string;
  description?: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'stat' | 'area' | 'donut';
  category?: string;               // Para agrupar en UI
  priority: number;                // 1-10, mayor = más importante
  datasetConfig: {
    primary: string;               // Dataset principal
    joins?: JoinConfig[];          // Configuración de joins
    calculations?: Calculation[];  // Cálculos a realizar
  };
  config: {
    xAxis: string;
    yAxis?: string | string[];
    aggregate?: 'sum' | 'avg' | 'median' | 'count' | 'mom' | 'cumulative' | 'outliers';
  };
}

interface JoinConfig {
  dataset: string;
  type?: 'left' | 'inner' | 'full';
  on: Record<string, string>;      // Claves de join
  selectColumns: string[];         // Columnas a traer
}

interface Calculation {
  name: string;
  column: string;
  aggregate: 'sum' | 'avg' | 'count' | 'median' | 'min' | 'max' | 'count_distinct';
  groupBy?: string;
  formula?: string;
}
```

### Ejemplo de Response

```json
{
  "success": true,
  "analysis": {
    "domain": "Retail",
    "narrative": "Datos de ventas con información de clientes. Se detectan relaciones claras entre transacciones y segmentos. Oportunidades para análisis de rentabilidad por segmento.",
    "datasets": [
      {
        "name": "ventas.csv",
        "role": "transactions",
        "recordCount": 5000,
        "columnCount": 4
      },
      {
        "name": "clientes.csv",
        "role": "dimension",
        "recordCount": 2500,
        "columnCount": 3
      }
    ],
    "relationships": [
      {
        "from": "ventas.csv",
        "to": "clientes.csv",
        "keys": {
          "ventas.customer_id": "clientes.id"
        },
        "relationship": "many-to-one",
        "confidence": 0.95
      }
    ],
    "mainKPIs": [
      "Total Revenue",
      "Customer Count",
      "Average Order Value",
      "Premium vs Basic Segment Split"
    ],
    "proposedWidgets": [
      {
        "title": "Revenue by Customer Segment",
        "description": "Total revenue desglosado por segmento de cliente",
        "type": "bar",
        "category": "📊 Análisis Ejecutivo",
        "priority": 1,
        "datasetConfig": {
          "primary": "ventas.csv",
          "joins": [
            {
              "dataset": "clientes.csv",
              "type": "left",
              "on": {
                "ventas.customer_id": "clientes.id"
              },
              "selectColumns": ["segment"]
            }
          ],
          "calculations": [
            {
              "name": "revenue",
              "column": "amount",
              "aggregate": "sum",
              "groupBy": "segment"
            }
          ]
        },
        "config": {
          "xAxis": "segment",
          "yAxis": ["amount"],
          "aggregate": "sum"
        }
      }
    ],
    "followUpQuestion": "¿Quieres analizar la rentabilidad por producto?"
  }
}
```

## Error Responses

### 400 Bad Request

**Caso: Sin datasets**
```json
{
  "error": "Sin datasets proporcionados"
}
```

**Caso: Más de 10 datasets**
```json
{
  "error": "Máximo 10 archivos permitidos para análisis cruzado"
}
```

**Caso: Dataset inválido**
```json
{
  "error": "Dataset ventas.csv inválido"
}
```

**Caso: Demasiadas filas en dataset**
```json
{
  "error": "Dataset clientes.csv tiene más de 10 filas de muestra"
}
```

### 401 Unauthorized

```json
{
  "error": "No autorizado"
}
```

### 500 Internal Server Error

```json
{
  "error": "Error al analizar datasets"
}
```

**Causas posibles:**
- Error en OpenAI API
- Error al parsear respuesta JSON
- Timeout en solicitud

## Modelos IA Utilizados

| Modelo | Uso |
|--------|-----|
| GPT-4o | Análisis cruzado, detección de relaciones, propuesta de gráficos |

**Precios (vigentes en 2024):**
- Input: $0.000005 por token ($5 por millón)
- Output: $0.000015 por token ($15 por millón)

## Auditoría - AILog

Cada llamada a este endpoint se registra en la tabla `AILog` con:

| Campo | Descripción |
|-------|-------------|
| userId | ID del usuario autenticado |
| actionType | `"multi-dataset-analysis"` |
| promptTokens | Tokens enviados a IA |
| completionTokens | Tokens generados por IA |
| totalTokens | Suma de ambos |
| estimatedCostUSD | Costo estimado calculado |
| requestPayload | Metadata de solicitud (datasetCount, totalColumns, etc) |
| responsePayload | Metadata de respuesta (domain, relationships, widgets) |
| createdAt | Timestamp automático |

**Ejemplo de registro:**
```typescript
{
  userId: "user-abc123",
  actionType: "multi-dataset-analysis",
  promptTokens: 2500,
  completionTokens: 1200,
  totalTokens: 3700,
  estimatedCostUSD: 0.0335,  // (2500 * $0.000005) + (1200 * $0.000015)
  requestPayload: {
    datasetCount: 2,
    totalColumns: 7,
    totalSampleRows: 20
  },
  responsePayload: {
    domain: "Retail",
    relationshipCount: 1,
    proposedWidgetCount: 5,
    mainKPIs: ["Total Revenue", "Customer Count", ...]
  }
}
```

## Rate Limiting

**Límite:** 10 llamadas/minuto por usuario

**Respuesta cuando se excede:**
```json
{
  "error": "Rate limit exceeded"
}
```

**Headers de respuesta:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1609459260
```

## Flujo de Uso Típico

### 1. Frontend prepara datos

```typescript
const datasetsForAnalysis = files.map(f => {
  const allRows = f.sampleData || [];
  const first5 = allRows.slice(0, 5);
  const remaining = allRows.slice(5);
  const random5 = remaining.slice(0, Math.min(5, remaining.length));
  const sampleData = [...first5, ...random5].slice(0, 10);

  return {
    id: f.id || f.name,
    name: f.name,
    headers: f.headers,
    sampleData,
    columnStats: computeColumnStats(sampleData, f.headers)
  };
});
```

### 2. Frontend envía solicitud

```typescript
const res = await fetch('/api/analyze-multi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ datasets: datasetsForAnalysis })
});

const data = await res.json();
```

### 3. Backend procesa con IA

- Valida entrada (máx 10 datasets, máx 10 filas c/u)
- Construye prompt especializado
- Llama OpenAI GPT-4o
- Extrae tokens de respuesta
- Registra en AILog

### 4. Frontend visualiza resultados

- Muestra `RelationshipDiagram` con relaciones
- Muestra gráficos propuestos agrupados por categoría
- Usuario selecciona cuáles crear
- Frontend envía widgets seleccionados al dashboard

### 5. Widget renderiza datos

```typescript
if (multiDatasetConfig) {
  const result = executeJoinedQuery(
    primaryDataset,
    joins,
    calculations,
    allDatasetsMap
  );
  // Motor local procesa joins sin IA
  // ChartEngine renderiza gráfico
}
```

## Consideraciones de Privacidad

✓ **Solo muestras se envían a IA:** 10 filas máximo por dataset  
✓ **Sin datos sensibles:** No incluir PII, contraseñas, etc.  
✓ **Payload truncado:** Prompt truncado a 500 chars en AILog  
✓ **RLS protege acceso:** Supabase RLS policies por organizationId  

## Troubleshooting

### "Error al analizar datasets"

**Posibles causas:**
- OpenAI API key inválida o expirada
- Timeout (solicitud muy grande o API lenta)
- JSON inválido en respuesta de OpenAI

**Solución:**
- Verificar OPENAI_API_KEY en variables de entorno
- Reducir número de datasets o filas
- Verificar status de OpenAI API

### "Rate limit exceeded"

**Solución:**
- Esperar 60 segundos antes de siguiente solicitud
- Implementar retry logic con backoff exponencial

### "Dataset [name] inválido"

**Posibles causas:**
- Falta `name`, `headers`, o `sampleData`
- `sampleData` contiene más de 10 filas

**Solución:**
- Verificar estructura de `DatasetForAnalysis`
- Asegurar que cada dataset tenga exactamente ≤10 filas

## Ejemplos en Diferentes Lenguajes

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const response = await axios.post('/api/analyze-multi', {
  datasets: [
    {
      id: 'sales-1',
      name: 'sales.csv',
      headers: ['id', 'amount'],
      sampleData: [{ id: 1, amount: 100 }],
      columnStats: [{ name: 'amount', type: 'numeric', nullCount: 0, uniqueCount: 1 }]
    }
  ]
});

const { analysis } = response.data;
console.log(analysis.mainKPIs);
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/api/analyze-multi', json={
    'datasets': [
        {
            'id': 'sales-1',
            'name': 'sales.csv',
            'headers': ['id', 'amount'],
            'sampleData': [{'id': 1, 'amount': 100}],
            'columnStats': [{'name': 'amount', 'type': 'numeric', 'nullCount': 0, 'uniqueCount': 1}]
        }
    ]
})

analysis = response.json()['analysis']
print(analysis['mainKPIs'])
```

### cURL

```bash
curl -X POST http://localhost:3000/api/analyze-multi \
  -H "Content-Type: application/json" \
  -d '{
    "datasets": [{
      "id": "sales-1",
      "name": "sales.csv",
      "headers": ["id", "amount"],
      "sampleData": [{"id": 1, "amount": 100}],
      "columnStats": [{"name": "amount", "type": "numeric", "nullCount": 0, "uniqueCount": 1}]
    }]
  }'
```

## Versión de API

- **Versión actual:** 1.0
- **Última actualización:** Abril 2026
- **Estado:** Producción

## Soporte

Para problemas, reportes de bugs o sugerencias, contactar al equipo de desarrollo o crear un issue en el repositorio.

---

**Documentación generada automáticamente.**  
**Última actualización:** Abril 26, 2026

# GUÍA RÁPIDA: ANÁLISIS CRUZADO MULTI-DATASET

## Para Usuarios

### 1. Cargando Datasets

1. Entra al dashboard
2. Haz clic en "➕ Cargar Dataset"
3. Selecciona 2-10 archivos CSV
4. Sistema extrae: headers, primeras 5 rows, columnStats

```
Requisitos por archivo:
- Mínimo: 1 fila de datos (además de headers)
- Máximo: Ilimitado (sistema usa muestra de 10)
- Columnas: Ilimitadas (máx 150 total entre datasets)
```

### 2. Análisis Cruzado

1. Una vez cargados 2+ datasets, aparece botón: **🔀 Análisis Cruzado**
2. Presiona el botón
3. Sistema:
   - Prepara 5 primeras + 5 random rows por dataset
   - Envía a OpenAI GPT-4o
   - Detecta relaciones automáticamente
   - Propone gráficos

**Espera:** ~3-8 segundos (depende de OpenAI)

### 3. Resultados

Verás:
- **Datasets analizados**: Rol, columnas, registros
- **KPIs detectados**: Métricas principales
- **Diagrama de relaciones**: Visual con joins
- **Gráficos propuestos**: Agrupados por categoría

### 4. Crear Gráficos

1. Lee detalles técnicos (presiona ▼ en cada gráfico)
2. Selecciona cuáles quieres (checkbox)
3. Presiona **"Crear X Gráficos"**
4. Sistema agrega al dashboard

**Resultado:** Widgets renderizados con datos combinados

---

## Para Desarrolladores

### API: POST /api/analyze-multi

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
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "domain": "Retail",
    "narrative": "Análisis de ventas con clientes...",
    "datasets": [...],
    "relationships": [{from, to, keys, type, confidence}],
    "mainKPIs": ["Total Revenue", "Customer Count", ...],
    "proposedWidgets": [...]
  }
}
```

### Motor de Joins Local

Importa `executeJoinedQuery`:

```typescript
import { executeJoinedQuery } from '@/lib/multiDatasetJoin';

// Datos
const salesData = [{id: 1, customer_id: 101, amount: 100}];
const customersData = [{id: 101, name: 'Alice', segment: 'Premium'}];

// Configuración
const joins = [{
  dataset: 'customers',
  type: 'left',
  on: { 'sales.customer_id': 'customers.id' },
  selectColumns: ['name', 'segment']
}];

const calculations = [{
  name: 'revenue',
  column: 'amount',
  aggregate: 'sum',
  groupBy: 'segment'
}];

const allDatasets = new Map([
  ['sales', salesData],
  ['customers', customersData]
]);

// Ejecutar
const result = executeJoinedQuery(
  salesData,
  joins,
  calculations,
  allDatasets
);

// Resultado: {labels: ['Premium'], datasets: [{label: 'revenue', data: [100]}]}
```

### Agregaciones Soportadas

```typescript
'sum'           // SUM(column)
'avg'           // AVG(column)
'count'         // COUNT(column)
'median'        // MEDIAN(column)
'min'           // MIN(column)
'max'           // MAX(column)
'count_distinct' // COUNT(DISTINCT column)
```

### Tipos de Join

```typescript
'left'  // LEFT JOIN (preserva primario)
'inner' // INNER JOIN (solo matches)
'full'  // FULL JOIN (todos)
```

---

## Estructura de Archivos

```
src/
├── lib/
│   ├── types/multiDataset.ts           # Interfaces TypeScript
│   ├── multiDatasetJoin.ts             # Motor de joins
│   └── __tests__/multiDatasetJoin.test.ts  # Tests (25+ casos)
│
├── components/
│   ├── MultiDatasetAnalysisResult.tsx  # UI resultados
│   ├── RelationshipDiagram.tsx         # Visualización relaciones
│   ├── UploadZone.tsx                  # [MODIFICADO] Análisis trigger
│   └── SortableWidget.tsx              # [MODIFICADO] Render joins
│
├── app/api/
│   └── analyze-multi/
│       └── route.ts                    # POST endpoint
│
└── docs/
    └── API_ANALYZE_MULTI.md            # Documentación completa
```

---

## Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Solo multiDatasetJoin
npm test -- multiDatasetJoin

# Con cobertura
npm test -- --coverage
```

### Ejemplo de Test

```typescript
it('debería hacer LEFT JOIN', () => {
  const joins = [{
    dataset: 'customers',
    type: 'left',
    on: { 'sales.customer_id': 'customers.id' },
    selectColumns: ['name']
  }];

  const result = executeJoinedQuery(
    salesData,
    joins,
    calculations,
    allDatasets
  );

  expect(result.labels).toContain('Premium');
});
```

---

## Auditoría: AILog

Cada análisis se registra automáticamente:

```typescript
{
  userId: "user-abc123",
  actionType: "multi-dataset-analysis",
  promptTokens: 2500,
  completionTokens: 1200,
  totalTokens: 3700,
  estimatedCostUSD: 0.0335,
  requestPayload: {
    datasetCount: 2,
    totalColumns: 7,
    totalSampleRows: 20
  },
  responsePayload: {
    domain: "Retail",
    relationshipCount: 1,
    proposedWidgetCount: 5
  },
  createdAt: "2026-04-26T21:00:00Z"
}
```

**Cálculo de costo:**
```
prompt_tokens (2500) × $0.000005 = $0.0125
completion_tokens (1200) × $0.000015 = $0.018
─────────────────────────────────────────
Total = $0.0305
```

---

## Troubleshooting

### "Rate limit exceeded"

**Solución:** Esperar 60 segundos antes de siguiente llamada

```bash
# Check rate limit headers
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1609459260 (timestamp)
```

### "Dataset inválido"

**Causas posibles:**
- Falta `name`, `headers`, o `sampleData`
- `sampleData` tiene >10 filas
- Estructura inconsistente

**Solución:**
```typescript
// ✓ Correcto
{
  id: "ds-1",
  name: "ventas.csv",
  headers: ["col1", "col2"],
  sampleData: [{col1: "a", col2: "b"}],
  columnStats: [...]
}

// ✗ Incorrecto
{
  name: "ventas.csv",
  // Falta: id, headers, sampleData, columnStats
}
```

### "Error al analizar datasets"

**Posibles causas:**
1. OpenAI API key inválida
2. Timeout (requests muy grandes)
3. JSON inválido en respuesta

**Solución:**
```bash
# 1. Verificar API key
echo $OPENAI_API_KEY

# 2. Reducir datasets o filas
# 3. Verificar estado OpenAI API
```

---

## Limitaciones Actuales

1. **Max 10 datasets** - Evitar timeouts
2. **Max 10 filas muestra** - Límite de tokens
3. **Max 150 columnas totales** - Contexto GPT-4o
4. **10 llamadas/minuto** - Rate limiting

**Próximas mejoras:**
- Soporte paginado para >10 datasets
- Caché de análisis previos
- Dashboard de costos por usuario

---

## Recursos

- **Documentación API:** `/docs/API_ANALYZE_MULTI.md`
- **Tipos TypeScript:** `/src/lib/types/multiDataset.ts`
- **Tests:** `/src/lib/__tests__/multiDatasetJoin.test.ts`
- **Componentes:** `/src/components/`

---

## Support

Para bugs, reportes o sugerencias:
1. Revisar `/docs/API_ANALYZE_MULTI.md` (Troubleshooting)
2. Revisar logs de AILog (userId + actionType)
3. Crear issue en repositorio

---

**Versión:** 1.0  
**Última actualización:** Abril 2026  
**Estado:** Producción ✓

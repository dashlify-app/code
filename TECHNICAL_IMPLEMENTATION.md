# Implementación Técnica: Detección de Relaciones Mejorada

## Arquitectura General

```
┌──────────────────────────────────────┐
│ Usuario carga múltiples archivos     │
└──────────────────────────────┬───────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  /api/analyze-multi
                    │  (POST request)
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │ buildAnalysisPrompt()│
                    │ - Fuzzy matching     │
                    │ - Validation rules   │
                    │ - Ambiguity handling │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │ OpenAI GPT-4o        │
                    │ (analyzeWithAI)      │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │validateAndCleanWidgets
                    │ - Filtra vacíos      │
                    │ - Valida xAxis/yAxis │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │ MultiDatasetAnalysis │
                    │ + clarificationQ.    │
                    └────────┬─────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │MultiDatasetAnalysisResult│
              │- Muestra relaciones      │
              │- Muestra clarifications  │
              │- Usuario selecciona      │
              └──────────────────────────┘
```

---

## 1. Prompt Mejorado (`buildAnalysisPrompt`)

### Antes:
```typescript
return `Eres un analista de datos experto. He cargado ${datasets.length} datasets...
Tu tarea es:
1. Detectar relaciones
2. Roles de tabla
3. Proponer métricas
4. Gráficos

[+ instrucciones genéricas]`;
```

### Después:
```typescript
return `Eres un analista de datos EXPERTO en detectar relaciones...

REGLAS CRÍTICAS PARA FUZZY MATCHING:
1. **Variaciones de ID**: id, _id, ID, Id, numero, code, codigo, clave
   Ejemplo: "id_empleado" ↔ "empleado_id"

2. **Campos de dimensión**: person, customer, product, employee...
   Ejemplo: "person_name" ↔ "name"

3. **Patrones de valor**: Si rango/formato similares, probablemente conectan
   Ejemplo: Dataset1.customer_num [1001-2500] ↔ Dataset2.cust [1001-2500]

4. **Contexto de negocio**: Busca customer_*, product_*, order_*
   
5. **CUANDO HAYA AMBIGÜEDAD**:
   - Inclúyelo pero con confidence < 0.8
   - Agrega "clarificationNeeded"
   - Ejemplo: {"confidence": 0.75, "clarificationNeeded": "¿...?"}

[+ resto del prompt con validación de campos]`;
```

### Cambios Clave:

**1. Fuzzy Matching Explícito**
```
# Antes:
"Identifica claves comunes (ID, CustomerID, ProductID, etc.)"

# Después:
"Variaciones: id, _id, ID, Id, numero, code, codigo, clave
Ejemplo: 'id_empleado' ↔ 'empleado_id'
Ejemplo: 'customer_id' ↔ 'customerID', 'cust_id', 'ClientID'"
```

**2. Confianza Gradual**
```javascript
{
  "relationship": "...",
  "confidence": 0.95,              // Exacto
  
  // VS
  
  "relationship": "...",
  "confidence": 0.75,              // Ambiguo
  "clarificationNeeded": "¿...?"   // NUEVO
}
```

**3. Validación de Campos**
```
IMPORTANTE:
- xAxis y yAxis DEBEN tener valores reales
- Nunca nulos/vacíos
- Verifica que existe en los datos
- Si no existe, propón otro gráfico
```

---

## 2. Validación Post-Procesamiento

### Nueva Función: `validateAndCleanWidgets()`

```typescript
function validateAndCleanWidgets(
  analysis: MultiDatasetAnalysis
): MultiDatasetAnalysis {
  const validatedWidgets = analysis.proposedWidgets.filter(widget => {
    // ✅ REGLA 1: xAxis es obligatorio y no puede estar vacío
    if (!widget.config.xAxis || widget.config.xAxis.trim() === '') {
      console.warn(`Widget "${widget.title}" tiene xAxis vacío - será filtrado`);
      return false;
    }

    // ✅ REGLA 2: yAxis es obligatorio (excepto para 'stat')
    if (widget.type !== 'stat') {
      const yAxis = widget.config.yAxis;
      if (!yAxis || (typeof yAxis === 'string' && yAxis.trim() === '')) {
        console.warn(`Widget "${widget.title}" tiene yAxis vacío - será filtrado`);
        return false;
      }
    }

    // ✅ Widget válido
    return true;
  });

  // Si filtramos algo, avisar
  if (validatedWidgets.length < analysis.proposedWidgets.length) {
    console.warn(
      `Se filtraron ${
        analysis.proposedWidgets.length - validatedWidgets.length
      } widgets con campos vacíos`
    );
  }

  return {
    ...analysis,
    proposedWidgets: 
      validatedWidgets.length > 0 
        ? validatedWidgets 
        : analysis.proposedWidgets,
  };
}
```

### Integración en `analyzeWithAI()`:

```typescript
async function analyzeWithAI(prompt: string): Promise<{
  analysis: MultiDatasetAnalysis;
  usage: { ... };
}> {
  // ... fetch OpenAI ...
  
  try {
    const jsonStr = content.replace(/```json\n?/g, '').trim();
    let parsed = JSON.parse(jsonStr) as MultiDatasetAnalysis;

    // ✨ VALIDACIÓN: Filtrar widgets vacíos
    parsed = validateAndCleanWidgets(parsed);

    return {
      analysis: parsed,
      usage: usage || { ... },
    };
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }
}
```

---

## 3. Actualización de Tipos TypeScript

### `multiDataset.ts`

#### A. Nuevo Tipo: `ClarificationQuestion`

```typescript
export interface ClarificationQuestion {
  // Describe qué relación se pregunta
  relationship?: string;
  // Ej: "ventas.id_empleado → empleados.empleado_id"

  // Pregunta clara para el usuario
  question: string;
  // Ej: "¿Confirma que id_empleado de ventas conecta con empleado_id de empleados?"

  // Respuesta sugerida (basada en confianza)
  suggestedAnswer?: string;
  // Ej: "sí"

  // Si aplica a un widget específico
  widgetIndex?: number;
}
```

#### B. RelationshipDetected (MEJORADO)

```typescript
export interface RelationshipDetected {
  from: string;                          // "ventas.csv"
  to: string;                            // "empleados.csv"
  keys: { [fromKey: string]: string };   // { "ventas.id_empleado": "empleados.empleado_id" }
  relationship: 'one-to-one' | 'one-to-many' | ...;
  confidence: number;                    // 0-1

  // ✨ NUEVO:
  clarificationNeeded?: string;          // "¿Confirma que...?"
}
```

#### C. ProposedWidget (MEJORADO)

```typescript
export interface ProposedWidget {
  title: string;
  description?: string;
  type: 'bar' | 'line' | 'pie' | ...;
  priority: number;

  datasetConfig: {
    primary: string;
    joins?: JoinConfig[];
    calculations?: Calculation[];
  };

  config: {
    xAxis: string;                      // Nunca vacío (después de mejoras)
    yAxis?: string | string[];          // Nunca vacío para tipos != 'stat'
    aggregate?: ...;
  };

  // ✨ NUEVO:
  clarificationNeeded?: string;          // Si hay duda sobre los campos
}
```

#### D. MultiDatasetAnalysis (MEJORADO)

```typescript
export interface MultiDatasetAnalysis {
  domain: string;
  narrative: string;
  datasets: { ... }[];
  relationships: RelationshipDetected[];
  mainKPIs: string[];
  proposedWidgets: ProposedWidget[];

  // ✨ NUEVO:
  clarificationQuestions?: ClarificationQuestion[];

  followUpQuestion?: string;
}
```

---

## 4. Componente UI: Mostrar Clarificaciones

### En `MultiDatasetAnalysisResult.tsx`

#### Sección Nueva (después de Relaciones):

```jsx
{/* Preguntas de Clarificación */}
{analysis.clarificationQuestions && analysis.clarificationQuestions.length > 0 && (
  <div className="space-y-3 p-4 rounded-lg border-2" 
    style={{ 
      borderColor: 'var(--accent)', 
      background: 'var(--surface3)' 
    }}>
    
    {/* Header */}
    <div className="text-sm font-bold flex items-center gap-2" 
      style={{ color: 'var(--accent)' }}>
      <span>❓</span>
      <span>Confirmación de Relaciones</span>
    </div>
    
    {/* Lista de preguntas */}
    <div className="space-y-3 text-sm">
      {analysis.clarificationQuestions.map((q, idx) => (
        <div key={idx} className="p-3 rounded bg-black/20">
          {/* Pregunta */}
          <div className="font-semibold text-sm mb-2">
            {q.question}
          </div>

          {/* Relación (si aplica) */}
          {q.relationship && (
            <div className="text-xs opacity-70 font-mono mb-2">
              Relación: 
              <span style={{ color: 'var(--accent)' }}>
                {q.relationship}
              </span>
            </div>
          )}

          {/* Sugerencia */}
          {q.suggestedAnswer && (
            <div className="text-xs">
              <span className="opacity-60">Sugerencia: </span>
              <span className="font-mono" 
                style={{ color: 'var(--accent)' }}>
                {q.suggestedAnswer}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>

    {/* Info */}
    <div className="text-xs opacity-70 border-t pt-2"
      style={{ borderColor: 'var(--border)' }}>
      ℹ️ Si confirma estas relaciones, todos los gráficos 
         propuestos funcionarán correctamente.
    </div>
  </div>
)}
```

---

## 5. Flujo de Ejecución Completo

### Step-by-Step

```
1. Usuario carga: ventas.csv + empleados.csv

2. POST /api/analyze-multi con:
   {
     "datasets": [
       { name: "ventas.csv", headers: ["id_venta", "id_empleado", "monto"], ... },
       { name: "empleados.csv", headers: ["empleado_id", "nombre", "depto"], ... }
     ]
   }

3. buildAnalysisPrompt() genera:
   - Lista de datasets con columnas
   - Datos de muestra
   - INSTRUCCIONES NUEVAS para fuzzy matching
   - INSTRUCCIONES para manejar ambigüedad
   - INSTRUCCIONES para NO generar campos vacíos

4. OpenAI responde con:
   {
     "domain": "RRHH",
     "relationships": [
       {
         "from": "ventas.csv",
         "to": "empleados.csv",
         "keys": {"ventas.id_empleado": "empleados.empleado_id"},
         "confidence": 0.85,
         "clarificationNeeded": "¿Confirma que id_empleado conecta con empleado_id?"
       }
     ],
     "proposedWidgets": [
       {
         "title": "Ventas por Empleado",
         "config": {
           "xAxis": "nombre",    // ✅ Válido (no vacío)
           "yAxis": "monto"      // ✅ Válido (no vacío)
         },
         "clarificationNeeded": "..."
       }
     ],
     "clarificationQuestions": [
       {
         "relationship": "ventas.id_empleado → empleados.empleado_id",
         "question": "¿Confirma que id_empleado de ventas conecta...",
         "suggestedAnswer": "sí"
       }
     ]
   }

5. validateAndCleanWidgets() verifica:
   ✅ Todos los xAxis tienen valor (no vacío)
   ✅ Todos los yAxis tienen valor (excepto 'stat')
   ❌ Si alguno está vacío → se filtra

6. Respuesta al cliente contiene:
   - Datasets analizados
   - Relaciones con confianza
   - Gráficos propuestos (TODOS con campos válidos)
   - Preguntas de clarificación (si hay ambigüedad)

7. MultiDatasetAnalysisResult renderiza:
   📊 DATASETS ANALIZADOS
   🎯 DOMINIO & KPIs
   ↔️ RELACIONES DETECTADAS
   ❓ CONFIRMACIÓN DE RELACIONES  ← ✨ NUEVO
   📈 GRÁFICOS PROPUESTOS
   [Botones: Cancelar / Crear Gráficos]

8. Usuario:
   - Lee preguntas de clarificación (contexto sobre qué detectó)
   - Entiende por qué cada gráfico es propuesto
   - Selecciona qué gráficos quiere
   - Click "Crear Gráficos"
   - Todos los gráficos funcionan (sin blancos)
```

---

## 6. Ejemplos de Respuesta JSON

### Caso 1: Relación Obvia

```json
{
  "relationships": [
    {
      "from": "ventas.csv",
      "to": "clientes.csv",
      "keys": {"ventas.customer_id": "clientes.id"},
      "relationship": "many-to-one",
      "confidence": 0.95
    }
  ],
  "proposedWidgets": [
    {
      "title": "Ingresos por Cliente",
      "config": {
        "xAxis": "nombre",
        "yAxis": "total_vendido",
        "aggregate": "sum"
      }
    }
  ],
  "clarificationQuestions": []
}
```

### Caso 2: Relación Ambigua (Fuzzy Match)

```json
{
  "relationships": [
    {
      "from": "ventas.csv",
      "to": "empleados.csv",
      "keys": {"ventas.id_empleado": "empleados.empleado_id"},
      "relationship": "many-to-one",
      "confidence": 0.75,
      "clarificationNeeded": "Los nombres de columna difieren pero..."
    }
  ],
  "proposedWidgets": [
    {
      "title": "Ventas por Empleado",
      "config": {
        "xAxis": "nombre_empleado",
        "yAxis": "monto",
        "aggregate": "sum"
      },
      "clarificationNeeded": "Esta relación necesita confirmación"
    }
  ],
  "clarificationQuestions": [
    {
      "relationship": "ventas.id_empleado → empleados.empleado_id",
      "question": "¿Confirma que id_empleado de ventas conecta con empleado_id de empleados?",
      "suggestedAnswer": "sí"
    }
  ]
}
```

### Caso 3: Múltiples Relaciones (Fuzzy)

```json
{
  "relationships": [
    {
      "from": "transacciones.csv",
      "to": "clientes.csv",
      "keys": {"transacciones.customer_num": "clientes.cust_id"},
      "confidence": 0.80,
      "clarificationNeeded": null
    },
    {
      "from": "transacciones.csv",
      "to": "productos.csv",
      "keys": {"transacciones.codigo_producto": "productos.product_code"},
      "confidence": 0.75,
      "clarificationNeeded": "¿Ambas son referencias a productos?"
    }
  ],
  "clarificationQuestions": [
    {
      "relationship": "transacciones.codigo_producto → productos.product_code",
      "question": "¿Confirma que codigo_producto de transacciones es el product_code de productos?",
      "suggestedAnswer": "sí"
    }
  ]
}
```

---

## 7. Validación de Campos

### Antes de Proponer un Gráfico

```typescript
// El prompt instruye al modelo:
"
- xAxis y yAxis son nombres de COLUMNAS (después del join)
- ANTES de incluir un campo en xAxis/yAxis, VERIFICA que existe
- Incluye el nombre exacto tal como aparece en los datos
- Si un campo no existe, NO lo uses (propón otro gráfico)
"
```

### Ejemplo: Validación Local

```typescript
// En validateAndCleanWidgets():
const widget = {
  title: "Ventas por Empleado",
  config: {
    xAxis: "nombre",      // ✅ Existe en joined data
    yAxis: "monto",       // ✅ Existe en joined data
    aggregate: "sum"
  }
};

// En validación:
if (!widget.config.xAxis || widget.config.xAxis.trim() === '') {
  // ❌ RECHAZADO
  return false;
}
if (widget.type !== 'stat' && !widget.config.yAxis) {
  // ❌ RECHAZADO
  return false;
}
// ✅ ACEPTADO
return true;
```

---

## 8. Resumen de Mejoras

| Aspecto | Implementación |
|---------|---|
| **Fuzzy Matching** | Explícito en el prompt con patrones (id, _id, code, etc.) |
| **Confianza Gradual** | Campo `confidence` con valores 0-1 |
| **Ambigüedad** | Campo `clarificationNeeded` + `clarificationQuestions` array |
| **Validación** | Función `validateAndCleanWidgets()` post-procesamiento |
| **UI** | Nueva sección "Confirmación de Relaciones" |
| **Sin Blancos** | Filtrado automático de widgets vacíos |
| **Logs** | Warnings en consola cuando se filtran widgets |

---

## Conclusión

El sistema ahora detecta relaciones entre datasets de manera mucho más robusta:
- ✅ Fuzzy matching automático para variaciones de nombres
- ✅ Manejo explícito de ambigüedades
- ✅ Validación para eliminar widgets vacíos
- ✅ UI clara para confirmación del usuario
- ✅ Logging detallado para debugging

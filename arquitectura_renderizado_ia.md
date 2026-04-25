# Arquitectura de Análisis y Renderizado IA - Dashlify

Este documento detalla el "Pipeline" completo de datos de Dashlify para que Claude pueda proponer mejoras en la lógica de negocio y estética visual.

## 1. Stack Tecnológico de Visualización
- **Framework:** Next.js 16 (App Router + Turbopack).
- **Librería de Gráficas:** Chart.js (v4) con `react-chartjs-2`.
- **Estilos:** Tailwind CSS v4 + Variables CSS nativas para el "ADN Visual" (Glassmorphism).
- **Motor de IA:** OpenAI (GPT-4o) para el análisis de datasets.

## 2. El Prompt de Análisis (Source of Truth)
Ubicación: `src/app/api/analyze/route.ts`

```typescript
const prompt = `
  Analiza estas columnas: ${headers}. 
  Dataset (muestra): ${sampleData}.

  TU OBJETIVO: Diseñar un Dashboard "Doctorado" para un CEO. 
  REGLAS DE ORO PARA EL TÍTULO:
  - Dinero: Incluye "$", "Venta", "Costo" o "Precio".
  - Tiempo: Incluye "Tiempo", "Días" o "Entrega".
  - Porcentaje: Incluye "%" o "Margen".
  - Volumen: Incluye "Cantidad" o "Unidades".

  ESTRUCTURA JSON:
  {
    "narrative": "Resumen ejecutivo potente",
    "proposedWidgets": [
      {
        "title": "Título descriptivo",
        "type": "bar | line | pie | kpi",
        "config": { "xAxis": "columna", "yAxis": "columna", "aggregate": "sum|avg" }
      }
    ]
  }
`;
```

## 3. El Motor de Agregación (The Brain)
Ubicación: `src/components/SortableWidget.tsx` -> Funciones `toChartData` y `toGrouped`.

**Lógica actual:**
- **Reducción de Ruido:** Si hay > 25 puntos en una línea, se promedian en "chunks" para evitar el efecto serrucho.
- **Top 10 + Otros:** Para barras y donas, el sistema ordena por valor, toma los 10 más altos y agrupa el resto en una categoría "Otros".
- **Fuzzy Matching:** Si la IA pide la columna "Ventas", el motor busca coincidencias como "Total_Ventas", "venta", etc.

## 4. El Motor de Renderizado (The Canvas)
Ubicación: `src/components/ChartEngine.tsx`

**Capacidades Actuales:**
- **Detección de Unidades:** Analiza el título de la gráfica mediante Regex/Keywords para decidir si muestra `$`, `%`, o `días`.
- **Estética Glow:** Aplica gradientes lineales de SVG y `shadowBlur` en las líneas para un look premium.
- **Suavizado:** Usa `tension: 0.45` en todas las gráficas de línea para curvas fluidas.

## 5. Limitaciones para Mejora (Oportunidades para Claude)
1. **Lógica de Correlación:** La IA actualmente propone gráficas aisladas. No busca correlaciones profundas (ej: "¿Cómo afecta el descuento al tiempo de entrega?").
2. **Interactividad:** Las gráficas son estáticas. Claude podría sugerir cómo implementar "Drill-down" o filtros cruzados.
3. **Refinamiento Estético:** Aunque tenemos gradientes, falta ese toque de "Data Art" (partículas, texturas, animaciones de entrada coordinadas).
4. **Agregaciones Complejas:** El motor actual solo hace SUM y AVG básicos. Falta lógica para "Crecimiento MoM", "Mediana" o "Outliers".

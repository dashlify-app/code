# Contexto Técnico: Dashlify Analytics Engine (Premium vs Primaria)

Este documento detalla la arquitectura actual, los bloqueos y la brecha visual entre el **dashboard estático (Doctorado)** y la **implementación dinámica (Primaria)** para su resolución.

## 1. El Objetivo (Benchmark)
Se busca igualdad 1:1 con el archivo `/legacy/dashlify-admin.html`. 
- **Estética:** Glassmorphism, gradientes de alto contraste, tipografía `Syne` (negrita/negra) y `DM Mono`.
- **Gráficas:** Look "artístico" con curvas suaves, rellenos con glow y ejes minimalistas.

## 2. Los Archivos "Culpables" (Foco de Trabajo)

### A. `src/components/SortableWidget.tsx`
Es el motor de renderizado de las gráficas. 
- **Limitación:** Actualmente usa la librería `Recharts`. Es funcional pero "rígida". 
- **Problema:** Los estilos inyectados para gradientes y bordes redondeados a veces rompen la sintaxis de React o no se ven tan fluidos como en el estático (que usa `Chart.js`).
- **Contexto de Datos:** Aquí reside la lógica `toChartData` y `toGrouped` que intenta limpiar los datos dinámicos. Si falla, la gráfica se ve vacía.

### B. `src/app/globals.css`
Es el corazón de los estilos globales.
- **Limitación:** El proyecto usa **Tailwind v4**.
- **Problema:** Al intentar inyectar el CSS puro del estático, el build de Vercel falla con errores de `unknown utility class` o problemas con `@apply`. 
- **ADN Visual:** Se han definido variables `:root` con la paleta pro, pero Tailwind v4 bloquea la sobrescritura masiva de componentes base.

### C. `src/components/DataCopilot.tsx` & `src/app/api/analyze/route.ts`
Controlan qué gráficas propone la IA.
- **Problema:** La IA propone nombres de ejes que a veces no coinciden exactamente con el dataset dinámico cargado, lo que genera gráficas sin datos si el "fuzzy match" falla.

## 3. Intentos Fallidos y Bloqueos
1. **Migración de Estilos:** Se intentó sobrescribir `globals.css` con el CSS del estático, pero rompió los componentes de Shadcn/Tailwind.
2. **Gradientes en Recharts:** Se implementaron `<linearGradient>` en SVG, pero el look sigue sintiéndose "genérico" comparado con el estático.
3. **Build de Vercel:** Los cambios más agresivos en CSS están provocando fallos en la etapa de `Turbopack build`.

## 4. Requerimiento para la Solución
Necesitamos un método para:
1. Inyectar el diseño premium sin romper la compatibilidad con Tailwind v4.
2. Hacer que las gráficas dinámicas de Dashlify hereden el look artístico (glow, curvas, tipografía) de `Chart.js` pero usando `Recharts` (o migrando el widget a Chart.js).
3. Asegurar que los datos reales fluyan siempre al widget sin depender de placeholders.

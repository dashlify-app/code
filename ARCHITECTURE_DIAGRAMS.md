# Diagramas de Arquitectura: Detección de Relaciones Mejorada

## 1. Flujo General del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│ USUARIO: Carga múltiples archivos CSV/Excel                    │
└────────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ DashboardCanvas detecta:          │
         │ - Archivos cargados              │
         │ - Columnas disponibles           │
         │ - Datos de muestra               │
         └────────────────┬──────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ Usuario hace clic:                 │
        │ "Generar Dashboard con IA"         │
        └────────────────┬───────────────────┘
                         │
                         ▼
    ┌──────────────────────────────────────────┐
    │ POST /api/analyze-multi                  │
    │ Body: { datasets: [...] }                │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ buildAnalysisPrompt()                                  │
│ ✨ MEJORADO: Fuzzy matching + clarifications         │
│ - Variaciones de ID (id, _id, ID, numero, code)      │
│ - Campos contextuales (customer_*, product_*)        │
│ - Patrones de valor similares                         │
│ - Manejo de ambigüedad                               │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
      ┌───────────────────────────┐
      │ OpenAI GPT-4o             │
      │ Genera JSON con:          │
      │ - relationships[]         │
      │ - proposedWidgets[]       │
      │ - clarificationQuestions[]│
      └────────────┬──────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ validateAndCleanWidgets()                   │
│ ✨ NUEVO: Valida campos                    │
│ - ❌ xAxis vacío? → FILTRA                 │
│ - ❌ yAxis vacío? → FILTRA                 │
│ - ✅ Todo válido? → MANTIENE               │
└────────────────┬────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │ MultiDatasetAnalysis limpio y válido   │
    │ - relationships (con confidence)       │
    │ - proposedWidgets (NUNCA vacíos)       │
    │ - clarificationQuestions (si aplica)   │
    └────────────────┬───────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ MultiDatasetAnalysisResult                          │
│ ✨ MEJORADA: UI clara y profesional                 │
│                                                     │
│ 📊 DATASETS ANALIZADOS                             │
│ [Dataset info]                                      │
│                                                     │
│ 🎯 DOMINIO & KPIs                                  │
│ [Domain and KPIs]                                   │
│                                                     │
│ ↔️ RELACIONES DETECTADAS                           │
│ [Relationship diagram]                              │
│                                                     │
│ ❓ CONFIRMACIÓN DE RELACIONES      ← ✨ NUEVO     │
│ ┌────────────────────────────────────┐            │
│ │ ¿Confirma que id_empleado de      │            │
│ │ ventas conecta con empleado_id    │            │
│ │ de empleados?                      │            │
│ │ Relación: ventas.id_empleado →     │            │
│ │           empleados.empleado_id   │            │
│ │ Sugerencia: sí                     │            │
│ └────────────────────────────────────┘            │
│                                                     │
│ 📈 GRÁFICOS PROPUESTOS                             │
│ [Widget list grouped by category]                   │
│                                                     │
│ [Cancelar] [Crear X Gráficos]                       │
└──────────────────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ Usuario selecciona        │
         │ gráficos a crear          │
         │ (TODOS con datos válidos) │
         └──────────────┬────────────┘
                        │
                        ▼
           ┌────────────────────────────┐
           │ Dashboard creado           │
           │ ✨ SIN WIDGETS EN BLANCO  │
           │ ✨ TODOS CON DATOS        │
           └────────────────────────────┘
```

---

## 2. Detección de Relaciones: Antes vs Después

### ANTES (Limitado)
```
┌──────────────────┐
│ Dataset A:       │
│ - id_empleado    │
│ - monto          │
└──────────────────┘
        │
        ▼
  ¿Encuentra relación?
        │
        ├─ Busca: "id_empleado" exacto
        │         en Dataset B
        │         ❌ No encontrado
        │
        └─ Resultado: ❌ NO HAY RELACIÓN
                      └─ Widget vacío

┌──────────────────┐
│ Dataset B:       │
│ - empleado_id    │
│ - nombre         │
└──────────────────┘
```

### DESPUÉS (Mejorado - Fuzzy Matching)
```
┌──────────────────┐
│ Dataset A:       │
│ - id_empleado    │
│ - monto          │
└──────────────────┘
        │
        ▼
  ¿Encuentra relación?
        │
        ├─ Paso 1: Busca exacto: "id_empleado"
        │          ❌ No encontrado
        │
        ├─ Paso 2: Fuzzy matching activa
        │          ├─ Patrón: id_X ↔ X_id
        │          ├─ Busca: "empleado_id"
        │          ✅ ENCONTRADO
        │
        ├─ Paso 3: Valida valores
        │          ├─ Tipos: ambos numéricos
        │          ├─ Rango: similar
        │          ✅ COMPATIBLE
        │
        ├─ Paso 4: Calcula confianza
        │          ├─ Nombres similares: +50%
        │          ├─ Tipos compatibles: +30%
        │          ├─ Patrones coinciden: +5%
        │          └─ Total: 0.85 confianza
        │
        └─ Resultado: ✅ RELACIÓN DETECTADA
                      confidence: 0.85
                      Widget válido creado

┌──────────────────┐
│ Dataset B:       │
│ - empleado_id    │
│ - nombre         │
└──────────────────┘
```

---

## Conclusión Visual

**Antes**: 
```
Entrada → IA → Salida (puede haber blancos) → Usuario confundido 😞
```

**Después**:
```
Entrada → IA Mejorada → Validación → Clarificación → Salida (sin blancos)
                                                     → Usuario satisfecho 😊
```

El flujo es ahora **robusto, transparente y confiable**.

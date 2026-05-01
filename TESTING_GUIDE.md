# Guía de Testing: Detección de Relaciones Mejorada

## Cómo Probar las Mejoras

### Escenario 1: Fuzzy Matching Automático

**Objetivo**: Verificar que el sistema detecta relaciones con nombres ligeramente diferentes.

**Datos de Prueba**:
```csv
// ventas.csv
id_venta,id_empleado,monto,fecha
1,101,1000,2024-01-01
2,102,1500,2024-01-02

// empleados.csv
empleado_id,nombre,departamento
101,Juan,Ventas
102,María,Ventas
```

**Pasos**:
1. Carga ambos archivos en "Generar Dashboard con IA"
2. Sistema detecta: `id_empleado` ↔ `empleado_id`
3. Propone gráfico "Ventas por Empleado"

**Verificación** ✅:
- [ ] Gráfico es propuesto
- [ ] xAxis = "nombre"
- [ ] yAxis = "monto"
- [ ] Confidence ≥ 0.75
- [ ] Sin campos vacíos

---

### Escenario 2: Múltiples Variaciones de ID

**Objetivo**: Sistema detecta múltiples variaciones (id, _id, ID, numero).

**Datos de Prueba**:
```csv
// transacciones.csv
transaction_id,customer_num,amount
1,1001,100
2,1002,200

// customers.csv
cust_id,customer_name,city
1001,Alice,NYC
1002,Bob,LA
```

**Pasos**:
1. Carga ambos archivos
2. Sistema debería detectar: `customer_num` ↔ `cust_id`

**Verificación** ✅:
- [ ] Relación detectada (confidence 0.75+)
- [ ] Aparece en "Confirmación de Relaciones"
- [ ] Widget propuesto funciona

---

### Escenario 3: Campos Contextuales

**Objetivo**: Sistema entiende contexto (customer_*, product_*, etc).

**Datos de Prueba**:
```csv
// orders.csv
order_id,customer_id,product_id,quantity
1,100,A1,2
2,101,B1,1

// customers.csv
id,name,email
100,Alice,alice@example.com
101,Bob,bob@example.com

// products.csv
product_code,product_name,price
A1,Laptop,1000
B1,Mouse,50
```

**Pasos**:
1. Carga 3 archivos
2. Sistema debería detectar ambas relaciones

**Verificación** ✅:
- [ ] customer_id → customers.id detectado
- [ ] product_id → products.product_code detectado
- [ ] Múltiples gráficos propuestos (ej: "Pedidos por Cliente", "Ingresos por Producto")
- [ ] Todos con xAxis y yAxis válidos

---

### Escenario 4: Ambigüedad (Requiere Confirmación)

**Objetivo**: Sistema detecta relación probable pero ambigua, pide confirmación.

**Datos de Prueba**:
```csv
// sales.csv
codigo,cantidad,fecha
1001,50,2024-01-01
1002,30,2024-01-02

// inventory.csv
codigo,stock,warehouse
1001,200,A
1002,150,B
```

**Pasos**:
1. Carga ambos archivos
2. Sistema detecta: `codigo` ↔ `codigo` con confianza alta (0.90+)
3. Propone gráfico "Cantidad vs Stock"

**Verificación** ✅:
- [ ] Relación detectada
- [ ] Confidence > 0.75
- [ ] Gráfico propuesto
- [ ] Sin preguntas innecesarias (confianza muy alta)

---

### Escenario 5: Sin Relaciones Obvias

**Objetivo**: Sistema NO fuerza relaciones que no existen.

**Datos de Prueba**:
```csv
// weather.csv
date,temperature,humidity

// stock_prices.csv
date,stock_price,volume
```

**Pasos**:
1. Carga ambos archivos
2. Sistema NO debería proponer joins (mismo `date` pero contextos diferentes)
3. Propone gráficos individuales

**Verificación** ✅:
- [ ] NO hay relación propuesta (o muy baja confianza < 0.5)
- [ ] Gráficos propuestos son independientes

---

### Escenario 6: Validación de Campos Vacíos

**Objetivo**: Verificar que widgets con campos vacíos son filtrados.

**Pasos**:
1. En modo DEBUG, simular respuesta de OpenAI con campo xAxis vacío
2. Verificar que `validateAndCleanWidgets()` lo filtra
3. Ver warning en consola

**Verificación** ✅:
- [ ] Console muestra: "Widget 'X' tiene xAxis vacío - será filtrado"
- [ ] Widget NO aparece en la UI
- [ ] Respuesta contiene solo widgets válidos

---

### Escenario 7: UI de Clarificación

**Objetivo**: Verificar que la sección "Confirmación de Relaciones" se muestra correctamente.

**Pasos**:
1. Carga archivos con relación de confianza media (0.5-0.8)
2. Sistema debería mostrar sección ❓ Confirmación de Relaciones
3. Verifica contenido

**Verificación** ✅:
- [ ] Sección "❓ Confirmación de Relaciones" visible
- [ ] Pregunta clara: "¿Confirma que X conecta con Y?"
- [ ] Relación mostrada: "dataset.campo → dataset.campo"
- [ ] Sugerencia: "sí" o "no"

---

## Logs para Verificar

### Consola del Servidor

```bash
# Información normal
[DEBUG] Relación detectada: ventas.id_empleado → empleados.empleado_id (confidence: 0.85)

# Widgets filtrados (indica mejora funcionando)
[WARN] Widget "Ventas por Empleado" tiene xAxis vacío - será filtrado
[WARN] Se filtraron 1 widgets con campos vacíos

# Ambigüedades detectadas
[INFO] Pregunta de clarificación: ¿codigo_producto = product_code?
```

### Respuesta JSON

Buscar estos campos en la respuesta:

```json
{
  "relationships": [
    {
      "confidence": 0.75,                    // < 0.8 = ambiguo
      "clarificationNeeded": "¿Confirma...?" // Indica pregunta pendiente
    }
  ],
  
  "proposedWidgets": [
    {
      "config": {
        "xAxis": "campo_valido",   // ✅ Nunca vacío
        "yAxis": "campo_valido"    // ✅ Nunca vacío (excepto 'stat')
      },
      "clarificationNeeded": "..."  // Si hay ambigüedad
    }
  ],
  
  "clarificationQuestions": [          // ✨ Array nuevo
    {
      "question": "¿Confirma que...?",
      "relationship": "a.field → b.field",
      "suggestedAnswer": "sí"
    }
  ]
}
```

---

## Checklist de Verificación

### ✅ Detección de Relaciones
- [ ] Nombres exactos detectados (confidence 0.95+)
- [ ] Fuzzy matches detectados (confidence 0.75+)
- [ ] Patrones id/ID/_id/numero detectados
- [ ] Contexto customer/product/employee entendido
- [ ] Relaciones sin evidencia NO forzadas

### ✅ Manejo de Ambigüedad
- [ ] Relaciones probables pero ambiguas incluidas
- [ ] Confidence < 0.8 para ambigüas
- [ ] clarificationNeeded agregado cuando necesario
- [ ] UI muestra preguntas de forma clara

### ✅ Validación de Widgets
- [ ] Nunca hay xAxis vacío
- [ ] Nunca hay yAxis vacío (excepto 'stat')
- [ ] Widgets vacíos son filtrados
- [ ] Logs muestran cuál fue filtrado

### ✅ Experiencia de Usuario
- [ ] Sección "Confirmación de Relaciones" visible
- [ ] Preguntas son comprensibles
- [ ] Sugerencias tienen sentido
- [ ] Información ayuda a tomar decisión

### ✅ Rendimiento
- [ ] Análisis completa en < 10 segundos
- [ ] Sin timeouts
- [ ] Respuesta JSON es válida
- [ ] Sin errores en consola (excepto WARN de filtrado)

---

## Debugging

### Si ves Widget Vacío (BUG)

1. Verifica consola del servidor:
   ```bash
   # Debería haber un WARN
   [WARN] Widget "X" tiene xAxis vacío - será filtrado
   ```

2. Si NO hay WARN → La validación no se ejecutó
   - Verifica que `validateAndCleanWidgets()` está siendo llamada
   - Verifica que está después de `JSON.parse()`

3. Si el widget sigue en la UI → La validación no funcionó
   - Revisa el JSON de respuesta
   - Busca xAxis/yAxis vacíos
   - Confirma que el campo fue eliminado

### Si ves Relación Correcta sin Pregunta

**Esperado si**:
- Confidence > 0.80
- Nombres coinciden exactamente o fuzzy match claro

**No esperado si**:
- Confidence < 0.80 o ambigüedad evident
- → Verifica que `clarificationQuestions` está en JSON

### Si ves Relación que No Debería Estar

1. Verifica confidence en respuesta JSON
2. Si < 0.5 → No debería incluirse
3. Revisa el prompt para ver si IA está siendo demasiado agresiva
4. Ajusta las instrucciones de confianza mínima

---

## Casos de Uso Reales

### Test 1: E-commerce Básico

```csv
// orders.csv
order_id, customer_id, total
1, 100, 500
2, 101, 750

// customers.csv
id, name, country
100, Alice, USA
101, Bob, MX
```

**Esperado**:
- Relación: customer_id ↔ id (confidence 0.95)
- Widget: "Ingresos por Cliente"
- Sin preguntas (muy obvio)

---

### Test 2: RRHH con Variaciones

```csv
// salary.csv
emp_id, salary, department
101, 50000, Sales
102, 60000, Marketing

// employees.csv
employee_id, emp_name, hire_date
101, John, 2020-01-15
102, Jane, 2021-06-20

// departments.csv
dept_code, dept_name, manager
S, Sales, Carol
M, Marketing, David
```

**Esperado**:
- Relación 1: emp_id ↔ employee_id (fuzzy, confidence ~0.80)
- Relación 2: department ↔ dept_code (context-based, confidence ~0.75)
- Widgets: "Salario por Empleado", "Salario por Departamento"
- Preguntas: Confirmación de ambas relaciones fuzzy

---

### Test 3: Retail Multi-Dataset

```csv
// sales.csv
sale_id, product_code, store_id, amount

// products.csv
product_id, product_code, category, price

// stores.csv
store_code, location, country
```

**Esperado**:
- Relación 1: product_code ↔ product_code (obvia)
- Relación 2: store_id ↔ store_code (fuzzy)
- Widgets: "Ventas por Producto", "Ventas por Tienda", "Categorías top"
- UI clara mostrando relaciones y preguntas

---

## Performance Targets

| Métrica | Target | Verificar |
|---------|--------|-----------|
| Tiempo de análisis | < 10s | Timer en Network tab |
| Widgets sin blancos | 100% | Inspeccionar JSON response |
| Relaciones detectadas | > 90% | Comparar con expected |
| Confianza promedio | > 0.80 | Revisar JSON |
| Preguntas claras | 100% | Leer UI |

---

## Reportar Resultados

### Template para Reporte

```markdown
## Test Results: [Fecha]

### Escenario: [Nombre]
- **Archivos**: [Listar]
- **Relaciones Esperadas**: [Listar]
- **Relaciones Detectadas**: [Listar]
- **Widgets Propuestos**: [Número]
- **Preguntas de Clarificación**: [Número]

### Resultados
- ✅ [Aspecto OK]
- ✅ [Aspecto OK]
- ❌ [Aspecto Fallido] → [Causa probable]

### Logs Relevantes
```
[Console output]
```

### Conclusión
[Resumen: ¿Funcionó bien? ¿Qué falló?]
```

---

## Conclusión

La suite de testing cubre:
- ✅ Detección automática de relaciones
- ✅ Fuzzy matching en múltiples variantes
- ✅ Manejo de ambigüedad
- ✅ Validación de campos
- ✅ Experiencia de usuario
- ✅ Performance

Ejecuta al menos los Escenarios 1-5 para validar la funcionalidad core.

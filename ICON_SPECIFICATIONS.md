# 📋 Especificaciones de Iconos para Dashlify

## Contexto del Proyecto
**Dashlify** es una plataforma de análisis de datos e inteligencia empresarial (BI) que permite a los usuarios:
- Crear dashboards automáticamente con IA
- Importar datos desde **archivos** (Excel, CSV, XLSX)
- Importar datos desde **Google Sheets** (en tiempo real)
- Personalizar gráficas y visualizaciones

Los iconos son para **diferenciar visualmente** de qué fuente provienen los datos de cada dashboard.

---

## 🎯 Icono #1: ARCHIVO (Datos de Upload Local)

### Propósito
Identificar dashboards creados **desde archivos locales** (Excel, CSV, XLSX subidos por el usuario).

### Especificaciones de Diseño

**Color primario:** Azul profesional
- Código: #1F2937 (azul oscuro) O #2563EB (azul brillante)
- Alternativa: Azul similar a archivos de Microsoft Office

**Elementos visuales:**
- Documento/archivo cerrado
- Formato: rectangular con esquinas redondeadas (muy ligeramente)
- Incluir **pliegue/fold en la esquina superior derecha** (como archivos doblados)
- Mostrar **líneas horizontales dentro** (representando datos/contenido)
- Mínimo 5 líneas para representar "datos"
- Las líneas deben tener **espesor variable** (la primera más gruesa = encabezado)

**Tamaño:** 24x24px base, escalable hasta 64x64px
**Estilo:** Minimalista pero reconocible
**Contexto de uso:**
- Sidebar de dashboards (20x20px)
- Header de canvas (24x24px)
- Lista de dashboards (16x16px)

**Inspiración visual:** Similar a los iconos de Microsoft Excel pero más genérico

---

## 📊 Icono #2: GOOGLE SHEETS (Datos en Tiempo Real)

### Propósito
Identificar dashboards creados **desde Google Sheets** (datos sincronizados en tiempo real desde Google).

### Especificaciones de Diseño

**Color primario:** Verde Google Sheets
- Código oficial: #34A853 (verde oficial de Google Sheets)
- Este es el color más importante para reconocimiento instant

**Elementos visuales:**
- **Hoja de cálculo/Spreadsheet** abierta/visible
- Formato: rectangular
- Mostrar **grid de celdas** (mínimo 3x3 o 4x4)
- Incluir **líneas de división** entre celdas (grid lines)
- Algunas celdas deben tener **datos representados:**
  - Números pequeños o símbolos
  - Colores sutiles en algunas celdas
  - Dar sensación de "datos reales"
- El grid debe ser **visible y claro**, no minimalista

**Tamaño:** 24x24px base, escalable hasta 64x64px
**Estilo:** Detallado pero limpio - el usuario debe entender "esto es una hoja de cálculo"
**Contexto de uso:**
- Sidebar de dashboards (20x20px)
- Header de canvas (24x24px)
- Lista de dashboards (16x16px)
- Análisis de Google Sheets (32-40px)

**Inspiración visual:** El icono oficial de Google Sheets (verde con grid) pero adaptado

---

## 🎨 Especificaciones Comunes

### Paleta de colores
| Elemento | Color | Código |
|----------|-------|--------|
| Archivo (principal) | Azul profesional | #1F2937 o #2563EB |
| Sheets (principal) | Verde Google | #34A853 |
| Fondo (opcional) | Blanco | #FFFFFF |
| Sombra (opcional) | Gris suave | #E5E7EB |

### Características de calidad
- ✅ Debe verse bien a 16x16px (muy pequeño)
- ✅ Debe verse bien a 64x64px (grande)
- ✅ Trazo: consistente, entre 1.5-2px
- ✅ Sin gradientes complejos (deben imprimirse bien)
- ✅ Fondo: transparente (PNG) o removible
- ✅ Formato: SVG escalable

### Contexto visual (cómo se verán en la UI)

```
SIDEBAR:
┌─────────────────────────┐
│ // MIS DASHBOARDS       │
├─────────────────────────┤
│ [📄] Nuevo Dashboard    │  <- Icono archivo azul
│      03-mayo            │
│                         │
│ [📊] Dashboard Sheets   │  <- Icono sheets verde
│      29-abril           │
└─────────────────────────┘

HEADER DEL DASHBOARD:
┌──────────────────────────────────────────┐
│ [🟦] Nuevo Dashboard                     │  <- Icono más grande, visible
│      Arrastra para reorganizar...        │
└──────────────────────────────────────────┘
```

---

## 📐 Tamaños Finales Requeridos

Entregar en **3 tamaños**:
1. **Pequeño:** 16x16px (sidebar)
2. **Medio:** 24x24px (headers)
3. **Grande:** 64x64px (análisis de datos)

O mejor aún: **SVG escalable** que se adapte automáticamente

---

## 📦 Entregables

Por favor, proporcionar:
- [ ] `dashboard-file.svg` - Icono de archivo (azul)
- [ ] `dashboard-sheets.svg` - Icono de Google Sheets (verde)
- [ ] Preview PNG de ambos (16x16, 24x24, 64x64)
- [ ] Versión en diferentes colores si es necesario
- [ ] Fuente editadle (Figma, Illustrator o similar)

---

## ✨ Notas Finales

- **Diferenciación clara:** Deben ser **inmediatamente diferenciables** uno del otro
- **Reconocimiento instant:** El usuario debe entender qué representa cada uno de un vistazo
- **Profesionalismo:** Deben verse como iconos de una app premium
- **Accesibilidad:** Colores suficientemente contrastados para usuarios daltónicos

---

## 🔗 Referencias visuales

- Google Sheets icon: Buscar en Google's Material Design
- Excel icon: Microsoft Office icons
- Inspiration: Apps como Notion, Airtable, Zapier (cómo diferencian tipos de fuentes)

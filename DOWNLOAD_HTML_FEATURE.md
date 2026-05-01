# Descargar HTML — Feature Guide

## ¿Qué es la descarga HTML?

El botón "Descargar HTML" en la modal de compartir genera un archivo HTML standalone que:
- ✅ Captura exactamente los datos y distribución de tu dashboard actual
- ✅ Funciona sin conexión a internet
- ✅ Incluye todas las funcionalidades interactivas
- ✅ Es seguro (token obfuscado, datos embebidos)

---

## Cómo usar

### 1. **Abre tu dashboard**
```
Dashboard Canvas → Widgets con datos visibles
```

### 2. **Haz clic en "Compartir"**
```
Botón "Compartir" (arriba derecha)
```

### 3. **Configura la descarga**
```
- Etiqueta (opcional): nombre descriptivo (ej: "Cliente A · Q1 2026")
- Caducidad: nunca, 7, 30, 90, o 365 días
- Haz clic en "Descargar HTML"
```

### 4. **Abre el HTML descargado**
```
- Doble clic en el archivo .html
- Se abre en tu navegador
- Misma vista que tu dashboard actual
```

---

## Funcionalidades Interactivas

### 🔄 Voltear Cards (Flip)
```
Clic en botón ℹ️ (info) en la esquina superior derecha de cada card
  → La card gira 180°
  → Muestra: cantidad de datos, ejes X/Y, tipo de agregación
Clic en ✕ (cerrar)
  → La card vuelve a su posición original
```

**Características:**
- Animación suave 3D (0.6 segundos)
- Hardware accelerated (GPU)
- Funciona en todos los navegadores modernos

### 📊 Cambiar Tamaño
```
Botones bajo el título de cada widget:
  - 1/3: Ancho normal (1 columna de 3)
  - 2/3: Dos columnas de ancho
  - Full: Ancho completo (todas las 3 columnas)
```

**Características:**
- Cambio inmediato de tamaño
- La distribución se ajusta automáticamente
- Otros widgets fluyen alrededor

### 🎯 Arrastrar y Reordenar
```
Haz clic y arrastra cualquier widget
  → Cursor cambia a "mano"
  → El widget se vuelve semitransparente (50% opacidad)
  → Coloca sobre otro widget para intercambiar posición
  → Suelta para soltar en la nueva posición
```

**Características:**
- Retroalimentación visual clara
- DOM reordering en tiempo real
- Funciona con widgets de cualquier tamaño

### 📱 Diseño Responsivo
```
Desktop (> 1200px): 3 columnas de widgets
Tablet (768px - 1200px): 2 columnas
Mobile (< 768px): 1 columna
```

---

## Tokens y Seguridad

### ¿Qué es un token de embebido?
Cada descarga crea un token único que:
- Valida que el usuario tiene acceso al dashboard
- Puede caducar después de cierto tiempo
- Puede ser revocado en cualquier momento

### Gestionar tokens
```
Modal Compartir → "Tokens activos"
  - Ver todos los tokens generados
  - Fecha de creación
  - Cantidad de usos
  - Fecha de caducidad
  - Botón para revocar (🗑️)
```

### Revocar un token
```
Haz clic en el botón 🗑️ al lado del token
  → El HTML descargado con ese token dejará de funcionar
  → Confirma la acción en el diálogo
```

---

## Estructura del HTML Descargado

### Contenido embebido
```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Chart.js CDN -->
    <!-- CSS para grid, flip cards, drag-and-drop -->
  </head>
  <body>
    <header><!-- Título, estado, botón conectar --></header>
    <div class="dlf-grid"><!-- Grid responsivo con widgets --></div>
    <script>
      _DLF.snapshotData = { /* todos tus datos */ };
      dlf_init(); // Inicializa widgets con datos
    </script>
  </body>
</html>
```

### Tamaño del archivo
- Dashboard pequeño (3-5 widgets): 15-20 KB
- Dashboard medio (10-15 widgets): 30-50 KB
- Dashboard grande (20+ widgets): 50-100 KB

---

## Modo Conectado (Opcional)

El HTML descargado incluye un botón "Conectar" que permite:

### Conectar a servidor en vivo
```
Clic en "Conectar" (arriba derecha)
  → Ingresa la URL del servidor (ej: https://dashlify.app)
  → Haz clic en "Conectar"
  → El HTML se sincroniza con los datos en vivo
  → Auto-actualiza cada 60 segundos
```

### Ver estado
```
SNAPSHOT: Mostrando datos descargados (offline)
LIVE: Conectado a servidor (online - punto verde pulsante)
```

### Desconectar
```
Si estás en modo LIVE, haz clic en "Desconectar"
  → Vuelve a mostrar los datos descargados
  → Punto se vuelve gris
```

---

## Casos de Uso

### 📧 Compartir con clientes
```
Genera una descarga con etiqueta "Cliente A - Trimestre Q1"
Establece caducidad a 7 días
Envía el HTML por email
El cliente abre en su navegador (sin necesidad de login)
```

### 📊 Presentaciones
```
Descarga el HTML en tu laptop
Abrelo offline en la presentación
Interactúa con los datos en vivo (sin dependencias de red)
```

### 📱 Reportes
```
Descarga HTML semanalmente
Archívalo con fecha (dashboard-2026-04-28.html)
Accede a históricos sin perder datos
```

### 🔐 Auditoría
```
Los tokens registran:
- Cuándo se descargó
- Cuántas veces se accedió
- Cuándo caduca
Puedes revocar cualquier token en cualquier momento
```

---

## Preguntas Frecuentes

### ¿Qué datos se incluyen?
Exactamente los mismos datos que ves en el dashboard en ese momento:
- Todos los widgets
- Sus configuraciones
- Los datos de muestra (sampleData)
- Los tamaños actuales (colSpan)

### ¿Pueden robar mi token?
El token está obfuscado en JavaScript (código protegido).
Si alguien accede al archivo y lo abre offline, ve los datos descargados.
Si intenta usar el token en otro lugar, será validado contra la base de datos.

### ¿Qué pasa si caduca el token?
El HTML descargado seguirá funcionando con los datos que incluye.
El botón "Conectar" no funcionará (no puede sincronizar con servidor).
Puedes descargar nuevamente para obtener un token válido.

### ¿Puedo editar el HTML?
Sí, puedes abrir con un editor de texto y modificar:
- Título del dashboard
- Textos y estilos CSS
- Los datos embebidos (snapshotData)

Pero ten en cuenta:
- JavaScript está obfuscado (difícil de leer/modificar)
- Si cambias el token, no funcionará la conexión en vivo

### ¿Funciona sin internet?
Sí, completamente offline.
La única funcionalidad que requiere conexión es "Conectar" al servidor en vivo.

---

## Características Técnicas

### Chart.js
- Cargado desde CDN de jsDelivr
- Soporta: Bar, Line, Pie, Doughnut, Area, Stat
- Paleta de colores predefinida

### Animaciones
- 3D flip: 0.6 segundos, cubic-bezier(0.4, 0, 0.2, 1)
- Transiciones: 0.3 segundos
- GPU accelerated (transform, opacity)

### Grid Layout
- CSS Grid 3 columnas
- Soporte para colSpan: 1, 2, 3
- auto-flow: dense (empaquetamiento eficiente)
- Responsive: 3 → 2 → 1 columna

### Drag & Drop
- HTML5 Drag & Drop API
- Visual feedback: cursor grab, opacity change
- DOM reordering con insertBefore()

---

## Limitaciones Conocidas

1. **Tamaño máximo de dashboard**: ~1 MB
   - Si excedes esto, necesitarás dividir el dashboard
   - Típicamente soporta 50+ widgets

2. **Datos estáticos**
   - Sin botón "Conectar": datos congelados en el tiempo
   - Con "Conectar": sincroniza cada 60 segundos (configurable)

3. **No sincroniza configuraciones de widgets**
   - Si editas el tamaño en el HTML y luego conectas, vuelve al tamaño original
   - Los cambios de tamaño son solo locales

---

## Soporte

¿Algo no funciona? Verifica:
1. ✓ Navegador moderno (Chrome, Firefox, Safari, Edge)
2. ✓ JavaScript habilitado
3. ✓ Token no revocado (si usas "Conectar")
4. ✓ Token no caducado (si usas "Conectar")

Para reportar problemas, incluye:
- Versión del navegador
- Pantalla de error (si existe)
- Pasos para reproducir
- Archivo HTML descargado (sin datos sensibles)

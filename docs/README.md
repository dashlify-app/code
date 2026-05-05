# Índice de documentación (Dashlify)

Mapa de los archivos `.md` del repositorio para orientar lectura y onboarding.

## Empieza aquí

| Documento | Contenido |
|-----------|-----------|
| [README.md](../README.md) | Visión del producto, variables de entorno, scripts, stack |
| [migrations/README.md](../migrations/README.md) | Cómo aplicar SQL en Supabase y convenciones |
| [TESTING_GUIDE.md](../TESTING_GUIDE.md) | Escenarios y checklist de pruebas |
| [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) | Detección de relaciones mejorada — referencia rápida |

## Arquitectura e implementación técnica

| Documento | Contenido |
|-----------|-----------|
| [TECHNICAL_IMPLEMENTATION.md](../TECHNICAL_IMPLEMENTATION.md) | Flujo `/api/analyze-multi`, prompts, validación |
| [ARCHITECTURE_DIAGRAMS.md](../ARCHITECTURE_DIAGRAMS.md) | Diagramas de arquitectura |
| [arquitectura_renderizado_ia.md](../arquitectura_renderizado_ia.md) | Renderizado e IA |
| [contexto_css_graficas.md](../contexto_css_graficas.md) | CSS y gráficas |
| [BUGFIX_MULTI_DATASET_ANALYSIS.md](../BUGFIX_MULTI_DATASET_ANALYSIS.md) | Bugfix análisis multi-dataset |
| [RELATIONSHIP_DETECTION_IMPROVEMENTS.md](../RELATIONSHIP_DETECTION_IMPROVEMENTS.md) | Mejoras en detección de relaciones |

## Funcionalidades y guías por tema

| Documento | Contenido |
|-----------|-----------|
| [DOWNLOAD_HTML_FEATURE.md](../DOWNLOAD_HTML_FEATURE.md) | Descarga HTML / embed |
| [GOOGLE_SHEETS_FIX.md](../GOOGLE_SHEETS_FIX.md) | Correcciones Google Sheets |
| [UI_UX_IMPROVEMENTS.md](../UI_UX_IMPROVEMENTS.md) | Mejoras UI/UX |
| [DIAGNOSTIC_REPORT.md](../DIAGNOSTIC_REPORT.md) | Informe diagnóstico |
| [FIX_AILOG_TABLE.md](../FIX_AILOG_TABLE.md) | Esquema y políticas tabla `AILog` |

## Resúmenes de cambios / hitos

| Documento | Contenido |
|-----------|-----------|
| [CHANGES_SUMMARY.md](../CHANGES_SUMMARY.md) | Resumen de cambios |
| [IMPLEMENTATION_COMPLETE.md](../IMPLEMENTATION_COMPLETE.md) | Cierre de implementación |
| [RESULTADO_PRUEBA.md](../RESULTADO_PRUEBA.md) | Resultados de prueba |

## Carpeta `docs_OFF/` (material desactivado o duplicado)

Archivos ahí pueden solaparse con los de la raíz; úsalos solo si necesitas esa variante específica.

- `ARCHITECTURE_DATA_FLOW.md` — Flujo de datos  
- `API_ANALYZE_MULTI.md` — API analyze-multi  
- `IMPLEMENTATION_SUMMARY.md` — Resumen implementación  
- `QUICK_START.md` — Inicio rápido  

## Auditoría rápida (2026)

### Dependencias (`npm audit`)

Ejecutar `npm audit` sobre el árbol actual suele reportar algo como:

- **postcss** (moderado): viene anidado con **Next.js**; el aviso se resuelve al subir Next cuando publiquen cadena sin la versión vulnerable. **`npm audit fix --force`** propone retroceder Next/next-auth — **no recomendado**.
- **uuid** (moderado): arrastrado por next-auth/next; mismo comentario: esperar releases upstream o evaluar bump manual coordinado.
- **xlsx** SheetJS (**alto**): varios CVEs históricos sin fix en la línea `xlsx` community; mitigación típica: solo parsear ficheros confiables, tamaño máximo en upload, valorar migración a **exceljs** / **SheetJS Pro** / pipeline server-side aislado si el riesgo es inaceptable.

Revisar el informe completo tras cada `npm install` mayor.

### CSS / build

Se eliminó el `@import` de Google Fonts en `globals.css` en favor de **`next/font`** ya definido en `layout.tsx`, para evitar el warning de orden de `@import` respecto a Tailwind.

### Auth Google vs Supabase

Con **Google Provider**, NextAuth expone **`token.sub`** (ID del proveedor). Rutas que usan `session.user.id` esperan el **UUID de `User` en tu base**. Asegura que exista una fila `User` con el **mismo email** que devuelve Google (p. ej. alta automática en `signIn` o flujo manual de onboarding); si no, los endpoints que consultan por `userId` pueden fallar para cuentas solo-Google.

## Logs en desarrollo

Trazas estructuradas: [src/lib/logger.ts](../src/lib/logger.ts). Variables `LOG_VERBOSE` / `NEXT_PUBLIC_LOG_VERBOSE` (ver [.env.example](../.env.example) y README principal).

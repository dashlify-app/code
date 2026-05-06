# Dashlify

Plataforma web para **analizar datos tabulares** (CSV, Excel, Google Sheets), **proponer dashboards con IA** (OpenAI) y **editar un lienzo** con widgets reordenables, correlaciones y análisis multi-dataset. Autenticación con NextAuth (credenciales y Google), persistencia en **Supabase** (PostgreSQL).

## Características principales

- Carga de archivos y vista previa con estadísticas por columna
- Sugerencia de widgets (gráficos, KPIs) vía `/api/analyze` y flujos relacionados
- Análisis de varios datasets con detección de relaciones (`/api/analyze-multi`)
- Integración Google Sheets (OAuth con alcance de solo lectura)
- Canvas de dashboard con temas, filtros y exportación (incluye flujo HTML embebido)
- Límites de uso por API (`rateLimiter`) y registro de llamadas a IA cuando aplica

## Stack

| Área        | Tecnología |
|------------|------------|
| Framework  | Next.js 16 (App Router), React 19 |
| Estilos    | Tailwind CSS 4 |
| Auth       | NextAuth.js |
| Base de datos | Supabase (cliente JS + SQL en carpeta `migrations/`) |
| IA         | OpenAI API |
| Gráficos   | Chart.js, Recharts |

## Requisitos

- Node.js 20+ (recomendado)
- Cuenta [Supabase](https://supabase.com) con el esquema aplicado (ver `migrations/README.md`)
- Clave [OpenAI](https://platform.openai.com) para funciones de análisis
- (Opcional) Credenciales OAuth de Google para inicio de sesión y lectura de hojas de cálculo

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores. Las variables críticas son:

| Variable | Obligatoria | Descripción |
|----------|------------|-------------|
| `NEXTAUTH_SECRET` | Sí (producción) | Secreto para firmar sesiones JWT |
| `NEXTAUTH_URL` | Sí (producción) | URL canónica de la app (ej. `https://tu-dominio.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave anónima (navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave service role solo en servidor |
| `OPENAI_API_KEY` | Sí* | Análisis con IA (*salvo rutas que no invoquen modelos) |

También se admiten alias documentados en el código: `PROJECT_URL_SUPABASE`, `ANON_PUBLIC_SUPABASE`, `SERVICE_ROLE_SUPABASE`.

Opcionales: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, claves de API de Google para mapas u otros usos en cliente.

Para **login demo** controlado por configuración (sin credenciales en el código), usa las variables descritas en `.env.example` con prefijo `AUTH_DEMO_*`.

En desarrollo, `LOG_VERBOSE=1` (o `NEXT_PUBLIC_LOG_VERBOSE=1` para el bundle cliente) activa trazas detalladas vía `src/lib/logger.ts` (por ejemplo volcados JSON de IA).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
# Edita .env.local con tus claves

npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Aplica las migraciones SQL en el proyecto Supabase siguiendo `migrations/README.md` (orden cronológico por prefijo de fecha).

### Base de datos local (opcional)

```bash
docker compose up -d
```

Expone PostgreSQL en el puerto **5432**. Para usarlo con Supabase self-hosted o herramientas locales, alinea la cadena de conexión con tu flujo; el proyecto en producción está pensado para Supabase alojado.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (webpack) |
| `npm run build` | Compilación de producción |
| `npm start` | Servidor tras `build` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios |
| `npm run clear-dev-data` | Vacía tablas de dev (Postgres directo; ver `.env.example`) |

## Estructura útil

- `src/app/` — Rutas, layouts y API routes
- `src/components/` — UI (canvas, landing, modales, gráficos)
- `src/lib/` — Lógica (joins multi-dataset, auth helpers, rate limit, etc.)
- `migrations/` — SQL para Supabase (fuente de verdad del esquema aplicado en cloud)

## Documentación adicional en el repositorio

**Índice completo:** [docs/README.md](docs/README.md).

Documentos útiles sueltos: `QUICK_REFERENCE.md`, `TECHNICAL_IMPLEMENTATION.md`, `TESTING_GUIDE.md`, `ARCHITECTURE_DIAGRAMS.md`.

## Licencia y privacidad

Repositorio privado (`"private": true` en `package.json`). Ajusta licencia y políticas según tu despliegue.

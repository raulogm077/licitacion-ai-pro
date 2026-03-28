# Documentación Técnica — Analista de Pliegos

> Versión: 1.1.0 | Fecha: 2026-03-27

---

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Frontend](#5-frontend)
6. [Backend — Edge Functions](#6-backend--edge-functions)
7. [Base de Datos](#7-base-de-datos)
8. [Integración con IA](#8-integración-con-ia)
9. [API Reference](#9-api-reference)
10. [Variables de Entorno](#10-variables-de-entorno)
11. [Autenticación y Seguridad](#11-autenticación-y-seguridad)
12. [Testing](#12-testing)
13. [Build y Despliegue](#13-build-y-despliegue)
14. [Flujo de Trabajo del Equipo](#14-flujo-de-trabajo-del-equipo)

---

## 1. Visión General

**Analista de Pliegos** es una aplicación SaaS que analiza documentos PDF de licitaciones públicas usando inteligencia artificial. El sistema extrae automáticamente información estructurada (criterios de adjudicación, requisitos técnicos, solvencia, plazos, etc.) y la presenta en un dashboard navegable.

### Capacidades principales

| Capacidad | Descripción |
|-----------|-------------|
| Análisis de PDFs | Procesamiento de pliegos de condiciones con OpenAI Agents SDK |
| Extracción estructurada | Output validado con Zod (30+ campos por documento) |
| Streaming en tiempo real | Progreso de análisis vía Server-Sent Events (SSE) |
| Multi-documento | Análisis de varios archivos en una sola sesión |
| Plantillas personalizadas | Esquemas de extracción configurables por usuario |
| Historial y búsqueda | Almacenamiento persistente con filtros avanzados |
| Analytics | Dashboard de métricas y estadísticas de licitaciones |
| Multi-tenant | Aislamiento total de datos por usuario (RLS en Supabase) |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                     │
│  React 18 + TypeScript + Vite + Tailwind CSS + Zustand      │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  HomePage  │ │ History  │ │Analytics │ │  Templates  │  │
│  └────────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│         │               │          │               │         │
│  ┌──────┴───────────────┴──────────┴───────────────┴──────┐ │
│  │                    Service Layer                        │ │
│  │  job.service  db.service  auth.service  template.service│ │
│  └────────────────────────────┬────────────────────────────┘ │
└───────────────────────────────┼─────────────────────────────┘
                                │ HTTPS
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
  │  Supabase    │    │ Supabase Edge    │   │   Vercel     │
  │  REST API    │    │ Function         │   │   CDN        │
  │  (PostgREST) │    │ (Deno Runtime)   │   │   (Frontend) │
  └──────┬───────┘    └────────┬─────────┘   └──────────────┘
         │                     │
         ▼                     ▼
  ┌──────────────┐    ┌──────────────────┐
  │  PostgreSQL  │    │   OpenAI API     │
  │  15+ (RLS)   │    │   Agents SDK     │
  │              │    │   gpt-4o         │
  └──────────────┘    │   Files API      │
                      │   Vector Store   │
                      └──────────────────┘
```

### Flujo de análisis

```
Usuario sube PDF
       │
       ▼
Frontend convierte a Base64
       │
       ▼
POST /functions/v1/analyze-with-agents
       │
       ▼
Edge Function valida JWT + rate limit (10/hora)
       │
       ▼
Sube PDF a OpenAI Files API → Vector Store
       │
       ▼
OpenAI Agent (gpt-4o) procesa el documento
  ├── file_search en Vector Store
  ├── Extracción estructurada con schemas Zod
  └── submit_analysis_result (tool call obligatorio)
       │
       ▼
SSE streaming → cliente (heartbeat, progress, complete)
       │
       ▼
Frontend valida respuesta con Zod
       │
       ▼
Guarda en Supabase (licitaciones table)
       │
       ▼
Dashboard renderiza resultado
```

---

## 3. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 18.2.0 | Framework UI |
| TypeScript | 5.5.4 | Lenguaje (modo estricto) |
| Vite | 7.3.0 | Build tool y dev server |
| Tailwind CSS | 3.4.1 | Estilos utilitarios |
| Zustand | 5.0.9 | Estado global |
| React Router DOM | 7.10.1 | Enrutamiento SPA |
| Zod | 3.22.4 | Validación de schemas |
| i18next | 25.7.3 | Internacionalización (ES) |
| Lucide React | 0.344.0 | Iconos |
| ExcelJS | 4.4.0 | Exportación a Excel |
| Sentry | 10.32.1 | Monitoreo de errores |
| Vercel Analytics | latest | Métricas de uso |

### Backend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Supabase | latest | BaaS (DB + Auth + Storage + Edge) |
| PostgreSQL | 15+ | Base de datos principal |
| Deno | runtime | Edge Functions |
| OpenAI Agents SDK | 0.8.1 | Orquestación de agentes IA |
| OpenAI Files API | v1 | Ingesta de PDFs |
| OpenAI Vector Store | v1 | Búsqueda semántica en PDFs |

### Infraestructura

| Tecnología | Uso |
|-----------|-----|
| Vercel | Hosting frontend (CDN global) |
| Supabase Cloud | Backend gestionado |
| GitHub Actions | CI/CD pipeline |
| Docker / Docker Compose | Desarrollo local |
| pnpm 9.15.9 | Package manager |

### Testing

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Vitest | 4.0.15 | Tests unitarios e integración |
| @testing-library/react | latest | Tests de componentes |
| Playwright | 1.57.0 | Tests E2E (Chromium) |
| @axe-core/playwright | latest | Tests de accesibilidad |

---

## 4. Estructura del Proyecto

```
licitacion-ai-pro-qa/
├── src/                        # Código fuente frontend
│   ├── agents/                 # Definiciones de agentes IA
│   │   ├── analista.agent.ts   # Agente principal (gpt-4o)
│   │   ├── schemas/            # Schemas de output del agente
│   │   ├── tools/              # Tools del agente (submit-result)
│   │   └── utils/              # Instrucciones y schema-transformer
│   ├── components/             # Componentes React
│   │   ├── ui/                 # Genéricos (Button, Card, Dialog, etc.)
│   │   ├── domain/             # Dominio (ProviderSelector, TagManager)
│   │   └── layout/             # Layout (Header, wrapper)
│   ├── features/               # Módulos de feature
│   │   ├── analytics/          # Dashboard de analíticas
│   │   ├── auth/               # Flujos de autenticación
│   │   └── dashboard/          # Vista principal + detalle de capítulos
│   ├── pages/                  # Páginas de rutas
│   ├── services/               # Lógica de negocio
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Stores de Zustand
│   ├── lib/                    # Schemas Zod + config i18n
│   ├── config/                 # Configuración (env, supabase, sentry, features)
│   ├── locales/es/             # Traducciones en español
│   ├── test/                   # Setup de tests
│   ├── App.tsx                 # Componente raíz + router
│   ├── main.tsx                # Entry point (StrictMode + ErrorBoundary)
│   └── types.ts                # Tipos TypeScript globales
├── supabase/
│   ├── config.toml             # Config Supabase CLI
│   ├── functions/
│   │   ├── analyze-with-agents/ # Edge Function principal
│   │   └── _shared/            # Utilidades compartidas (cors, rate-limiter)
│   ├── migrations/             # Migraciones SQL (orden cronológico)
│   └── tests/database/         # Tests SQL
├── e2e/                        # Tests Playwright
├── scripts/                    # Scripts de utilidad
├── .github/workflows/          # CI/CD (ci-cd.yml, ci-cd-docs.yml)
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── vercel.json
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 5. Frontend

### Entry Point

`src/main.tsx` inicializa la aplicación:

```tsx
// Orden de inicialización:
// 1. Sentry (monitoreo de errores)
// 2. i18n (traducciones ES)
// 3. React.StrictMode + ErrorBoundary
// 4. App.tsx (router + layout)
```

### Rutas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `HomePage` | Subida de PDF y análisis |
| `/history` | `HistoryPage` | Historial de licitaciones |
| `/analytics` | `AnalyticsPage` | Dashboard de métricas |
| `/search` | `SearchPage` | Búsqueda avanzada con filtros |
| `/templates` | `TemplatesPage` | Gestión de plantillas de extracción |
| `/presentation/:id` | `PresentationPage` | Vista de presentación de resultado |

### Capa de Servicios

| Servicio | Archivo | Responsabilidad |
|---------|---------|----------------|
| `job.service` | `src/services/job.service.ts` | Orquestación del análisis, SSE streaming, timeout de inactividad (5 min). Incluye refresh proactivo del JWT antes de cada llamada a la Edge Function (si `expires_at - now < 60s`). |
| `db.service` | `src/services/db.service.ts` | CRUD de licitaciones, búsqueda, filtros (303 líneas) |
| `template.service` | `src/services/template.service.ts` | CRUD de plantillas de extracción |
| `auth.service` | `src/services/auth.service.ts` | Login, logout, sesión |
| `ai.service` | `src/services/ai.service.ts` | Interacciones IA (cancelación, reintentos) |
| `analytics.service` | `src/services/analytics.service.ts` | Cálculo de métricas |
| `quality.service` | `src/services/quality.service.ts` | Validación de calidad de extracción |
| `feedback.service` | `src/services/feedback.service.ts` | Feedback del usuario |
| `logger` | `src/services/logger.ts` | Logging estructurado |

### Estado Global (Zustand)

Los stores de Zustand en `src/stores/` gestionan:
- Estado de análisis en curso (`AnalysisState`)
- Sesión de usuario
- Configuración de UI (tema oscuro, idioma)

### Schemas de Validación (Zod)

Definidos en `src/lib/schemas.ts`:

```typescript
// Estructura principal de resultado de análisis
LicitacionContent {
  plantilla_personalizada?: Record<string, any>
  datosGenerales: {
    titulo: string
    presupuesto: number
    moneda: string
    plazoEjecucionMeses: number
    cpv: string[]
    organoContratacion: string
    fechaLimitePresentacion: string
  }
  criteriosAdjudicacion: {
    subjetivos: CriterioAdjudicacion[]  // { descripcion, ponderacion, detalles, cita }
    objetivos: CriterioAdjudicacion[]
  }
  requisitosTecnicos: {
    funcionales: RequisitoTecnico[]     // { requisito, obligatorio, referenciaPagina, cita }
    normativa: NormativaRef[]
  }
  requisitosSolvencia: {
    economica: SolvenciaEconomica
    tecnica: SolvenciaTecnica[]
  }
  restriccionesYRiesgos: Restriccion[]
  modeloServicio: ModeloServicio
}

// Metadata del documento
LicitacionMetadata {
  tags: string[]
  cliente?: string
  importeAdjudicado?: number
  estado?: 'PENDIENTE' | 'ADJUDICADA' | 'DESCARTADA' | 'EN_REVISION'
  fechaCreacion?: number
  ultimaModificacion?: number
  sectionStatus?: Record<string, 'success' | 'failed' | 'processing'>
}
```

### Configuración de Build (Vite)

```typescript
// vite.config.ts — manual chunks
{
  vendor: ['react', 'react-dom'],
  excel: ['exceljs'],
  ui: ['lucide-react', 'clsx', 'tailwind-merge']
}
// Límite de warning: 1000KB
```

---

## 6. Backend — Edge Functions

### `analyze-with-agents` (función principal)

**Archivo**: `supabase/functions/analyze-with-agents/index.ts`

**Flujo interno**:

```
1. Validar CORS (orígenes permitidos)
2. Extraer y verificar JWT → user_id
3. Rate limiting: 10 req/hora por usuario
4. Validar body (Zod schema)
5. Subir PDF a OpenAI Files API
6. Crear Vector Store con el archivo
7. Inicializar OpenAI Agent con:
   - Instrucciones de lectura de pliegos (guia-lectura-pliegos.md)
   - Tool: submit_analysis_result (mandatory)
   - file_search habilitado en Vector Store
8. Ejecutar agente con streaming
9. Emitir SSE: heartbeat → agent_message (progress) → complete/error
10. Limpiar archivos de OpenAI (Files API)
```

**Utilidades compartidas** (`supabase/functions/_shared/`):

| Archivo | Función |
|---------|---------|
| `cors.ts` | Manejo de CORS (whitelist de orígenes) |
| `rate-limiter.ts` | Rate limiting: 10 req/hora por usuario |
| `schemas.ts` | Validación de request/response |
| `services/job.service.ts` | Lógica de jobs de análisis |
| `services/openai.service.ts` | Cliente OpenAI |
| `utils/error.utils.ts` | Manejo centralizado de errores |

---

## 7. Base de Datos

### Configuración local

- **Puerto DB**: 54322
- **Puerto API**: 54321
- **Schema**: `public`
- **Auth**: Supabase Auth (JWT)

### Tablas

#### `public.licitaciones`

Almacenamiento principal de documentos analizados.

```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id         UUID NOT NULL REFERENCES auth.users(id)
hash            TEXT NOT NULL                    -- hash único por usuario+archivo
file_name       TEXT NOT NULL
data            JSONB NOT NULL                   -- LicitacionContent + LicitacionMetadata
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- Índices:
-- data->'metadata'->'tags' GIN
-- data->'metadata'->>'cliente'
-- data->'datosGenerales'->>'presupuesto' (numeric)
-- data->'metadata'->>'estado'

-- RLS: SELECT/INSERT/UPDATE/DELETE requieren auth.uid() = user_id
```

#### `public.extraction_templates`

Plantillas de extracción personalizadas.

```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id         UUID NOT NULL REFERENCES auth.users(id)
name            TEXT NOT NULL
description     TEXT
schema          JSONB NOT NULL  -- Array de campos: { name, type, description, obligatorio }
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- RLS: CRUD completo aislado por user_id
```

#### `public.analysis_jobs`

Seguimiento de trabajos de análisis de larga duración.

```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id         UUID NOT NULL REFERENCES auth.users(id)
status          TEXT NOT NULL  -- pending | processing | completed | failed
result          JSONB
error           TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `public.extraction_feedback`

Feedback de calidad sobre extracciones.

```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id         UUID NOT NULL REFERENCES auth.users(id)
licitacion_id   UUID REFERENCES licitaciones(id)
feedback_type   TEXT  -- quality_issue | correction | suggestion
field_path      TEXT  -- e.g., 'datosGenerales.presupuesto'
feedback_text   TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `storage.analysis_pdfs`

Bucket de Supabase Storage para PDFs.

```
Acceso: REST API de Supabase Storage
Seguridad: RLS por user_id
Operaciones: upload, download, delete
```

### Migraciones

```
supabase/migrations/
├── 20251228000000_initial_schema.sql           # Schema inicial
├── 20251231000000_add_analysis_jobs.sql        # Tabla analysis_jobs
├── 20260103_create_analysis_pdfs_bucket.sql    # Storage bucket
├── 20260318192404_extraction_templates.sql     # Plantillas de extracción
├── 20260323000000_extraction_feedback.sql      # Feedback de usuario
└── 20250130000000_add_provider_reading_mode.sql # Modo de lectura por proveedor
```

---

## 8. Integración con IA

### Agente principal

**Archivo**: `src/agents/analista.agent.ts`

| Parámetro | Valor |
|-----------|-------|
| Modelo | `gpt-4.1` (1M token context, Agents SDK default) |
| SDK | OpenAI Agents SDK 0.8.1 |
| Tool obligatorio | `submit_analysis_result` |
| Capacidades | `file_search` (Vector Store) |
| Instrucciones | `src/agents/utils/instructions.ts` |
| Guía de dominio | `guia-lectura-pliegos.md` (en Edge Function) |

### Flujo de procesamiento de documentos

```
PDF (base64)
  → OpenAI Files API (upload)
  → Vector Store (indexación semántica)
  → Agent run (file_search habilitado)
      → Agent lee chunks relevantes del PDF
      → Llena el schema estructurado
      → Llama a submit_analysis_result (tool call)
  → schema-transformer valida con Zod
  → WorkflowState (quality, warnings)
  → SSE complete event → frontend
```

### Schema de output del agente

`src/agents/schemas/licitacion-agent.schema.ts` define el schema JSON que el agente debe seguir, validado después con Zod.

### WorkflowState

Metadata de calidad generada por el agente:

```typescript
WorkflowState {
  quality: {
    overall: 'COMPLETO' | 'PARCIAL' | 'VACIO'
    bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>
    missingCriticalFields: string[]
    ambiguous_fields: string[]
  }
  warnings: Array<{ code: string, message: string, severity: string }>
  processTime: number  // milisegundos
}
```

### Decisiones de arquitectura IA

| Decisión | Alternativa rechazada | Razón |
|---------|----------------------|-------|
| OpenAI Files API + Vector Store | Extraer texto en frontend | Permite file_search nativo del agente |
| Base64 para transferencia de PDF | FormData multipart | Simplifica validación Zod en Edge Function |
| SSE para streaming | WebSocket | Unidireccional, HTTP-nativo, más simple |
| Tool call obligatorio (`submit_result`) | Respuesta directa de texto | Garantiza output estructurado validable |
| Procesamiento secuencial multi-doc | Paralelo | Límites de memoria del Edge Runtime |

---

## 9. API Reference

### Edge Function: `analyze-with-agents`

**Endpoint**: `POST https://<PROJECT>.supabase.co/functions/v1/analyze-with-agents`

**Headers**:

```
Authorization: Bearer <JWT>
Content-Type: application/json
apikey: <VITE_SUPABASE_ANON_KEY>
```

**Request body**:

```typescript
{
  pdfBase64: string              // PDF en base64
  guiaBase64?: string | null     // Guía adicional en base64 (opcional)
  filename: string               // Nombre del archivo
  template?: {                   // Plantilla personalizada (opcional)
    id: string
    name: string
    schema: TemplateField[]
  } | null
  files?: Array<{                // Para análisis multi-documento
    name: string
    base64: string
  }>
}
```

**Response**: Server-Sent Events (SSE)

```
# Evento de keepalive (cada 15s)
event: heartbeat
data: {}

# Progreso del agente
event: agent_message
data: {
  "step": "Analizando criterios de adjudicación...",
  "progress": 45,           // 0-100
  "thinkingOutput": "..."   // Opcional: razonamiento del agente
}

# Análisis completado
event: complete
data: {
  "result": LicitacionContent,
  "workflow": WorkflowState
}

# Error
event: error
data: {
  "error": "Descripción del error"
}
```

**Límites**:
- Rate limit: 10 requests/hora por usuario
- Timeout de inactividad (frontend): 5 minutos
- CORS: `licitacion-ai-pro.vercel.app`, `localhost:5173`, `localhost:3000`

### REST API (Supabase auto-generada)

Toda operación requiere `Authorization: Bearer <JWT>` y RLS garantiza aislamiento.

| Operación | Endpoint | Descripción |
|-----------|---------|-------------|
| `GET` | `/rest/v1/licitaciones` | Listar licitaciones del usuario |
| `POST` | `/rest/v1/licitaciones` | Crear nueva licitación |
| `PATCH` | `/rest/v1/licitaciones?id=eq.<id>` | Actualizar licitación |
| `DELETE` | `/rest/v1/licitaciones?id=eq.<id>` | Eliminar licitación |
| `GET` | `/rest/v1/extraction_templates` | Listar plantillas del usuario |
| `POST` | `/rest/v1/extraction_templates` | Crear plantilla |
| `PATCH` | `/rest/v1/extraction_templates?id=eq.<id>` | Actualizar plantilla |
| `DELETE` | `/rest/v1/extraction_templates?id=eq.<id>` | Eliminar plantilla |

---

## 10. Variables de Entorno

### Frontend (`.env` / `.env.local`)

```bash
# Requeridas
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>

# Opcionales
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_ENVIRONMENT=development|staging|production
```

Validadas en `src/config/env.ts` con Zod al iniciar la app.

### Backend (Supabase Secrets)

```bash
# Configurar via CLI (nunca en .env):
npx supabase secrets set OPENAI_API_KEY=sk-...
```

> La `OPENAI_API_KEY` **nunca** debe exponerse en el frontend. Solo existe como secret de Supabase.

### Feature Flags (`src/config/features.ts`)

```typescript
ENABLE_TEMPLATES = true          // Plantillas de extracción personalizadas
ENABLE_MULTI_DOCUMENT = true     // Subida de múltiples PDFs
ENABLE_FEEDBACK = true           // Recolección de feedback de usuario
```

---

## 11. Autenticación y Seguridad

### Autenticación

- **Proveedor**: Supabase Auth (JWT)
- **Sesión**: Gestionada por `src/services/auth.service.ts`
- **Cliente**: `src/config/supabase.ts` (inicialización lazy con proxy)
- **Flujos**: Login, logout, refresh de sesión automático

### Row-Level Security (RLS)

Todas las tablas tienen RLS activado. Política base en todas:

```sql
-- SELECT: solo propios registros
CREATE POLICY "select_own" ON public.licitaciones
  FOR SELECT USING (auth.uid() = user_id);

-- Políticas equivalentes para INSERT, UPDATE, DELETE
```

### Seguridad en producción (Vercel)

Headers configurados en `vercel.json`:

```
Content-Security-Policy: default-src 'self'; connect-src 'self' *.supabase.co *.sentry.io ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### CORS (Edge Functions)

```typescript
// Orígenes permitidos:
const ALLOWED_ORIGINS = [
  'https://licitacion-ai-pro.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
]
```

### Rate Limiting

- **Límite**: 10 requests/hora por `user_id`
- **Implementación**: `supabase/functions/_shared/rate-limiter.ts`
- **Respuesta en exceso**: `HTTP 429 Too Many Requests`

---

## 12. Testing

### Tests Unitarios (Vitest)

```bash
npm test              # Modo watch
npm test -- --run     # Single run (CI)
npm test -- --ui      # UI dashboard
npm run test:coverage # Con reporte de cobertura
```

**Umbrales mínimos de cobertura**:

| Métrica | Umbral |
|---------|--------|
| Statements | 65% |
| Branches | 50% |
| Functions | 58% |
| Lines | 65% |

**Organización de tests**:

```
src/
├── services/__tests__/     # db, ai, auth, template, analytics, feedback, quality
├── config/__tests__/       # env validation, features
├── components/__tests__/   # UI components
├── pages/__tests__/        # Pages
├── hooks/__tests__/        # Custom hooks
├── agents/__tests__/       # Agent logic
└── __tests__/              # Tests globales
```

**Setup** (`src/test/setup.ts`): Mocks para `matchMedia`, `i18next`, `localStorage`, variables de entorno.

### Tests E2E (Playwright)

```bash
npm run test:e2e              # Todos los tests
npm run test:e2e -- --headed  # Con navegador visible
```

| Archivo | Cobertura |
|---------|-----------|
| `app.spec.ts` | Funcionalidad básica de la app |
| `critical-flows.spec.ts` | Flujo principal de análisis |
| `complete-journeys.spec.ts` | Escenarios de usuario completos |
| `accessibility.spec.ts` | Cumplimiento WCAG (@axe-core) |
| `multi-upload.spec.ts` | Subida de múltiples archivos |

**Configuración**: Base URL `http://localhost:4173` (Vite preview), timeout global 600s, Chromium, trace on-first-retry.

### Calidad de Código

```bash
npm run lint          # ESLint (0 warnings permitidos)
npm run typecheck     # TypeScript strict check
npm run format:check  # Prettier
npm run format        # Prettier con auto-fix
```

**Git Hooks** (Husky + lint-staged): ESLint + Prettier en pre-commit sobre archivos `.ts/.tsx` staged.

---

## 13. Build y Despliegue

### Desarrollo local

**Con Docker Compose** (recomendado):

```bash
docker-compose up
# Frontend: http://localhost:5173
# PostgreSQL: localhost:54322
```

**Sin Docker**:

```bash
pnpm install
pnpm dev         # Dev server en http://localhost:5173

# Supabase local:
npx supabase start  # Inicia DB local + API en puerto 54321
npx supabase db reset  # Aplica todas las migraciones
```

### Build de producción

```bash
pnpm build       # TypeScript check + Vite build → dist/
pnpm preview     # Preview del build en http://localhost:4173
```

**Chunks generados**:
- `vendor.[hash].js` — React + React DOM
- `excel.[hash].js` — ExcelJS
- `ui.[hash].js` — Lucide React, clsx, tailwind-merge
- `index.[hash].js` — Código de la app

### Despliegue en Vercel

1. Push a rama `main` (vía PR aprobado)
2. GitHub Actions ejecuta: lint → typecheck → unit tests → E2E tests → build
3. Vercel detecta el push y despliega automáticamente
4. Variables de entorno configuradas en Vercel Dashboard

### Despliegue de Edge Functions

```bash
# Prerrequisitos:
npm run typecheck && npm test && npm run test:e2e

# Deploy:
npx supabase functions deploy analyze-with-agents --no-verify-jwt

# Secrets:
npx supabase secrets set OPENAI_API_KEY=sk-...
```

### CI/CD (GitHub Actions)

**`.github/workflows/ci-cd.yml`**:

```
PR → main:
  1. Lint (ESLint + TypeScript)
  2. Unit tests (Vitest)
  3. Build (Vite)
  4. E2E tests (Playwright)

Merge a main:
  5. Deploy a Vercel (automático)
```

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
```

---

## 14. Flujo de Trabajo del Equipo

### Roles de Agentes IA

El proyecto usa un sistema de agentes especializados (documentado en `AGENTS.md`):

| Rol | Responsabilidad |
|-----|----------------|
| **PM** | Backlog, SPEC.md, planificación. No escribe código. |
| **Tech Lead** | UI, servicios, tests unitarios |
| **AI Engineer** | Prompts, schemas de extracción, Edge Function |
| **QA** | Validación, tests E2E, procedimiento de deploy |

### Política de ramas

- Ramas efímeras por tarea: `jules/{rol}/{slug}`
  - Ejemplo: `jules/tech/add-extraction-templates`
- No hay commits directos a `main`
- PRs requeridos con CI completo

### Documentación viva

Los siguientes documentos deben mantenerse actualizados con cada tarea:

| Documento | Contenido |
|-----------|-----------|
| `ARCHITECTURE.md` | Decisiones de diseño, registro de cambios arquitecturales |
| `SPEC.md` | Requisitos de la iteración activa |
| `BACKLOG.md` | Cola de trabajo operacional |
| `DEPLOYMENT.md` | Procedimientos de release |
| `CHANGELOG.md` | Notas de versión |
| `AUDIT.md` | Notas de seguridad y auditoría |

**Regla**: Actualizar documentación es obligatorio antes de cerrar una tarea.

---

## Apéndice — Decisiones Arquitecturales Clave

| Decisión | Elección | Alternativa | Razón |
|---------|----------|-------------|-------|
| Streaming | SSE | WebSocket | Unidireccional, HTTP-nativo, más simple de implementar |
| Transferencia de PDF | Base64 en JSON | FormData multipart | Facilita validación Zod y SSE en mismo request |
| Multi-tenancy | RLS en Supabase | Filtros en app | Aislamiento garantizado a nivel DB sin código adicional |
| AI SDK | OpenAI Agents SDK | LangChain | Streaming nativo, tool calling, Files API integrado |
| Modelo | gpt-4.1 | gpt-4o | Nuevo default del Agents SDK; contexto 1M tokens, mejor instruction following y structured output enforcement |
| Multi-doc | Procesamiento secuencial | Paralelo | Límites de memoria del Deno Edge Runtime |
| Validación | Zod (frontend + backend) | JSON Schema | Type-safe, reutilizable entre frontend y Edge Functions |
| Estado | Zustand | Redux / Context | Más ligero, API más simple para este caso de uso |

---

*Documentación generada el 2026-03-27. Para actualizaciones, ver `CHANGELOG.md` y `ARCHITECTURE.md`.*

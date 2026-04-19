# Documentación Técnica — Analista de Pliegos

> Versión: 2.2.0 | Fecha: 2026-04-19

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
| Análisis de PDFs | Procesamiento de pliegos de condiciones con OpenAI Responses API (pipeline por fases) |
| Extracción estructurada | Output validado con Zod (30+ campos por documento) |
| Streaming en tiempo real | Progreso de análisis vía Server-Sent Events (SSE) con reintentos visibles |
| Chat conversacional | Consultas sobre análisis persistidos con OpenAI Agents SDK |
| Multi-documento | Análisis de varios archivos en una sola sesión |
| Plantillas personalizadas | Esquemas de extracción configurables por usuario |
| Historial y búsqueda | Almacenamiento persistente con FTS (español) + filtros avanzados + eliminación |
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
  │  15+ (RLS)   │    │   Responses API  │
  │              │    │   gpt-4.1        │
  └──────────────┘    │   Files API      │
                      │   Vector Store   │
                      └──────────────────┘
```

### Flujo de análisis (Pipeline por Fases)

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
Fase A: Ingesta
  └── Sube PDF a OpenAI Files API → Vector Store
       │
       ▼
Fase B: Mapa Documental
  └── Responses API + file_search → identifica PCAP, PPT, anexos
       │
       ▼
Fase C: Extracción por Bloques (~9 llamadas, 3 en paralelo con retries agresivos)
  └── Responses API + file_search por sección
      (datosGenerales, criterios, solvencia, técnicos, riesgos, etc.)
      Ejecución con concurrencia limitada (runWithConcurrency)
       │
       ▼
Fase D: Consolidación
  └── Merge de bloques + prelación documental + resolución de conflictos
       │
       ▼
Fase E: Validación Final
  └── Quality scoring, evidencias, campos críticos
       │
       ▼
SSE streaming → cliente (phase events + retry_scheduled + complete)
       │
       ▼
Frontend valida respuesta con Zod (TrackedField para campos críticos)
       │
       ▼
Guarda en Supabase (licitaciones table)
       │
       ▼
Dashboard renderiza resultado con evidencias y warnings
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
| OpenAI Responses API | latest | Pipeline de extracción por fases |
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
licitacion-ai-pro/
├── src/                        # Código fuente frontend
│   ├── components/             # Componentes React
│   │   ├── ui/                 # Genéricos (Button, Card, Dialog, etc.)
│   │   ├── domain/             # Dominio (TagManager, etc.)
│   │   └── layout/             # Layout (Header, wrapper)
│   ├── features/               # Módulos de feature
│   │   ├── analytics/          # Dashboard de analíticas
│   │   ├── auth/               # Flujos de autenticación
│   │   ├── dashboard/          # Vista principal + detalle de capítulos
│   │   └── history/            # Historial con búsqueda FTS y eliminación
│   ├── pages/                  # Páginas de rutas
│   ├── services/               # Lógica de negocio
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Stores de Zustand
│   ├── lib/                    # Schemas Zod + tracked-field utils + config i18n
│   ├── config/                 # Configuración (env, supabase, sentry, features)
│   ├── locales/es/             # Traducciones en español
│   ├── test/                   # Setup de tests
│   ├── App.tsx                 # Componente raíz + router
│   ├── main.tsx                # Entry point (StrictMode + ErrorBoundary)
│   └── types.ts                # Tipos TypeScript globales
├── supabase/
│   ├── config.toml             # Config Supabase CLI
│   ├── functions/
│   │   ├── analyze-with-agents/ # Edge Function principal (pipeline por fases)
│   │   ├── chat-with-analysis-agent/ # Capa conversacional sobre análisis persistidos
│   │   │   ├── agents.ts        # Manager agent + especialistas expuestos como tools
│   │   │   ├── index.ts         # Entry point HTTP + auth + ejecución del agente
│   │   │   ├── session.ts       # Persistencia manual del historial conversacional
│   │   │   ├── tools.ts         # Tools de solo lectura sobre análisis persistidos
│   │   │   ├── tools_test.ts    # Tests Deno de utilidades y extracción de evidencias
│   │   │   └── types.ts         # Tipos del contrato HTTP y contexto del agente
│   │   └── _shared/            # Utilidades compartidas (cors, rate-limiter, schemas)
│   │       └── schemas/         # Schemas canónicos (canonical, blocks, job, etc.)
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
| `db.service` | `src/services/db.service.ts` | CRUD de licitaciones, FTS search (RPC), filtros avanzados, delete |
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
    titulo: TrackedField<string>          // { value, status, evidence?, warnings? }
    presupuesto: TrackedField<number>
    moneda: TrackedField<string>
    plazoEjecucionMeses: TrackedField<number>
    cpv: TrackedField<string[]>
    organoContratacion: TrackedField<string>
    fechaLimitePresentacion?: string
  }
  criteriosAdjudicacion: {
    subjetivos: CriterioSubjetivo[]  // { descripcion, ponderacion, detalles, cita, subcriterios }
    objetivos: CriterioObjetivo[]    // { descripcion, ponderacion, formula, cita }
  }
  requisitosTecnicos: {
    funcionales: RequisitoTecnico[]  // { requisito, obligatorio, referenciaPagina, cita }
    normativa: NormativaRef[]
  }
  requisitosSolvencia: {
    economica: SolvenciaEconomica
    tecnica: SolvenciaTecnica[]
    profesional: SolvenciaProfesional[]
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

**Flujo interno (Pipeline por Fases)**:

```
1. Validar CORS (orígenes permitidos)
2. Extraer y verificar JWT → user_id
3. Rate limiting: 10 req/hora por usuario
4. Validar body (Zod schema)
5. Fase A — Ingesta:
   - Subir PDF(s) a OpenAI Files API
   - Crear Vector Store
   - Persistir job en analysis_jobs
6. Fase B — Mapa Documental:
   - Responses API + file_search → identifica documentos
7. Fase C — Extracción por Bloques:
   - ~9 llamadas a Responses API + file_search
   - Cada bloque valida con Zod parcial
8. Fase D — Consolidación:
   - Merge de bloques + prelación PCAP > PPT > carátula
9. Fase E — Validación:
   - Quality scoring + evidencias
10. Emitir SSE: heartbeat → phase events → complete/error
11. Cleanup de resources marcado para TTL
```

**Utilidades compartidas** (`supabase/functions/_shared/`):

| Archivo | Función |
|---------|---------|
| `config.ts` | Constantes centralizadas (modelo, timeouts, concurrencia) |
| `cors.ts` | Manejo de CORS (whitelist de orígenes) |
| `rate-limiter.ts` | Rate limiting: 10 req/hora por usuario |
| `services/job.service.ts` | Lógica de jobs de análisis |
| `schemas/canonical.ts` | Schema canónico con TrackedField |
| `schemas/blocks.ts` | Schemas parciales por bloque |
| `schemas/job.ts` | Schema del estado del job |
| `utils/error.utils.ts` | Manejo centralizado de errores OpenAI (type guard + mapeo) |
| `utils/timeout.ts` | Timeout por llamada API (`callWithTimeout` con `Promise.race`) |

### `chat-with-analysis-agent` (función conversacional)

**Archivo**: `supabase/functions/chat-with-analysis-agent/index.ts`

**Flujo interno**:

```
1. Validar CORS
2. Extraer y verificar JWT → user_id
3. Validar body (`analysisHash`, `message`, `sessionId?`)
4. Verificar que el análisis existe en `licitaciones`
5. Crear o recuperar sesión (`analysis_chat_sessions`)
6. Cargar historial conversacional (`analysis_chat_messages`)
7. Ejecutar manager agent con tools de solo lectura
8. Reescribir historial persistido con `result.history`
9. Devolver `answer`, `citations`, `usedTools` y `sessionId`
```

**Módulos internos**:

| Archivo | Función |
|---------|---------|
| `agents.ts` | Manager agent + specialists (`criteria_agent`, `solvency_agent`, `risk_agent`) |
| `tools.ts` | Tools de lectura sobre `licitaciones` (`get_analysis_overview`, `get_field_value`, etc.) |
| `session.ts` | Persistencia manual de historial conversacional en Supabase |
| `types.ts` | Schemas Zod del request y de la salida estructurada |
| `tools_test.ts` | Tests Deno de resolución de campos, evidencias y búsqueda |

**Consumo frontend**:

- `src/services/analysis-chat.service.ts` encapsula auth, refresh de sesión y llamada HTTP a `functions/v1/chat-with-analysis-agent`
- `src/features/analysis-chat/components/AnalysisChatPanel.tsx` renderiza mensajes, evidencias, herramientas usadas y acciones de reset
- `src/features/dashboard/Dashboard.tsx` expone la sección `Copiloto IA` cuando existe `analysisHash`
- la UX guarda `sessionId` y mensajes renderizados en `localStorage` para recuperar la conversación al volver al mismo análisis

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

search_vector   TSVECTOR GENERATED ALWAYS AS (...)  -- FTS español (weighted A/B/C)

-- Índices:
-- data->'metadata'->'tags' GIN
-- data->'metadata'->>'cliente'
-- data->'datosGenerales'->>'presupuesto' (numeric)
-- data->'metadata'->>'estado'
-- search_vector GIN (full-text search)

-- RLS: SELECT/INSERT/UPDATE/DELETE requieren auth.uid() = user_id
```

#### `public.extraction_templates`

#### `public.analysis_chat_sessions`

Sesiones conversacionales ligadas a un análisis persistido.

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES auth.users(id)
analysis_hash   TEXT NOT NULL
title           TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- Índice: (user_id, analysis_hash)
-- RLS: FOR ALL requiere auth.uid() = user_id
```

#### `public.analysis_chat_messages`

Historial serializado del chat para reconstruir el input del SDK.

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
session_id      UUID NOT NULL REFERENCES analysis_chat_sessions(id) ON DELETE CASCADE
user_id         UUID NOT NULL REFERENCES auth.users(id)
role            TEXT NOT NULL DEFAULT 'item'
content         JSONB NOT NULL
metadata        JSONB
created_at      TIMESTAMPTZ DEFAULT NOW()

-- Índices: (session_id, created_at), (user_id, created_at)
-- RLS: FOR ALL requiere auth.uid() = user_id
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
├── 20250130000000_add_provider_reading_mode.sql # Modo de lectura por proveedor
└── 20260329000000_fulltext_search.sql          # FTS español + RPC search_licitaciones
```

---

## 8. Integración con IA

### Pipeline de Extracción (Responses API)

| Parámetro | Valor |
|-----------|-------|
| Modelo | `gpt-4.1` (1M token context) |
| API | OpenAI Responses API (`openai.responses.create()`) |
| Capacidades | `file_search` (Vector Store) por fase |
| Prompts | `supabase/functions/analyze-with-agents/prompts.ts` |
| Guía de dominio | Inyectada en system prompts (no en Vector Store) |

### Flujo de procesamiento de documentos

```
PDF (base64)
  → OpenAI Files API (upload)
  → Vector Store (indexación semántica)
  → Pipeline de 5 fases:
      Fase A: Ingesta + Vector Store
      Fase B: Mapa documental (file_search)
      Fase C: Extracción por bloques (file_search × 9)
      Fase D: Consolidación (local, sin API)
      Fase E: Validación + quality scoring
  → Resultado validado con Zod canónico
  → WorkflowState (quality, warnings, phases)
  → SSE complete event → frontend
```

### Schema canónico

El schema canónico (`supabase/functions/_shared/schemas/canonical.ts`) define la estructura rica del resultado. Los 6 campos críticos (titulo, presupuesto, moneda, plazo, cpv, organoContratacion) usan **TrackedField**:

```typescript
TrackedField<T> = {
  value: T,
  evidence?: { quote: string, pageHint?: string, confidence?: number },
  status: 'extraido' | 'ambiguo' | 'no_encontrado' | 'derivado_tecnico',
  warnings?: string[]
}
```

El frontend (`src/lib/schemas.ts`) define schemas equivalentes con backward-compat via `z.preprocess` para datos legacy.

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
| Responses API por fases | Agents SDK monolítico | Evidencias por campo, resultado parcial, mejor control |
| file_search + JSON en prompt | file_search + json_schema (incompatibles) | Restricción de OpenAI API; Zod valida server-side |
| OpenAI Files API + Vector Store | Extraer texto en frontend | Permite file_search nativo |
| Base64 para transferencia de PDF | FormData multipart | Simplifica validación Zod en Edge Function |
| SSE para streaming | WebSocket | Unidireccional, HTTP-nativo, más simple |
| TrackedField para campos críticos | Valores planos | Permite status, evidencia y warnings por campo |
| Procesamiento secuencial multi-doc | Paralelo | Límites de memoria del Edge Runtime |
| Agents SDK sobre `licitaciones` | Reescribir el pipeline batch con agentes | Mantiene estable la extracción principal y aísla la conversación |

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

# Inicio de fase
event: phase_started
data: { "phase": "C", "name": "block_extraction" }

# Fin de fase
event: phase_completed
data: { "phase": "C", "name": "block_extraction" }

# Progreso dentro de fase (legacy compat)
event: agent_message
data: {
  "step": "Analizando criterios de adjudicación...",
  "progress": 45,           // 0-100
  "thinkingOutput": "..."   // Opcional
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

### Edge Function: `chat-with-analysis-agent`

**Endpoint**: `POST https://<PROJECT>.supabase.co/functions/v1/chat-with-analysis-agent`

**Headers**:

```
Authorization: Bearer <JWT>
Content-Type: application/json
apikey: <VITE_SUPABASE_ANON_KEY>
```

**Request body**:

```typescript
{
  analysisHash: string
  message: string
  sessionId?: string
}
```

**Response**:

```typescript
{
  answer: string
  citations: Array<{
    fieldPath?: string
    quote: string
    pageHint?: string
    confidence?: number
  }>
  usedTools: string[]
  sessionId: string
}
```

**Comportamiento esperado en frontend**:

- se invoca solo sobre análisis persistidos con `hash`
- cada respuesta puede actualizar el `sessionId` local que se reutiliza en turnos sucesivos
- la UI muestra `citations` y `usedTools`, pero no consulta tablas conversacionales directamente
- resetear la conversación borra el estado local del navegador; la sesión histórica queda persistida en backend
- CORS: `licitacion-ai-pro.vercel.app`, `localhost:5173`, `localhost:3000`

### RPC: `search_licitaciones`

**Endpoint**: `POST https://<PROJECT>.supabase.co/rest/v1/rpc/search_licitaciones`

Combina full-text search (FTS español con `websearch_to_tsquery`) y fallback ILIKE para coincidencias parciales (códigos CPV, términos cortos). El `search_vector` es una columna `tsvector` generada con pesos:

| Peso | Campos |
|------|--------|
| A | `datosGenerales.titulo` |
| B | `datosGenerales.organoContratacion`, `metadata.cliente` |
| C | `file_name`, `tipoContrato`, `procedimiento` |

Resultados ordenados por ranking FTS descendente + fecha de actualización.

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

Esta secret se usa en:

- `analyze-with-agents`
- `chat-with-analysis-agent`

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
npx supabase functions deploy chat-with-analysis-agent --no-verify-jwt

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
| AI API | OpenAI Responses API | Agents SDK / LangChain | Pipeline por fases, file_search nativo, control granular |
| Modelo | gpt-4.1 | gpt-4o | Contexto 1M tokens, mejor instruction following |
| Multi-doc | Procesamiento secuencial | Paralelo | Límites de memoria del Deno Edge Runtime |
| Extracción bloques | Paralela (3 concurrentes) | Secuencial | ~3x speedup sin saturar API; `runWithConcurrency` |
| Config backend | Centralizada (`_shared/config.ts`) | Hardcoded por archivo | Único punto de cambio para modelo, timeouts, concurrencia |
| Búsqueda historial | FTS español + ILIKE fallback | Solo ILIKE | Stemming español + ranking por relevancia + parciales |
| Validación | Zod (frontend + backend) | JSON Schema | Type-safe, reutilizable entre frontend y Edge Functions |
| Estado | Zustand | Redux / Context | Más ligero, API más simple para este caso de uso |

---

*Documentación actualizada el 2026-03-29. Para actualizaciones, ver `CHANGELOG.md` y `ARCHITECTURE.md`.*

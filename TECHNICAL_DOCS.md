# Documentación Técnica — Analista de Pliegos

> Versión: 2.4.0 | Fecha: 2026-05-06

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
| Análisis de PDFs | Procesamiento de pliegos de condiciones con OpenAI Responses API (pipeline por fases, fases B+C vía `@openai/agents@0.3.1`) |
| Extracción estructurada | Output validado con Zod (30+ campos por documento) |
| Streaming en tiempo real | Progreso de análisis vía Server-Sent Events (SSE) con reintentos e indexación visible |
| Tracing del SDK | `SupabaseLogTraceProcessor` emite `[trace]` JSON por evento del Agent SDK; correlable con `requestId` en logs |
| Chat conversacional | Consultas sobre análisis persistidos con OpenAI Agents SDK |
| Camino principal soportado | Un único PDF completo del expediente como referencia fiable de release |
| Multi-documento | Análisis de varios archivos en una sola sesión como refuerzo, no como gate principal |
| Plantillas personalizadas | Esquemas de extracción configurables por usuario; `templateSanitizationGuardrail` (input) bloquea > 50 campos |
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
│  └──────────────────────────────────┬──────────────────────────┘ │
└─────────────────────────────────────────────┼───────────────────────┘
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
Kong API Gateway: verify_jwt = true → 401 si falta JWT
       │
       ▼
Edge Function: resolver user (auth.getUser) + rate limit (10/hora)
       │
       ▼
Fase A: Ingesta
  └── Sube PDF a OpenAI Files API → Vector Store
       │
       ▼
Fase B: Mapa Documental
  └── Agent + run() + file_search → identifica PCAP, PPT, anexos
       │
       ▼
Fase C: Extracción por Bloques (~9 Agents, 3 en paralelo con retries)
  └── buildBlockAgent(name) + run() por sección
      (datosGenerales, criterios, solvencia, técnicos, riesgos, etc.)
      Output guardrail: jsonShapeGuardrail(BLOCK_SCHEMAS[name])
      Reintentos: 1 retry con reinforceJson tras OutputGuardrailTripwireTriggered
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
SSE streaming → cliente (phase events + phase_progress + retry_scheduled + complete)
       │
       ▼
Frontend valida respuesta con Zod y consume `workflow.quality.partial_reasons`
       │
       ▼
Guarda en Supabase (licitaciones table)
       │
       ▼
Dashboard renderiza resultado con evidencias y warnings
```

### Contrato compartido FE/BE

La aplicación ya no depende de definiciones wire paralelas para los eventos del análisis:

- `src/shared/analysis-contract.ts` define `AnalysisStreamEvent`, `TrackedFieldWire`, `WorkflowQualityWire` y `AnalysisPartialReason`
- `WorkflowQualityWire` incluye `section_diagnostics` para explicar por qué una sección queda vacía, parcial o recuperada
- backend y frontend deben mantenerse alineados con ese contrato antes de aplicar sus validaciones locales
- `partial_reasons` es el mecanismo estructurado para clasificar análisis `PARCIAL` sin depender de heurísticas de texto libre

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
| Zod | 3.25.76 | Validación de schemas (alineado con `@openai/agents@0.3.1`) |
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
| `@openai/agents` | 0.3.1 | Agent + run() + guardrails para fases B y C de `analyze-with-agents`. Pin vía `_shared/agents/sdk.ts` (re-export nombrado explícito). |
| OpenAI Responses API | latest | Pipeline de extracción por fases (subyacente al SDK) |
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
| Deno test | runtime | Tests Edge Function (`analyze-with-agents/__tests__/agents.test.ts`, `chat-with-analysis-agent/tools_test.ts`) |

---

## 4. Estructura del Proyecto

```
licitacion-ai-pro/
├── src/                        # Código fuente frontend
│   ├── components/             # Componentes React
│   ├── features/               # Módulos de feature
│   ├── pages/                  # Páginas de rutas
│   ├── services/               # Lógica de negocio
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Stores de Zustand
│   ├── lib/                    # Schemas Zod + tracked-field utils + config i18n
│   ├── shared/                 # Contrato wire compartido (SSE, quality, TrackedFieldWire)
│   ├── config/                 # Configuración (env, supabase, sentry, features)
│   ├── locales/es/             # Traducciones en español
│   ├── test/                   # Setup de tests
│   ├── App.tsx                 # Componente raíz + router
│   ├── main.tsx                # Entry point
│   └── types.ts                # Tipos TypeScript globales
├── supabase/
│   ├── config.toml             # Config Supabase CLI (verify_jwt=true para analyze-with-agents)
│   ├── functions/
│   │   ├── analyze-with-agents/
│   │   │   ├── index.ts          # Orquestador SSE + setTraceProcessors + requestId
│   │   │   ├── agents/           # Agent factories (document-map, block-extractor, custom-template)
│   │   │   ├── prompts/index.ts  # Prompt strings (1:1 desde la implementación previa)
│   │   │   ├── phases/           # Pipeline phases (incluye block-extraction.legacy.ts behind USE_AGENTS_SDK flag)
│   │   │   └── __tests__/        # Tests Deno (deno test)
│   │   ├── chat-with-analysis-agent/
│   │   └── _shared/
│   │       ├── agents/           # SDK shim (sdk.ts), PipelineContext, guardrails, tracing
│   │       ├── schemas/          # Schemas canónicos
│   │       └── utils/            # error.utils (reconoce InputGuardrail/OutputGuardrailTripwireTriggered), timeout, retry
│   ├── migrations/             # Migraciones SQL (orden cronológico)
│   └── tests/database/         # Tests SQL
├── benchmarks/pliegos/         # Benchmark funcional versionado de pliegos
├── e2e/                        # Tests Playwright
├── scripts/                    # Scripts de utilidad
├── .github/workflows/          # CI/CD (ci-cd.yml)
├── ARCHITECTURE.md
├── AGENTS.md                   # Reglas duras del SDK + how-to-add-Agent
├── SPEC.md
├── DEPLOYMENT.md
├── CLAUDE.md
└── package.json
```

---

## 5. Frontend

### Schemas de Validación (Zod)

Los schemas comparten mínimo 3.25.76 (alineado con el peerDependency de `@openai/agents@0.3.1`).

---

## 6. Backend — Edge Functions

### `analyze-with-agents` (función principal)

**Archivo**: `supabase/functions/analyze-with-agents/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml`. El gateway de Supabase rechaza requests sin JWT válido con 401 antes de invocar la función. El handler sólo resuelve `user` para rate-limit y ownership; el bloque de auth manual fue eliminado en M3.

**Flujo interno (Pipeline por Fases)**:

```
1. Validar CORS (orígenes permitidos)
2. Resolver user desde JWT (auth.getUser) + rate limiting (10 req/hora)
3. Validar payload (size + Zod)
4. Construir PipelineContext (vectorStoreId, fileNames, guideExcerpt, requestId, userId)
5. Fase A — Ingesta:
   - Subir PDF(s) a OpenAI Files API
   - Crear Vector Store
   - Persistir job en analysis_jobs
6. Fase B — Mapa Documental:
   - run(buildDocumentMapAgent(vsId), '', { context }) — outputGuardrail jsonShape(DocumentMapSchema)
7. Fase C — Extracción por Bloques:
   - 9 Agents (uno por bloque) ejecutados con runWithConcurrency(3)
   - run(buildBlockAgent(name, vsId), buildBlockInput(name, false), { context: {...ctx, blockName} })
   - Output guardrail jsonShape(BLOCK_SCHEMAS[name])
   - Retry: OutputGuardrailTripwireTriggered → 1 retry con reinforceJson:true → si falla, emptyBlockResult con warning
   - Custom template: customTemplateAgent con templateSanitizationGuardrail (input) + jsonShape(record) (output)
   - Feature flag USE_AGENTS_SDK=false reactiva el camino legacy (block-extraction.legacy.ts)
8. Fase D — Consolidación:
   - Merge de bloques + prelación PCAP > PPT > carátula (sin LLM)
9. Fase E — Validación:
   - Quality scoring + evidencias (sin LLM)
10. Emitir SSE: heartbeat → phase events → complete/error
11. Cleanup de resources marcado para TTL
```

**Tracing**: `setTraceProcessors([new SupabaseLogTraceProcessor()])` se registra una vez al cargar el módulo. Cada evento del SDK emite una línea `[trace]` JSON al stdout, leg ble con `npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'`. `requestId` (`crypto.randomUUID()`) se propaga a logs y a `PipelineContext` para correlacionar SSE ↔ logs ↔ spans.

**Utilidades compartidas** (`supabase/functions/_shared/`):

| Archivo | Función |
|---------|---------|
| `agents/sdk.ts` | Re-export nombrado explícito de `@openai/agents@0.3.1` (único import surface) |
| `agents/context.ts` | `PipelineContext` + `createPipelineContext()` |
| `agents/guardrails.ts` | `jsonShapeGuardrail<T>(schema, label)` + `templateSanitizationGuardrail` + `extractOutputText` + `parseJsonFromText` |
| `agents/tracing.ts` | `SupabaseLogTraceProcessor` |
| `config.ts` | Constantes centralizadas (modelo, timeouts, concurrencia) |
| `cors.ts` | Manejo de CORS (whitelist de orígenes) |
| `rate-limiter.ts` | Rate limiting: 10 req/hora por usuario |
| `services/job.service.ts` | Lógica de jobs de análisis |
| `schemas/canonical.ts` | Schema canónico con TrackedField (zod 3.25.76) |
| `schemas/blocks.ts` | Schemas parciales por bloque (zod 3.25.76) |
| `schemas/job.ts` | Schema del estado del job (zod 3.25.76) |
| `utils/error.utils.ts` | Mapeo centralizado de errores OpenAI + `Input/OutputGuardrailTripwireTriggered` del SDK |
| `utils/timeout.ts` | `callWithTimeout` con `Promise.race` (envuelve cada `run()` con 90s) |

### `chat-with-analysis-agent` (función conversacional)

Mantiene el patrón previo (verify_jwt manual). La migración a `verify_jwt=true` queda como trabajo futuro (ver `DEPLOYMENT.md` §5).

---

## 7. Base de Datos

Sin cambios de schema en la migración a `@openai/agents`. Las tablas siguen siendo: `licitaciones`, `extraction_templates`, `analysis_jobs`, `extraction_feedback`, `analysis_chat_sessions`, `analysis_chat_messages`. RLS aislada por `user_id` en todas.

---

## 8. Integración con IA

### Pipeline de Extracción (`@openai/agents` sobre Responses API)

| Parámetro | Valor |
|-----------|-------|
| Modelo | `gpt-4.1` (1M token context) |
| SDK | `@openai/agents@0.3.1` (`Agent`, `run`, `fileSearchTool`, `setTraceProcessors`, `OutputGuardrailTripwireTriggered`) |
| API subyacente | OpenAI Responses API |
| Capacidades | `fileSearchTool({ vectorStoreIds })` por fase |
| Prompts | `supabase/functions/analyze-with-agents/prompts/index.ts` (externalizados, copia 1:1 de la implementación previa) |
| Guardrails | `outputGuardrails: [jsonShapeGuardrail<T>(schema, label)]` valida JSON contra Zod; trips disparan retry con reinforceJson |
| Sanitización input | `inputGuardrails: [templateSanitizationGuardrail]` rechaza > 50 campos en plantillas custom |
| Guía de dominio | Inyectada en `PipelineContext.guideExcerpt` (no en Vector Store) |

### Restricciones duras del SDK

- `file_search` HostedTool y `outputType` con JSON schema son incompatibles en Responses API. Cada Agent mantiene `outputType: 'text'` (default) y la forma JSON se valida con `outputGuardrails`. Cada definición lleva un comentario `// DO NOT add outputType`.
- `fileSearchTool` enlaza `vectorStoreIds` en construcción; los Agents se construyen por request (overhead despreciable, evita caché mutable global).
- Toda importación del SDK pasa por `_shared/agents/sdk.ts` con re-exports nombrados explícitos. `export *` de un especificador `npm:` pierde nombres en Deno y rompe `deno check`. Los consumidores llevan `// @ts-nocheck` a nivel módulo (mismo patrón que `_shared/schemas/*.ts`).

### WorkflowState

Metadata de calidad generada por el pipeline:

```typescript
WorkflowState {
  quality: {
    overall: 'COMPLETO' | 'PARCIAL' | 'VACIO'
    bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>
    missingCriticalFields: string[]
    ambiguous_fields: string[]
    partial_reasons: AnalysisPartialReason[]
    section_diagnostics: Record<string, SectionDiagnostic>
  }
  warnings: Array<{ code: string, message: string, severity: string }>
  processTime: number  // milisegundos
}
```

### Decisiones de arquitectura IA

| Decisión | Alternativa rechazada | Razón |
|---------|----------------------|-------|
| `@openai/agents@0.3.1` con `outputType:'text'` + `jsonShapeGuardrail` | `outputType: jsonSchema(...)` | `file_search` + JSON schema son incompatibles en Responses API |
| Pin SDK a 0.3.1 (no 0.9.x) | Migrar a Zod 4 + SDK ústimo | Coste de migración de schemas (`z.preprocess`, `.default`) supera beneficio inmediato |
| Per-request agent construction | Caché módulo-global de Agents | `fileSearchTool` enlaza `vectorStoreIds` en construcción; caché sería incorrecto |
| `OutputGuardrailTripwireTriggered` retry con reinforceJson | retry-on-bad-JSON inline | Mismo efecto que el código previo, pero como guardrail declarativo en lugar de lógica imperativa |
| `templateSanitizationGuardrail` en `inputGuardrails` | Sanitización inline en el prompt builder | Rechaza > 50 campos antes del LLM call (ahorra coste); aparece como span dedicado en logs |
| `SupabaseLogTraceProcessor` vía `console.log` con prefijo `[trace]` | Default OpenAI tracing exporter | Edge Functions sin presupuesto de retry para sinks externos; `grep [trace]` reconstruye la ejecución entera |
| Feature flag `USE_AGENTS_SDK=false` | Migrar de golpe sin fallback | Permite rollback sin redeploy si la paridad se rompe en producción |

---

## 9. API Reference

Contrato HTTP y SSE sin cambios respecto a la implementación previa. La migración M1+M2+M3 preserva nombres y orden de eventos:

`heartbeat` → `phase_started/ingestion` → `phase_completed/ingestion` → `phase_started/document_map` → `phase_completed/document_map` → `phase_started/extraction` → `extraction_progress` ×9 → `phase_completed/extraction` → `phase_started/consolidation` → `phase_completed/consolidation` → `phase_started/validation` → `phase_completed/validation` → `complete`.

---

## 10. Variables de Entorno

### Backend (Supabase Secrets)

```bash
# Requerida
npx supabase secrets set OPENAI_API_KEY=sk-...

# Opcional (rollback Fase C al camino legacy sin redeploy)
npx supabase secrets set USE_AGENTS_SDK=false
npx supabase secrets unset USE_AGENTS_SDK   # vuelve al camino @openai/agents (default)
```

---

## 11. Autenticación y Seguridad

### Autenticación

- **`analyze-with-agents`**: `verify_jwt = true` en `supabase/config.toml`. El gateway rechaza requests sin JWT válido con 401 antes de invocar la función.
- **`chat-with-analysis-agent`**: validación manual interna (no migrado todavía; ver `DEPLOYMENT.md` §5).
- Sesión gestionada por `src/services/auth.service.ts`.

### Smoke test post-deploy

Tras desplegar `analyze-with-agents`, comprobar que `verify_jwt=true` está efectivo:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/analyze-with-agents" \
  -H 'Content-Type: application/json' \
  -d '{"pdfBase64":""}'
```

Debe responder `401` desde el gateway, sin invocar el código de la función. Si responde otro código, revertir.

---

## 12. Testing

### Edge Function unit tests (Deno)

```bash
# Tests de guardrails / parsers / context
deno test supabase/functions/analyze-with-agents/__tests__/agents.test.ts

# Tests del chat agent
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
```

### Frontend tests (Vitest)

Sin cambios. Mismos comandos y umbrales que antes.

### Functional benchmark

```bash
pnpm benchmark:pliegos  # protege paridad semántica del pipeline tras la migración
```

---

## 13. Build y Despliegue

### Despliegue de Edge Functions (post-M3)

```bash
# Prerrequisitos:
pnpm typecheck && pnpm test -- --run && pnpm benchmark:pliegos && pnpm test:e2e

# Deploy (NOTA: analyze-with-agents YA NO usa --no-verify-jwt después de M3):
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy chat-with-analysis-agent --no-verify-jwt

# Secrets:
npx supabase secrets set OPENAI_API_KEY=sk-...
# (opcional) rollback de Fase C al camino legacy:
npx supabase secrets set USE_AGENTS_SDK=false
```

---

## 14. Flujo de Trabajo del Equipo

Sin cambios respecto a la versión previa. Detalles en `AGENTS.md`.

---

## Apéndice — Decisiones Arquitecturales Clave (delta migración M1+M2+M3)

| Decisión | Elección | Alternativa | Razón |
|---------|----------|-------------|-------|
| SDK del pipeline | `@openai/agents@0.3.1` | `openai.responses.create()` directo | Tracing nativo, guardrails declarativos, prompts externalizados |
| Pin del SDK | 0.3.1 | 0.9.1 | 0.3.1 acepta zod 3.x; 0.3.2+ exige zod 4 (migración de schemas pendiente) |
| Pin de zod | 3.25.76 | 3.22.4 (anterior) | Mínimo aceptado por `@openai/agents@0.3.1` |
| Construcción de Agents | Per-request | Caché módulo-global | `fileSearchTool` enlaza `vectorStoreIds` en construcción |
| JWT de `analyze-with-agents` | `verify_jwt = true` (gateway) | Validación manual interna | Rechazo en gateway evita coste de cold-start; menos código en el handler |
| Rollback de Fase C | Feature flag `USE_AGENTS_SDK=false` | Sin fallback | Permite rollback sin redeploy si paridad se rompe en producción |
| Tracing | `SupabaseLogTraceProcessor` (stdout) | Exporter por defecto del SDK | Sin presupuesto de retry para sinks externos en Edge Functions |

---

*Documentación actualizada el 2026-05-06 tras la migración M1+M2+M3 a `@openai/agents`. Para actualizaciones, ver `CHANGELOG.md` y `ARCHITECTURE.md`.*

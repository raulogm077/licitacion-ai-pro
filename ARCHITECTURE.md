# ARCHITECTURE - Analista de Pliegos

## 1. Propósito

Este documento describe la arquitectura vigente de la aplicación y define qué cambios obligan a actualizarlo. Debe mantenerse alineado con el código real.

## 2. Regla de mantenimiento

Este documento es obligatorio actualizarlo cuando cambie cualquiera de estos puntos:

- flujo principal de análisis
- `JobService`
- contrato SSE
- estructura de entrada o salida del análisis
- arquitectura de plantillas
- soporte multi-documento
- responsabilidades técnicas relevantes de los agentes

## 3. Vista general

La aplicación analiza documentos PDF de licitaciones usando una Edge Function con **OpenAI Responses API** organizada en un **pipeline de 5 fases**, con streaming de progreso al frontend mediante **Server-Sent Events (SSE)**. Las fases B y C se invocan a través del SDK `@openai/agents@0.3.1` (Agent + run() + guardrails declarativos), que se apoya internamente en Responses API. Además, incorpora una capa conversacional productiva con **OpenAI Agents SDK** sobre análisis ya persistidos, sin alterar el flujo batch vigente.

Flujo actual:

```text
Frontend
  └─ JobService.analyzeWithAgents()
       └─ Supabase Edge Function: analyze-with-agents
            ├─ Fase A: Ingesta (Files API + Vector Store)
            ├─ Fase B: Mapa Documental (Agent + run() + file_search)
            ├─ Fase C: Extracción por Bloques (~9 Agents + run(), concurrencia 2)
            ├─ Fase D: Consolidación (merge + prelación documental)
            └─ Fase E: Validación Final (quality scoring)
                 └─ SSE → Frontend (progreso por fase + reintentos + resultado)
```

## 4. Componentes principales

### 4.1. Frontend

Responsabilidades principales:

- subida de documentos
- interacción del usuario con el flujo de análisis
- visualización del progreso en tiempo real
- render del resultado estructurado
- visualización de advertencias de calidad (QualityService)
- gestión de historial de análisis
- futura gestión de plantillas y multi-documento
- consumo del contrato compartido `src/shared/analysis-contract.ts` para eventos SSE y calidad estructurada

Superficies típicas:

- `src/components/**`
- `src/features/**`
- `src/pages/**`
- `src/stores/**`
- `src/services/**`

### 4.2. JobService

`JobService` actúa como capa de orquestación frontend para el análisis.

Responsabilidades:

- preparar la petición al backend
- invocar `analyze-with-agents`
- consumir eventos SSE
- notificar progreso a la UI
- transformar o encaminar el resultado al flujo de render
- preservar el contrato wire compartido (`AnalysisStreamEvent`) y mostrar `retry_scheduled` o progreso de indexación sin aparentar congelación

Cualquier cambio relevante en este servicio obliga a revisar este documento.

### 4.3. Edge Function `analyze-with-agents`

Es el núcleo del pipeline de IA. La autenticación está delegada al gateway de Supabase mediante `verify_jwt = true` en `supabase/config.toml`. Las peticiones sin un JWT válido se rechazan con 401 antes de invocar la función; dentro del handler sólo resolvemos el `user` para rate-limiting y ownership.

Fases B y C ya no llaman a `openai.responses.create()` directamente: invocan `run(agent, input, { context })` del SDK `@openai/agents@0.3.1`. La forma JSON se valida con `outputGuardrails` (Zod) y los errores de guardrail se mapean a mensajes de usuario en `_shared/utils/error.utils.ts`. Detalle operativo en `AGENTS.md`. Tras confirmar paridad en producción se eliminó `phases/block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK`; el camino SDK queda como único y la única vía de revertir la migración es `git revert` del PR responsable.

Responsabilidades:

- recibir la solicitud de análisis (autenticación garantizada por el gateway)
- ejecutar pipeline de 5 fases:
    - Fases B y C usan **`@openai/agents`** (`Agent` + `run()` + `fileSearchTool` + `outputGuardrails`)
    - Fases A, D, E usan código imperativo (sin LLM)
- la "Guía de lectura de pliegos" se inyecta vía `PipelineContext.guideExcerpt` (no en Vector Store)
- emitir eventos SSE por fase (phase_started, phase_completed, heartbeat, complete) sin cambios respecto a la implementación previa
- emitir `phase_progress` estructurado durante la indexación del Vector Store (contadores + elapsed)
- propagar `requestId` (`crypto.randomUUID()`) en logs y trace spans
- devolver resultado en formato canónico rico con evidencias por campo
- persistir estado del job en `analysis_jobs` para recovery de fallos parciales

#### Tracing

`SupabaseLogTraceProcessor` (en `_shared/agents/tracing.ts`) se registra una sola vez al cargar el módulo con `setTraceProcessors([...])`. Emite una línea `[trace]` con JSON por evento (`trace_start|trace_end|span_start|span_end`), legible con `npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'`.

#### Fases del pipeline:

| Fase                      | Descripción                                                               | Llamadas API  | Implementación                                                                      |
| ------------------------- | ------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| A: Ingesta                | Subir archivos a OpenAI Files API, crear Vector Store                     | 0 (solo REST) | imperativa                                                                          |
| B: Mapa Documental        | Identificar documentos (PCAP, PPT, anexos)                                | 1             | `Agent` + `run()` + `file_search`                                                   |
| C: Extracción por Bloques | Extraer datos por sección (3 bloques en paralelo + retries agresivos)     | ~9            | `buildBlockAgent()` + `run()` por bloque + `OutputGuardrailTripwireTriggered` retry |
| D: Consolidación          | Unificar bloques, resolver conflictos, prelación documental               | 0 (local)     | imperativa                                                                          |
| E: Validación             | Quality scoring, verificar campos críticos, evidencias, `partial_reasons` | 1             | imperativa (sin LLM, no se beneficia del SDK)                                       |

**Optimizaciones del pipeline:**

- Fase C usa `runWithConcurrency(tasks, BLOCK_CONCURRENCY=2)` para ejecutar bloques en paralelo (bajado de 3 el 2026-07-12: tres bloques simultáneos con file_search disparaban cascadas de 429 en cuentas con TPM ajustado)
- Cada llamada API tiene timeout individual de 90s (`callWithTimeout`)
- Los errores `429` y transitorios se reintentan con backoff real (`retryWithBackoff`, `BLOCK_MAX_RETRIES=1`, delay con tope `BLOCK_RETRY_MAX_DELAY_MS=30s`) y espera visible por SSE; los timeouts NO se reintentan y el guardrail JSON conserva su reintento de refuerzo
- Constantes centralizadas en `_shared/config.ts` (modelo, timeouts, concurrencia)
- Errores de OpenAI mapeados a mensajes legibles (`mapOpenAIError`), incluyendo `Input/OutputGuardrailTripwireTriggered`

### 4.4. Edge Function `chat-with-analysis-agent`

`chat-with-analysis-agent` es la capa conversacional productiva sobre análisis ya persistidos. Se apoya en OpenAI Agents SDK, pero permanece aislada del pipeline batch principal.

Responsabilidades:

- delegar la verificación del JWT al gateway (mismo patrón que `analyze-with-agents`, `verify_jwt = true`)
- cargar un análisis existente por `analysisHash`
- recuperar y persistir historial conversacional por sesión
- ejecutar un manager agent con especialistas vía `agent.asTool()`, con el modelo en la constante `CHAT_MODEL` (`_shared/config.ts`, no hardcodeado) e importando el SDK solo vía `_shared/agents/sdk.ts`
- aplicar rate limiting por usuario (`CHAT_MAX_REQUESTS_PER_HOUR=60`, `checkRateLimit` con clave namespaced `chat:`) y rechazar bodies mayores que `MAX_CHAT_PAYLOAD_BYTES=64KB`
- devolver una respuesta estructurada con citas y herramientas utilizadas
- ser consumida por el dashboard solo cuando existe un análisis persistido seleccionable

Restricciones:

- no relee PDFs ni recrea Vector Stores
- no modifica `analysis_jobs`
- no sustituye el flujo SSE principal
- opera solo sobre resultados ya guardados en `licitaciones`

Persistencia conversacional:

- `analysis_chat_sessions` guarda la sesión por `user_id + analysis_hash`
- `analysis_chat_messages` guarda el historial serializado
- la función reconstruye el input conversacional del SDK a partir de ese historial
- el frontend conserva `sessionId` y mensajes renderizados en `localStorage` bajo la clave `analysis-chat:<hash>` para continuidad de UX sin exponer tablas internas

Integración frontend:

- `Dashboard.tsx` añade la sección `chat` cuando `useLicitacionStore().hash` está disponible
- `AnalysisChatPanel` usa `AnalysisChatService` para invocar `chat-with-analysis-agent`
- la UI no accede directamente a `analysis_chat_messages`; todo el intercambio conversacional sigue entrando por la Edge Function

### 4.5. Persistencia

Supabase se usa para:

- autenticación
- datos de historial con búsqueda full-text (FTS español + ILIKE fallback) y eliminación
- sesiones de chat conversacional (`analysis_chat_sessions` y `analysis_chat_messages`)
- plantillas de extracción (`extraction_templates`): permite definir estructuras de extracción configurables por usuario autenticado. La tabla cuenta con políticas RLS (`Row Level Security`) para garantizar que cada usuario gestione exclusivamente sus plantillas, basadas en su `user_id`.
- otras entidades de soporte del producto

#### Full-Text Search

La tabla `licitaciones` incluye una columna `search_vector` (`tsvector`, generada, `stored`) con pesos:

- **A**: título
- **B**: órgano de contratación, cliente
- **C**: nombre de archivo, tipo de contrato, procedimiento

La función RPC `search_licitaciones(search_query text)` combina FTS (`websearch_to_tsquery('spanish', ...)`) con fallback ILIKE para coincidencias parciales (códigos CPV, términos cortos). Índice GIN para búsqueda rápida. Desde 2026-07-12 es `SECURITY INVOKER` (aplica RLS) con un único argumento y filtro explícito `auth.uid()`; ya no acepta un `user_id_param` controlable por el llamante (ver §8.6).

## 5. Contrato SSE

El frontend depende de un contrato SSE estable para mostrar progreso en tiempo real.

La fuente de verdad del wire contract vive en:

- `src/shared/analysis-contract.ts` para tipos compartidos FE/BE (`AnalysisStreamEvent`, `TrackedFieldWire`, `AnalysisPartialReason`)
- `supabase/functions/_shared/schemas/canonical.ts` para el schema canónico validado del resultado
- `workflow.quality.section_diagnostics` como diagnóstico estructurado por sección (`present`, `missing_in_uploaded_docs`, `schema_recovered`, `extraction_gap`)

Eventos esperados, a nivel lógico:

- `heartbeat`
- `phase_started` — indica inicio de una fase (A, B, C, D, E)
- `phase_completed` — indica fin de una fase con resultado parcial
- `phase_progress` — progreso estructurado de una fase; en ingesta incluye `completedFiles`, `inProgressFiles`, `failedFiles`, `elapsedMs`
- `retry_scheduled` — indica que un bloque espera antes de un nuevo intento, con `waitMs` visible
- `agent_message` — progreso dentro de una fase (legacy compat)
- `complete` — resultado final con `{result, workflow}`
- `error`

Reglas:

- no romper nombres ni estructura sin coordinar backend y frontend
- cualquier cambio de contrato exige actualización de tests y de esta arquitectura
- `workflow.quality.partial_reasons` es contrato backend→frontend; la UI no debe inferir parcialidad crítica si backend ya la emitió
- la reconciliación de presupuesto y plazo ocurre en backend durante consolidación; el frontend consume el resultado canónico ya reconciliado y no inventa backfills locales
- QA debe validar el flujo si una tarea toca SSE o el proceso principal de análisis

## 6. Plantillas dinámicas de extracción

La iteración activa introduce una arquitectura de plantillas configurable, respaldada por la tabla `extraction_templates`. Dicha tabla está protegida mediante Row Level Security (RLS), garantizando que los usuarios autenticados únicamente puedan gestionar (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) las plantillas que han creado.

En frontend se gestionan en la ruta `/templates` con operaciones de listar, crear, editar, eliminar y duplicar.

El modelo consta de:

- `id` (UUID)
- `user_id` (vinculado a `auth.users`)
- `name` y `description`
- `schema` (JSONB): listado de campos con su nombre, tipo, descripción y obligatoriedad.
- `created_at` y `updated_at`

Flujo objetivo:

```text
Usuario selecciona plantilla opcional
  └─ Frontend envía `templateId`
       └─ JobService lo incluye en la petición
            └─ analyze-with-agents consulta `extraction_templates`
                 ├─ si hay plantilla válida: construye extracción dinámica
                 └─ si no: fallback al esquema estático actual
```

Impacto técnico:

- frontend: selector de plantilla y gestión CRUD
- backend: persistencia de plantillas con modelo RLS
- IA: construcción dinámica de esquema; `customTemplateAgent` aplica `templateSanitizationGuardrail` (input) que rechaza > 50 campos y limpia metacaracteres
- documentación: `SPEC.md` y este archivo

## 7. Soporte multi-documento

El soporte multi-documento está disponible a nivel de back-end a través de `analyze-with-agents` y orquestación con `JobService`, listo para integrarse en la UI.

Flujo objetivo:

```text
Usuario selecciona varios documentos
  └─ Frontend valida y lista archivos (hasta 5, max 30MB)
       └─ JobService envía entrada multiarchivo a través del parámetro opcional `files`
            └─ analyze-with-agents ingiere de manera secuencial los documentos y construye el Vector Store
                 └─ resultado único estructurado para el expediente completo
```

Riesgos principales mitigados por la estrategia actual:

- crecimiento de memoria en Edge Functions (resuelto mediante carga secuencial de `files` usando `for...of`)
- crecimiento del contexto (OpenAI Vector Stores es responsable de la partición/chunks y recuperación mediante embeddings)
- comportamiento ambiguo entre documentos (Responses API con file_search permite lectura priorizada según prompts de cada fase)
- límites de Rate Limiting en API de OpenAI (resuelto mediante Exponential Backoff en el polling del Vector Store)

## 8. Decisiones técnicas documentadas

### 8.1 Base64 vs FormData para envío de PDFs (Decisión: mantener base64)

**Contexto:** Los PDFs se envían como base64 dentro de un JSON body, lo que implica ~33% de overhead en tamaño de red.

**Alternativa evaluada:** Enviar PDFs como `FormData` con `multipart/form-data`.

**Decisión: NO migrar.** Razones:

- Supabase Edge Functions (Deno) tienen soporte limitado para streaming multipart con SSE.
- La evaluación de OpenAI Agents SDK en Edge Functions debe mantenerse fuera del pipeline batch hasta confirmar compatibilidad real de runtime y despliegue.
- El contrato actual JSON es compatible con la validación Zod del request body.
- El cuello de botella real de latencia es OpenAI Files API + Vector Store indexing (~20-60s), no la transferencia.
- La validación de payload size (50MB máx.) ya limita el riesgo de abuso.
- La complejidad de migración (frontend + backend + tests) no justifica el beneficio marginal.

**Fecha:** 2026-03-22

### 8.2 Migración de Agents SDK a Responses API (Implementado)

**Contexto:** La aplicación usaba OpenAI Agents SDK con un único run monolítico que hacía todo en una llamada.

**Decisión:** Migrar a OpenAI Responses API (`openai.responses.create()`) con pipeline de 5 fases.

### 8.4. Capa conversacional con Agents SDK (Implementado)

**Contexto:** Se quería aprovechar OpenAI Agents SDK sin reescribir ni desestabilizar el pipeline principal.

**Decisión:** Consolidar la capa conversacional productiva en `chat-with-analysis-agent` y retirar del repositorio el spike técnico una vez validado el runtime, evitando mantener dos superficies agentic con distinto nivel de madurez.

**Restricción técnica:** `file_search` y `text.format: json_schema` (structured outputs) NO pueden usarse juntos en Responses API. Se instruye JSON estricto en el prompt y se valida con Zod server-side.

**Beneficios:**

- Extracción por bloques permite evidencias por campo
- Resultado parcial persistido en DB si una fase falla
- Vector Store persiste para reintentos (cleanup por TTL)
- Schema canónico rico con TrackedField (value + status + evidence) para campos críticos

**Fecha:** 2026-04-18

### 8.3 CORS restrictivo (Implementado)

**Contexto:** CORS wildcard (`*`) permitía cualquier origen invocar la Edge Function.

**Decisión:** Restringir a orígenes autorizados (`licitacion-ai-pro.vercel.app`, `localhost:5173`, `localhost:3000`). Se usa `Vary: Origin` para compatibilidad con caches.

**Fecha:** 2026-03-22

### 8.5 Migración del pipeline de análisis a `@openai/agents` (Implementado 2026-05)

**Contexto:** Las fases B y C llamaban a `openai.responses.create()` directamente con prompts hardcodeados, retry-on-bad-JSON inline y sin tracing estructurado.

**Decisión:** Migrar Fase B (DocumentMap) y Fase C (BlockExtraction + custom template) al SDK `@openai/agents@0.3.1` con:

- Prompts externalizados a `analyze-with-agents/prompts/index.ts` (copia byte-a-byte para preservar paridad).
- `inputGuardrails` y `outputGuardrails` declarativos (`templateSanitizationGuardrail`, `jsonShapeGuardrail<T>`).
- `SupabaseLogTraceProcessor` registrado vía `setTraceProcessors([...])` que emite `[trace]` JSON por evento del SDK.
- `verify_jwt = true` en `supabase/config.toml` para `analyze-with-agents` (delegar validación al gateway, eliminar bloque de auth manual).

Tras confirmar paridad de salida en producción (PRs #275 y #276), el 2026-05-09 se eliminan `phases/block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK`. Si hay que revertir la migración, el path correcto es `git revert` del PR responsable, no reanimar el archivo legacy ni reintroducir un flag inline.

**Restricciones duras:** `file_search` HostedTool y `outputType` con JSON schema son incompatibles en Responses API; cada Agent mantiene `outputType: 'text'` y la forma JSON se valida con `outputGuardrails`. Comentarios `// DO NOT add outputType` en cada definición. Detalle operativo en `AGENTS.md`.

**SDK version:** 0.3.1 — última compatible con `zod ^3.25.40 \|\| ^4.0`. Subir a 0.3.2+ requiere migrar todos los `z.preprocess`/`.default` de los schemas a Zod 4 (deferido).

**Fecha:** 2026-05-06 (migración) + 2026-05-09 (eliminación del legacy fallback)

### 8.6 Revisión integral: seguridad, robustez del pipeline y limpieza compartida (Implementado 2026-07-12)

**Contexto:** auditoría transversal (seguridad, bugs, accesibilidad, deuda) posterior a §10.6 de `SPEC.md`.

**Decisiones aplicadas con impacto arquitectónico:**

- **IDOR en `search_licitaciones`**: migración `20260712000000_fix_search_licitaciones_idor.sql`. La RPC pasa de `SECURITY DEFINER` con `user_id_param` controlable a `search_licitaciones(search_query text)` de un argumento, `SECURITY INVOKER` (aplica RLS de `licitaciones`), con filtro `auth.uid()` y `search_path` fijo. Se fija también el `search_path` de las funciones trigger `update_updated_at_column` y `update_extraction_templates_updated_at`. El contrato del frontend (`db.service`) no cambia.
- **Superficie única del SDK en el chat**: `chat-with-analysis-agent` importa `@openai/agents` solo vía `_shared/agents/sdk.ts` (0.3.1), que ahora re-exporta también `tool`, `user` y `AgentInputItem`. El modelo del chat vive en `CHAT_MODEL` (`_shared/config.ts`).
- **Límites del chat**: rate limiting por usuario (`CHAT_MAX_REQUESTS_PER_HOUR=60`, `checkRateLimit` parametrizable con clave namespaced `chat:`/`analyze:`) y tope de payload real (`MAX_CHAT_PAYLOAD_BYTES=64KB`). `analyze-with-agents` valida la longitud real del body (no el header `content-length`), cerrando el bypass del límite de payload.
- **Tracing seguro**: `SupabaseLogTraceProcessor` redacta `spanData` con `sanitizeSpanData` (allowlist de claves operativas, truncado de strings, `redacted_keys`) para no filtrar contenido del pliego a los logs.
- **Backoff real en Fase C**: se cablea `retryWithBackoff` con `BLOCK_MAX_RETRIES=1` y delay con tope `BLOCK_RETRY_MAX_DELAY_MS=30s` (nueva opción `maxDelayMs` en `_shared/utils/retry.ts`). Los timeouts siguen sin reintentarse; el guardrail JSON conserva su reintento de refuerzo. Hace realidad las "retries visibles" ya documentadas.
- **Utilidades compartidas**: `runWithConcurrency` se centraliza en `_shared/utils/concurrency.ts` (antes duplicada en ingestion y block-extraction); `buildInitialVersion` se extrae a `src/lib/envelope.ts` (compartida por `db.service` y `licitacion.store`); `cn()` se unifica en `src/lib/utils.ts`.
- **Cleanup ordenado**: `analyze-with-agents/cleanup.ts` borra los recursos en OpenAI antes de anular las referencias en DB, evitando vector stores/files huérfanos.

**Limitaciones conocidas (deuda consciente):** eslint 9 + flat config, i18n multi-locale completo, majors diferidos (React 19 / Tailwind 4 / zod 4, este último anclado por el peer del SDK), refactor de `HistoryView`, decisión sobre el service-registry y el modelo de job asíncrono para documentos de 300+ páginas. Detalle en `SPEC.md` §10.7.

**Fecha:** 2026-07-12

### 8.7 Rediseño UX «Iris» — frontend del pipeline por fases (Implementado 2026-07-12)

**Contexto:** rediseño integral de UX (sistema «Iris»). El contrato SSE y las Edge Functions **no cambian**; el frontend explota mejor los eventos ya existentes.

**Decisiones con impacto en la capa de análisis del frontend:**

- **Propagación de fase al store**: `ai.service.analyzePdfContent` añade un 4º argumento opcional `phase?: AnalysisPhase` a su callback `onProgress`, derivado de los eventos SSE (`phase_started`/`phase_completed`). `analysis.store` lo persiste en `currentPhase` (antes siempre `null`) y `AnalyzingStep` lo renderiza como checklist de las 5 fases (`ANALYSIS_PHASES` del contrato compartido) con barra de progreso real.
- **Celebración acotada**: el confetti de finalización se dispara solo en la transición `ANALYZING → COMPLETED` observada en `HomePage` (no al cargar desde historial), con import dinámico de `canvas-confetti` y guard de `prefers-reduced-motion`.
- **Búsqueda unificada**: se eliminó la página `/search` (`SearchPage` + `SearchPanel`); el Historial es la única superficie de búsqueda (FTS + filtros, ahora con estado y tags). `db.advancedSearch` y `applyClientFilters` ya soportaban ambos filtros; no hubo cambio de contrato.
- **UI libs solo-cliente**: `motion` (LazyMotion), `sonner`, `recharts` (lazy), `canvas-confetti` y fuentes `@fontsource-variable` viven únicamente en el bundle de Vite; ninguna Edge Function las importa y `deno check` no las ve.

**Fecha:** 2026-07-12

### 8.8 Hotfix: contrato RunContext en instrucciones dinámicas (Implementado 2026-07-12)

**Contexto:** desde la migración al SDK (§8.5), **todos** los análisis en producción fallaban en Fase B a los ~60 ms con `Cannot read properties of undefined (reading 'fileNames')` (visible en `analysis_jobs.error`; ningún job `completed` posterior al 2026-04-28).

**Causa raíz:** el SDK invoca `instructions(runContext, agent)` donde `runContext.context` **ya es** el `PipelineContext`. Los tres agentes destructuraban `({ context })` (correcto) y luego leían `.context` otra vez (undefined) antes de acceder a `fileNames`/`documentMap`/`guideExcerpt`. El `@ts-nocheck` de los ficheros de agentes ocultó el error de tipos, y los tests de guardrails no pasaban por `run()`, así que CI quedaba verde.

**Fix y blindaje:**

- Eliminado el segundo salto `.context` en `document-map.agent.ts`, `block-extractor.agent.ts` y `custom-template.agent.ts`.
- `_shared/agents/sdk.ts` re-exporta `RunContext` y `agents.test.ts` añade 4 tests de regresión que resuelven las instrucciones por la misma vía que el SDK (`agent.getSystemPrompt(new RunContext(ctx))`): un salto de contexto mal hecho vuelve a romper CI, no producción.
- Verificado contra el paquete real `@openai/agents-core@0.3.1`: el patrón antiguo lanza exactamente el error de producción; el corregido devuelve el prompt con los nombres de archivo.

**Fecha:** 2026-07-12

### 8.9 Hotfix 2: `fileSearchTool` posicional + fin del `@ts-nocheck` en agentes (Implementado 2026-07-12)

**Contexto:** tras corregir §8.8, el análisis pasó de morir en las instrucciones a morir en la llamada a OpenAI: `400 invalid_type — Invalid type for 'tools[0].vector_store_ids[0]': expected a string, but got an object`.

**Causa raíz (misma familia que §8.8):** `fileSearchTool(vectorStoreIds, options?)` recibe los ids como **primer argumento posicional**; los agentes lo llamaban estilo-opciones (`fileSearchTool({ vectorStoreIds: [id] })`), así que el SDK serializaba `vector_store_ids: [{...}]`. Verificado contra `@openai/agents-openai@0.3.1` real: el patrón antiguo reproduce el 400 byte a byte.

**Fix y blindaje:**

- Los 3 agentes llaman `fileSearchTool([vectorStoreId])`; 3 tests de regresión fijan la forma wire (`tool.providerData.vector_store_ids === ['vs_test']`, strings planos).
- **Eliminado el `@ts-nocheck` de fichero completo** en los 3 agentes (ocultó los dos bugs de esta familia). Quedan 4 supresiones quirúrgicas `@ts-expect-error` documentadas, solo en las líneas de guardrails: el tipo de config del SDK 0.3.x pide la forma _definida_ del guardrail mientras su runtime normaliza vía `define*Guardrail({ name, execute })` (comprobado en `run.js` L753) — nuestra forma `{ name, execute }` es la correcta en runtime. Cualquier otro mal uso del SDK en los agentes es ahora un error de compilación de `deno check`, no un incidente de producción.

**Fecha:** 2026-07-12

### 8.10 Diagnóstico veraz de ingesta, resiliencia 429 y tracking de jobs fiable (Implementado 2026-07-12)

**Contexto:** el primer análisis completo tras los hotfixes §8.8/§8.9 devolvió el aviso «PDF con señal baja / OCR pobre» para un PDF con capa de texto digital perfecta, mientras la cuenta sufría 429 de OpenAI. Tres causas distintas:

1. **Diagnóstico falso**: cualquier error en el polling del vector store (incl. un 429 del endpoint de estado) se marcaba `indexingTimedOut` → `ocr_or_indexing_low_signal` → la UI culpaba al PDF. Ahora el polling reintenta transitorios (`retryWithBackoff` + `isRetryableError`); si aún falla, `IngestionDiagnostics.pollFailed=true` deja constancia de que los conteos son **desconocidos** y `derivePartialReasons` no acusa al documento sin conteos reales. `indexingTimedOut` solo se marca si de verdad quedan ficheros `in_progress`.
2. **Prioridad del consejo**: `buildGuidance` (frontend) prioriza ahora la composición documental (falta PCAP/PPT) sobre el aviso de OCR cuando ambos aparecen — para un memo, el paso útil es completar el expediente, no reescanear.
3. **Jobs colgados en `processing`**: las escrituras `updatePhase('extraction')`/`completeJob`/`failJob` se disparaban sin `await` justo antes de cerrar el stream SSE (consolidación y validación son síncronas), y el runtime mata los fetch pendientes al terminar la request → el job quedaba en `document_map` para siempre. Ahora se esperan (~100 ms) y `JobService` comprueba el `error` de PostgREST en cada update (antes se ignoraba y el `.catch` nunca saltaba).
4. **`BLOCK_CONCURRENCY` 3→2**: con file_search cada bloque consume mucho TPM; tres simultáneos provocaban cascadas de 429. El coste es ~20-30 s más de análisis.

**Fecha:** 2026-07-12

## 9. Responsabilidades técnicas por rol

### PM

- backlog y `SPEC.md`
- no programa ni despliega

### Tech Lead

- UI, servicios tradicionales, tests y cambios no IA
- actualiza arquitectura si toca flujo, UI principal o `JobService`

### AI Engineer

- prompts, esquemas, transformación y `analyze-with-agents`
- actualiza arquitectura si cambia contrato o pipeline real

### QA

- valida, actualiza estado del backlog y despliega si corresponde
- no crea features nuevas

## 10. Reglas de calidad técnica

- no trabajar sobre `main`
- una sola tarea de desarrollo por noche
- no mezclar plantillas y multi-documento en la misma noche salvo ticket explícito
- no mover una tarea a QA sin tests y sin documentación mínima actualizada

## 11. Fuentes vigentes

Documentos operativos vigentes:

- `README.md`
- `SPEC.md`
- `BACKLOG.md`
- `AGENTS.md`
- `DEPLOYMENT.md`
- `TECHNICAL_DOCS.md`
- `CHANGELOG.md`

No existen documentos históricos no operativos en el repo. El historial de migraciones cerradas se conserva como entradas fechadas dentro de `SPEC.md` (§2.x, §10.x), `ARCHITECTURE.md` (§8.x) y `CHANGELOG.md`.

## Agent Skill Modular Pattern (Infraestructura AI)

Para asegurar que la integración de _skills_ en Jules siga principios de arquitectura limpia y evite la contaminación del proyecto raíz, el sistema adopta un modelo estricto de carpetas:

1. **Directorio `.agents`:** Contiene configuraciones, plugins o recursos centrales que Jules u otros agentes core requieran a nivel de proyecto base, actuando como espacio aislado oculto.
2. **Directorio `.jules`:** Espacio estricto de configuración exclusiva para la instancia actual de Jules, donde residen referencias propias, reglas y personalizaciones.
3. **Directorio `skills`:** Todas las habilidades extendidas que actúan como plugins independientes quedan centralizadas aquí.

> _Importante:_ El repositorio no admite la proliferación de carpetas punto (`.`) por cada modelo/herramienta (ej. `.claude`, `.roo`, `.qoder`) para evitar desorden arquitectónico. Todo _skill_ se inyecta o referencia bajo el entorno modularizado provisto por Jules.

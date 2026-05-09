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
            ├─ Fase C: Extracción por Bloques (~9 Agents + run(), concurrencia 3)
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

| Fase | Descripción | Llamadas API | Implementación |
|------|-------------|--------------|----------------|
| A: Ingesta | Subir archivos a OpenAI Files API, crear Vector Store | 0 (solo REST) | imperativa |
| B: Mapa Documental | Identificar documentos (PCAP, PPT, anexos) | 1 | `Agent` + `run()` + `file_search` |
| C: Extracción por Bloques | Extraer datos por sección (3 bloques en paralelo + retries agresivos) | ~9 | `buildBlockAgent()` + `run()` por bloque + `OutputGuardrailTripwireTriggered` retry |
| D: Consolidación | Unificar bloques, resolver conflictos, prelación documental | 0 (local) | imperativa |
| E: Validación | Quality scoring, verificar campos críticos, evidencias, `partial_reasons` | 1 | imperativa (sin LLM, no se beneficia del SDK) |

**Optimizaciones del pipeline:**
- Fase C usa `runWithConcurrency(tasks, 3)` para ejecutar bloques en paralelo (~3x speedup)
- Cada llamada API tiene timeout individual de 90s (`callWithTimeout`)
- Los errores `429` y transitorios se reintentan con backoff agresivo y espera visible
- Constantes centralizadas en `_shared/config.ts` (modelo, timeouts, concurrencia)
- Errores de OpenAI mapeados a mensajes legibles (`mapOpenAIError`), incluyendo `Input/OutputGuardrailTripwireTriggered`

### 4.4. Edge Function `chat-with-analysis-agent`

`chat-with-analysis-agent` es la capa conversacional productiva sobre análisis ya persistidos. Se apoya en OpenAI Agents SDK, pero permanece aislada del pipeline batch principal.

Responsabilidades:

- delegar la verificación del JWT al gateway (mismo patrón que `analyze-with-agents`, `verify_jwt = true`)
- cargar un análisis existente por `analysisHash`
- recuperar y persistir historial conversacional por sesión
- ejecutar un manager agent con especialistas vía `agent.asTool()`
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

La función RPC `search_licitaciones` combina FTS (`websearch_to_tsquery('spanish', ...)`) con fallback ILIKE para coincidencias parciales (códigos CPV, términos cortos). Índice GIN para búsqueda rápida.

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
Para asegurar que la integración de *skills* en Jules siga principios de arquitectura limpia y evite la contaminación del proyecto raíz, el sistema adopta un modelo estricto de carpetas:

1. **Directorio `.agents`:** Contiene configuraciones, plugins o recursos centrales que Jules u otros agentes core requieran a nivel de proyecto base, actuando como espacio aislado oculto.
2. **Directorio `.jules`:** Espacio estricto de configuración exclusiva para la instancia actual de Jules, donde residen referencias propias, reglas y personalizaciones.
3. **Directorio `skills`:** Todas las habilidades extendidas que actúan como plugins independientes quedan centralizadas aquí.

> *Importante:* El repositorio no admite la proliferación de carpetas punto (`.`) por cada modelo/herramienta (ej. `.claude`, `.roo`, `.qoder`) para evitar desorden arquitectónico. Todo *skill* se inyecta o referencia bajo el entorno modularizado provisto por Jules.

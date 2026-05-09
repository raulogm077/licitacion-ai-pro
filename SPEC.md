# SPEC - Analista de Pliegos

## 1. Visión del producto

El producto debe permitir analizar pliegos de licitación de forma rápida, precisa y navegable, siguiendo la **Guía de lectura de pliegos** como referencia principal de negocio. La aplicación no sustituye la revisión humana; la acelera y la estructura.

## 2. Estado actual confirmado

Estado funcional confirmado a fecha de esta especificación:

- el análisis principal usa **OpenAI Responses API** con pipeline de 5 fases
- las fases B (DocumentMap) y C (BlockExtraction + custom template) se ejecutan a través del SDK `@openai/agents@0.3.1` (Agent + run() + guardrails declarativos), preservando el contrato SSE
- el flujo de ejecución usa **streaming por SSE**
- existe historial de licitaciones y análisis ya implementado
- el sistema soporta análisis de PDF principal y múltiples documentos (backend/AI)
- el sistema soporta plantillas dinámicas de extracción en todos los niveles
- la arquitectura legacy de colas/polling quedó fuera del flujo operativo principal
- campos críticos (titulo, presupuesto, moneda, plazo, cpv, organo) usan **TrackedField** con status y evidencias
- el schema canónico vive en `supabase/functions/_shared/schemas/canonical.ts`
- la cobertura actual de tests está en progreso (~66% en statements), el objetivo de la iteración D es 80%.
- no existen errores críticos globales en la ejecución de pruebas con vitest.
- los directorios `src/agents/` y `src/llm/` han sido eliminados (código legacy)
- el flujo de release productivo debe pasar por PR en verde y merge a `main`
- el runtime de análisis normaliza `cpv` a `string[]` y expone esperas de reintento al usuario
- el camino soportado con mayor fiabilidad para producto es un único PDF completo del expediente
- frontend y backend comparten contrato wire del análisis en `src/shared/analysis-contract.ts`
- `workflow.quality` incorpora `partial_reasons` estructurados y el frontend debe priorizarlos frente a heurísticas locales
- `workflow.quality.section_diagnostics` debe explicar por sección si el dato está presente, falta en los documentos subidos o se recuperó tras degradación de schema/extracción
- el release de superficies de análisis queda protegido por `pnpm benchmark:pliegos`
- el backend reconcilia `datosGenerales.presupuesto` y `datosGenerales.plazoEjecucionMeses` desde bloques fiables (`economico`, `duracionYProrrogas`) solo cuando el dato general venía ausente
- `criteriosAdjudicacion` no puede vaciarse por completo por un `subcriterio` mal tipado si aún existe señal útil recuperable
- ambas Edge Functions (`analyze-with-agents` y `chat-with-analysis-agent`) usan `verify_jwt = true` y rechazan en el gateway las peticiones sin JWT con 401
- el camino @openai/agents para Fase C es único; el antiguo fallback `block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` se eliminaron tras confirmar paridad en producción

## 2.1. Endurecimiento operativo aplicado (2026-04-19)

Decisiones vigentes:

- `pnpm verify:integrity` pasa a ser validación obligatoria de deriva de migraciones, workflows, hooks y sincronía documental mínima
- `pnpm verify:release` pasa a ser el cierre obligatorio antes de push/PR para sesiones que toquen código o despliegue
- el despliegue productivo solo ocurre desde `main` y solo si el commit proviene de una PR fusionada
- los cambios sobre `analyze-with-agents`, SSE, `JobService`, migraciones o CI/CD deben actualizar la documentación mínima afectada en la misma rama

## 2.2. Hardening del runtime de análisis (2026-04-19)

- `datosGenerales.cpv.value` acepta entrada `string` o `string[]`, pero se normaliza siempre a `string[]`
- Fase C mantiene concurrencia 3 para reducir ráfagas de rate limit
- los errores `429` y transitorios usan retries agresivos con backoff visible
- el contrato SSE incluye `retry_scheduled` para que la UI muestre espera y cuenta atrás en lugar de aparentar bloqueo

## 2.3. Contrato funcional de producto (2026-04-20)

- el caso principal de producto y de release es subir un PDF completo de pliego y obtener un dashboard útil sin datos inventados
- los documentos parciales siguen soportados, pero deben quedar clasificados como `PARCIAL` con `partial_reasons`
- el benchmark `pnpm benchmark:pliegos` valida mínimos por campos y secciones sobre fixtures versionados
- cambios que toquen pipeline, contrato SSE, `JobService`, dashboard de análisis o persistencia de `workflow.quality` deben mantener ese benchmark en verde

## 2.4. Migración a `@openai/agents` (2026-05-06)

- las fases B y C del pipeline se ejecutan vía `Agent` + `run()` del SDK `@openai/agents@0.3.1`; la API observable (eventos SSE, schema canónico, TrackedField, `partial_reasons`) no cambia
- los prompts viven en `analyze-with-agents/prompts/index.ts` (copia byte-a-byte de los strings previos para preservar paridad)
- `outputGuardrails` (`jsonShapeGuardrail<T>`) sustituyen el retry-on-bad-JSON inline; un `OutputGuardrailTripwireTriggered` dispara un único reintento con clausula JSON-only y, si falla otra vez, devuelve un bloque vacío con warning
- `inputGuardrails` (`templateSanitizationGuardrail`) bloquea plantillas personalizadas con > 50 campos antes de invocar al LLM
- `SupabaseLogTraceProcessor` emite líneas `[trace]` JSON por evento del SDK; `npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'` reconstruye una ejecución completa
- `verify_jwt = true` en `supabase/config.toml` para `analyze-with-agents`; el bloque de auth manual desapareció del handler
- detalle operativo y reglas de "cómo añadir un nuevo Agent" en `AGENTS.md`

## 2.5. Auth uniforme en Edge Functions (2026-05-09)

- `chat-with-analysis-agent` migrada a `verify_jwt = true` (mismo patrón que `analyze-with-agents`). El gateway rechaza con 401 las peticiones sin JWT antes de invocar la función; el handler sólo resuelve `user` para ownership contra `licitaciones` / `analysis_chat_sessions`.
- `.github/workflows/ci-cd.yml` ya no pasa `--no-verify-jwt` al `supabase functions deploy` para ninguna de las dos funciones. La versión previa lo seguía usando para `analyze-with-agents` incluso después de M3, lo que sobrescribía silenciosamente `config.toml` — esa regresión queda cerrada.
- el job `Smoke Test` del workflow valida con `curl -X POST` sin Authorization que ambas funciones devuelven 401 desde el gateway tras el deploy. Si una de las dos responde otro código, el deploy falla.
- detalle operativo en `DEPLOYMENT.md` §5 y `AGENTS.md` (Auth model).

## 2.6. Eliminación del legacy fallback de Fase C (2026-05-09)

- `phases/block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` (Supabase secret) **eliminados**. Paridad de salida ya confirmada en producción tras los deploys de PR #275 y #276.
- `phases/block-extraction.ts` queda como camino único: lee de `BlockExtractionInput.context` (ahora obligatorio) y llama directamente a `buildBlockAgent(...)` + `run()`.
- Si en el futuro hay que revertir la migración, el path correcto es `git revert` del PR responsable; **no** reanimar `block-extraction.legacy.ts` ni reintroducir el flag inline.

## 3. Iteración activa

### 3.1. Objetivo

Cobertura al 80%, i18n multi-idioma, Dependabot (Iteración D — mantenimiento y observabilidad).

### 3.2. Entregables esperados

1. Subir cobertura de tests al 80% statements / 70% branches.
2. Implementar i18n multi-idioma (inglés).
3. Configurar Dependabot para actualizaciones automáticas.
4. Validar compatibilidad de OpenAI Agents SDK en Supabase Edge Functions mediante un spike aislado no productivo.

### 3.3. Criterios de aceptación globales

- `pnpm exec vitest run --coverage` ≥80% statements, ≥70% branches.
- La app puede cambiar entre ES y EN.
- Dependabot crea PRs semanales.

## 4. Diseño funcional y técnico de la iteración activa

**Iteración D (Mantenimiento y Observabilidad)**

- **Testing (QA):** El test global de Vitest que bloqueaba la suite ha sido resuelto. El objetivo ahora es incrementar progresivamente la cobertura unitaria de componentes UI y hooks, comenzando con los widgets del Dashboard y los componentes core de UI (`src/components/`), hasta alcanzar el 80% global.
- **i18n (UI/Infra):** Integrar `react-i18next` u otra librería estándar. Inicializar diccionarios básicos (`es`, `en`) e implementar un selector de idioma en la interfaz. Extraer progresivamente textos hardcodeados.
- **Dependabot (Infra):** Añadir `.github/dependabot.yml` para gestionar actualizaciones semanales de paquetes npm y acciones de GitHub, reduciendo deuda técnica.
- **Capa conversacional Agents SDK (AI/Infra):** Mantener operativa la Edge Function `chat-with-analysis-agent` para consultar análisis persistidos desde el dashboard sin alterar el pipeline batch principal.


## 5. Próxima iteración

### 5.1. Objetivo
Observabilidad y mejoras de producto: métricas de rendimiento, analytics avanzados, optimización de bundle.

## 6. Decisiones cerradas

- **Composición multi-documento:** Se usa Vector Store de OpenAI con ingesta secuencial. El documento principal se pasa como `pdfBase64` y los adicionales en array `files`. La Guía de lectura se inyecta como archivo markdown local vía `Deno.readTextFile`. Decisión: mantener esta arquitectura hasta que se superen las 10 docs por análisis.
- **Límites multi-documento:** Máximo 5 archivos, 30MB total. Validación en frontend (`useFileValidation.ts`) y backend (Edge Function). Si se necesita más, evaluar chunking o vector store persistente por usuario.
- **Migración a `@openai/agents` (2026-05-06):** Pipeline B+C ejecuta a través del SDK pinned a 0.3.1 (zod 3.25.76). Subir a 0.3.2+ requiere migrar schemas a Zod 4; deferido sine die. Tras confirmar paridad en producción (PR #275 + #276) se eliminaron `block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` (2026-05-09).
- **Auth uniforme (2026-05-09):** ambas Edge Functions usan `verify_jwt = true`. NO reintroducir validación manual del token en los handlers; NO añadir `--no-verify-jwt` al despliegue (sobrescribe `config.toml`). Smoke automático en `Smoke Test` del workflow protege la postura.

## 7. Riesgos y mitigaciones

### Riesgo 1: romper el contrato SSE
Mitigación: todo cambio en `analyze-with-agents` debe validar compatibilidad de eventos y consumo frontend.

### Riesgo 2: documentación obsoleta
Mitigación: ningún cambio pasa a QA sin actualizar documentación mínima afectada.

### Riesgo 3: tareas demasiado grandes
Mitigación: dividir cualquier épica en entregables de una sola sesión.

### Riesgo 4: desalineación con la Guía de lectura
Mitigación: el AI Engineer debe contrastar cada cambio de extracción contra la guía antes de entregar.

### Riesgo 5: regresión semántica del pipeline @openai/agents
Mitigación: tras eliminar el legacy fallback, la única reversión disponible es `git revert` del PR responsable. `pnpm benchmark:pliegos` sigue siendo el gate de paridad y debe quedar verde antes de cada merge a `main` que toque el pipeline.

### Riesgo 6: regresión de auth (peticiones legítimas rechazadas con 401)
Mitigación: editar `supabase/config.toml` para fijar `verify_jwt = false` en la función afectada y redesplegar con `--no-verify-jwt`. El smoke automático bloquea el deploy si la postura cambia involuntariamente, evitando que el repo y producción se desincronicen.

## 8. Historial de implementación

### Implementado previamente
- spike técnico planificado para evaluar OpenAI Agents SDK en Edge Functions sin afectar producción
- streaming por SSE
- historial avanzado de licitaciones
- limpieza principal de arquitectura legacy de colas
- Plantillas Dinámicas de Extracción (Back, Front, CRUD, AI Integrations)
- Soporte Multi-documento Backend (Edge Function adaptada para recibir Array de files)
- Migración M1+M2+M3 del pipeline `analyze-with-agents` a `@openai/agents@0.3.1` (2026-05-06)
- Auth uniforme: `chat-with-analysis-agent` migrada a `verify_jwt=true` + cierre de regresión del workflow para `analyze-with-agents` (2026-05-09)
- Eliminación del legacy fallback de Fase C: `block-extraction.legacy.ts` + flag `USE_AGENTS_SDK` retirados (2026-05-09)

## 9. Capa conversacional con Agents SDK sobre análisis persistidos

### 9.1. Objetivo

Permitir consultas conversacionales sobre análisis ya guardados sin reprocesar PDFs ni alterar el pipeline batch de `analyze-with-agents`.

### 9.2. Alcance

- Edge Function productiva: `supabase/functions/chat-with-analysis-agent/index.ts`
- autenticación delegada al gateway de Supabase vía `verify_jwt = true` (mismo patrón que `analyze-with-agents`)
- tools de solo lectura sobre `licitaciones`
- persistencia de sesiones en `analysis_chat_sessions` y `analysis_chat_messages`
- consumo desde dashboard mediante la sección `Copiloto IA`

### 9.3. Restricciones

- no reprocesa PDFs ni recrea Vector Stores
- no reemplaza `analyze-with-agents`
- no introduce SSE en el flujo principal
- no modifica `analysis_jobs`
- no expone acceso directo del frontend a tablas conversacionales

### 9.4. Criterios de éxito

- `deno check supabase/functions/chat-with-analysis-agent/index.ts` pasa
- `deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts` pasa
- el dashboard muestra `Copiloto IA` solo cuando existe `analysisHash`
- la función responde con `answer`, `citations`, `usedTools` y `sessionId`
- un POST sin Authorization recibe 401 desde el gateway (validado en `Smoke Test` post-deploy)

### 9.6. Evolución aplicada sobre producto

La validación inicial del runtime con Agents SDK ya se absorbió en la capa productiva `chat-with-analysis-agent`. El spike técnico se retiró del repositorio para evitar duplicidad y mantenimiento muerto.

Alcance aplicado:

- consulta sobre análisis ya persistidos, nunca sobre PDFs sin procesar
- continuidad conversacional mediante `sessionId`
- persistencia UX en navegador con `localStorage`
- evidencias y herramientas utilizadas visibles en la respuesta

### 9.5. Criterios de fallo

Si la capa conversacional introduce incompatibilidades relevantes de Deno/npm o del runtime de Supabase Edge con `@openai/agents`, se debe desactivar su despliegue y rediseñar fuera del camino crítico batch.

## 10. Hallazgos Técnicos y Mantenimiento

### 10.2. Resolución de Errores de Despliegue (Edge Functions)
Durante el ciclo de pruebas E2E y despliegues, se identificó un error 401 en `analyze-with-agents`. Se resolvió temporalmente con `--no-verify-jwt`. Tras la migración M3 a `@openai/agents` (2026-05-06) la función usa `verify_jwt = true` y el flag `--no-verify-jwt` se eliminó del comando documentado de despliegue. La regresión latente en el workflow de CI (que seguía pasando `--no-verify-jwt` y sobrescribía silenciosamente la config) quedó cerrada el 2026-05-09 junto con la migración equivalente de `chat-with-analysis-agent`.

### 10.3. Migración a `@openai/agents` (2026-05-06)
- Fases B y C migradas a `Agent` + `run()` del SDK `@openai/agents@0.3.1`.
- Pin de zod subido a `3.25.76` (mínimo aceptado por el SDK; mayor 3.x estable).
- `verify_jwt = true` activado para `analyze-with-agents`; bloque de auth manual eliminado del handler.
- Tracing del SDK redirigido a `console.log` con prefijo `[trace]` vía `SupabaseLogTraceProcessor`.
- Reglas duras del SDK (no `outputType` con `file_search`, per-request agents, prompts byte-a-byte, `requestId` en todo) documentadas en `AGENTS.md`.

### 10.4. Auth uniforme en ambas Edge Functions (2026-05-09)
- `chat-with-analysis-agent` migrada a `verify_jwt = true` con el mismo patrón que `analyze-with-agents`. El handler retira el bloque "if (!token) → 401" y se queda con `auth.getUser(token)` para resolver el `user` y un `if (!user)` defensivo.
- `.github/workflows/ci-cd.yml`: `deploy-supabase` deja de pasar `--no-verify-jwt` para ambas funciones. La versión previa lo seguía pasando para `analyze-with-agents`, lo que sobrescribía silenciosamente la config y dejaba la función abierta tras los deploys de producción.
- `Smoke Test` del workflow gana un nuevo paso que verifica con `curl -X POST` sin `Authorization` que ambas funciones devuelven 401 desde el gateway tras cada deploy a `main`. Si la respuesta no es 401, el deploy falla.
- Documentación: `DEPLOYMENT.md` §5 (comando sin `--no-verify-jwt`), §5.2 (smoke), §8 (rollback de auth); `AGENTS.md` (Auth model + regla dura nº 6); `README.md` (postura de auth en la sección Arquitectura).

### 10.5. Eliminación del legacy fallback de Fase C (2026-05-09)
- `phases/block-extraction.legacy.ts` retirado (~12.5 KB) tras confirmar paridad.
- `phases/block-extraction.ts` queda como camino único: el `if (!useAgentsSdk()) { ... }` y el helper `useAgentsSdk()` desaparecen; `BlockExtractionInput.context` pasa a obligatorio.
- Flag `USE_AGENTS_SDK` (Supabase secret) ya no se lee en código. Si quedan secrets remotos con ese nombre se pueden borrar con `supabase secrets unset USE_AGENTS_SDK` (no afecta runtime).
- Documentación: referíncias eliminadas en DEPLOYMENT.md (§5.3 retirada, §6, §8), CLAUDE.md (key patterns), AGENTS.md (regla dura nº 7 nueva), ARCHITECTURE.md (§4.3), TECHNICAL_DOCS.md (§8, §10, §13).

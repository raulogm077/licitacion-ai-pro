# SPEC - Analista de Pliegos

## 1. Visión del producto

El producto debe permitir analizar pliegos de licitación de forma rápida, precisa y navegable, siguiendo la **Guía de lectura de pliegos** como referencia principal de negocio. La aplicación no sustituye la revisión humana; la acelera y la estructura.

## 2. Estado actual confirmado

Estado funcional confirmado a fecha de esta especificación:

- el análisis principal usa **OpenAI Responses API** con pipeline de 5 fases
- las fases B (DocumentMap) y C (BlockExtraction + custom template) se ejecutan a través del SDK `@openai/agents@0.3.1` (Agent + run() + guardrails declarativos), preservando el contrato SSE
- el flujo principal usa **jobs durables**, Broadcast privado de Realtime y polling RLS; SSE queda como rollback temporal
- existe historial de licitaciones y análisis ya implementado
- el sistema soporta análisis de PDF principal y múltiples documentos (backend/AI)
- el sistema soporta plantillas dinámicas de extracción en todos los niveles
- PGMQ, ledger, outbox y leases forman parte del flujo operativo principal
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
- la interfaz sigue el sistema de diseño **«Iris»** (marca índigo→violeta, tipografía Inter/Space Grotesk self-hosted, superficies aurora/glass); el **modo oscuro es funcional** en toda la app y respeta `prefers-reduced-motion`
- el feedback transitorio de la UI (errores de carga/borrado, éxito de acciones) se comunica con **toasts** (`sonner`) mediante el helper único `notify()`, no con banners ad-hoc
- la pantalla de análisis muestra las **5 fases del pipeline como checklist** (la fase activa llega desde el recovery durable vía `currentPhase`) con barra de progreso real; al completar un análisis fresco hay una celebración breve (confetti, desactivable por `prefers-reduced-motion`)
- el dashboard exporta el análisis a **Excel real** (`exportLicitacionToExcel`, 6 hojas); no existe el CTA «Ver Original» porque el PDF original no se persiste
- la **búsqueda es única** y vive en el Historial (texto libre FTS + filtros avanzados incl. estado y tags); la antigua página `/search` fue eliminada
- Analytics muestra **gráficos reales** (donut de estados y evolución mensual con recharts, lazy) con paleta validada para daltonismo/contraste en claro y oscuro
- los visitantes no autenticados ven una **landing de marca** con CTA de acceso; el **modo presentación** es un pase de diapositivas real (teclado, pantalla completa, transiciones)
- `criteriosAdjudicacion` no puede vaciarse por completo por un `subcriterio` mal tipado si aún existe señal útil recuperable
- `analysis-jobs`, `analyze-with-agents` y `chat-with-analysis-agent` usan `verify_jwt = true`; `analysis-worker` usa auth M2M con token en Vault y rechaza sin él aunque `verify_jwt = false`
- el camino @openai/agents para Fase C es único; el antiguo fallback `block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` se eliminaron tras confirmar paridad en producción
- las `instructions` dinámicas de los agentes consumen el `PipelineContext` directamente del primer argumento del SDK (`({ context })`), **sin** un segundo salto `.context`; el contrato queda protegido por tests de regresión que llaman a `getSystemPrompt(new RunContext(ctx))`
- los `partial_reasons` de ingesta son veraces: el aviso «OCR/señal baja» solo puede aparecer con conteos reales de indexación (si el polling del vector store falla, `pollFailed` impide culpar al documento), y el dashboard prioriza el consejo de composición documental (falta PCAP/PPT) sobre el de OCR
- el tracking de `analysis_jobs` es fiable: las escrituras de cierre (`extraction`/`completeJob`/`failJob`) se esperan antes de cerrar el stream SSE y `JobService` propaga los errores de PostgREST
- `fileSearchTool` se invoca con los vector store ids como primer argumento posicional (`fileSearchTool([id])`); la forma wire (`vector_store_ids` como strings) está fijada por tests, y los ficheros de agentes ya no llevan `@ts-nocheck` (solo supresiones puntuales documentadas en guardrails)
- la UI calcula SHA-256 sin base64, crea el job antes de subir, usa tokens firmados de Storage y recibe `202` al encolar; el worker verifica tamaño/hash antes de OpenAI
- cada fase persiste un checkpoint reutilizable y la RPC de avance hace checkpoint + archive + siguiente enqueue de forma atómica; retry/DLQ no dependen de una conexión del navegador

## 2.1. Endurecimiento operativo aplicado (2026-04-19)

Decisiones vigentes:

- `pnpm verify:integrity` pasa a ser validación obligatoria de deriva de migraciones, workflows, hooks y sincronía documental mínima
- `pnpm verify:release` pasa a ser el cierre obligatorio antes de push/PR para sesiones que toquen código o despliegue
- el despliegue productivo solo ocurre desde `main` y solo si el commit proviene de una PR fusionada
- los cambios sobre `analyze-with-agents`, SSE, `JobService`, migraciones o CI/CD deben actualizar la documentación mínima afectada en la misma rama

## 2.2. Hardening del runtime de análisis (2026-04-19)

- `datosGenerales.cpv.value` acepta entrada `string` o `string[]`, pero se normaliza siempre a `string[]`
- Fase C usa concurrencia 2 (bajada de 3 el 2026-07-12) para reducir ráfagas de rate limit
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

- **Composición multi-documento:** Se usa Vector Store de OpenAI, pero los bytes llegan al worker desde Storage mediante upload firmado, no en `pdfBase64/files`. La Guía de lectura permanece en código/contexto y no se sube al Vector Store.
- **Límites multi-documento:** La UI mantiene máximo 5 archivos/30MB; el control plane aplica defensa adicional de 20 documentos/50MB agregado y MIME PDF/DOCX/TXT.
- **Migración a `@openai/agents` (2026-05-06):** Pipeline B+C ejecuta a través del SDK pinned a 0.3.1 (zod 3.25.76). Subir a 0.3.2+ requiere migrar schemas a Zod 4; deferido sine die. Tras confirmar paridad en producción (PR #275 + #276) se eliminaron `block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` (2026-05-09).
- **Auth de Edge Functions:** las tres funciones públicas usan `verify_jwt = true`. `analysis-worker` es la única excepción, con token M2M Vault/hash y smoke 401 propio. NO abrir otra función sin un mecanismo equivalente y explícito.

## 7. Riesgos y mitigaciones

### Riesgo 1: romper el contrato de progreso/recovery o el SSE de rollback

Mitigación: todo cambio en `JobService`, `analysis-jobs`, `analysis-worker` o `analyze-with-agents` debe validar estados terminales, Broadcast/polling y compatibilidad del contrato compartido.

### Riesgo 2: documentación obsoleta

Mitigación: ningún cambio pasa a QA sin actualizar documentación mínima afectada.

### Riesgo 3: tareas demasiado grandes

Mitigación: dividir cualquier épica en entregables de una sola sesión.

### Riesgo 4: desalineación con la Guía de lectura

Mitigación: el AI Engineer debe contrastar cada cambio de extracción contra la guía antes de entregar.

### Riesgo 5: regresión semántica del pipeline @openai/agents

Mitigación: tras eliminar el legacy fallback, la única reversión disponible es `git revert` del PR responsable. `pnpm benchmark:pliegos` sigue siendo el gate de paridad y debe quedar verde antes de cada merge a `main` que toque el pipeline.

### Riesgo 6: regresión de auth (peticiones legítimas rechazadas o worker abierto)

Mitigación: los smokes validan 401 de gateway en funciones públicas y 401 M2M en el worker. Cualquier cambio de `verify_jwt` debe coordinar config, handler, deploy y rollback; nunca se elimina el control M2M para resolver un incidente.

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
- Revisión integral (seguridad IDOR, chat sobre `sdk.ts`/`CHAT_MODEL` + rate-limit, redacción de tracing, bugs de feedback/búsqueda/historial/validación/cleanup, accesibilidad de modales, dark mode, limpieza y pins de CI) (2026-07-12) — ver §10.7

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

### 10.6. Análisis de arquitectura de IA: gap Guía ↔ extracción (2026-07-03)

Auditoría del diseño de IA (prompts, contexto, costes) contra la "Guía de lectura de pliegos". Conclusión: el pipeline actual es un **extractor estructurado con trazabilidad**, no el **analista estratégico** que describe la Guía (§3–§7). Hallazgos:

- **La Guía casi no llega al modelo.** `guide-content.ts` embebe solo los primeros ~4900 chars de una Guía de 34.857 (su propia cabecera lo declara), y cada fase corta a `substring(0, N)` (`GUIDE_EXCERPT_LENGTH=4000` extracción, `3000` mapa, `2000` template). Solo sobreviven §1 y el arranque de §2.1.1; la metodología operativa (Go/No-Go, ingeniería inversa del scoring, contaminación de sobres, Win Themes) nunca entra en el prompt. La "inteligencia" real vive en `BLOCK_USER_PROMPTS`, no en el excerpt de Guía.
- **Grounding asimétrico.** Solo 6 campos críticos de `datosGenerales` usan `TrackedField`; importes (`presupuestoBaseLicitacion`), ponderaciones de criterios y `umbralAnormalidad` van sin `status/evidence`, contra la regla §6.3 de la Guía.
- **Coste input-bound por RAG y tier único.** ~10–11 llamadas LLM por análisis (1 mapa + 9 bloques + reintentos guardrail + template opcional), todas a `gpt-4.1`, con 9 recuperaciones `file_search` independientes. El coste dominante es el contexto de entrada repetido, no la generación.
- **Capa de decisión ausente.** El schema canónico no modela Go/No-Go, simulación de scoring/baja temeraria, matriz de cumplimiento trazable, Win Themes ni validación de solvencia contra la empresa (que además requiere un dato inexistente: el perfil del licitador).

Acciones derivadas en `BACKLOG.md`: metodología por bloque (`## To Do`), model tiering + `TrackedField` extendido + motor de scoring (`## Deuda Técnica`), y perfil de empresa licitadora como decisión de producto (`## Ideas de Producto`). Relacionado con Riesgo 4 (§7, desalineación con la Guía).

### 10.7. Revisión integral: seguridad, bugs, accesibilidad y limpieza (2026-07-12)

Revisión transversal del producto tras la auditoría de §10.6. Cambios cerrados (detalle por categorías en `CHANGELOG.md`, arquitectura en `ARCHITECTURE.md` §8.6):

- **Seguridad**:
    - IDOR corregido en la RPC `search_licitaciones` (migración `20260712000000_fix_search_licitaciones_idor.sql`): pasa de `SECURITY DEFINER` con `user_id_param` controlable por el llamante a `search_licitaciones(search_query text)` de un solo argumento, `SECURITY INVOKER` (aplica RLS), filtro explícito `auth.uid()` y `search_path` fijo. Se endurece también el `search_path` de las funciones trigger `update_updated_at_column` y `update_extraction_templates_updated_at`. El frontend no cambia (ya llamaba solo con `search_query`).
    - `chat-with-analysis-agent` importa el SDK `@openai/agents` únicamente vía `_shared/agents/sdk.ts` (0.3.1), que ahora re-exporta también `tool`, `user` y el tipo `AgentInputItem`. El modelo del chat deja de estar hardcodeado y vive en la constante `CHAT_MODEL` (`_shared/config.ts`).
    - Rate limiting y límite de payload en el chat (`CHAT_MAX_REQUESTS_PER_HOUR=60`, `MAX_CHAT_PAYLOAD_BYTES=64KB`); `checkRateLimit` pasa a ser parametrizable con clave namespaced (`chat:`/`analyze:`). En `analyze-with-agents` se cierra el bypass del límite de payload validando la longitud real del body en lugar del header `content-length`.
    - `tracing.ts` redacta `spanData` antes de loguearlo (`sanitizeSpanData`) para no filtrar contenido del pliego a los logs.
- **Funcionalidad**: feedback de extracción persistido de verdad en `extraction_feedback` (antes no-op); búsqueda con formato monetario defensivo y estados de carga/vacío/error; composición real de texto + filtros en `useHistory` (`src/lib/search-filters.ts`); fallback de schema en `job.service` ahora logueado (Sentry) en vez de silencioso; el valor numérico `0` deja de tratarse como vacío en validación; corregida la carrera del historial de chat en `localStorage`; cleanup borra recursos en OpenAI antes de anular referencias en DB.
- **UX/A11y**: modales (`Dialog`, `AuthModal`, borrado de `HistoryView`) con `role="dialog"`, `aria-modal`, cierre con Escape y foco gestionado; borrado de plantillas con `Dialog` accesible; dark mode en la vista de detalle del dashboard y el panel de chat.
- **Refactor/CI**: `cn()`, `runWithConcurrency` y `buildInitialVersion` unificadas; flags y singletons muertos eliminados (`MAX_PDF_SIZE_MB=4` como fuente única del límite de subida); backoff real ante 429/5xx en Fase C (`retryWithBackoff`, `BLOCK_MAX_RETRIES`, `BLOCK_RETRY_MAX_DELAY_MS=30s`); tests Deno huérfanos cableados en CI; versiones de herramientas de CI fijadas y toolchain unificado en Node 22; bumps de dependencias seguros (Playwright fijado en 1.58.2).

#### Pendientes y limitaciones conocidas

No forman parte de `## To Do` de `BACKLOG.md`; se registran aquí como deuda consciente:

- migración a **eslint 9 + flat config** (eslint 8 está EOL);
- **i18n completo multi-locale**: hoy es vestigial (solo `es`, 4 componentes con `useTranslation`); las claves de `UploadStep` se completaron, pero el idioma sigue siendo único;
- **majors diferidos**: React 19, Tailwind 4 y zod 4 (zod anclado por el peer de `@openai/agents@0.3.1`), eslint 9;
- refactor del monolito `HistoryView`;
- decisión sobre **adopción o eliminación completa del service-registry**;
- ~~**modelo de job asíncrono** para documentos de 300+ páginas~~ **(resuelto en Fase 1B)**: el trabajo ya no depende de la vida de SSE; persisten límites de tiempo por step y el escalado del dataset de expedientes grandes.
- ~~**orden de la migración `add_provider_reading_mode`**~~ **(resuelto 2026-07-12)**: el fichero se renombró de `20250130000000` a `20251229000000` (posterior a `initial_schema`) y se idempotentizó; se reparó el historial remoto (`delete` de la fila vieja en `schema_migrations`) para que el deploy re-aplique bajo el nuevo `version`. El _branching preview_ vuelve a pasar. Detalle en `DEPLOYMENT.md` (§ "Orden de migraciones y Supabase Preview").

### 10.8. Fase 0 de arquitectura IA evaluable (2026-07-16)

Decisión aprobada en `docs/adr/ADR-001-arquitectura-ia-durable-y-evaluable.md`:

- arquitectura objetivo basada en job ledger, cola de pasos idempotentes, Storage directo, retrieval explícito y Fact/Evidence Store;
- Responses con structured output para extracción controlada; Agents SDK para conversación, tools y handoffs;
- versionado de pipeline/prompts/schema/modelo/SDK más fingerprint efectivo;
- eval live real separado del benchmark determinista de proyección.

Criterios cerrados en esta fase:

- `pnpm eval:pliegos:check` pasa sin red y queda integrado en `verify:release`;
- `pnpm eval:pliegos:live` ejecuta A-E contra OpenAI, puntúa hechos/ausencias/grounding/calidad y limpia los recursos temporales;
- los resultados no persisten respuestas completas, documentos ni credenciales;
- no cambia el contrato SSE ni el comportamiento de producción.

El dataset inicial contiene un smoke mínimo. El siguiente gate de arquitectura exige 10–20 pliegos representativos antes de comparar/promover modelos, prompts o retrieval nuevos.

### 10.9. Fase 1A: jobs y pasos durables (2026-07-16)

Primer corte productivo de la Fase 1 aprobada en ADR-001:

- el job se crea antes de cualquier escritura en Storage o llamada a OpenAI;
- `X-Idempotency-Key` se conserva en el reintento 401 y queda vinculado al fingerprint SHA-256 del body;
- PDF/DOCX/TXT se copian a Storage privado con hash, metadatos y retención antes de la ingesta OpenAI;
- cada paso tiene ledger, lease, máximo de intentos, checkpoint y mensaje PGMQ; outbox y enqueue comparten transacción;
- el cliente recibe `job_created` y, si SSE se interrumpe, recupera estados terminales mediante polling de `analysis_jobs` protegido por RLS;
- anon/authenticated no pueden mutar jobs, documentos, steps ni outbox; las mutaciones usan `service_role` solo dentro de la Edge Function.

Compatibilidad: el resultado canónico, los eventos de fase y la proyección del dashboard no cambian. En este corte el worker continúa inline y el request todavía transporta base64; consumidor independiente, Realtime y upload firmado quedan para el siguiente corte de Fase 1.

### 10.10. Fase 1B: upload firmado y consumidor independiente (2026-07-16)

Segundo corte productivo de la Fase 1:

- `analysis-jobs:init` crea/recupera el job y devuelve tokens firmados; el navegador sube bytes directamente a `analysis-pdfs` y `submit` responde `202` tras encolar;
- `analysis-worker` usa lease de 155 s y slices compatibles con el wall clock Free de 150 s: ingesta y mapa se separan, extracción procesa hasta dos bloques, y un yield exitoso no consume el presupuesto de tres fallos;
- `pg_net` activa después del commit del outbox, `pg_cron` recupera activaciones perdidas y ejecuta cleanup TTL acotado;
- el token interno se genera en Postgres, vive en Vault y solo su SHA-256 queda disponible al runtime backend;
- Realtime Broadcast privado envía solo estado/fase; `JobService` relee por RLS y mantiene polling como fallback;
- los recursos se eliminan en orden OpenAI → Storage → filas de documento, conservando referencias cuando un borrado falla;
- `analyze-with-agents`/SSE queda desplegado como rollback, sin ser el camino de subida principal.

No cambia `OPENAI_MODEL`, prompts, schema ni proyección de producto. La modernización de modelos permanece para Fase 3 y requiere el dataset representativo definido en ADR-001.

### 10.11. Jobs zombi: techo de plataforma y lease sin recuperación (2026-07-27)

Reporte de producción: un pliego formado por dos PDF terminaba en «Error en el análisis» con el cuerpo «El análisis sigue en curso. Vuelve a abrirlo desde tu historial en unos minutos». El mensaje se contradecía porque el estado real no era ninguno de los dos: el job estaba muerto y nadie lo sabía.

Evidencia sobre el job afectado:

- `ingestion_map` completó en 34 s; `extraction` arrancó y no volvió a escribir nunca, sin `last_error`;
- tres caminos de error independientes (el `catch` del pipeline, el `finally` y el `setTimeout` de `PIPELINE_TIMEOUT_MS`) no dejaron rastro, lo que solo es compatible con una muerte abrupta del isolate;
- el plan de la organización es free, cuyo techo de invocación son 150 s, mientras `PIPELINE_TIMEOUT_MS` valía 280 s: el guard de código era inalcanzable;
- un análisis de un solo PDF (0,68 MB) completaba en 119 s, justo por debajo del techo; el fallido llevaba 3,85 MB en dos documentos;
- 27 de 80 jobs estaban atrapados en estado no terminal por el mismo motivo.

Cambios aplicados:

- `PIPELINE_TIMEOUT_MS` se deriva de `EDGE_WALL_CLOCK_MS` menos un margen de apagado, para que el guard dispare antes que la plataforma y el fallo se persista;
- `reclaim_stale_analysis_steps` recupera pasos con lease expirado y jobs huérfanos, con `dead_letter` cuando no existe consumidor capaz de reanudarlos y reencolado cuando sí lo hay;
- el barrido corre oportunistamente en cada request de `analyze-with-agents`;
- `recoverDurableResult` deja de afirmar que un análisis interrumpido sigue en curso.

Criterio de fallo asumido: en plan free un expediente multi-documento sigue sin caber en el techo. La entrega convierte el zombi en un fallo explicado y reintentable, no en un análisis correcto; cerrarlo del todo exige el timeout de Pro o el worker asíncrono.

### 10.12. El polling no informaba del progreso (2026-07-27)

Primer pliego real analizado con Fase 1B en producción: **completó correctamente en 669 s**, cuatro pasos en verde y resultado persistido — muy por encima del techo de 150 s que antes lo mataba. Pero durante los 11 minutos la interfaz mostró «Documentos guardados; análisis asíncrono en cola» y un 18 % congelado, así que era indistinguible de un cuelgue.

Causa: `recoverDurableResult` solo emitía `onProgress` desde el handler de Broadcast. El bucle de polling leía `status` y `phase` para decidir si el job había terminado, pero **no informaba de nada**. Como Broadcast es best-effort —y en esta ejecución no llegó ningún frame al navegador—, la UI se quedó clavada en el último evento recibido al enviar. El 18 % es exactamente `PHASE_PROGRESS.ingestion.start` (10) proyectado por el store (`10 + 10·0,8`): el marcador de inicio de ingesta, nunca actualizado.

Cambios:

- el polling emite `phase_progress` cuando cambia `status:phase`, de modo que el fallback documentado deja de ser mudo; la clave excluye `updated_at` para que un checkpoint sin cambio de fase no repita línea;
- los mensajes dejan de filtrar el identificador interno del paso (`Procesando extraction...`) y describen la fase en castellano, con aviso explícito de que la extracción puede tardar varios minutos, que es el tramo largo.

Criterio de fallo asumido: durante la extracción la barra se queda en el punto medio de su rango (50 %) porque el Broadcast privado solo transporta estado y fase, sin detalle por bloque. Mostrar avance por bloque exigiría ampliar el payload y queda fuera de este arreglo.

### 10.13. Barrido sin disparador y avance por bloque (2026-07-27)

Dos huecos que dejó al descubierto el primer uso real de Fase 1B en producción.

**El barrido de trabajo abandonado se quedó sin disparador.** `reclaim_stale_analysis_steps` se invocaba de forma oportunista al inicio de cada request de `analyze-with-agents`, que era el camino principal cuando se escribió. Fase 1B lo dejó como ruta de rollback: el flujo normal entra ahora por `analysis-jobs`, así que en la práctica el barrido dejó de ejecutarse. Verificado tras el despliegue: ~30 jobs no terminales y 0 en `dead_letter`. Pasa a un `pg_cron` cada 5 minutos, que además cubre el caso que la invocación oportunista nunca podía cubrir —un usuario que no vuelve a subir nada se quedaba con su análisis colgado indefinidamente en el historial—. Comprobado contra producción que `postgres`, el rol que ejecuta el cron y que no es superusuario, tiene los permisos reales necesarios sobre `pgmq`.

**La extracción no reportaba avance.** Es el tramo largo y la barra se quedaba en el punto medio del rango de la fase durante minutos. El dato ya se persistía en cada checkpoint (`phase_results.extraction.blocks`), pero leerlo desde el navegador cada 2 s significaba descargar cientos de KB de datos y evidencias para mostrar «4 de 9». Se añade `analysis_jobs.progress`, un `{"done","total"}` compacto que el worker escribe en el mismo checkpoint, incluido en el trigger de Broadcast y en el sondeo.

**El stepper de fases tampoco se iluminaba.** Encontrado al revisar el propio arreglo: `AnalyzingStep` resuelve la fase activa con `ANALYSIS_PHASES.indexOf(currentPhase)`, y `ai.service` solo asignaba `currentPhase` en `phase_started`/`phase_completed`, eventos exclusivos de SSE. En el camino asíncrono la fase viaja dentro del propio evento de progreso, así que `currentPhase` se quedaba en `null`, `activeIndex` en `-1` y ninguna fase aparecía activa durante todo el análisis. Ahora el evento de progreso por bloque lleva su `phase` y `ai.service` la propaga.

Criterio de fallo asumido: el contador refleja bloques terminados, no el progreso dentro de un bloque. Un bloque que tarda 40 s no mueve la barra durante esos 40 s.

### 10.14. Cierre de las observaciones de la revisión de #327 (2026-07-27)

Tres puntos que la revisión de #327 dejó anotados y que se cierran aquí.

**`blockIndex` tenía dos significados.** El camino SSE lo emitía como índice del bloque en curso y el asíncrono como bloques terminados. Al unificarlo apareció un off-by-one real: el emisor SSE pasaba `completedCount - 1`, así que al terminar los nueve bloques enviaba ocho y la barra no llegaba nunca al final del rango de la fase. El contrato fija ahora el significado —bloques **terminados**, de 0 a `totalBlocks`, de modo que el cociente es la fracción completada— y ambos productores lo respetan.

**`progress` se quedaba pegado al salir de la extracción.** `COALESCE(p_progress, progress)` es lo correcto dentro de una fase, porque el worker hace checkpoints que no siempre aportan contador, pero al pasar a consolidación el valor dejaba de significar nada y sobrevivía en la fila indefinidamente. Ahora se limpia en la transición, comparando la fase entrante con la almacenada, y los cierres de job (`completeJob`, `failJob`) lo anulan explícitamente.

**El contador no estaba acotado.** El emisor actual no puede salirse de rango, pero `done / total` alimenta directamente el porcentaje: un valor corrupto se traduciría en una barra que retrocede o se pasa. `readBlockProgress` acota a `[0, total]` y rechaza valores no finitos.

## 11. Simulación de oferta económica (2026-07-27)

Primer paso del salto de «extractor» a «analista» descrito en la Guía §4. El pipeline ya extraía `formula`, `ponderacion` y `umbralAnormalidad`, pero como texto libre: se mostraban tal cual y nadie los interpretaba.

`src/lib/scoring.ts` los convierte en algo evaluable y responde dos preguntas que decide un licitador antes de presentarse: cuántos puntos saca con un precio y a partir de qué importe entra en baja temeraria.

### Qué se reconoce

| Familia                   | Ejemplo                                      | Origen                     |
| ------------------------- | -------------------------------------------- | -------------------------- |
| Proporcionalidad inversa  | `40 x (oferta mínima / oferta analizada)`    | fixture real del benchmark |
| Proporcional a la baja    | `50 x (baja de la oferta / baja máxima)`     | —                          |
| Lineal sobre presupuesto  | `P × (PBL − oferta) / (PBL − oferta mínima)` | —                          |
| Umbral contra presupuesto | `un 25% por debajo del presupuesto base`     | —                          |
| Umbral contra la media    | `un 10% inferior a la media`                 | fixture real del benchmark |

### Decisiones de diseño

**No adivinar.** Cuando el texto no encaja con un patrón conocido se devuelve un fallo explícito con el motivo y la interfaz dice que no es simulable. Un número calculado sobre una fórmula mal interpretada es peor que no dar ninguno: parece autoridad y no lo es.

**La puntuación se presenta como escenarios, no como cifra única.** La fórmula más común depende de la oferta más baja de los rivales, que el licitador no conoce al decidir su precio. Dar un número exacto sería falsa precisión, así que se muestra qué pasa si alguien baja un 5, 10 o 15 %.

**El umbral sobre la media se declara no anticipable.** No existe hasta la apertura de plicas; `anomalyLimit` devuelve `null` y la interfaz lo explica en vez de callarlo.

### Criterio de fallo asumido

El simulador cubre las familias de fórmula más frecuentes en pliegos españoles, no todas. Una fórmula con tramos, topes o coeficientes correctores cae en «no simulable» — que es el comportamiento correcto, pero significa que la cobertura real depende del pliego. Ampliarla exige casos nuevos, no relajar los patrones.

### 11.1. Migración a ESLint 9 + flat config (2026-07-27)

Cierra la deuda técnica que mantenía `eslint-plugin-react-refresh` fijado a la 0.4 y con un `ignore` en Dependabot. El conjunto de reglas efectivo es **el mismo**: `@typescript-eslint/no-explicit-any` sigue en `error`, verificado con `eslint --print-config`.

Dos cosas que aparecieron al hacerla y que no estaban previstas:

**`minimatch@3` no puede convivir con el override de `brace-expansion`.** ESLint 9 no arrancaba: `TypeError: expand is not a function`. `@eslint/config-array@0.21.2` arrastra `minimatch@3`, que consume `brace-expansion` como export por defecto; el override de seguridad lo fija a la v5, cuya API es distinta.

El primer intento fue acotar el override por línea mayor, asumiendo que la v1 tenía versión parcheada. **Era falso y el CI lo cazó**: el aviso es `GHSA-mh99-v99m-4gvg`, que afecta desde la versión 0 y **solo se corrige en 5.0.8** — no hay parche en las líneas v1 ni v2. Acotarlo reintroducía la vulnerabilidad.

La solución correcta no toca la seguridad: se fuerza `@eslint/config-array` a `^0.23.5`, que ya usa `minimatch ^10` y consume `brace-expansion` por named export, compatible con la v5. El lockfile queda con una única versión, `5.0.8`.

**`react-refresh` no estaba registrando sus reglas.** Con ESLint 8 y el plugin fijado, la regla existía en la configuración pero el plugin no llegaba a cargarla. Ahora `eslint --print-config` la devuelve activa, así que la migración no solo desbloquea el ecosistema: recupera una regla que llevaba tiempo sin aplicarse.

`@typescript-eslint` v8 detectó además un binding de `catch` sin usar en `SupabaseStatus.tsx`, corregido omitiéndolo (válido desde ES2019) en vez de silenciando la regla.

### 11.2. Modelo por bloque de extracción (2026-07-27)

Cierra la deuda de coste registrada en `BACKLOG.md`: los nueve bloques corrían en `gpt-4.1`, incluidos los triviales (`anexosYObservaciones`, `duracionYProrrogas`). `buildBlockAgent` resuelve ahora su modelo con `modelForBlock(blockName)` y `BLOCK_MODEL_OVERRIDES` decide caso por caso.

**El mapa se entrega vacío, y esa es la parte deliberada.** Rellenarlo no es configuración: es una promoción de modelo, y el criterio de aceptación que traía la tarea del backlog —`pnpm benchmark:pliegos` en verde— no sirve para autorizarla. El benchmark valida fixtures ya generados y **no llama al modelo**: seguiría verde aunque el modelo barato extrajera mucho peor. La única señal que detecta esa regresión es `pnpm eval:pliegos:live`, que es manual y requiere clave de OpenAI, y que el contrato de release ya exige antes de promover modelo, prompt, retrieval u orquestación.

Así que se separa lo verificable de lo que no lo es: el mecanismo entra revisado, con tests que fallan si alguien vuelve a fijar el modelo en la factory, y con cambio de comportamiento cero. Encender un bloque queda condicionado a la baseline.

Dos condiciones para quien lo encienda:

- **El modelo debe soportar Responses API con `file_search`.** Sin eso el bloque pierde la recuperación documental y responde de memoria: la peor forma de fallar, porque el JSON sigue teniendo la forma correcta.
- **La provenance viaja con el cambio.** `ANALYSIS_RUNTIME_VERSIONS` añade `blockModels` en cuanto hay overrides, porque un `model` único mentiría sobre qué modelo extrajo cada bloque justo cuando ese dato hace falta para comparar contra la baseline. Mientras el mapa esté vacío la clave no aparece y el `runtime_version` persistido en los jobs no cambia de forma.

### 11.3. Grounding de importes y ponderaciones (2026-07-27)

Cierra la regla de grounding de la Guía §6.3 sobre los datos numéricos críticos. Hasta ahora `TrackedField` cubría seis campos de `datosGenerales`; `presupuestoBaseLicitacion`, las ponderaciones de criterios y `umbralAnormalidad` viajaban sin `status` ni `evidence`.

El criterio para envolver un campo deja de ser «es importante» y pasa a ser **«¿de este número depende una decisión?»**. Con esa vara: el PBL es la base de la fórmula de precio y del umbral de baja temeraria; el VEC lo es del VAM contra el que se compara la solvencia económica; la ponderación decide dónde merece la pena invertir esfuerzo en la oferta. Los tres se envuelven. `tipoIVA` no —es un tipo impositivo, no un importe—, ni el presupuesto por lote —ya tiene `cita` propia—, ni la ponderación de subcriterios, que hoy no renderiza nadie.

`umbralAnormalidad` merece mención aparte: se normalizaba con `safeCoerceString`, que **desenvolvía el `{ value, status }` que el modelo ya devolvía a veces y tiraba el status**. Un umbral que el modelo marcaba como dudoso llegaba a la interfaz indistinguible de uno firme, y de ese texto sale a partir de qué importe entras en baja temeraria.

### Compatibilidad sin migración

El `preprocess` de `TrackedField` acepta el valor plano de los análisis ya guardados y lo envuelve con `status: 'extraido'`, pero **sin fabricarle evidencia**: eso es lo que distingue un dato acreditado de uno heredado. No hay backfill de filas. En el frontend, `unwrap()` cubre la dirección contraria y ya existía.

Los prompts de `economico` y `criteriosAdjudicacion` piden ahora evidencia explícita para esos campos, con la misma plantilla que ya usaba `datosGenerales`. Eso mueve `ANALYSIS_RUNTIME_VERSIONS` a `prompts: pliegos-es-v1.1.0` y `schema: canonical-v1.2.0`.

### Lo que no se veía venir

Envolver un campo no es sólo cambiar el schema; es revisar quién hace aritmética con él. Dos fases deterministas corren sobre `CanonicalResult` con `@ts-nocheck` aguas arriba, así que el compilador no las cubre:

- **La suma de ponderaciones** (`sum + criterio.ponderacion`) habría concatenado objetos y producido «La suma de ponderaciones es 0[object Object]» en vez de un total. Resuelto con un helper local `trackedNumber`.
- **`evaluateObjectQuality`** contaba claves no vacías para puntuar la sección. Un `TrackedField` vacío es un objeto: un bloque económico sin un solo importe habría pasado a reportarse como `COMPLETO`. Ahora mira dentro del envoltorio antes de decidir.

Ninguna de las dos habría roto un test existente ni un `deno check`. Aparecieron al revisar a mano cada sitio que tocaba los campos envueltos, y son la razón por la que este cambio no era mecánico.

### Mejora colateral

Cuando `datosGenerales.presupuesto` se rellena desde el bloque económico, hereda ahora la evidencia del importe de origen. La cita que respalda el número es la de donde salió, no la del bloque que no lo encontró.

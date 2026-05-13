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
- la **iteración E** quedó cerrada el 2026-05-12 con cobertura real 79.95% statements / 80.81% lines / 66% branches / 72.94% functions, fijada por `vitest.config.ts` (thresholds 79/65/72/80). No hay regresión activa de la suite Vitest.
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
- **Bug abierto (2026-05-12)**: existe asimetría de límites de tamaño entre el drop zone (`useFileValidation`: 5 archivos, 30MB total) y el inicio del análisis (`analysis.store.ts`: 4MB por archivo, no documentado). Archivos aceptados por el drop zone son rechazados con error fatal al pulsar "Analizar". Tarea en `BACKLOG.md` (To Do #1).

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

## 2.7. Política de límites de Upload (auditoría 2026-05-12)

Decisión recomendada (a confirmar en la implementación del bug #1):

- **Límite por número de archivos**: 5 (sin cambios).
- **Límite por tamaño total**: 30MB (sin cambios).
- **Límite por archivo individual**: eliminado. La constante `MAX_PDF_SIZE_MB = 4` de `src/config/constants.ts` era incompatible con pliegos reales de licitación (5-20MB típicos) y rompe el upload silenciosamente.
- Si por motivos técnicos (timeout del backend, OOM del Vector Store) hay que mantener un límite individual, fijarlo en 30MB (igual al total) para que sea coherente con la validación del drop zone.
- El backend debe validar `files.length <= 5` y `payload <= 30MB`, no solo el `MAX_PAYLOAD_BYTES = 50MB` actual.
- La UI debe mostrar los límites en el drop zone (hint o tooltip) y el tamaño acumulado en tiempo real (`X.X MB de 30MB`).

Detalle operativo: ver tarea #1 en `BACKLOG.md` (`To Do (Iteración F)`).

## 3. Iteración activa

### 3.1. Objetivo

**Iteración F** — Bug crítico de Upload + claridad UX del Detalle + endurecimiento del flujo de auth + completar i18n EN.

La iteración E (cobertura ≥79% statements + i18n base ES + Dependabot pendiente) quedó cerrada el 2026-05-12. La iteración F se centra en valor de usuario observable: resolver el bug de límites que rompe el upload, que el Detalle del análisis sea visualmente más claro, que el login no tenga huecos críticos y que la app pueda mostrarse en inglés.

### 3.2. Entregables esperados

1. **Bug: asimetría de límites de Upload** (§2.7 + tarea #1 del backlog). Prioridad máxima (regla: bugs sobre features).
2. **Banner "Análisis incompleto" + normalización de defaults a "No detectado"** en KPIs (Issue #6, entregable 1/6).
3. **Flujo "Olvidé mi contraseña"** (`resetPasswordForEmail` + UI + ruta `/reset-password`) (Issue #4, entregable 1/2).
4. **Diccionario EN + LanguageSwitcher** visible en la UI.

Dependabot baja a `Próximas iteraciones` por entrada del bug crítico. Los 7 entregables visuales/auth restantes siguen en `Próximas iteraciones` con orden de prioridad.

### 3.3. Criterios de aceptación globales

- Cada entregable cumple sus criterios definidos en `BACKLOG.md`.
- Ningún entregable rompe el contrato SSE, el schema canónico ni la postura de auth `verify_jwt = true`.
- La suite Vitest sigue verde y respeta los thresholds vigentes (79/65/72/80).
- `pnpm benchmark:pliegos` no se ejecuta a menos que algún entregable toque pipeline o dashboard del análisis; si lo toca, debe quedar verde.
- La app puede cambiarse entre ES y EN sin errores y la selección persiste.
- El bug de límites queda cerrado con tests E2E que cubran el caso de PDF de 20MB (no solo `memo_p2.pdf` de 496 bytes).

## 4. Diseño funcional y técnico de la iteración activa

**Iteración F (Bug Upload + UX Detalle + Auth + i18n EN)**

- **Bug Upload (UI/Backend):** unificar la política de límites entre `useFileValidation`, `analysis.store.ts` y la Edge Function. Eliminar `MAX_PDF_SIZE_MB = 4`. Validar conteo de archivos en backend. Mostrar límites en UI.
- **UX del Detalle (UI):** la base ya está. `src/features/dashboard/model/pliego-vm.ts` expone `isAnalysisEmpty`, `quality.bySection`, `missingCriticalFields`, `warnings[]` y `guidance`. La iteración F entrega valor sumando capa visual sobre ese ViewModel: banner cuando el análisis es vacío, KPIs que muestran "No detectado" en lugar de `0` o `[]`, y posteriormente sticky nav, drawer y empty states con microcopy aprobado en el Issue #6.
- **Auth (Backend + UI):** el flujo actual permite login y signup, pero falta recovery y protección de rutas. La tarea de mayor valor inmediato es "Olvidé mi contraseña". La protección de rutas (`ProtectedRoute`) entra en "Próximas iteraciones".
- **i18n EN (UI/Infra):** la infra `react-i18next` ya inicializa ES. Falta diccionario inglés, selector visible y extracción progresiva de strings hardcoded del Dashboard.
- **Higiene (Infra):** Dependabot semanal, sin impacto runtime. Desplazado a próximas iteraciones por entrada del bug.

El pipeline de análisis y la capa conversacional no son objetivo de esta iteración.

## 5. Próxima iteración

### 5.1. Objetivo

A definir tras observar el impacto de la iteración F. Candidatos serios: completar los entregables restantes del rediseño del Detalle (Issue #6: sticky nav, drawer, JSON modal, kill criteria, empty states, extracción de strings) y endurecer auth (ProtectedRoute + UI de sesión expirada + resend de email confirmation). También: observabilidad de uso (Lighthouse en CI, visual regression con Playwright screenshots), recovery del análisis tras recarga, progreso por archivo durante Fase A.

## 6. Decisiones cerradas

- **Composición multi-documento:** Se usa Vector Store de OpenAI con ingesta secuencial. El documento principal se pasa como `pdfBase64` y los adicionales en array `files`. **La Guía de lectura se inyecta vía `PipelineContext.guideExcerpt` tras la migración M3 (ya no se sube al Vector Store; ver `ARCHITECTURE.md §4.3`).** Decisión: mantener esta arquitectura hasta que se superen las 10 docs por análisis.
- **Límites multi-documento (revisión 2026-05-12):** Máximo 5 archivos, 30MB total. **Sin límite individual por archivo** (decisión recomendada en §2.7; se confirma con la implementación del bug #1). La constante `MAX_PDF_SIZE_MB = 4` de `src/config/constants.ts` queda marcada para retirada porque era incompatible con pliegos reales. Validación preventiva en frontend (`useFileValidation.ts`) y validación defensiva en backend (Edge Function). Si se necesita más, evaluar chunking o vector store persistente por usuario.
- **Migración a `@openai/agents` (2026-05-06):** Pipeline B+C ejecuta a través del SDK pinned a 0.3.1 (zod 3.25.76). Subir a 0.3.2+ requiere migrar schemas a Zod 4; deferido sine die. Tras confirmar paridad en producción (PR #275 + #276) se eliminaron `block-extraction.legacy.ts` y el flag `USE_AGENTS_SDK` (2026-05-09).
- **Auth uniforme (2026-05-09):** ambas Edge Functions usan `verify_jwt = true`. NO reintroducir validación manual del token en los handlers; NO añadir `--no-verify-jwt` al despliegue (sobrescribe `config.toml`). Smoke automático en `Smoke Test` del workflow protege la postura.
- **Cierre de iteración E (2026-05-12):** la cobertura objetivo (≥79% statements) quedó cumplida y los thresholds del proyecto se elevaron a 79/65/72/80 en `vitest.config.ts`. No reabrir como "objetivo de cobertura" en futuras iteraciones; cualquier elevación adicional pasa por nueva decisión de producto.

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

### Riesgo 7: ampliar el flujo de auth sin proteger rutas existentes
Mitigación: la tarea de "reset password" (iteración F) y la de `ProtectedRoute` (próxima iteración) están separadas. No mezclarlas en la misma sesión; introducir `ProtectedRoute` requiere validación específica de rutas públicas vs privadas y no debe colarse como side-effect del reset password.

### Riesgo 8: subir límite individual a 30MB produce timeouts del backend
Mitigación: si tras aplicar el bug #1 (sin límite individual) el pipeline empieza a fallar por timeout en archivos grandes, mantener el conteo máximo de 5 archivos y reducir el total a un valor seguro (p.ej. 20MB) o introducir límite individual en 15MB. Documentar en `§2.7`.

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
- Cobertura de tests iteración E cerrada al 79.95% statements / 80.81% lines (2026-05-12)

### 2026-05-12 — Sesión PO #1: saneamiento de backlog + apertura de iteración F
- `BACKLOG.md` reescrito: se consolida `## Done` en una sola sección, se eliminan duplicados (la tarea "Aumentar cobertura a 80%" aparecía simultáneamente en Done, Ready for QA y To Do), se cierran tareas obsoletas ("Resolver Bloqueo Global de Vitest" ya estaba resuelta según `§4`).
- Se refinan 11 tareas con el formato obligatorio del rol PO: 4 activas en `To Do (Iteración F)` + 7 en `Próximas iteraciones`.
- Se descompone el Issue #6 (rediseño Apple-like del Detalle) en 6 entregables pequeños.
- Se refina el Issue #4 (login) en 2 tareas accionables + 3 notas de deuda técnica.
- Issue #5 ("mejorar arquitectura") devuelto al autor por falta de contenido textual concreto.
- Corrección de §6: la Guía de lectura se inyecta vía `PipelineContext.guideExcerpt` (post-M3), no vía Vector Store como decía la redacción previa.

### 2026-05-12 — Sesión PO #2: auditoría de Upload + bug crítico
- Auditoría funcional del flujo de upload y multi-documento detecta **asimetría de límites** entre `useFileValidation` (drop zone: 5 archivos, 30MB total) y `analysis.store.ts` (rechaza individual > 4MB según `MAX_PDF_SIZE_MB` de `src/config/constants.ts`). Esa constante no estaba documentada en SPEC y rompe el upload silenciosamente con pliegos reales de 5-20MB.
- Bug registrado como tarea #1 de `To Do (Iteración F)` en `BACKLOG.md` con criterios de aceptación verificables.
- Dependabot desplazado de `To Do` a `Próximas iteraciones` para respetar el límite de 4 tareas activas (regla: bugs sobre features).
- Nueva sección `§2.7` define la política de límites recomendada (5 archivos, 30MB total, sin límite individual). `§6` actualiza la decisión cerrada de límites multi-documento. Nuevo `Riesgo 8` en `§7` cubre el caso de que el backend no aguante archivos grandes.
- Fricciones menores adicionales registradas en `BACKLOG.md → Deuda Técnica`: sin display de límites pre-upload, sin progreso por archivo en Fase A, sin recovery post-reload, contradicción entre `ARCHITECTURE.md §7` ("carga secuencial") y el `runWithConcurrency(..., 3)` real de la ingesta.

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
- `.github/workflows/ci-cd.yml`: `deploy-supabase` deja de pasar `--no-verify-jwt` para ambas funciones.
- `Smoke Test` del workflow gana un nuevo paso que verifica con `curl -X POST` sin `Authorization` que ambas funciones devuelven 401 desde el gateway tras cada deploy a `main`. Si la respuesta no es 401, el deploy falla.
- Documentación: `DEPLOYMENT.md` §5, §5.2, §8; `AGENTS.md`; `README.md`.

### 10.5. Eliminación del legacy fallback de Fase C (2026-05-09)
- `phases/block-extraction.legacy.ts` retirado (~12.5 KB) tras confirmar paridad.
- `phases/block-extraction.ts` queda como camino único.
- Flag `USE_AGENTS_SDK` (Supabase secret) ya no se lee en código.

### 10.6. Cierre de iteración E + apertura de iteración F (2026-05-12)
- `vitest.config.ts` consolida thresholds 79/65/72/80 con cobertura real 79.95% statements / 80.81% lines.
- `BACKLOG.md` saneado: una sola sección `## Done`, sin duplicados, sin tareas obsoletas activas; 11 tareas refinadas.
- La iteración F se abre con foco en UX del Detalle (#6 descompuesto), auth (#4 descompuesto) y i18n EN.
- Issue #5 ("mejorar arquitectura") sin contenido accionable; devuelto al autor.

### 10.7. Auditoría de Upload y bug de límites (2026-05-12)
- Auditoría funcional del flujo Upload + multi-documento revela bug crítico de asimetría de límites: `useFileValidation` acepta archivos que `analysis.store.ts` rechaza con `Error` fatal.
- `src/config/constants.ts` define `MAX_PDF_SIZE_MB = 4` que no está documentado en SPEC ni se respeta en el drop zone, y es incompatible con pliegos reales de 5-20MB.
- Tarea registrada como #1 de `To Do (Iteración F)` con criterios verificables y archivos probables. Dependabot desplazado a `Próximas iteraciones`.
- Documentación: nueva `§2.7` (política de límites recomendada), `§6` (decisión de límites multi-documento actualizada), `§8` (entrada de la sesión PO #2), `§7 Riesgo 8` (mitigación si los archivos grandes producen timeout backend).
- Fricciones menores registradas en Deuda Técnica: sin display de límites pre-upload, sin progreso por archivo en Fase A, sin recovery post-reload, posible contradicción `ARCHITECTURE.md §7` (carga secuencial) vs `runWithConcurrency(..., 3)` real.

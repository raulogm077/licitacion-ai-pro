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
- feature flag `USE_AGENTS_SDK=false` (Supabase secret) reactiva `phases/block-extraction.legacy.ts` sin redeploy; se elimina cuando paridad de salida esté confirmada en producción
- detalle operativo y reglas de "cómo añadir un nuevo Agent" en `AGENTS.md`

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
- **Migración a `@openai/agents` (2026-05-06):** Pipeline B+C ahora ejecuta a través del SDK pinned a 0.3.1 (zod 3.25.76). Subir a 0.3.2+ requiere migrar schemas a Zod 4; deferido sine die. Eliminación del fallback `block-extraction.legacy.ts` y del flag `USE_AGENTS_SDK` queda condicionada a paridad de salida medida en producción durante 1-2 semanas.

## 7. Riesgos y mitigaciones

### Riesgo 1: romper el contrato SSE
Mitigación: todo cambio en `analyze-with-agents` debe validar compatibilidad de eventos y consumo frontend.

### Riesgo 2: documentación obsoleta
Mitigación: ningún cambio pasa a QA sin actualizar documentación mínima afectada.

### Riesgo 3: tareas demasiado grandes
Mitigación: dividir cualquier épica en entregables de una sola sesión.

### Riesgo 4: desalineación con la Guía de lectura
Mitigación: el AI Engineer debe contrastar cada cambio de extracción contra la guía antes de entregar.

### Riesgo 5: regresión semántica tras la migración a `@openai/agents`
Mitigación: feature flag `USE_AGENTS_SDK=false` reactiva `block-extraction.legacy.ts` sin redeploy. La eliminación del legacy fallback queda condicionada a paridad confirmada en producción con `pnpm benchmark:pliegos` y smoke tests sobre fixtures de referencia.

## 8. Historial de implementación

### Implementado previamente
- spike técnico planificado para evaluar OpenAI Agents SDK en Edge Functions sin afectar producción
- streaming por SSE
- historial avanzado de licitaciones
- limpieza principal de arquitectura legacy de colas
- Plantillas Dinámicas de Extracción (Back, Front, CRUD, AI Integrations)
- Soporte Multi-documento Backend (Edge Function adaptada para recibir Array de files)
- Migración M1+M2+M3 del pipeline `analyze-with-agents` a `@openai/agents@0.3.1` (2026-05-06)

## 9. Capa conversacional con Agents SDK sobre análisis persistidos

### 9.1. Objetivo

Permitir consultas conversacionales sobre análisis ya guardados sin reprocesar PDFs ni alterar el pipeline batch de `analyze-with-agents`.

### 9.2. Alcance

- Edge Function productiva: `supabase/functions/chat-with-analysis-agent/index.ts`
- autenticación JWT usando el mismo patrón de `analyze-with-agents`
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

### 9.6. Evolución aplicada sobre producto

La validación inicial del runtime con Agents SDK ya se absorbió en la capa productiva `chat-with-analysis-agent`. El spike técnico se retiró del repositorio para evitar duplicidad y mantenimiento muerto.

Alcance aplicado:

- consulta sobre análisis ya persistidos, nunca sobre PDFs sin procesar
- continuidad conversacional mediante `sessionId`
- persistencia UX en navegador con `localStorage`
- evidencias y herramientas utilizadas visibles en la respuesta

### 9.5. Criterios de fallo

Si la capa conversacional introduce incompatibilidades relevantes de Deno/npm o del runtime de Supabase Edge con `@openai/agents`, se debe desactivar su despliegue y rediseñar fuera del camino crítico batch.

### Implementado previamente
- Soporte Multi-documento Frontend y QA
- Integrar advertencias de consistencia semántica en la interfaz (`AlertsPanel`, `pliego-vm.ts`)
- Implementar UI de feedback de extracción de usuario (`FeedbackToggle` en componentes de resultados)

### Iteración completada: Consolidación de Seguridad (Iteración A - Auditoría)
- Habilitar verificación JWT en Edge Function `analyze-with-agents`
- Implementar detección pre-commit de secretos
- Pre-commit hook con lint-staged
- Configurar CSP headers y security headers en Vercel
- Integrar FeedbackToggle en KpiCards del Dashboard
- Limpieza de código muerto (config `analyze-licitacion` eliminada)
- Actualización de documentación (BACKLOG, SPEC, ARCHITECTURE, AUDIT)

### Iteración completada: Rendimiento y DX (Iteración C - Auditoría)
- ChapterComponents refactorizados: data-driven rendering con `chapter-config.ts` + `ChapterRenderer.tsx` (~90 líneas)
- ChapterComponents.tsx limpiado de 265→80 líneas (solo ChapterSummary), ChapterComponentsPart2.tsx de 261→50 líneas (solo TechnicalJsonModal)
- Caching implementado: `SimpleCache` en `src/lib/cache.ts`, integrado en `db.service.ts` y `template.service.ts` con invalidación por mutaciones
- Feature flag `enableCaching` activado por defecto
- Docker Compose configurado: `docker-compose.yml` + `Dockerfile` para desarrollo local (PostgreSQL + Vite dev)
- Feedback de extracción conectado a base de datos: tabla `extraction_feedback` con RLS, `FeedbackService`, `FeedbackToggle` actualizado
- Decisiones abiertas de SPEC.md §6 resueltas (composición multi-doc, límites)
- Tests: 251 tests en 48 suites (cache, ChapterRenderer, feedback.service)
- Documentación actualizada: AUDIT.md, BACKLOG.md, SPEC.md

### Iteración completada: Calidad de Código y Testing (Iteración B - Auditoría)
- ESLint `no-explicit-any` escalado de "warn" a "error", 11 violaciones corregidas
- Refactorización TemplatesPage.tsx: 417→80 líneas + useTemplates hook + TemplateForm/TemplateList/TemplateFieldEditor
- Refactorización AnalysisWizard.tsx: 406→80 líneas + useFileValidation hook + UploadStep/AnalyzingStep/StepIndicator
- Eliminado `eslint-disable @typescript-eslint/no-explicit-any` de Dashboard.tsx y todos los test files
- E2E multi-upload test estabilizado: eliminado test.skip, mejorado mocking de auth
- Cobertura de tests: 56% → 67% statements, 44% → 50% branches (231 tests, 45 suites)
- Thresholds de cobertura subidos a 65/50/58/65
- Tests añadidos: useFileValidation, useTemplates, auth.store, licitacion.store, analysis.store, useKeyboardShortcut, Result, file-utils, llmFactory, logger, perfTracker

### 4.2. Refinamiento Multi-Documento (Frontend)

El flujo de carga en `AnalysisWizard.tsx` debe modificarse de la siguiente manera:
1.  **Estado:** Reemplazar `selectedFile` (tipo `File | null`) por `selectedFiles` (tipo `File[]`).
2.  **Límite:** Validar que `selectedFiles.length <= 5`. Mostrar mensaje de error claro si se excede.
3.  **Tamaño total:** Sumar el tamaño de todos los archivos en `selectedFiles` y validar contra `MAX_PDF_SIZE_BYTES` (30MB).
4.  **UI de Listado:** Reemplazar el bloque que muestra el único archivo seleccionado por un listado mapeando `selectedFiles`. Cada elemento debe tener su botón para eliminarlo del array.
5.  **Store:**
    - Modificar `analyzeFile` en `analysis.store.ts` para que reciba un array `files: File[]`.
    - Actualizar llamadas a `processFile(file)` para iterar y extraer `{ name, base64 }` de todos los documentos, pasando el primero como principal y el resto en el array `files`.
    - Enviar el objeto o parámetros correspondientes a `services.ai.analyzePdfContent`.

6.  **AI Service / Job Service:**
    - `analyzePdfContent` en `ai.service.ts` debe recibir `files` y pasarlo a `JobService.analyzeWithAgents`.
    - Asegurarse que el backend (`analyze-with-agents`) está preparado para el array de `files` extra que recibe `JobService`.

*Nota de implementación: Es crucial que el archivo principal se pase como `pdfBase64` y los adicionales en el array `files` para mantener retrocompatibilidad con la Edge Function, o refactorizar el backend para que todo entre por `files`.*

### 4.2. Refinamiento Multi-Documento (Frontend) - Implementado
- **Estado:** Se reemplazó `selectedFile` por `selectedFiles: File[]` en `AnalysisWizard.tsx`.
- **Límite:** Se implementó límite de 5 archivos y validación de 30MB en total de archivos.
- **UI de Listado:** Se lista ahora un div scrolleable mostrando los nombres, tamaños y un botón de borrar para cada archivo; el primer archivo se resalta como Principal.
- **Store:** `analyzeFile` se migró a `analyzeFiles`, procesando cada archivo secuencialmente para extracción de `base64` en `useAnalysisStore`.
- **Servicios:** Se modificó la firma `analyzePdfContent` en `ai.service.ts` para aceptar la inyección del parámetro `files?: {name: string, base64: string}[]` que es pasado de forma íntegra a `JobService.analyzeWithAgents`.

### 4.3. Refinamiento Multi-Documento (Backend AI) - Implementado
- **Ingesta:** La Edge Function `analyze-with-agents` ingiere los documentos adicionales de forma *secuencial* para evitar picos de uso de memoria (Límite 256MB/512MB en Vercel/Supabase Edge Functions).
- **Prompt Dinámico:** El contexto enviado a la IA declara explícitamente el documento principal y enumera los nombres de todos los archivos adicionales que configuran el "expediente".
- **Polling:** El chequeo del estado del Vector Store de OpenAI usa ahora *Exponential Backoff* para minimizar solicitudes a la API durante la indexación.



### 4.4. Refinamiento Guía de Lectura (Backend AI) - Implementado
Se ha detectado un hueco funcional en la inyección de la **Guía de lectura de pliegos**. Actualmente el modelo instruye al agente a buscar la "Guía" con `file_search`, pero ésta no forma parte del Vector Store que la Edge Function aprovisiona en runtime.
- **Acción Doc:** Convertida la "Guia Lectura de Pliegos .pdf" a formato `.md` y depositada directamente en `supabase/functions/analyze-with-agents/`.
- **Acción AI:** Se ha refactorizado `analyze-with-agents/index.ts` para que lea el archivo markdown local (`Guía de lectura de pliegos.md`) usando `Deno.readTextFile`, y se inyecte de forma programática y explícita subiéndolo al Vector Store de OpenAI (`purpose: 'assistants'`) durante la ejecución de la función por cada análisis. Esto garantiza que el Agente siempre tenga acceso a las directrices de negocio para el análisis de pliegos.
- **Acción Doc:** Convertir la "Guia Lectura de Pliegos .pdf" a formato `.md` y depositarla directamente en `supabase/functions/analyze-with-agents/`.
- **Acción AI:** Refactorizar `analyze-with-agents/index.ts` para que incluya de forma programática y explícita el archivo markdown local en la creación del Vector Store por cada análisis.
  - *Detalle técnico:* Se reemplazó la inyección via base64 desde el frontend (`guiaBase64`) por una lectura asíncrona local del Edge Function usando `Deno.readTextFile`, construyendo un `File` tipo `text/markdown` para subir a la API Files de OpenAI.


## 9. Security & Secrets Management

Dado que este repositorio es **público**, el manejo de secretos y variables de entorno es un área de nivel crítico.

### Políticas de Seguridad
- **Cero Secretos Hardcodeados:** Nunca incluir API keys reales (Google Gemini, OpenAI, Supabase, Vercel, Github, etc.) en texto plano dentro de código, scripts de inicialización (`.sh`, `.ts`, `.py`), archivos JSON, o documentación.
- **Inyección Dinámica:** Todo token o secreto debe inyectarse estrictamente a través del sistema de variables de entorno de la infraestructura subyacente (ej. Variables de entorno de Vercel, Supabase Secrets, o GitHub Secrets para CI/CD).
- **Uso de Entornos de Ejemplo:** Todo ejemplo o template (ej. `.env.example`) debe utilizar *placeholders* genéricos (`your-api-key-here`, `sk-XXXXX...`).
- **Prevención proactiva:** Utilizar herramientas pre-commit o CI (como detect-secrets o hooks similares) para prevenir y alertar la inclusión accidental de material sensible en futuras modificaciones del repositorio.
El incumplimiento de esta política expone infraestructura de producción de manera global y detendrá el pase a los entornos correspondientes.

## 10. Hallazgos Técnicos y Mantenimiento

### QA: E2E Playwright Tests Bugfix
- **Problema:** En el archivo `e2e/upload-pdf.spec.ts` se utilizó `__dirname`, lo cual no está definido en entornos ESM, provocando que los tests de interfaz fallen en Playwright con `ReferenceError: __dirname is not defined`.
- **Acción Planificada:** Reemplazar el uso de `__dirname` por `import.meta.dirname` para obtener la ruta absoluta compatible con módulos ES. Esto resolverá los timeouts y permitira subir los archivos de prueba exitosamente.

### 10.1. Limpieza de Credenciales (Sentinel)
Se realizó una auditoría y limpieza de credenciales expuestas en el repositorio:
- Se eliminaron las referencias directas y prompts para solicitar `GEMINI_KEY` / `VITE_GEMINI_API_KEY` en `scripts/setup-vercel-env.sh`, ya que Gemini ha sido reemplazado por la arquitectura server-side de OpenAI y el código no debe incitar a configurar variables obsoletas o exponer claves.
- Se verificó mediante scripts de escaneo (`grep`) que no existen claves reales hardcodeadas (ej. `sk-`, `AIza`, `eyJ`) en el código fuente, scripts ni documentación.
- Se actualizó `scripts/test-agents-sdk.ts` para que el `wfId` de prueba utilice variables de entorno (`VITE_OPENAI_WORKFLOW_ID`) en lugar de un string hardcodeado, cumpliendo con la política de seguridad.

### 10.2. Resolución de Errores de Despliegue (Edge Functions)
Durante el ciclo de pruebas E2E y despliegues, se identificó un error 401 en `analyze-with-agents`. Se resolvió temporalmente con `--no-verify-jwt`. Tras la migración M3 a `@openai/agents` (2026-05-06) la función usa `verify_jwt = true` y el flag `--no-verify-jwt` se eliminó del despliegue (ver `DEPLOYMENT.md` §5).

### 10.3. Migración a `@openai/agents` (2026-05-06)
- Fases B y C migradas a `Agent` + `run()` del SDK `@openai/agents@0.3.1`.
- Pin de zod subido a `3.25.76` (mínimo aceptado por el SDK; mayor 3.x estable).
- `verify_jwt = true` activado para `analyze-with-agents`; bloque de auth manual eliminado del handler.
- Tracing del SDK redirigido a `console.log` con prefijo `[trace]` vía `SupabaseLogTraceProcessor`.
- Feature flag `USE_AGENTS_SDK=false` reactiva `phases/block-extraction.legacy.ts` (verbatim del código pre-migración) sin redeploy.
- Reglas duras del SDK (no `outputType` con `file_search`, per-request agents, prompts byte-a-byte, `requestId` en todo) documentadas en `AGENTS.md`.
- La eliminación del legacy fallback queda condicionada a paridad de salida medida en producción durante 1-2 semanas.

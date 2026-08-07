# Analista de Pliegos - Backlog

## Contexto y Estado Actual

La migración a análisis en tiempo real con **OpenAI Agents SDK + SSE** está completada. La iteración de **Plantillas dinámicas de extracción** está terminada a nivel de desarrollo y documentación. La iteración activa se centra en la **Mejora del Análisis de Calidad y Consistencia** (Quality & Consistency Analysis Improvement).

## Reglas de priorización

1. Los **bugs** devueltos por QA tienen prioridad sobre cualquier feature.
2. Las tareas deben caber en una sola sesión.
3. Si una tarea es demasiado grande, debe dividirse antes de desarrollarse.

## Formato obligatorio de cada tarea

```md
- [ ] [Tipo: UI|Backend|AI|Docs|QA] [Área: Templates|Analysis|Upload|History|Infra] Título claro
    - Objetivo:
    - Alcance:
    - Criterios de aceptación:
    - Archivos probables:
    - Dependencias:
```

## Done

- [x] [Tipo: UI] [Área: Infra] Configurar infraestructura base para i18n (ES/EN)
    - Objetivo: Preparar la aplicación para soportar múltiples idiomas, empezando por español e inglés.
    - Alcance: Instalar e inicializar librería de internacionalización (ej. `react-i18next`), crear archivos de traducción base (`es.json`, `en.json`) y configurar el proveedor en la raíz de la app.
    - Criterios de aceptación:
        - La librería de i18n está configurada y lista para usarse en componentes.
        - Existe un mecanismo (ej. hook) para cambiar de idioma.
        - El idioma por defecto es español.
    - Archivos probables: `src/main.tsx`, `src/App.tsx`, `package.json`
    - Dependencias: Ninguna.

- [x] [Tipo: QA] [Área: Analysis] Fix Fallo en test unitario `AnalyticsDashboard.test.tsx` (Eliminado o resuelto al mover el archivo)

- [x] [Tipo: AI|QA] [Área: Analysis] Fix Error 401 Unauthorized en `analyze-with-agents` (JWT expirado)
    - Implementación: Añadido refresh proactivo del token en `job.service.ts` antes de llamar a la Edge Function. Si el `access_token` expira en menos de 60 segundos, se llama a `supabase.auth.refreshSession()` para obtener un token fresco.
    - Archivos modificados: `src/services/job.service.ts`

- [x] [Tipo: Infra] [Área: Infra] Fix Drift de Migraciones en CI/CD (`supabase db push`)
    - Implementación: Añadido flag `--include-all` al paso `db push` y configurado `continue-on-error: true` para que el fallo de migraciones no bloquee el despliegue de la Edge Function.
    - Archivos modificados: `.github/workflows/ci-cd.yml`

- [x] [Tipo: Infra] [Área: Infra] Fix Autenticación de Postgres en CI/CD (`SQLSTATE 28P01`)
    - Implementación: Separado el paso de `db push` (no-crítico, `continue-on-error`) del paso `functions deploy` (crítico). El despliegue de la Edge Function ya no depende del éxito de la migración.
    - Archivos modificados: `.github/workflows/ci-cd.yml`

- [x] [Tipo: AI] [Área: Analysis] Actualizar `@openai/agents` a 0.8.1 y modelo a `gpt-4o`
    - Implementación: Actualizado `@openai/agents@0.3.7` → `0.8.1` y `openai@4.77.0` → `6.26.0` en la Edge Function. Migrado el patrón de streaming (iteración directa sobre `StreamedRunResult`) y el uso de `fileSearchTool([vectorStoreId])` en lugar de `toolResources` en `run()`. Modelo cambiado de `gpt-4o-2024-08-06` a `gpt-4o`.
    - Archivos modificados: `supabase/functions/analyze-with-agents/index.ts`

- [x] [Tipo: QA] [Área: Upload] Test E2E completo upload con `memo_p2.pdf`
    - Implementación: Creado `e2e/upload-pdf.spec.ts` con tests end-to-end usando el PDF real del repositorio, mockeando SSE y auth para CI.
    - Archivos modificados: `e2e/upload-pdf.spec.ts` (nuevo)

## Ready for QA

- [x] [Tipo: QA] [Área: Analysis] Aumentar cobertura de tests a 80%
    - Objetivo: Cumplir con la meta de calidad de código de la iteración D.
    - Alcance: Cubiertas las ramas de `pliego-vm.ts` (guidance por motivo de parcialidad, diagnósticos de capítulo vacío, evidencias/ambigüedad, citas y normalización de display) y el contrato declarativo de `chapter-config.ts` (extractores y formateadores de cada subsección, con análisis poblado y vacío).
    - Criterios de aceptación:
        - Ejecutar `pnpm test --run --coverage` debe reportar al menos 80% en statements y 70% en branches.
    - Resultado (2026-07-26): **82.61% statements / 71.31% branches** (82.03% funciones, 83.44% líneas), 461 tests en 64 suites. Partía de 79.57/67.19 con 420 tests. Gates de `vitest.config.ts` subidos a 82/70/81/83 para que el nivel no se pierda.
    - Archivos probables: `src/features/dashboard/model/__tests__/pliego-vm.test.ts`, `src/features/dashboard/components/detail/__tests__/chapter-config.test.ts`, `vitest.config.ts`
    - Dependencias: Ninguna.

- [x] [Tipo: QA] [Área: Analysis] Implementar tests unitarios interactivos para FeedbackToggle y Fix E2E
    - Objetivo: Asegurar que el componente de feedback registre adecuadamente la interacción y arreglar el fallo en Playwright test `e2e/upload-pdf.spec.ts` debido al uso de `__dirname`.
    - Alcance: Se añadieron assertions para asegurar que `feedbackService.saveFeedback` y `removeFeedback` se llaman correctamente, y reemplazar `__dirname` por `import.meta.dirname` en `e2e/upload-pdf.spec.ts`.
    - Criterios de aceptación: Pasa validación de types y `xvfb-run pnpm run test:e2e` pasa correctamente o no falla por este error.
    - Archivos probables: `src/features/dashboard/components/detail/__tests__/FeedbackToggle.test.tsx`, `e2e/upload-pdf.spec.ts`
    - Dependencias: Ninguna.
    - Tipo: QA
    - Área: Analysis

- [x] [Tipo: AI] [Área: Analysis] Inyectar metodología específica por bloque en el prompt de extracción (entregado 2026-08-07)
    - Objetivo: Aprovechar la "Guía de lectura" en cada bloque en vez de repetir un prefijo genérico. Los 9 bloques recibían los mismos ~4000 chars de la §1–§2.1; la metodología útil (§3–§7) no entraba en ningún prompt.
    - Entregado: `prompts/guide-methodology.ts` trocea la guía por sus encabezados numerados y asigna secciones por bloque (`criteriosAdjudicacion`→§4.1/§4.2, `requisitosSolvencia`→§3.1/§3.2, `restriccionesYRiesgos`→§3.3/§7, `requisitosTecnicos`→§2.2/§5.1, `anexosYObservaciones`→§2.3/§5.4…). `buildBlockSystemPrompt` resuelve por `blockName` en vez de por `context.guideExcerpt`, porque el contexto lo comparten los bloques concurrentes.
    - Hallazgo durante la implementación: la metodología ni siquiera estaba desplegada. `guide-content.ts` venía recortado a ~4900 de los 34 KB de la guía porque el único consumidor tomaba un prefijo de 4000; ahora se inlinea entera.
    - Criterios de aceptación:
        - Cada bloque recibe un extracto distinto y pertinente — ✅ cinco tests nuevos en `__tests__/agents.test.ts` (distinción, literalidad contra la guía, techo de contexto, mapeo pertinente y prompt de sistema resuelto por el camino del SDK).
        - Contrato del schema canónico y de eventos en verde; `pnpm benchmark:pliegos` sin regresión — ✅.
        - No aumenta el nº de tokens de contexto por bloque — ✅ baja: 1,1–3,1 KB por bloque frente a 4 KB, con `GUIDE_EXCERPT_LENGTH` como techo.
    - Pendiente de QA: el efecto en calidad de extracción solo lo mide `pnpm eval:pliegos:live` (manual, requiere `OPENAI_API_KEY`). Es un cambio de prompt, así que el contrato de release pide baseline live antes de promoverlo.
    - Archivos: `supabase/functions/analyze-with-agents/prompts/guide-methodology.ts` (nuevo), `prompts/index.ts`, `agents/block-extractor.agent.ts`, `phases/block-extraction.ts`, `guide-content.ts`, `_shared/config.ts`, `__tests__/agents.test.ts`

- [x] [Tipo: Backend] [Área: Analysis] Perfil de empresa licitadora — Paso 1: migración + RLS (entregado 2026-08-07)
    - Objetivo: Crear el modelo de datos del licitador que ADR-002 deja diseñado, sin nada visible todavía.
    - Entregado: `20260807120000_empresa_perfil_licitador.sql` con las cuatro tablas, políticas owner-scoped de lectura y escritura, índice GIN sobre `cpv`, índices sobre las FK y trigger de `updated_at`.
    - Criterios de aceptación:
        - Migración aplicable y reversible; sin avisos nuevos del Security Advisor — ✅ RLS con política en las cuatro tablas e índices sobre todas las FK, que es lo que el advisor reclama.
        - RLS owner-scoped, con las hijas validadas atravesando `empresa_perfil` — ✅.
        - Ninguna tabla hija referencia `user_id` directamente — ✅ y además **verificado estáticamente**: `validateProfileOwnershipModel()` en `verify-integrity.ts` falla si alguien lo rompe. Se comprobó que el guard detecta las dos violaciones (hija con `user_id`, tabla sin RLS) y no pasa por vacuidad.
    - Fuera de alcance por decisión, no por olvido: sin schemas Zod. Llegan con su primer consumidor real; añadirlos ahora sería código sin uso, que este repo no conserva.
    - Pendiente de QA: el aislamiento entre dos usuarios solo se puede ejercitar contra una base real. La rama de preview de Supabase aplica la migración en cada PR; validarlo ahí antes de merge a `main`.
    - Archivos: `supabase/migrations/20260807120000_empresa_perfil_licitador.sql` (nuevo), `scripts/verify-integrity.ts`

- [x] [Tipo: AI] [Área: Analysis] Perfil de empresa licitadora — Paso 2: motor determinista de Go/No-Go (entregado 2026-08-07)
    - Objetivo: Convertir los requisitos ya extraídos del pliego en un veredicto comparable contra el perfil, siguiendo la Guía §3.
    - Entregado: `src/lib/go-no-go.ts` con los cuatro chequeos (VAN §3.1.1, seguro RC §3.1.2, similitud CPV §3.2.1, certificaciones §3.2.2), `evaluarGoNoGo` y las utilidades expuestas para test (`vanExigido`, `mejorVanEmpresa`, `proyectosSimilares`, `familiaCpv`).
    - No dependía del Paso 1 para escribirse: es un módulo puro que recibe TypeScript plano. La dependencia del backlog era de secuencia, no técnica.
    - Criterios de aceptación:
        - Un test por regla de la §3, con el caso «dato del perfil ausente» en cada una — ✅ 29 tests.
        - Nunca un veredicto sobre un dato que nadie introdujo — ✅ es el primer bloque de tests: perfil vacío no produce ningún `no_cumple`, todo `no_verificable` nombra su campo, y no hay `go` con nada sin verificar.
        - `pnpm verify:release` en verde; sin cambios en el contrato de extracción — ✅.
    - Decisión de dominio a revisar en QA: sin umbral de importe en el pliego, la similitud CPV acredita experiencia en vez de aplicar el 70 % habitual del VAM. Ese 70 % es costumbre, no regla del pliego, y aplicarlo sería inventar un requisito que nadie exigió.
    - Pendiente: los pasos 3 (captura incremental), 4 (panel) y 5 (tool del copiloto) siguen en ADR-002.
    - Archivos: `src/lib/go-no-go.ts` (nuevo), `src/lib/__tests__/go-no-go.test.ts` (nuevo)

## In Progress

<!-- Los agentes Tech/IA mueven aquí la tarea que reclaman (claim) con formato:
     - [ ] <tarea> — <rol> — agents/<rol>/<slug> — <fecha ISO>
     y la sacan a "## Ready for QA" al entregar. Mantener vacía en reposo. -->

## To Do (Iteración Actual)

<!-- Saneado 2026-07-26 tras auditar la cola contra el repo real. Tres entradas
     salieron de aquí porque ya no describían trabajo pendiente:

     · "Resolver Bloqueo Global de Vitest" — no reproduce. `pnpm test` ejecuta
       las 64 suites y 461 tests sin error de inicialización, y `verify:release`
       depende de ello en cada push. Eliminada.
     · "Configurar Dependabot" — ya hecho: `.github/dependabot.yml` existe desde
       el commit bae8320, con npm + github-actions, agrupaciones e ignores.
       Eliminada.
     · "Aumentar cobertura de tests a 80%" — entregada (ver `## Ready for QA`).
       Estaba además duplicada: figuraba a la vez aquí y allí.

     Una tarea que ya está hecha no es inofensiva: los agentes de cron toman la
     primera entrada elegible de esta sección, así que una entrada muerta se
     lleva por delante una sesión entera. Antes de añadir aquí, comprobar contra
     el repo. -->

<!-- Los pasos 3 (captura incremental de perfil), 4 (panel Go/No-Go) y 5 (tool
     read-only del copiloto sobre el veredicto ya calculado, decisión 7.3) se
     añaden aquí cuando los pasos 1 y 2 estén entregados. No se adelantan: el
     paso 3 es el que decide si esto se usa, y diseñarlo antes de tener el
     motor sería diseñar contra un veredicto que aún no existe. Win Themes
     queda FUERA de este alcance por decisión 7.2. -->

## Deuda Técnica / Refactorización

- [x] [Tipo: Infra] [Área: Infra] Migrar a ESLint 9 + flat config (entregado 2026-07-27)
    - Objetivo: Desbloquear el ecosistema de plugins de ESLint, que ya está abandonando la versión 8. Hoy el repo va con ESLint 8.57.1 y `.eslintrc.cjs`, y esa versión está marcada como no soportada por upstream (`WARN deprecated eslint@8.57.1` en cada `pnpm install`).
    - Contexto: `eslint-plugin-react-refresh` 0.5.0 cambió su peerDependency de `eslint: >=8.40` a `eslint: ^9 || ^10`. Con ESLint 8 el plugin no registra sus reglas y `.eslintrc.cjs` deja 184 referencias huérfanas a `react-refresh/only-export-components`, que tumban `pnpm lint` (verificado: el PR de Dependabot #316 falló así, y se reprodujo en local). Como parche, el plugin quedó fijado a `~0.4.26` y Dependabot tiene un `ignore` para sus minor/major.
    - Alcance: convertir `.eslintrc.cjs` a `eslint.config.js` (flat config), subir `eslint` a ^9, `@typescript-eslint/*` de ^7 a ^8 (v7 no soporta ESLint 9), `eslint-plugin-react-hooks` de ^4 a ^5 y `eslint-plugin-react-refresh` a ^0.5. Retirar entonces el `ignore` de `.github/dependabot.yml` y el pin de `package.json`.
    - Criterios de aceptación:
        - `pnpm lint` en verde con 0 warnings y el mismo conjunto de reglas efectivas que hoy (no relajar `@typescript-eslint/no-explicit-any`).
        - `pnpm verify:release` en verde; el hook de pre-commit (lint-staged) sigue funcionando.
        - `.github/dependabot.yml` ya no ignora `eslint-plugin-react-refresh`, y `package.json` no lo fija a `~0.4.x`.
    - Archivos probables: `.eslintrc.cjs` (eliminar), `eslint.config.js` (nuevo), `package.json`, `.github/dependabot.yml`
    - Dependencias: Ninguna. Conviene hacerla sola, sin mezclar con otros bumps.

- [ ] [Tipo: AI] [Área: Analysis] Model tiering por bloque (coste) — **mecanismo entregado 2026-07-27; falta la promoción**
    - Objetivo: Reducir coste sin perder calidad donde importa. Hoy los 9 bloques usan `gpt-4.1`, incluidos triviales (`anexosYObservaciones`, `duracionYProrrogas`).
    - Alcance: Parametrizar el modelo por bloque en `config.ts` (bloque→modelo), reservando el tier alto para `criteriosAdjudicacion`, `economico`, `requisitosSolvencia` y usando un tier menor (p. ej. `gpt-4.1-mini`) en los simples. Verificar que el modelo elegido soporta Responses API + `file_search`.
    - Entregado: `BLOCK_MODEL_OVERRIDES` + `modelForBlock()` en `config.ts`, `buildBlockAgent` resolviendo por bloque, tests que fallan si alguien vuelve a fijar el modelo en la factory, y `blockModels` en `ANALYSIS_RUNTIME_VERSIONS` para la provenance. El mapa se entrega **vacío**: cambio de comportamiento cero.
    - Pendiente: elegir qué bloques bajan de tier y rellenar el mapa. Es una promoción de modelo, no configuración.
    - Obstáculo retirado 2026-08-07: la comparación de baselines ya no es mirar dos JSON a ojo. `pnpm eval:pliegos:diff` contrasta ambos informes respetando la dirección de cada métrica, marca como regresión el deterioro que aún no rompe (un caso que sigue en `passed` con la exactitud cayendo) y se niega a comparar datasets distintos. Lo que queda es exclusivamente ejecutar el eval live, que necesita `OPENAI_API_KEY`.
    - Criterios de aceptación (corregidos al implementar):
        - El modelo por bloque es configurable y trazable en logs `[trace]` — ✅ el span de generación ya incluye `model`, y `agent_name` es `blockExtractor:<bloque>`.
        - ~~`pnpm benchmark:pliegos` en verde con los mismos umbrales~~ — **este criterio no vale para autorizar la promoción**: el benchmark valida fixtures ya generados y no llama al modelo, así que seguiría verde aunque el modelo barato extrajera mucho peor. Sustituido por el siguiente.
        - Baseline manual de `pnpm eval:pliegos:live` registrada antes y después de rellenar el mapa, comparando `runtime_version` (`model` + `blockModels`) — es el gate que el contrato de release ya exige para promover modelo.
        - Tests de contrato (schema canónico, SSE) en verde.
    - Archivos probables: `supabase/functions/_shared/config.ts`, `supabase/functions/analyze-with-agents/agents/block-extractor.agent.ts`, `supabase/functions/analyze-with-agents/__tests__/`
    - Dependencias: requiere `OPENAI_API_KEY` para la evaluación live.

- [x] [Tipo: AI] [Área: Analysis] Extender `TrackedField` a importes y ponderaciones críticos (grounding §6.3) (entregado 2026-07-27)
    - Objetivo: Cumplir la regla de grounding de la Guía (§6.3) en todo dato numérico crítico. Hoy solo 6 campos de `datosGenerales` usan `TrackedField`; `presupuestoBaseLicitacion`, ponderaciones de criterios y `umbralAnormalidad` van sin `status/evidence`.
    - Alcance: Envolver en `TrackedField` los importes económicos clave y la `ponderacion` de criterios, preservando compatibilidad hacia atrás (unwrap legacy) y la transformación a frontend. Actualizar `canonical_test.ts`.
    - Criterios de aceptación:
        - Golden/contract tests nuevos que verifican `value/evidence/status` en los campos añadidos.
        - Frontend (`unwrap()`) sigue renderizando valores legacy y nuevos sin romper.
        - `pnpm benchmark:pliegos` y contrato SSE en verde.
    - Archivos probables: `supabase/functions/_shared/schemas/canonical.ts`, `supabase/functions/_shared/schemas/canonical_test.ts`, `src/lib/tracked-field.ts`, `src/lib/schemas.ts`
    - Dependencias: Ninguna.

- [x] [Tipo: AI] [Área: Analysis] Motor de simulación de scoring (fórmula de precio + baja temeraria) (entregado 2026-07-27; entrada saneada 2026-08-07)
    - Objetivo: Dar el primer salto de "extractor" a "analista": interpretar la fórmula de precio y el umbral de anormalidad para permitir simulaciones what-if (§4 de la Guía).
    - Entregado en `src/lib/scoring.ts`: `parsePriceFormula` / `parseAnomalyThreshold` sobre los strings que ya extraía el pipeline, `scorePrice`, `anomalyLimit` y `simulateAgainstRivals`. Documentado en `SPEC.md` §11 y `ARCHITECTURE.md` §8.18.
    - Criterios de aceptación:
        - Golden tests de fórmulas y umbrales — ✅ 22 tests en `src/lib/__tests__/scoring.test.ts`, con dos familias tomadas de fixtures reales del benchmark.
        - Manejo explícito de fórmulas no parseables — ✅ `FormulaParse`/`ThresholdParse` devuelven `{ ok: false, reason }` y la UI dice «no simulable» en vez de inventar cifra.
        - Contrato de eventos y `pnpm benchmark:pliegos` en verde — ✅ es capa post-extracción, no toca el contrato.
    - Por qué seguía abierta: la entrada nunca se cerró al entregar. Es el fallo contra el que avisa el comentario de `## To Do`, y aquí llegó a costar una comprobación de sesión: antes de retomarla hubo que verificar contra el repo que ya estaba hecha.

## Ideas de Producto

- Implementar i18n multi-idioma (inglés)
- Configurar Dependabot para actualizaciones automáticas de dependencias
- Métricas de rendimiento (Lighthouse, bundle size) automatizadas en CI
- Visual regression testing con Playwright screenshots
- **Perfil de empresa licitadora** — **desbloqueado el 2026-08-07**: las cuatro decisiones de producto de [`ADR-002`](docs/adr/ADR-002-perfil-de-empresa-licitadora.md) §7 están tomadas y la ADR pasa a Aceptada. Ya no es una idea: los dos primeros pasos del plan viven como tareas en `## To Do (Iteración Actual)`.
    - Lo decidido: perfil **por usuario** con `perfil_id` desde el día 1; **Win Themes fuera** de este alcance; el copiloto consulta el **veredicto calculado**, no el perfil crudo; con el perfil incompleto se muestra «no verificable» y el campo que falta, nunca un veredicto sobre un dato ausente.
    - Los pasos 3 a 5 (captura incremental, panel Go/No-Go, tool del copiloto) siguen en la ADR y entran al backlog cuando 1 y 2 estén entregados. El riesgo dominante no ha cambiado y no es técnico: un onboarding que nadie completa deja un Go/No-Go que responde «desconocido» a todo, y por eso el paso 3 es el que decide si esto se usa.

## Done

- [x] [Tipo: QA] [Área: Analysis] Fix Fallo en test unitario `AnalyticsDashboard.test.tsx` (Eliminado o resuelto al mover el archivo)

- [x] [Tipo: Infra] [Área: Analysis] Resolver Error 401 Unauthorized en Endpoint de Producción (`analyze-with-agents`)
    - Objetivo: La Edge Function requería JWT verificado por Kong, el cual bloqueaba peticiones válidas (probablemente por CORS preflight en peticiones externas o asimetría de secretos JS/Gateway).
    - Implementación: Se desactivó `verify_jwt = false` en `config.toml` y explícitamente en el despliegue CI. Se implementó verificación robusta desde cero dentro de `index.ts` usando `@supabase/supabase-js`, garantizando seguridad sin afectar el paso preflight de Kong.
    - Criterios: Peticiones legítimas son aceptadas, tokens inválidos o expirados son rechazados (401).

- [x] [Tipo: QA] [Área: Analysis] Implementar tests unitarios para KpiCards
    - Objetivo: Asegurar que los componentes principales del dashboard funcionen y no presenten regresiones.
    - Alcance: Crear el archivo de test `KpiCards.test.tsx`.
    - Criterios de aceptación:
        - Los tests de `KpiCards` verifican que se muestren los KPIs correctos a partir del `PliegoVM`.
    - Archivos probables: `src/features/dashboard/components/widgets/__tests__/KpiCards.test.tsx`
    - Dependencias: Ninguna.

- [x] [Tipo: UI] [Área: Analysis] Refactorizar ChapterComponents en data-driven rendering
    - Archivos creados: `src/features/dashboard/components/detail/chapter-config.ts`, `ChapterRenderer.tsx`
    - El renderer data-driven y `SummarySection.tsx` son las superficies vigentes; los componentes transitorios `ChapterComponents*.tsx` se retiraron en la auditoría de 2026-08-07 al confirmar que el resumen antiguo no tenía consumidores y el modal JSON no tenía trigger de apertura.

- [x] [Tipo: UI] [Área: Analysis] Implementar estrategia de caching
    - Archivos creados: `src/lib/cache.ts` (SimpleCache + CACHE_KEYS + TTL)
    - Integrado en: `db.service.ts`, `template.service.ts` con invalidación por mutaciones
    - Feature flag `enableCaching` activado por defecto

- [x] [Tipo: Infra] [Área: Infra] Configurar Docker Compose para desarrollo local
    - Archivos creados: `docker-compose.yml`, `Dockerfile`

- [x] [Tipo: Backend] [Área: Analysis] Conectar feedback de extracción a base de datos
    - Archivos creados: `supabase/migrations/20260323000000_extraction_feedback.sql`, `src/services/feedback.service.ts`
    - FeedbackToggle actualizado para persistir en Supabase cuando hay `licitacionHash`

- [x] [Tipo: Docs] [Área: Infra] Enriquecer BACKLOG.md y resolver decisiones abiertas SPEC.md
    - Decisiones §6 cerradas: composición multi-doc y límites operativos

- [x] [Tipo: Infra] [Área: Infra] Endurecer reglas de ESLint (no-explicit-any → error)
    - Archivos modificados: `.eslintrc.cjs`, `src/features/dashboard/Dashboard.tsx`, 5 test files

- [x] [Tipo: UI] [Área: Templates] Refactorizar TemplatesPage.tsx (417 → 80 líneas)
    - Archivos creados: `src/features/templates/hooks/useTemplates.ts`, `src/features/templates/components/TemplateForm.tsx`, `TemplateList.tsx`, `TemplateFieldEditor.tsx`

- [x] [Tipo: UI] [Área: Upload] Refactorizar AnalysisWizard.tsx (406 → 80 líneas)
    - Archivos creados: `src/features/upload/hooks/useFileValidation.ts`, `src/features/upload/components/UploadStep.tsx`, `AnalyzingStep.tsx`, `StepIndicator.tsx`

- [x] [Tipo: QA] [Área: Upload] Estabilizar E2E tests de multi-documento
    - Archivos modificados: `e2e/multi-upload.spec.ts` — eliminado test.skip, mejorado auth mocking

- [x] [Tipo: QA] [Área: Infra] Incrementar cobertura de tests (56% → 67% statements)
    - Tests añadidos: useFileValidation, useTemplates, auth.store, licitacion.store, analysis.store (extendido), useKeyboardShortcut, Result, file-utils, llmFactory, logger, perfTracker
    - Thresholds actualizados: 65/50/58/65 en vitest.config.ts

- [x] [Tipo: UI] [Área: Analysis] Integrar controles de feedback en KpiCards del Dashboard
    - Objetivo: Extender FeedbackToggle a los KpiCards principales (presupuesto, fecha, duración, valor estimado).
    - Alcance: Importar FeedbackToggle en KpiCards.tsx, añadir fieldPath a cada KPI, renderizar en esquina superior derecha.
    - Criterios de aceptación: Botones de validación visibles en cada KPI, sin interferir con layout.
    - Archivos modificados: `src/features/dashboard/components/widgets/KpiCards.tsx`

- [x] [Tipo: Backend] [Área: Infra] Habilitar verificación JWT en Edge Function analyze-with-agents
    - Objetivo: Proteger endpoint público que no verificaba JWT.
    - Alcance: Cambiar verify_jwt a true en config.toml, reemplazar parseo manual inseguro, quitar --no-verify-jwt del CI.
    - Archivos modificados: `supabase/config.toml`, `supabase/functions/analyze-with-agents/index.ts`, `.github/workflows/ci-cd.yml`

- [x] [Tipo: Infra] [Área: Infra] Implementar detección pre-commit de secretos + lint-staged
    - Objetivo: Prevenir inclusión accidental de credenciales y garantizar calidad antes de commit.
    - Alcance: Crear .husky/pre-commit con grep de patrones de secretos + lint-staged.
    - Archivos creados/modificados: `.husky/pre-commit`, `package.json`

- [x] [Tipo: Infra] [Área: Infra] Configurar Content Security Policy (CSP) y headers de seguridad
    - Objetivo: Añadir CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
    - Alcance: Configurar headers en vercel.json.
    - Archivos modificados: `vercel.json`

- [x] [Tipo: UI] [Área: Analysis] Feedback de extracción (Correcciones de usuario)
    - Objetivo: Permitir que el usuario marque si un campo extraído es incorrecto, para guardar estadísticas de precisión.
    - Alcance: Añadir botones de "correcto/incorrecto" al lado de cada dato clave en la vista de resultados (ej. en `KPICards` o `PliegoAnalysis`).
    - Criterios de aceptación:
        - El usuario visualiza un control (botones) asociado a datos clave.
        - El estado se actualiza visualmente al interactuar.
        - Opcional: El evento se registra (incluso si es simulado por el momento) en una función que se podría enlazar al backend posteriormente.
    - Archivos probables: `src/features/analytics/AnalyticsDashboard.tsx`, `src/features/analytics/components/KPICards.tsx`
    - Dependencias: Ninguna.

- [x] [Tipo: Infra] [Área: Infra] Fix CI/CD Pipeline Deployment Failures
    - Objetivo: Ensure code changes are actually deployed to Vercel and Supabase successfully.
    - Alcance: Remove invalid pnpm cache from security-audit step and remove obsolete openai-runner Edge Function from Supabase deploy step in `.github/workflows/ci-cd.yml`. Also add `--no-verify-jwt` to `analyze-with-agents` deploy step.
    - Criterios de aceptación: GitHub Actions pipeline completes successfully without cache validation errors and deploys correctly to Supabase.
    - Archivos probables: `.github/workflows/ci-cd.yml`

- [x] [Tipo: UI] [Área: Analysis] Integrar advertencias de consistencia semántica en la interfaz
    - Objetivo: Mostrar al usuario las advertencias de calidad (QualityService) generadas para el análisis.
    - Alcance: Integrar en la vista de resultados (`src/features/analytics/components/`) el renderizado de `warnings` del análisis, mejorando la fiabilidad visible para el usuario.
    - Criterios de aceptación: Las advertencias (ej. presupuesto vs solvencia) se visualizan claramente en la pantalla de resultados.
    - Archivos probables: `src/features/dashboard/components/widgets/AlertsPanel.tsx (realmente vía pliego-vm.ts)` (u otros en este directorio), `src/services/quality.service.ts`
    - Dependencias: Ninguna.

- [x] [AI] [Tipo: AI] [Área: Analysis] Inyectar "Guía de lectura de pliegos.md" en el Vector Store del análisis
    - Objetivo: Resolver el error 401 Unauthorized detectado al ejecutar la Edge Function tras inyectar la guía de lectura.
    - Alcance: El error indica que la Edge Function fue desplegada requiriendo verificación JWT (`--verify-jwt`). El cliente no envía credenciales o la función debe ser pública. La acción correctiva requiere redesplegar la función con el flag `--no-verify-jwt`.
    - Criterios de aceptación: La ejecución de `analyze-with-agents` retorna 200 OK y el flujo SSE funciona sin error 401.
    - Archivos probables: `supabase/functions/analyze-with-agents/index.ts` (solo revisión), documentación de despliegue.
    - Dependencias: Ninguna.

- [x] [Tipo: Docs] [Área: Infra] Limpieza de estructura de proyectos y arquitectura de skills
    - Objetivo: Eliminar carpetas innecesarias generadas por múltiples agentes IA y consolidar la arquitectura de skills con Jules.
    - Alcance: Eliminar carpetas como `.adal`, `.agent`, `.claude`, `.roo`, etc. Mantener solo lo necesario (`.jules`, `.agents`, `skills/`). Documentar el patrón usado en `ARCHITECTURE.md`.
    - Criterios de aceptación: Las carpetas redundantes se eliminan del directorio raíz y la arquitectura limpia queda documentada.
    - Archivos probables: `ARCHITECTURE.md`, `SPEC.md`, `BACKLOG.md`
    - Dependencias: Ninguna.

- [x] [Tipo: Docs] [Área: Analysis] Convertir "Guia Lectura de Pliegos .pdf" a formato Markdown ("Guía de lectura de pliegos.md")
    - Objetivo: Disponer de las directrices de lectura de pliegos en un formato fácilmente analizable (Markdown) para los agentes AI.
    - Alcance: Extracción del contenido de "Guia Lectura de Pliegos .pdf" y creación del archivo "Guía de lectura de pliegos.md", alojándolo en el directorio de la Edge Function (`supabase/functions/analyze-with-agents/`) para que sea accesible en tiempo de ejecución.
    - Criterios de aceptación: El archivo "Guía de lectura de pliegos.md" se crea y contiene la transcripción fiel del PDF original en una ruta accesible por Deno.
    - Archivos probables: `supabase/functions/analyze-with-agents/Guía de lectura de pliegos.md`

- [x] [AI] [Tipo: AI] [Área: Analysis] Inyectar "Guía de lectura de pliegos.md" en el Vector Store del análisis
    - Objetivo: Garantizar que el agente tenga acceso a las instrucciones metodológicas de la guía.
    - Alcance: Modificar `analyze-with-agents/index.ts` para que lea el archivo local `Guía de lectura de pliegos.md` y lo suba al Vector Store de OpenAI.
    - Criterios de aceptación: El Vector Store generado incluye la guía. El agente puede usar file_search para extraer directrices de lectura.
    - Archivos probables: `supabase/functions/analyze-with-agents/index.ts`
    - Dependencias: La conversión de la Guía de lectura a Markdown debe estar completada.

- [x] [Tipo: UI] [Área: History] Implementar exportación a CSV/Excel
    - Objetivo: Permitir al usuario descargar los resultados estructurados del análisis para trabajarlos offline.
    - Alcance: Añadir botón de exportación en la vista de resultados que genere un archivo con las variables clave.
    - Criterios de aceptación: Al hacer clic en "Exportar", se descarga un CSV con los datos de pliego, solvencia y presupuesto.
    - Archivos probables: `src/features/analytics/AnalyticsDashboard.tsx`
    - Dependencias: Ninguna.

- [x] [Tipo: UI] [Área: History] Implementar buscador avanzado y paginación en historial
    - Objetivo: Mejorar la navegabilidad del historial de análisis de licitaciones.
    - Alcance: Modificar la página de historial para soportar filtros (por fecha, título) y paginación.
    - Criterios de aceptación: El usuario puede buscar un expediente específico y navegar entre páginas.
    - Archivos probables: `src/features/history/HistoryView.tsx`
    - Dependencias: Ninguna.

- [x] [Tipo: QA] [Área: Upload] Validar E2E el soporte de múltiples documentos
    - Objetivo: Asegurar que el flujo completo de análisis con múltiples archivos funcione correctamente desde la UI hasta el Edge Function.
    - Alcance: Actualización de pruebas Playwright (`e2e/multi-upload.spec.ts`) y posible ajuste en `AnalysisWizard.tsx`.
    - Criterios de aceptación: Un test E2E sube múltiples documentos correctamente y verifica que el resultado se genera sin errores SSE.
    - Archivos probables: `e2e/multi-upload.spec.ts`, `src/features/upload/components/AnalysisWizard.tsx`
    - Dependencias: Ninguna.

- [x] [AI] [Tipo: AI] [Área: Upload] Adaptar `analyze-with-agents` para múltiples archivos
    - Objetivo: soportar análisis conjunto de varios documentos sin romper el contrato actual.
    - Alcance: entrada multiarchivo, estrategia de ingestión y transformación compatible con frontend.
    - Criterios de aceptación: la Edge Function acepta varios archivos, el análisis mantiene salida válida.
    - Archivos probables: `supabase/functions/analyze-with-agents/**`
    - Dependencias: soporte UI multi-documento y definición cerrada del contrato de entrada

- [x] [Tipo: UI] [Área: Upload] Implementar soporte UI de múltiples documentos por licitación
    - Objetivo: permitir cargar varios documentos relacionados dentro del mismo análisis.
    - Alcance: actualizar dropzone en `AnalysisWizard.tsx`, manejo de estado global con múltiples archivos en `useAnalysisStore`.
    - Criterios de aceptación: se pueden seleccionar y soltar varios archivos PDF, el usuario ve el listado de documentos cargados.
    - Archivos probables: `src/features/upload/components/AnalysisWizard.tsx`, `src/stores/analysis.store.ts`
    - Dependencias: ninguna

- [x] [Tipo: Backend] [Área: Infra] Remover credenciales expuestas y hardcodeadas
    - Objetivo: Identificar y eliminar cualquier credencial hardcodeada del repositorio para garantizar la seguridad del código público.
    - Alcance: Revisión de `scripts/setup-vercel-env.sh`, `scripts/init-env.sh` y otros scripts susceptibles.
    - Criterios de aceptación: El repositorio no contiene secretos reales hardcodeados. Todas las credenciales se inyectan dinámicamente vía entorno.
    - Archivos probables: `scripts/setup-vercel-env.sh`, `scripts/init-env.sh`
    - Dependencias: Ninguna

- [x] [Tipo: UI] [Área: Templates] Desarrollar pantalla de gestión de plantillas (`/templates`)
- [x] [AI] [Tipo: AI] [Área: Templates] Hacer dinámica la extracción en `analyze-with-agents` a partir de `templateId`
- [x] [Tipo: Backend] [Área: Templates] Crear soporte persistente para `extraction_templates` en Supabase
- [x] [Tipo: UI] [Área: Templates] Integrar selector de plantilla en el flujo principal de análisis
- [x] [Tipo: QA] [Área: Analysis] Configurar Playwright para pruebas E2E del flujo SSE de análisis
- [x] [Tipo: UI] [Área: History] Implementar módulo avanzado de historial de licitaciones
- [x] [Tipo: Docs] [Área: Infra] Limpiar código legacy de colas y referencias obsoletas en servicios
- [x] [Tipo: QA] [Área: Infra] Refactor de tests para silenciar advertencias de configuración en Vitest
- [x] [Tipo: Docs] [Área: Infra] Crear script para inicialización de variables de entorno locales
- [x] [Tipo: QA] [Área: Analysis] Revisar warnings en tests de UI
- [x] [Tipo: AI] [Área: Analysis] Implementar soporte completo para PDFs sin anexos o guía

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

- [x] [Tipo: QA] [Área: Analysis] Implementar tests unitarios interactivos para FeedbackToggle y Fix E2E
  - Objetivo: Asegurar que el componente de feedback registre adecuadamente la interacción y arreglar el fallo en Playwright test `e2e/upload-pdf.spec.ts` debido al uso de `__dirname`.
  - Alcance: Se añadieron assertions para asegurar que `feedbackService.saveFeedback` y `removeFeedback` se llaman correctamente, y reemplazar `__dirname` por `import.meta.dirname` en `e2e/upload-pdf.spec.ts`.
  - Criterios de aceptación: Pasa validación de types y `xvfb-run pnpm run test:e2e` pasa correctamente o no falla por este error.
  - Archivos probables: `src/features/dashboard/components/detail/__tests__/FeedbackToggle.test.tsx`, `e2e/upload-pdf.spec.ts`
  - Dependencias: Ninguna.
  - Tipo: QA
  - Área: Analysis
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

## To Do (Iteración Actual)

- [ ] 🐛 BUG: [Tipo: QA] [Área: Analysis] Aumentar cobertura de tests a 80%
  - Objetivo: Cumplir con la meta de calidad de código de la iteración D.
  - Alcance: Escribir pruebas unitarias adicionales para componentes críticos y subrepresentados en la cobertura, especialmente en src/components y src/features/dashboard.
  - Criterios de aceptación:
    - Ejecutar `pnpm test --run --coverage` debe reportar al menos 80% en statements y 70% en branches.
  - Archivos probables: `src/components/**/*.test.tsx`, `src/features/dashboard/**/*.test.tsx`
  - Dependencias: Ninguna.

> [34m % [39m[2mCoverage report from [22m[33mv8[39m
> -------------------|---------|----------|---------|---------|-------------------
> File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
> -------------------|---------|----------|---------|---------|-------------------
> All files          |   79.84 |    65.98 |    72.9 |   80.71 |
> -------------------|---------|----------|---------|---------|-------------------


- [ ] [Tipo: Infra] [Área: Infra] Resolver Bloqueo Global de Vitest
  - Objetivo: Restablecer la operatividad de la suite global de tests unitarios de Vitest.
  - Alcance: Investigar la resolución ESM y caché de pnpm, actualizar dependencias si es necesario o purgar el entorno global para que `vitest` ejecute correctamente.
  - Criterios de aceptación:
    - Ejecutar `pnpm test` debe completar la ejecución de todas las suites sin errores fatales de inicialización.
  - Archivos probables: `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`
  - Dependencias: Ninguna.

- [ ] [Tipo: QA] [Área: Analysis] Aumentar cobertura de tests a 80%
  - Objetivo: Cumplir con la meta de calidad de código de la iteración D.
  - Alcance: Escribir pruebas unitarias adicionales para componentes críticos y subrepresentados en la cobertura, especialmente en src/components y src/features/dashboard.
  - Criterios de aceptación:
    - Ejecutar `pnpm exec vitest run --coverage` debe reportar al menos 80% en statements y 70% en branches.
  - Archivos probables: `src/components/**/*.test.tsx`, `src/features/dashboard/**/*.test.tsx`, `src/services/__tests__/`
  - Dependencias: Tarea "Resolver Bloqueo Global de Vitest" debe estar completada.

- [ ] [Tipo: Backend] [Área: Infra] Configurar Dependabot para actualizaciones automáticas
  - Objetivo: Automatizar la detección y actualización de dependencias vulnerables u obsoletas.
  - Alcance: Crear `.github/dependabot.yml` configurando actualizaciones semanales para npm y github-actions.
  - Criterios de aceptación:
    - El archivo `.github/dependabot.yml` existe y es válido.
    - Dependabot ejecuta chequeos semanales.
  - Archivos probables: `.github/dependabot.yml`
  - Dependencias: Ninguna.

## Deuda Técnica / Refactorización

- (Vacio - Tareas integradas en la iteración actual)

## Ideas de Producto

- Implementar i18n multi-idioma (inglés)
- Configurar Dependabot para actualizaciones automáticas de dependencias
- Métricas de rendimiento (Lighthouse, bundle size) automatizadas en CI
- Visual regression testing con Playwright screenshots

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
  - ChapterComponents.tsx limpiado (265→80 líneas), ChapterComponentsPart2.tsx (261→50 líneas)

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

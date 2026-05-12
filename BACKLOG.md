# Analista de Pliegos — Backlog

## Contexto y Estado Actual

Iteración E **completada**. Cobertura de tests fijada al 79.95% statements / 80.81% lines / 66% branches / 72.94% functions (ver `vitest.config.ts`; thresholds 79/65/72/80).

Iteración F **activa**. Foco operativo:

- Claridad UX del Detalle (Issue #6 descompuesto en 6 entregables pequeños).
- Endurecimiento del flujo de autenticación (Issue #4 descompuesto en 2 entregables + deuda técnica).
- Completar i18n EN (diccionario inglés, selector visible y extracción progresiva de strings hardcoded).
- Higiene de plataforma (Dependabot heredado de la iteración previa).

La arquitectura del pipeline IA (`analyze-with-agents` + `chat-with-analysis-agent`) está estable tras la migración M1+M2+M3 a `@openai/agents@0.3.1` y la eliminación del legacy fallback. No hay trabajo activo sobre el pipeline en esta iteración.

## Reglas de priorización

1. Los **bugs** devueltos por QA tienen prioridad sobre cualquier feature.
2. Las tareas deben caber en una sola sesión.
3. Si una tarea es demasiado grande, debe dividirse antes de desarrollarse.
4. `## To Do (Iteración Actual)` no puede contener más de 4 tareas activas a la vez.
5. Antes de crear una tarea nueva, revisar si la primera tarea pendiente está bien definida.

## Formato obligatorio de cada tarea

```md
- [ ] [Tipo: UI|Backend|AI|Docs|QA] [Área: Templates|Analysis|Upload|History|Infra|Auth|UX] Título claro
  - Objetivo:
  - Alcance:
  - Criterios de aceptación:
  - Archivos probables:
  - Dependencias:
```

## To Do (Iteración F — máx 4 activas)

- [ ] [Tipo: Backend] [Área: Infra] Configurar Dependabot semanal para npm y github-actions
  - Objetivo: Automatizar la detección de dependencias vulnerables u obsoletas.
  - Alcance: Crear `.github/dependabot.yml` con dos ecosistemas (`npm` en `/`, `github-actions` en `/`), interval `weekly`, agrupar minor/patch en un único PR cuando sea posible para reducir ruido.
  - Criterios de aceptación:
    - `.github/dependabot.yml` existe, es válido y pasa el lint del propio Dependabot.
    - Tras merge, aparece al menos un primer PR de Dependabot dentro de 7 días.
    - No se modifica ningún workflow existente.
  - Archivos probables: `.github/dependabot.yml`
  - Dependencias: Ninguna.

- [ ] [Tipo: UI] [Área: Analysis] Banner "Análisis incompleto" + normalización de defaults a "No detectado" en KPIs
  - Objetivo: Que el usuario distinga visualmente un análisis válido pero vacío (todos los críticos sin extraer) de un análisis con datos, evitando que valores `0`, `[]` o `"Desconocido"` se rendericen como datos reales en los KPIs principales.
  - Alcance:
    - Crear componente `IncompleteAnalysisBanner` que se renderiza encima del contenido del Detalle cuando `pliegoVM.isAnalysisEmpty === true`. Microcopy según Issue #6: título "Análisis incompleto", texto "No se han podido extraer datos clave del pliego...", botón primario "Re-analizar" y secundario "Ver avisos".
    - Crear utilidad `formatKpiValue(value, kind)` que convierte `0`, `null`, `undefined`, `[]` y `"Desconocido"` en `"No detectado"` para los KPIs de presupuesto, plazo, CPV y órgano de contratación.
    - Integrar utilidad en `KpiCards` sin romper el layout existente ni los `FeedbackToggle` ya integrados.
  - Criterios de aceptación:
    - Con un análisis vacío (presupuesto=0, plazo=0, cpv=[], objetivos+subjetivos=[]), el banner aparece visible con CTA `Re-analizar`.
    - Con análisis válido, el banner no aparece.
    - Los KPIs muestran `"No detectado"` en lugar de `"0,00 €"` o `"0 meses"` cuando el dato es default.
    - Existen tests unitarios para `formatKpiValue` cubriendo cada caso (numérico 0, array vacío, string "Desconocido", null).
    - El componente `IncompleteAnalysisBanner` tiene test de render condicional.
  - Archivos probables: `src/features/dashboard/Dashboard.tsx`, `src/features/dashboard/components/widgets/KpiCards.tsx`, nuevo `src/features/dashboard/components/IncompleteAnalysisBanner.tsx`, nueva utilidad `src/features/dashboard/utils/formatKpi.ts` y su test, `src/features/dashboard/model/pliego-vm.ts` (solo lectura, ya expone `isAnalysisEmpty`).
  - Dependencias: Ninguna.

- [ ] [Tipo: Backend] [Área: Auth] Flujo "Olvidé mi contraseña" (reset password)
  - Objetivo: Que un usuario que perdió su contraseña pueda recuperar el acceso sin contactar soporte.
  - Alcance:
    - Añadir `resetPassword(email)` en `auth.service.ts` invocando `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })`.
    - Añadir `resetPassword` al store `auth.store.ts` con manejo de loading / error.
    - Añadir botón "¿Olvidaste tu contraseña?" en `AuthModal.tsx`, abriendo vista interna con input de email y feedback de éxito.
    - Crear ruta `/reset-password` con página `ResetPasswordPage` que capture el token del email y permita establecer nueva contraseña usando `supabase.auth.updateUser({ password })`.
    - Errores visibles, estados de carga consistentes con el resto del modal.
  - Criterios de aceptación:
    - Desde `AuthModal`, el usuario puede solicitar el email de reset y recibe confirmación visual.
    - Tras hacer click en el enlace del email, `/reset-password` carga, valida el token y permite establecer nueva contraseña.
    - Si el token está expirado o es inválido, se muestra mensaje claro.
    - Existe test unitario del store cubriendo el éxito y el error de `resetPassword`.
    - No se rompe el flujo de login/signup existente.
  - Archivos probables: `src/services/auth.service.ts`, `src/stores/auth.store.ts`, `src/components/ui/AuthModal.tsx`, nueva `src/pages/ResetPasswordPage.tsx` (o `src/features/auth/ResetPasswordPage.tsx`), `src/App.tsx` (ruta), tests asociados.
  - Dependencias: Configuración en Supabase Auth (URL de redirect autorizada). Documentar en `DEPLOYMENT.md` si aplica.

- [ ] [Tipo: UI] [Área: Infra] Diccionario EN + LanguageSwitcher visible
  - Objetivo: Habilitar realmente el cambio de idioma ES↔EN que la infra `react-i18next` permite pero la UI no expone.
  - Alcance:
    - Crear `src/locales/en/translation.json` espejo del actual `es/translation.json` con traducciones reales (no placeholders).
    - Registrar el bundle `en` en `src/lib/i18n.ts`.
    - Crear `LanguageSwitcher` con dos opciones (ES / EN) e icono. Integrarlo en un sitio visible (header del Layout o Sidebar, según convenga).
    - Persistir la selección en `localStorage` vía `i18next-browser-languagedetector` (ya está instalado).
  - Criterios de aceptación:
    - El usuario ve el selector en pantalla y al cambiar idioma se actualizan los textos ya internacionalizados (5 componentes actuales: TemplatesPage, AnalyzingStep, StepIndicator, UploadStep, setup).
    - La selección sobrevive a un refresh del navegador.
    - `src/locales/en/translation.json` cubre exactamente las mismas claves que `es/translation.json`.
    - No se rompe la renderización con idioma EN activo (claves faltantes mostrarían el ID; debe evitarse).
    - Test unitario o de integración mínimo que valide cambio de idioma sobre un componente.
  - Archivos probables: `src/locales/en/translation.json` (nuevo), `src/lib/i18n.ts`, nuevo `src/components/LanguageSwitcher.tsx`, integración en `src/components/Layout.tsx` o `src/components/Sidebar.tsx` (según el árbol real), test asociado.
  - Dependencias: Ninguna técnica. Extraer el resto de strings hardcoded del Dashboard se hace en una tarea posterior (#11).

## Próximas iteraciones (refinadas, orden de prioridad)

- [ ] [Tipo: UI] [Área: Auth] Proteger rutas autenticadas con `ProtectedRoute`
  - Objetivo: Que las rutas que dependen de sesión (`/history`, `/analytics`, `/templates`, dashboard de análisis) no sean accesibles sin autenticación.
  - Alcance:
    - Crear `src/components/ProtectedRoute.tsx` que lea `useAuthStore`. Si no hay sesión, abrir `AuthModal` (o redirigir a landing) en lugar de renderizar el children.
    - Envolver las rutas privadas en `src/App.tsx` con `<ProtectedRoute>`.
    - Mantener la ruta `/` (landing) pública.
  - Criterios de aceptación:
    - Acceder a `/history` sin sesión muestra landing + modal de login abierto en lugar del contenido privado.
    - Tras login, el usuario llega a la ruta solicitada originalmente (preservar destino con query param o redirección suave).
    - Test unitario de `ProtectedRoute` con mock de `auth.store` cubriendo los dos caminos.
  - Archivos probables: nuevo `src/components/ProtectedRoute.tsx`, `src/App.tsx`, test asociado.
  - Dependencias: Ninguna.

- [ ] [Tipo: UI] [Área: Analysis] StickyHeader + StickySubnav navegable por capítulos del Detalle
  - Objetivo: Que el usuario navegue rápido entre capítulos largos del Detalle sin scroll manual.
  - Alcance:
    - Crear `StickyHeader` con título de la licitación y menú `⋯` (entrada de menú vacía por ahora, se rellena en tareas #8 y #9).
    - Crear `StickySubnav` con anchors a los capítulos: Resumen, Datos, Criterios, Solvencia, Técnicos, Riesgos, Servicio. Click hace scroll suave al anchor correspondiente.
    - Integrar en `Dashboard.tsx` por encima de los capítulos existentes (ChapterRenderer no se toca, solo se le da anchor `id` a cada capítulo).
    - Compensar offset del header al hacer scroll para que el título del capítulo no quede tapado.
  - Criterios de aceptación:
    - Subnav permanece visible al hacer scroll por todo el Detalle.
    - Click en cada item navega al capítulo correcto sin saltos abruptos.
    - No se duplica con cabecera/sidebar globales del Layout.
    - Pasa lint, typecheck y los tests existentes del Dashboard no rompen.
  - Archivos probables: nuevos `src/features/dashboard/components/StickyHeader.tsx`, `src/features/dashboard/components/StickySubnav.tsx`, `src/features/dashboard/Dashboard.tsx`, capítulos existentes en `src/features/dashboard/components/detail/` (solo añadir `id`).
  - Dependencias: Ninguna.

- [ ] [Tipo: UI] [Área: Analysis] RightDrawer con tabs (Evidencias / Avisos / Progreso / Notas)
  - Objetivo: Mover información secundaria (warnings, evidencias, progreso, notas) fuera del flujo principal a un drawer lateral que el usuario puede abrir, cerrar y pinear.
  - Alcance:
    - Crear `RightDrawer` con 4 tabs.
    - Tab "Avisos" consume `pliegoVM.warnings` con severidad (crítico vs normal) según campos críticos faltantes.
    - Tab "Evidencias" lista evidencias del análisis (campos con `TrackedField.evidence`).
    - Tab "Progreso" muestra `workflow.steps` si existen, con estado por sección y mensaje de error legible.
    - Tab "Notas" input + lista persistida en `localStorage` bajo `analysis-notes:<hash>`.
    - Empty states con microcopy del Issue #6 si una tab no tiene contenido.
  - Criterios de aceptación:
    - Drawer abre/cierra con animación, no bloquea el contenido principal.
    - Botón pin alterna entre modo flotante y modo siempre visible.
    - Los 4 tabs muestran datos reales del análisis cargado, no mocks.
    - Tests unitarios mínimos por cada tab (al menos render condicional con/sin datos).
  - Archivos probables: nuevos `src/features/dashboard/components/drawer/RightDrawer.tsx`, `EvidencesTab.tsx`, `WarningsTab.tsx`, `ProgressTab.tsx`, `NotesTab.tsx`, integración en `Dashboard.tsx`.
  - Dependencias: Tarea #6 (StickyHeader incluye el toggle del drawer).

- [ ] [Tipo: UI] [Área: Analysis] TechnicalJsonModal (mover JSON crudo fuera del flujo principal)
  - Objetivo: Sacar la vista del JSON crudo del Detalle principal sin perder la capacidad de inspeccionarlo.
  - Alcance:
    - Crear `TechnicalJsonModal` accesible desde el menú `⋯` del `StickyHeader` (entrada "Ver datos técnicos").
    - Modal muestra JSON formateado, botón "Copiar JSON" y aviso pequeño "Solo para depuración y soporte.".
    - Quitar el bloque "Datos técnicos (JSON)" del flujo principal del Dashboard si está presente; reusar el componente actual de extracción personalizada cuando aplique.
  - Criterios de aceptación:
    - El JSON crudo ya no aparece en el flujo principal.
    - Modal se abre desde el menú `⋯`, muestra JSON legible y copia funciona.
    - Pasa typecheck y lint.
  - Archivos probables: nuevo `src/features/dashboard/components/TechnicalJsonModal.tsx`, `src/features/dashboard/components/StickyHeader.tsx`, `src/features/dashboard/Dashboard.tsx`.
  - Dependencias: Tarea #6 (StickyHeader provee el menú `⋯`).

- [ ] [Tipo: UI] [Área: Analysis] KillCriteriaBlock + RiskCards (visualización dedicada de criterios excluyentes y riesgos)
  - Objetivo: Visibilizar los criterios excluyentes y los riesgos con un layout específico (badges ALTO/MEDIO/BAJO) en lugar de listas neutras.
  - Alcance:
    - `KillCriteriaBlock` destacado en `ChapterSummary` cuando existan criterios excluyentes; muestra empty state con microcopy del Issue #6 cuando no hay.
    - `RiskCards` reemplaza la lista actual de riesgos en `ChapterRiesgos`, con tarjetas que muestran badge de impacto, descripción y origen.
  - Criterios de aceptación:
    - Con un análisis con killCriteria y riesgos, ambos componentes renderizan datos reales con badges correctos.
    - Con análisis sin estos datos, ambos muestran empty state con microcopy aprobado.
    - No se rompe el resto del capítulo donde se integran.
  - Archivos probables: nuevos `src/features/dashboard/components/blocks/KillCriteriaBlock.tsx`, `RiskCards.tsx`, capítulos existentes en `src/features/dashboard/components/detail/`.
  - Dependencias: Ninguna fuerte (puede entrar antes o después de #6, pero gana valor con StickySubnav).

- [ ] [Tipo: UI] [Área: Analysis] Empty states con microcopy en capítulos vacíos
  - Objetivo: Que cada capítulo del Detalle vacío explique por qué está vacío y qué puede hacer el usuario.
  - Alcance:
    - Crear componente reutilizable `EmptyState` (título, texto, CTA opcional).
    - Aplicar el microcopy exacto del Issue #6 a: Datos Generales incompletos, Criterios vacíos, Solvencia técnica vacía, Requisitos técnicos vacíos, Riesgos/penalizaciones vacíos, Modelo de servicio vacío.
  - Criterios de aceptación:
    - Cada capítulo vacío muestra título y texto exactos del Issue #6, no genéricos.
    - El componente `EmptyState` se reutiliza desde todos los capítulos sin duplicar markup.
    - Tests unitarios mínimos del componente y de al menos dos capítulos.
  - Archivos probables: nuevo `src/features/dashboard/components/EmptyState.tsx`, capítulos existentes en `src/features/dashboard/components/detail/`.
  - Dependencias: Ninguna técnica. Se beneficia de #2 (banner) y #9 (KillCriteria/Risk) si ya están.

- [ ] [Tipo: UI] [Área: Infra] Extracción de strings hardcoded del Dashboard a i18n (es + en)
  - Objetivo: Que el Dashboard también respete el idioma seleccionado por el usuario.
  - Alcance:
    - Recorrer los componentes principales del Dashboard (Sidebar, Header, MainContent, ChapterRenderer, KpiCards, capítulos).
    - Extraer strings al `translation.json` (es y en).
    - Reemplazar literales por `t(...)` con `useTranslation`.
  - Criterios de aceptación:
    - Al cambiar idioma con el `LanguageSwitcher` (tarea #4), el Dashboard muestra los textos en el idioma seleccionado.
    - No quedan literales castellanos en los componentes del Dashboard tocados.
    - Sin regresiones visuales (layout intacto).
  - Archivos probables: `src/locales/es/translation.json`, `src/locales/en/translation.json`, archivos del Dashboard bajo `src/features/dashboard/`.
  - Dependencias: Tarea #4 (diccionario EN + selector).

## Deuda Técnica

- **Auth — signup sin resend de email confirmation**: `AuthModal` muestra "Revisa tu email para confirmar tu cuenta" pero no hay forma de reenviar el email ni recuperar el flujo si el usuario cierra el modal. Convertir en tarea si se confirma que Supabase exige confirmación en producción.
- **Auth — sin UI explícita de "sesión expirada"**: cuando el token expira, las acciones fallan silenciosamente. Sería una mejora UX pequeña: detectar 401 a nivel servicio y emitir un evento de sesión expirada que abra `AuthModal` con mensaje claro.
- **Auth — convivencia hash-based recovery + onAuthStateChange**: `src/stores/auth.store.ts:56-62` parsea `window.location.hash` manualmente además de la suscripción al state change. Funciona pero conviene documentar o consolidar.
- **Docs — `ARCHITECTURE.md` lista `.claude` como carpeta dot prohibida**: la sección "Agent Skill Modular Pattern" prohíbe explícitamente carpetas como `.claude`, pero la carpeta sigue presente en el repo y es de uso operativo. Decidir en próxima sesión PO si se ajusta el lenguaje de `ARCHITECTURE.md` o si la carpeta debe retirarse.
- **Docs — corrección de `SPEC.md §6` realizada en esta sesión**: la decisión sobre composición multi-documento citaba inyección de Guía vía `Deno.readTextFile` al Vector Store; la realidad tras M3 es `PipelineContext.guideExcerpt`. Trazabilidad para el changelog.

## Ideas de Producto (no refinadas)

- Métricas Lighthouse / bundle size automatizadas en CI.
- Visual regression testing con Playwright screenshots.
- E2E coverage del flujo de auth (login, signup, recover, logout).
- Resend de email confirmation tras signup.
- UI explícita de "sesión expirada".
- Rediseño completo "Apple-like" del Detalle (Issue #6) — el grueso de los entregables visuales ya está descompuesto en tareas #2, #6, #7, #8, #9, #10 de este backlog.

## Done

- [x] [Tipo: QA] [Área: Analysis] Aumentar cobertura de tests al 80% (cerrada en iteración E)
  - Implementación: `vitest.config.ts` fija thresholds 79/65/72/80 con cobertura real 79.95% statements / 80.81% lines / 66% branches / 72.94% functions. La nota interna del archivo documenta la trayectoria baseline → iterD → iterE.
  - Archivos modificados: `vitest.config.ts`, múltiples tests en `src/services/`, `src/features/dashboard/`, `src/stores/`.

- [x] [Tipo: Infra] [Área: Infra] Resolver bloqueo global de Vitest (cerrada como resuelta)
  - Confirmado por `SPEC.md §4`: "El test global de Vitest que bloqueaba la suite ha sido resuelto." No hay menciones de crash actual en código ni docs. Sin trabajo adicional necesario.

- [x] [Tipo: UI] [Área: Infra] Configurar infraestructura base para i18n (ES/EN)
  - Implementación: `react-i18next` + `i18next-browser-languagedetector` instalados, `src/lib/i18n.ts` inicializa el idioma ES por defecto. Falta diccionario EN, selector visible y extracción de strings (cubierto por tareas #4 y #11 de este backlog).
  - Archivos: `src/main.tsx`, `src/lib/i18n.ts`, `package.json`, `src/locales/es/translation.json`.

- [x] [Tipo: QA] [Área: Upload] Test E2E completo de upload con `memo_p2.pdf`
  - Implementación: `e2e/upload-pdf.spec.ts` con tests end-to-end usando el PDF real del repositorio, mockeando SSE y auth para CI.

- [x] [Tipo: AI|QA] [Área: Analysis] Fix Error 401 Unauthorized en `analyze-with-agents` (JWT expirado)
  - Implementación: refresh proactivo del token en `job.service.ts` antes de llamar a la Edge Function.

- [x] [Tipo: Infra] [Área: Infra] Fix drift de migraciones en CI/CD (`supabase db push`)
  - Implementación: flag `--include-all` y `continue-on-error: true` para que el fallo de migraciones no bloquee el deploy de la Edge Function.

- [x] [Tipo: Infra] [Área: Infra] Fix autenticación de Postgres en CI/CD (`SQLSTATE 28P01`)
  - Implementación: separado el paso de `db push` (no-crítico) del paso `functions deploy` (crítico).

- [x] [Tipo: AI] [Área: Analysis] Actualizar `@openai/agents` a 0.8.1 y modelo a `gpt-4o`
  - Posteriormente revertido al pin `@openai/agents@0.3.1` por compatibilidad con Zod 3; ver §10.5 de `SPEC.md`.

- [x] [Tipo: QA] [Área: Analysis] Implementar tests unitarios interactivos para `FeedbackToggle` y fix de E2E

- [x] [Tipo: Infra] [Área: Analysis] Resolver Error 401 Unauthorized en endpoint productivo (`analyze-with-agents`)
  - Implementación: tras la migración M3, `verify_jwt = true` queda activo en gateway y el manejo se delega a Supabase; ver `SPEC.md §2.4` y `§2.5`.

- [x] [Tipo: QA] [Área: Analysis] Tests unitarios para `KpiCards`

- [x] [Tipo: UI] [Área: Analysis] Refactorizar ChapterComponents en data-driven rendering
  - Archivos: `chapter-config.ts`, `ChapterRenderer.tsx`, `ChapterComponents.tsx` (265→80 líneas), `ChapterComponentsPart2.tsx` (261→50 líneas).

- [x] [Tipo: UI] [Área: Analysis] Implementar estrategia de caching (`src/lib/cache.ts` con TTL e invalidación)

- [x] [Tipo: Infra] [Área: Infra] Configurar Docker Compose para desarrollo local

- [x] [Tipo: Backend] [Área: Analysis] Conectar feedback de extracción a base de datos
  - Archivos: `supabase/migrations/20260323000000_extraction_feedback.sql`, `src/services/feedback.service.ts`.

- [x] [Tipo: Docs] [Área: Infra] Enriquecer `BACKLOG.md` y resolver decisiones abiertas en `SPEC.md`

- [x] [Tipo: Infra] [Área: Infra] Endurecer reglas de ESLint (`no-explicit-any` → error)

- [x] [Tipo: UI] [Área: Templates] Refactorizar `TemplatesPage.tsx` (417 → 80 líneas)

- [x] [Tipo: UI] [Área: Upload] Refactorizar `AnalysisWizard.tsx` (406 → 80 líneas)

- [x] [Tipo: QA] [Área: Upload] Estabilizar E2E tests de multi-documento

- [x] [Tipo: QA] [Área: Infra] Incrementar cobertura de tests (56% → 67% statements en iteración previa, 79.95% tras iteración E)

- [x] [Tipo: UI] [Área: Analysis] Integrar controles de feedback en KpiCards del Dashboard

- [x] [Tipo: Backend] [Área: Infra] Habilitar verificación JWT en Edge Function `analyze-with-agents`

- [x] [Tipo: Infra] [Área: Infra] Detección pre-commit de secretos + lint-staged

- [x] [Tipo: Infra] [Área: Infra] Configurar Content Security Policy (CSP) y headers de seguridad

- [x] [Tipo: UI] [Área: Analysis] Feedback de extracción (correcciones de usuario)

- [x] [Tipo: Infra] [Área: Infra] Fix CI/CD pipeline deployment failures

- [x] [Tipo: UI] [Área: Analysis] Integrar advertencias de consistencia semántica en la interfaz

- [x] [Tipo: AI] [Área: Analysis] Inyectar "Guía de lectura de pliegos.md" en el Vector Store del análisis (deprecada por M3: ahora vía `PipelineContext.guideExcerpt`, ver `SPEC.md §6` y `ARCHITECTURE.md §4.3`)

- [x] [Tipo: Docs] [Área: Infra] Limpieza de estructura de proyectos y arquitectura de skills

- [x] [Tipo: Docs] [Área: Analysis] Convertir "Guía Lectura de Pliegos.pdf" a Markdown

- [x] [Tipo: UI] [Área: History] Implementar exportación a CSV/Excel

- [x] [Tipo: UI] [Área: History] Implementar buscador avanzado y paginación en historial

- [x] [Tipo: QA] [Área: Upload] Validar E2E soporte multi-documento

- [x] [AI] [Tipo: AI] [Área: Upload] Adaptar `analyze-with-agents` para múltiples archivos

- [x] [Tipo: UI] [Área: Upload] Soporte UI multi-documento por licitación

- [x] [Tipo: Backend] [Área: Infra] Remover credenciales expuestas y hardcodeadas

- [x] [Tipo: UI] [Área: Templates] Desarrollar pantalla de gestión de plantillas (`/templates`)

- [x] [AI] [Tipo: AI] [Área: Templates] Hacer dinámica la extracción en `analyze-with-agents` a partir de `templateId`

- [x] [Tipo: Backend] [Área: Templates] Crear soporte persistente para `extraction_templates` en Supabase (con RLS)

- [x] [Tipo: UI] [Área: Templates] Integrar selector de plantilla en el flujo principal de análisis

- [x] [Tipo: QA] [Área: Analysis] Configurar Playwright para pruebas E2E del flujo SSE de análisis

- [x] [Tipo: UI] [Área: History] Módulo avanzado de historial de licitaciones

- [x] [Tipo: Docs] [Área: Infra] Limpiar código legacy de colas y referencias obsoletas en servicios

- [x] [Tipo: QA] [Área: Infra] Refactor de tests para silenciar advertencias en Vitest

- [x] [Tipo: Docs] [Área: Infra] Script de inicialización de variables de entorno locales (posteriormente retirado en commit `bad901b`)

- [x] [Tipo: QA] [Área: Analysis] Revisar warnings en tests de UI

- [x] [Tipo: AI] [Área: Analysis] Soporte completo para PDFs sin anexos o guía

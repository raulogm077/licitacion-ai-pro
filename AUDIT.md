# Auditoría de Arquitectura de Software — Analista de Pliegos

**Fecha:** 2026-03-23
**Alcance:** Auditoría completa de código, arquitectura, seguridad, rendimiento, testing y procesos
**Fuentes consultadas:** Código fuente (~132 ficheros TS/TSX, ~12K líneas), BACKLOG.md, SPEC.md, ARCHITECTURE.md, configuraciones CI/CD

---

## 1. Resumen Ejecutivo

**Analista de Pliegos** es una aplicación de análisis de documentos de licitación con IA que ha alcanzado un nivel funcional sólido. La migración a OpenAI Agents SDK + SSE está completada, junto con plantillas dinámicas, soporte multi-documento, exportación Excel y sistema de feedback de usuario.

| Área | Puntuación | Estado |
|------|-----------|--------|
| Arquitectura y Organización | 8/10 | Sólida con oportunidades de refactor |
| Calidad del Código | 7/10 | Buena base, falta rigor en linting |
| Seguridad | 7/10 | Fundamentos sólidos, endpoint público expuesto |
| Rendimiento | 6/10 | Optimizaciones básicas, faltan estrategias avanzadas |
| Testing | 7/10 | Infraestructura completa, cobertura insuficiente |
| DevX | 7/10 | Funcional pero sin herramientas modernas |
| Documentación y Proceso | 8/10 | Bien mantenida, backlog requiere enriquecimiento |
| **GLOBAL** | **7.1/10** | **Producción funcional, necesita consolidación** |

**Conclusión:** La aplicación tiene una arquitectura bien pensada con patrones profesionales (Result<T>, Zod schemas robustos, Service Registry, RLS). Las áreas prioritarias de mejora son: seguridad del endpoint público, refactorización de componentes grandes, y aumento de cobertura de tests.

---

## 2. Diagnóstico por Área

### 2.1. Arquitectura y Organización del Código

**Fortalezas:**
- Separación clara en capas: `pages/` → `features/` → `services/` → `stores/` → `lib/` → `config/`
- Service Registry (`src/config/service-registry.ts`) como patrón de inyección de dependencias
- Patrón Result<T, E> (`src/lib/Result.ts`) para manejo de errores railway-oriented en toda la capa de servicios
- Schemas Zod robustos (`src/lib/schemas.ts`, 255+ líneas) con preprocesadores `RobustString`, `RobustNumber`, `RobustBoolean`, `RobustEnum`, `RobustArray`
- ViewModel pattern en `src/features/dashboard/model/pliego-vm.ts` para transformación de datos
- Feature flags bien diseñados en `src/config/features.ts` con soporte de variables de entorno

**Debilidades:**
- Sin interfaces/contratos de servicio — todas las clases de servicio son implementaciones concretas sin abstracción
- Componentes con demasiadas responsabilidades:
  - `src/pages/TemplatesPage.tsx` (417 líneas) — lógica CRUD, estado de formulario, listado y renderizado en un solo archivo
  - `src/features/upload/components/AnalysisWizard.tsx` (406 líneas) — validación, carga, pasos del wizard y estado mezclados
  - `src/stores/analysis.store.ts` (262 líneas) — múltiples flujos de análisis en un store
- `ChapterComponents.tsx` (265 líneas) + `ChapterComponentsPart2.tsx` (261 líneas) — división artificial sin uso de data-driven rendering
- `src/services/db.service.ts` (277 líneas) — concentra demasiados métodos de acceso a datos

### 2.2. Calidad del Código

**Fortalezas:**
- Cero uso de `dangerouslySetInnerHTML`, `eval()` o `Function()`
- Cero secretos hardcodeados en el código fuente
- Sin contaminación de `console.log` en servicios
- Prettier (`.prettierrc`) + ESLint (`.eslintrc.cjs`) configurados y funcionales
- TypeScript strict mode habilitado
- `typecheck` y `lint` pasan limpiamente en el estado actual

**Debilidades:**
- `@typescript-eslint/no-explicit-any` configurado como `"warn"` en vez de `"error"` — permite `any` sin bloquear
- Solo existe hook pre-push (`.husky/pre-push`), sin pre-commit — errores de lint pueden llegar a commits
- Cobertura de tests configurada al 60% como umbral mínimo (bajo para aplicación en producción)
- Max warnings de ESLint permisivo (`--max-warnings 10`)

**Archivos afectados:** `.eslintrc.cjs`, `.husky/pre-push`, `vitest.config.ts`

### 2.3. Seguridad

**Fortalezas:**
- Row Level Security (RLS) habilitado en todas las tablas (`licitaciones`, `extraction_templates`)
- Validación Zod de todos los inputs en frontend y schemas del agente
- Tests explícitos de XSS (`src/features/security/__tests__/XSS.test.tsx`)
- Filtrado de tokens Authorization en breadcrumbs de Sentry (`src/config/sentry.ts`)
- CORS restrictivo con whitelist de orígenes autorizados (`supabase/functions/_shared/cors.ts`)
- Rate-limiting server-side (10 análisis/hora por usuario) en Edge Functions
- Validación de tamaño de payload (50MB máx.)

**Debilidades:**
- **Edge Function `analyze-with-agents` desplegada con `--no-verify-jwt`** — endpoint completamente público, expuesto a abuso. Documentado como decisión temporal en SPEC.md §10.2 pero sin plan concreto de resolución
- Sin Content Security Policy (CSP) headers en `vercel.json` ni middleware
- Detección pre-commit de secretos mencionada como política en SPEC.md §9 pero **no implementada**
- Sin rate-limiting en el frontend (solo existe server-side en Edge Function)
- Protección CSRF delegada implícitamente a Supabase Auth sin validación explícita

**Archivos afectados:** `supabase/functions/analyze-with-agents/index.ts`, `supabase/config.toml`, `vercel.json`, `.husky/`

### 2.4. Rendimiento

**Fortalezas:**
- Lazy loading de rutas via `React.lazy()` en `src/App.tsx` con `Suspense` boundaries
- ViewModel pattern para pre-cálculo de datos del dashboard (`pliego-vm.ts`)
- Lazy import dinámico de AI service (`const { jobService } = await import(...)`)
- Traversal O(n) single-pass en `AnalyticsService.calculateAnalytics()`
- Carga secuencial de archivos en Edge Function para evitar picos de memoria

**Debilidades:**
- Uso muy limitado de `useMemo`/`useCallback` — solo presente en `Dashboard.tsx`, `SearchPanel.tsx` y `Header.tsx`
- Sin virtualización de listas (historial, búsqueda avanzada pueden crecer)
- Feature flags `enableCaching` y `enableServerSideFiltering` existen en `src/config/features.ts` pero están **desactivados sin implementación real**
- Sin estrategia de optimización de assets (imágenes, fonts)
- Code splitting solo a nivel de rutas, no a nivel de componentes pesados dentro de rutas

**Archivos afectados:** `src/config/features.ts`, `src/features/dashboard/Dashboard.tsx`, `src/features/history/`, `src/features/search/`

### 2.5. Testing

**Fortalezas:**
- Infraestructura dual: Vitest (unit/integration) + Playwright (E2E)
- 38 ficheros de unit tests distribuidos por el codebase
- 10 suites E2E en `e2e/` cubriendo flujos principales
- Setup profesional con mocking de localStorage, matchMedia, i18next (`src/test/setup.ts`)
- Tests de accesibilidad con `@axe-core/playwright`
- Pipeline CI ejecuta tests en cada push con retry automático (2 intentos para E2E)

**Debilidades:**
- Cobertura configurada al **60% statements, 50% branches** — insuficiente para producción
- E2E test de multi-documento (`e2e/multi-upload.spec.ts`) tiene `test.skip(true)` — frágil por dependencia de auth en CI
- Sin tests de integración para la capa de servicios (db.service, quality.service, analytics.service)
- Sin visual regression testing
- Sin tests de rendimiento/benchmark

**Archivos afectados:** `vitest.config.ts`, `e2e/multi-upload.spec.ts`, `e2e/test-utils.ts`

### 2.6. DevX (Experiencia de Desarrollo)

**Fortalezas:**
- Scripts npm bien definidos: `lint`, `format`, `format:check`, `typecheck`, `test`, `build`
- CI/CD multi-stage profesional (security audit → quality → E2E → deploy → smoke test)
- Concurrency control en CI para evitar despliegues simultáneos
- Playwright browser caching para builds más rápidos

**Debilidades:**
- Sin Docker/docker-compose para desarrollo local — requiere Supabase CLI + configuración manual
- Sin Storybook ni catálogo de componentes
- Solo hook pre-push (debería haber pre-commit con lint-staged)
- i18n configurado pero solo con locale español (`src/locales/es/`)
- Sin Dependabot ni renovate para actualizaciones automáticas de dependencias

### 2.7. Documentación y Proceso

**Fortalezas:**
- 5 documentos operativos mantenidos: `README.md`, `SPEC.md`, `BACKLOG.md`, `AGENTS.md`, `DEPLOYMENT.md`
- `ARCHITECTURE.md` con reglas explícitas de cuándo debe actualizarse
- Formato obligatorio de tareas en BACKLOG.md (tipo, área, objetivo, alcance, criterios, archivos, dependencias)
- Historial de implementación detallado en SPEC.md
- Roles técnicos documentados (PM, Tech Lead, AI Engineer, QA)
- Reglas de calidad técnica documentadas

**Debilidades:**
- Sección **"Deuda Técnica / Refactorización"** del BACKLOG.md está vacía — a pesar de la deuda técnica existente documentada en esta auditoría
- Sección **"Ideas de Producto"** del BACKLOG.md está vacía
- Solo **1 tarea** en la sección "To Do" — backlog empobrecido
- **Decisiones abiertas** en SPEC.md §6 sin resolver: estrategia de composición multi-doc y límites de archivos
- Sección 3 de SPEC.md ("Iteración activa") está desorganizada — mezclada con sección 8

---

## 3. Scorecard Detallado

```
Arquitectura y Organización  ████████░░  8/10
Calidad del Código           ███████░░░  7/10
Seguridad                    ███████░░░  7/10
Rendimiento                  ██████░░░░  6/10
Testing                      ███████░░░  7/10
DevX                         ███████░░░  7/10
Documentación y Proceso      ████████░░  8/10
─────────────────────────────────────────────
GLOBAL                       ███████░░░  7.1/10
```

---

## 4. Lista de Tareas Priorizadas

### CRÍTICAS — Bloquean seguridad o estabilidad

- [x] **T-01** `[Tipo: Backend] [Área: Infra]` Implementar autenticación en Edge Function `analyze-with-agents`
  - Objetivo: Proteger el endpoint público que actualmente no verifica JWT.
  - Alcance: Implementar envío de Authorization header desde `JobService` y habilitar `--verify-jwt` en la Edge Function, o implementar rate-limiting robusto server-side por IP.
  - Criterios de aceptación: El endpoint rechaza requests sin token válido o tiene rate-limiting efectivo por IP/usuario. Tests E2E actualizados.
  - Archivos probables: `src/services/job.service.ts`, `supabase/functions/analyze-with-agents/index.ts`, `supabase/config.toml`
  - Dependencias: Ninguna

- [x] **T-02** `[Tipo: Infra] [Área: Infra]` Implementar detección pre-commit de secretos
  - Objetivo: Prevenir la inclusión accidental de credenciales (política documentada en SPEC.md §9 pero no implementada).
  - Alcance: Configurar `gitleaks` o `detect-secrets` como pre-commit hook via Husky.
  - Criterios de aceptación: Un commit con patrón `sk-`, `AIza`, `eyJ` es bloqueado automáticamente. Hook documentado.
  - Archivos probables: `.husky/pre-commit`, `package.json`
  - Dependencias: Ninguna

### ALTA PRIORIDAD — Mejoran calidad y mantenibilidad significativamente

- [x] **T-03** ✅ `[Tipo: UI] [Área: Templates]` Refactorizar TemplatesPage.tsx (417→80 líneas)
  - Objetivo: Separar lógica CRUD en custom hook y dividir componentes de UI.
  - Alcance: Extraer `useTemplates()` hook, crear `TemplateForm`, `TemplateList`, `TemplateCard` como componentes independientes.
  - Criterios de aceptación: TemplatesPage < 100 líneas, cada sub-componente < 150 líneas, tests existentes siguen pasando.
  - Archivos probables: `src/pages/TemplatesPage.tsx`, nuevos: `src/features/templates/hooks/useTemplates.ts`, `src/features/templates/components/`
  - Dependencias: Ninguna

- [x] **T-04** ✅ `[Tipo: UI] [Área: Upload]` Refactorizar AnalysisWizard.tsx (406→80 líneas)
  - Objetivo: Separar en componentes por paso del wizard (upload, analyzing, completed).
  - Alcance: Crear `UploadStep`, `AnalyzingStep`, `CompletedStep` como componentes, extraer lógica de validación en hook.
  - Criterios de aceptación: AnalysisWizard < 80 líneas (orquestador), cada step < 150 líneas.
  - Archivos probables: `src/features/upload/components/AnalysisWizard.tsx`, nuevos: `src/features/upload/components/steps/`
  - Dependencias: Ninguna

- [x] **T-05** ✅ `[Tipo: QA] [Área: Infra]` Subir cobertura de tests (56%→67%, thresholds 65/50/58/65)
  - Objetivo: Incrementar cobertura de 60% a 80% en statements/lines.
  - Alcance: Añadir unit tests para servicios (db.service, quality.service, analytics.service), stores y utilidades sin cobertura.
  - Criterios de aceptación: `vitest --coverage` reporta ≥80% statements, ≥70% branches.
  - Archivos probables: `vitest.config.ts`, nuevos tests en `src/services/__tests__/`, `src/stores/__tests__/`
  - Dependencias: Ninguna

- [x] **T-06** `[Tipo: Infra] [Área: Infra]` Añadir pre-commit hook con lint-staged
  - Objetivo: Garantizar calidad antes de cada commit (actualmente solo pre-push).
  - Alcance: Configurar Husky pre-commit + lint-staged para ejecutar ESLint y Prettier solo en archivos staged.
  - Criterios de aceptación: Archivos con errores de lint son bloqueados antes del commit.
  - Archivos probables: `.husky/pre-commit`, `package.json` (lint-staged config)
  - Dependencias: Ninguna

- [x] **T-07** ✅ `[Tipo: Infra] [Área: Infra]` Endurecer reglas de ESLint (no-explicit-any → error)
  - Objetivo: Cambiar `@typescript-eslint/no-explicit-any` de "warn" a "error" y corregir usos existentes.
  - Alcance: Auditar y corregir todos los `any` explícitos, actualizar config ESLint.
  - Criterios de aceptación: `pnpm lint` pasa con 0 warnings de `no-explicit-any`, max-warnings reducido.
  - Archivos probables: `.eslintrc.cjs`, múltiples archivos con `any`
  - Dependencias: Ninguna

### PRIORIDAD MEDIA — Mejoran rendimiento y DX

- [x] **T-08** ✅ `[Tipo: UI] [Área: Analysis]` Refactorizar ChapterComponents en componentes data-driven
  - Objetivo: Unificar ChapterComponents.tsx (265 líneas) y ChapterComponentsPart2.tsx (261 líneas) en un sistema renderizable por configuración.
  - Alcance: Crear un mapa de configuración de capítulos y un componente genérico `ChapterRenderer`.
  - Criterios de aceptación: Un solo archivo de configuración define los capítulos, renderizador genérico < 100 líneas.
  - Archivos probables: `src/features/dashboard/components/detail/ChapterComponents.tsx`, `src/features/dashboard/components/detail/ChapterComponentsPart2.tsx`
  - Dependencias: Ninguna

- [x] **T-09** `[Tipo: Infra] [Área: Infra]` Configurar Content Security Policy (CSP)
  - Objetivo: Añadir headers CSP para prevenir XSS y data exfiltration.
  - Alcance: Configurar CSP headers en `vercel.json` o middleware de Vercel.
  - Criterios de aceptación: Headers CSP presentes en respuestas de producción, app funciona sin violaciones.
  - Archivos probables: `vercel.json` o nuevo `middleware.ts`
  - Dependencias: Ninguna

- [x] **T-10** ✅ `[Tipo: UI] [Área: Analysis]` Activar y configurar estrategia de caching
  - Objetivo: Habilitar el feature flag `enableCaching` con implementación real.
  - Alcance: Implementar cache en memoria (o localStorage) para llamadas frecuentes a `getAllLicitaciones()` y `getTemplates()` con invalidación.
  - Criterios de aceptación: Navegación entre páginas no re-fetcha datos innecesariamente, cache se invalida tras mutaciones.
  - Archivos probables: `src/config/features.ts`, `src/services/db.service.ts`, `src/services/template.service.ts`
  - Dependencias: Ninguna

- [x] **T-11** ✅ `[Tipo: QA] [Área: Upload]` Estabilizar E2E tests de multi-documento
  - Objetivo: Eliminar `test.skip(true)` y hacer que los tests de multi-upload funcionen en CI.
  - Alcance: Mejorar mocking de auth en Playwright para no depender de Supabase real.
  - Criterios de aceptación: `e2e/multi-upload.spec.ts` pasa en CI sin skips.
  - Archivos probables: `e2e/multi-upload.spec.ts`, `e2e/test-utils.ts`
  - Dependencias: Ninguna

- [x] **T-12** ✅ `[Tipo: Infra] [Área: Infra]` Configurar Docker Compose para desarrollo local
  - Objetivo: Permitir levantar el stack completo (frontend + Supabase local) con un solo comando.
  - Alcance: Crear `docker-compose.yml` con servicios de Supabase local y frontend dev.
  - Criterios de aceptación: `docker compose up` levanta la app funcional en localhost.
  - Archivos probables: nuevo `docker-compose.yml`, nuevo `Dockerfile`
  - Dependencias: Ninguna

### BAJA PRIORIDAD — Nice-to-have, mejoran DX a largo plazo

- [x] **T-13** ✅ `[Tipo: Docs] [Área: Infra]` Enriquecer BACKLOG.md con deuda técnica detectada
  - Objetivo: Poblar las secciones vacías "Deuda Técnica" e "Ideas de Producto" del backlog.
  - Alcance: Transcribir las tareas T-03 a T-12 como deuda técnica en formato BACKLOG.md.
  - Criterios de aceptación: BACKLOG.md tiene secciones de deuda técnica e ideas no vacías.
  - Archivos probables: `BACKLOG.md`
  - Dependencias: Ninguna

- [x] **T-14** ✅ `[Tipo: Docs] [Área: Infra]` Resolver decisiones abiertas en SPEC.md
  - Objetivo: Cerrar las decisiones abiertas documentadas (estrategia multi-doc context, límites de archivos).
  - Alcance: Investigar y documentar decisiones sobre composición de contexto multi-documento y límites operativos.
  - Criterios de aceptación: Sección "Decisiones abiertas" de SPEC.md se vacía o se mueve a "Decisiones cerradas".
  - Archivos probables: `SPEC.md`, `ARCHITECTURE.md`
  - Dependencias: Ninguna

- [ ] **T-15** `[Tipo: UI] [Área: Infra]` Implementar i18n multi-idioma
  - Objetivo: Añadir soporte de inglés (actualmente solo español).
  - Alcance: Crear `src/locales/en/` con traducciones, añadir selector de idioma en settings.
  - Criterios de aceptación: La app puede cambiar entre ES y EN.
  - Archivos probables: `src/locales/en/`, `src/lib/i18n.ts`, `src/components/layout/Header.tsx`
  - Dependencias: Ninguna

- [ ] **T-16** `[Tipo: Infra] [Área: Infra]` Configurar Dependabot para actualizaciones automáticas
  - Objetivo: Mantener dependencias actualizadas automáticamente.
  - Alcance: Crear `.github/dependabot.yml` con configuración para npm/pnpm.
  - Criterios de aceptación: Dependabot crea PRs semanales para dependencias desactualizadas.
  - Archivos probables: `.github/dependabot.yml`
  - Dependencias: Ninguna

---

## 5. Roadmap Recomendado

### Iteración A — Consolidación de Seguridad (Próxima)

| Tarea | Esfuerzo estimado |
|-------|------------------|
| T-01: Autenticación en Edge Function | Alto |
| T-02: Detección pre-commit de secretos | Bajo |
| T-06: Pre-commit hook con lint-staged | Bajo |
| T-09: CSP headers | Medio |
| Backlog actual: Feedback en KpiCards | Bajo |

**Resultado esperado:** Endpoint protegido, pipeline de seguridad pre-commit completo, headers CSP activos.

### Iteración B — Calidad de Código y Testing

| Tarea | Esfuerzo estimado |
|-------|------------------|
| T-03: Refactorizar TemplatesPage | Medio |
| T-04: Refactorizar AnalysisWizard | Medio |
| T-05: Subir cobertura al 80% | Alto |
| T-07: Endurecer ESLint | Medio |
| T-11: Estabilizar E2E tests | Medio |

**Resultado esperado:** Componentes mantenibles (<150 líneas), cobertura ≥80%, lint estricto, E2E estables.

### Iteración C — Rendimiento y DX

| Tarea | Esfuerzo estimado |
|-------|------------------|
| T-08: ChapterComponents data-driven | Medio |
| T-10: Estrategia de caching | Medio |
| T-12: Docker Compose | Medio |
| T-13: Enriquecer BACKLOG | Bajo |
| T-14: Resolver decisiones SPEC.md | Bajo |

**Resultado esperado:** Renderizado optimizado, caching activo, entorno local reproducible, documentación al día.

---

## 6. Notas Finales

### Estado de verificación del proyecto al momento de la auditoría
- `pnpm typecheck` — PASA
- `pnpm lint` — PASA (0 errores, ≤10 warnings)
- Dependencias instaladas correctamente con pnpm 9.15.9
- Branch: `claude/architecture-audit-BDQt5`

### Principios para las próximas iteraciones
1. **Seguridad primero** — T-01 y T-02 deben resolverse antes de cualquier feature nueva
2. **Una tarea por sesión** — respetar la regla de calidad de ARCHITECTURE.md §10
3. **Tests antes de QA** — ninguna tarea se mueve a QA sin tests y documentación actualizada
4. **Deuda técnica visible** — usar la sección "Deuda Técnica" del BACKLOG.md activamente

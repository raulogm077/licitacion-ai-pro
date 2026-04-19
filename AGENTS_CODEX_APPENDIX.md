# Anexo Codex para `licitacion-ai-pro`

Este archivo complementa `AGENTS.md`. No lo sustituye.

## 1. Objetivo

Usar Codex como sistema de:
- auditoría de release readiness,
- revisión especializada por dominios,
- limpieza de código muerto,
- remediación controlada,
- verificación de alineación entre código, documentación y pipeline real.

## 2. Regla de compatibilidad con `AGENTS.md`

Se mantiene la política actual del repositorio:
- no trabajar sobre `main`,
- documentación viva obligatoria,
- QA como puerta final,
- no desplegar sin evidencia.

Para evitar conflicto con la fábrica secuencial descrita en `AGENTS.md`:
- los agentes de **revisión** pueden ejecutarse en paralelo **solo si son `read-only`**;
- cualquier agente con `workspace-write` debe ejecutarse de forma secuencial y explícita.

## 3. Fuente de verdad para revisar

Los agentes de Codex deben contrastar cambios contra estos artefactos:

- `SPEC.md`
- `ARCHITECTURE.md`
- `TECHNICAL_DOCS.md`
- `BACKLOG.md`
- `DEPLOYMENT.md`
- `RELEASE_GATES_CODEX.md`
- `code_review.md`

## 4. Commands reales del repo

- Install: `pnpm install --frozen-lockfile`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test -- --run --coverage`
- E2E: `pnpm test:e2e`
- Build: `pnpm build`
- Format check: `pnpm format:check`

## 5. Gates específicos del producto

Bloquear release si ocurre cualquiera de estos casos:

1. Se rompe o modifica el contrato SSE sin actualizar frontend, tests y docs.
2. Se toca `JobService` o `analyze-with-agents` y no se actualizan `SPEC.md` y `ARCHITECTURE.md`.
3. Se modifica autenticación/JWT/CORS/rate limit y no hay revisión de seguridad.
4. Se cambia el schema canónico o `TrackedField` y no hay validación completa frontend/backend.
5. Se tocan migraciones Supabase o despliegue de Edge Functions sin validar compatibilidad de CI/CD.
6. Se introduce código muerto adicional o scripts obsoletos que comprometan mantenibilidad.
7. Se modifican flujos visibles y la UX queda inconsistente o sin estados loading/error/empty.
8. Se toca el pipeline de IA y no queda claro el fallback ni el riesgo residual en `SPEC.md`.

## 6. Agentes autorizados

### Revisores (`read-only`)
- `release_governor`
- `spec_guardian`
- `architecture_reviewer`
- `code_quality_reviewer`
- `ux_reviewer`
- `test_reliability_reviewer`
- `ci_cd_reviewer`
- `security_reviewer`
- `dead_code_auditor`

### Agentes con escritura (`workspace-write`)
- `remediation_worker`
- `cleanup_worker`

## 7. Restricción de alcance

Los agentes con escritura:
- no amplían alcance,
- no reescriben arquitectura sin ticket explícito,
- no tocan despliegue sin necesidad real,
- no cambian prompts o `analyze-with-agents` salvo hallazgo concreto o tarea explícita.

## 8. Regla documental

Todo cambio que toque comportamiento real debe dejar actualizados:
- `SPEC.md` si cambia comportamiento, aceptación o riesgo,
- `ARCHITECTURE.md` si cambia pipeline, SSE, `JobService`, multi-doc o plantillas,
- `TECHNICAL_DOCS.md` si cambia setup, stack, rutas, APIs, testing o despliegue,
- `DEPLOYMENT.md` si cambia release real.

# RELEASE_GATES_CODEX

Gates de release específicos para usar Codex en `licitacion-ai-pro`.

## STATUS posibles

- `PASS`
- `WARN`
- `BLOCK`

La release queda `BLOCK` si falla cualquier gate duro.

## Gates duros

### G1. Calidad base

Deben pasar:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test -- --run --coverage`
- `pnpm build`

Si el cambio toca UI principal, análisis, SSE o navegación principal, también:
- `pnpm test:e2e`

### G2. Contrato SSE

Bloquear si cambia cualquiera de estos elementos sin coordinación completa:
- nombres de eventos SSE,
- payload de `phase_started`, `phase_completed`, `agent_message`, `complete`, `error`,
- consumo de eventos en frontend,
- documentación y tests asociadas.

### G3. JobService + analyze-with-agents

Bloquear si se toca:
- `JobService`
- `analyze-with-agents`
- prompts
- pipeline por fases
- `canonical.ts`
- `TrackedField`

sin evidencia de:
- compatibilidad frontend/backend,
- actualización de `SPEC.md`,
- actualización de `ARCHITECTURE.md`,
- validación de tests relevantes.

### G4. Seguridad

Bloquear si se modifica cualquiera de estos ámbitos sin revisión explícita:
- JWT
- auth
- CORS
- rate limiting
- variables de entorno
- secretos
- Supabase RLS
- Vercel / GitHub secrets
- Edge Function auth

### G5. CI/CD real

Bloquear si el cambio deja desalineado el pipeline real del repo:
- `.github/workflows/ci-cd.yml`
- despliegue Vercel
- despliegue Supabase
- smoke tests
- Docker build validation

### G6. Migraciones y backend

Bloquear si se añaden o modifican:
- migraciones SQL,
- tablas o RLS,
- bucket storage,
- Edge Function deploy,

sin validar impacto en despliegue y compatibilidad del código.

### G7. UX / producto

Bloquear si el flujo visible queda degradado en:
- empty states,
- loading states,
- error states,
- consistencia visual,
- accesibilidad básica,
- jerarquía visual,
- fricción del flujo principal.

### G8. Documentación viva

Bloquear si cambió comportamiento real y no se actualizó la documentación mínima afectada:
- `SPEC.md`
- `ARCHITECTURE.md`
- `TECHNICAL_DOCS.md`
- `DEPLOYMENT.md`

### G9. Código muerto

Bloquear si:
- se detecta deuda obsoleta relevante añadida por el cambio,
- quedan scripts/configs/artefactos sin uso que generen confusión operativa,
- se elimina código con posible uso dinámico sin marcarlo como `REVIEW_NEEDED`.

## Hallazgos

### Severidades
- `P0`: riesgo crítico de seguridad, pérdida de datos o deploy no seguro
- `P1`: bloqueante funcional o arquitectónico
- `P2`: importante pero no bloqueante por sí solo
- `P3`: mejora o deuda menor

## Regla final

`release_governor` debe devolver:
- `PASS` si no hay fallos de gates duros,
- `WARN` si solo hay P2/P3 no bloqueantes,
- `BLOCK` si existe cualquier P0/P1 o gate duro incumplido.

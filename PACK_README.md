# Codex Release Governance Pack — licitacion-ai-pro

Este pack integra una capa de gobernanza y revisión especializada para Codex **sin sustituir** el flujo secuencial actual definido en `AGENTS.md`.

## Objetivo

Añadir una capa de auditoría de release readiness basada en subagentes de Codex para revisar:

- alineación con SPEC
- arquitectura
- calidad de código
- UX
- tests
- CI/CD
- seguridad
- código muerto / artefactos obsoletos

## Principio de integración

El repositorio ya tiene reglas propias en `AGENTS.md`, `SPEC.md`, `ARCHITECTURE.md` y un pipeline real en `.github/workflows/ci-cd.yml`.

Este pack:
- **no reemplaza** `AGENTS.md`
- añade `AGENTS_CODEX_APPENDIX.md` como anexo específico para Codex
- añade `RELEASE_GATES_CODEX.md` como reglas de aprobación y bloqueo
- añade `.codex/agents/*.toml` para subagentes especializados
- añade una skill reutilizable en `.agents/skills/release-audit/`
- añade un workflow opcional de GitHub Actions para invocar Codex en PRs

## Recomendación operativa

Mantener el desarrollo con escritura siguiendo el flujo secuencial actual:
- PM
- Tech Lead / AI Engineer
- QA

Y usar Codex principalmente para:
- revisión especializada en paralelo o semiparalelo
- consolidación de findings
- remediación puntual controlada
- limpieza de código muerto

## Ajuste recomendado inicial

En `.codex/config.toml`, dejar:

```toml
[agents]
max_threads = 1
max_depth = 1
```

Esto respeta la política actual del repositorio. Solo subir `max_threads` si decides permitir paralelismo **solo de revisión**.

## Artefactos incluidos

- `AGENTS_CODEX_APPENDIX.md`
- `RELEASE_GATES_CODEX.md`
- `code_review.md`
- `AGENT_TASKS.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.agents/skills/release-audit/SKILL.md`
- `.github/codex/prompts/review.md`
- `.github/workflows/codex-review.yml`

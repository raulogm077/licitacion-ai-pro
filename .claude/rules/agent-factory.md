---
paths:
    - '.github/workflows/agent-*.yml'
    - 'scripts/agents/**'
    - 'BACKLOG.md'
---

# Fábrica de agentes autónomos

Cuatro agentes (PM, Tech, IA, QA) corren en GitHub Actions
(`.github/workflows/agent-*.yml`) con `anthropics/claude-code-action@v1`, guiados
por los prompts de `.claude/commands/agent-*.md` y coordinados por `BACKLOG.md`
(`## To Do` → `## In Progress` → `## Ready for QA` → `## Done`; el tag `[Tipo: AI]`
enruta al agente IA). `scripts/agents/guard.sh` serializa por rol y evita sesiones
sin tareas. El auto-merge (`gh pr merge --auto --squash`) depende del CI existente
`Productive CI/CD Pipeline`; el kill switch es la variable de repositorio
`AGENTS_ENABLED`. Cada workflow invoca su prompt con `prompt: '/agent-<rol>'`.

Cualquier cambio en `.github/workflows/agent-*.yml` o en `scripts/agents/`
arrastra los cuatro docs de release (`verify:integrity` lo exige). Detalle en
[`DEPLOYMENT.md`](../../DEPLOYMENT.md).

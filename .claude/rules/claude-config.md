---
paths:
    - '.claude/**'
    - '.mcp.json'
---

# Configuración de Claude Code (`.claude/`)

`.claude/` y `.mcp.json` **se versionan**: CI y las sesiones cloud clonan el repo,
así que lo que no esté commiteado no existe allí. El `.gitignore` solo excluye
`.claude/settings.local.json`.

- `settings.json` — hook `SessionStart` (`matcher: startup|resume`, no reinstala en cada `/clear`) y `permissions.deny` sobre `.env*`
- `hooks/session-start.sh` — `pnpm install`, `.env.local`, symlinks de Playwright
- `commands/agent-*.md` — prompts de la fábrica, con `disable-model-invocation: true`
- `rules/*.md` — contexto con `paths:`, se carga solo al tocar sus ficheros
- `skills/` — `/observability` y las skills de `.agents/skills/` vía symlink

Al añadir prompts, reglas o skills: van bajo `.claude/`, nunca en un `skills/` de
raíz (Claude Code no lee esa ruta). Y ojo con los patrones de `.gitignore` sin
barra inicial: `skills/` captura también `.claude/skills/`; hay que anclar
(`/skills/`).

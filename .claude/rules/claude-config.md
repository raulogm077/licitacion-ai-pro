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
- `hooks/session-start.sh` — dependencias, `.env.local`, symlinks de Playwright
- `commands/agent-*.md` — prompts de la fábrica, con `disable-model-invocation: true`
- `rules/*.md` — contexto con `paths:`, se carga solo al tocar sus ficheros
- `skills/` — `/observability` y las skills de `.agents/skills/` vía symlink

Al añadir prompts, reglas o skills: van bajo `.claude/`, nunca en un `skills/` de
raíz (Claude Code no lee esa ruta). Y ojo con los patrones de `.gitignore` sin
barra inicial: `skills/` captura también `.claude/skills/`; hay que anclar
(`/skills/`).

## Por qué el hook de arranque no instala siempre

El `matcher` es `startup|resume`, y **cada despertar por webhook cuenta como
`resume`**. Vigilando una PR, cada comentario de un bot de Vercel o Supabase
disparaba un `pnpm install` completo: 42 arranques y ~8 min de reloj bloqueado en
una sola sesión, con mediana de 10 s y picos de 23 s, para reimprimir «Already up
to date» cada vez.

Ahora el hook compara el SHA-256 de `pnpm-lock.yaml` con el sello
`node_modules/.session-start-stamp` y se salta la instalación si cuadra. Medido:
**0,06 s frente a 3,96 s**.

Dos detalles que hay que conservar si alguien toca esto:

- **El sello vive dentro de `node_modules`.** Se invalida solo: si el contenedor
  se recicla y `node_modules` desaparece, el sello se va con él. No puede quedar
  afirmando «ya está instalado» sobre un árbol que no existe — que es justo la
  garantía por la que el hook corre también en `resume`, y que incluye
  `prepare` → `husky`, quien pone `core.hooksPath` para el pre-push.
- **Se comprueba también `node_modules/.modules.yaml`**, que pnpm escribe al
  _completar_ una instalación. Sin eso, un árbol a medio instalar pasaría el
  filtro con solo cuadrar el hash del lockfile.

Estrechar el `matcher` a `startup` habría sido más simple y es la opción
equivocada: un `resume` puede caer sobre un contenedor reciclado donde
`node_modules` de verdad no está.

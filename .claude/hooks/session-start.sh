#!/bin/bash
set -euo pipefail

# =============================================================================
# SessionStart hook — Analista de Pliegos
# Prepara el entorno de Claude Code en la web antes de arrancar la sesión.
#
# Registrado en .claude/settings.json con matcher "startup|resume": no vuelve a
# instalar dependencias en cada /clear ni en cada compactación.
#
# stdout se entrega a Claude como contexto de sesión. Los únicos campos JSON que
# el runtime interpreta son continue/stopReason/suppressOutput/systemMessage/
# additionalContext/hookSpecificOutput; `async` es un campo de settings.json en
# el objeto del hook, NO de stdout — emitirlo aquí no hace nada.
# =============================================================================

cd "$CLAUDE_PROJECT_DIR"

# ── 1. Dependencias npm ───────────────────────────────────────────────────────
# Cada despertar por webhook —un comentario en una PR, un resultado de CI— llega
# como `resume` y vuelve a disparar este hook. Con `pnpm install` incondicional
# eso costaba una mediana de 10 s (hasta 23 s en frío) por despertar para
# reimprimir «Already up to date»: 42 arranques y ~8 min de reloj bloqueado en
# una sola sesión de vigilancia de PRs. Comprobar si hace falta cuesta 7 ms.
#
# El sello vive DENTRO de `node_modules` a propósito: si el contenedor se recicla
# y `node_modules` desaparece, el sello se va con él y la instalación vuelve a
# correr. No puede quedarse afirmando «ya está instalado» sobre un árbol que ya
# no existe, que es justo la garantía por la que el hook corre también en
# `resume`. Eso incluye `prepare` → `husky`, que es quien pone `core.hooksPath`
# para el pre-push de `verify:release`.
#
# `.modules.yaml` lo escribe pnpm al COMPLETAR una instalación, así que su
# ausencia delata un árbol a medio instalar aunque el hash del lockfile cuadre.
LOCK_STAMP="node_modules/.session-start-stamp"
LOCK_HASH=""
if [ -f pnpm-lock.yaml ]; then
  LOCK_HASH=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
fi

DEPS_IN_SYNC=false
if [ -n "$LOCK_HASH" ] && [ -f node_modules/.modules.yaml ] && [ -f "$LOCK_STAMP" ]; then
  if [ "$(cat "$LOCK_STAMP")" = "$LOCK_HASH" ]; then
    DEPS_IN_SYNC=true
  fi
fi

if [ "$DEPS_IN_SYNC" = true ]; then
  echo "✓ Dependencias ya sincronizadas con pnpm-lock.yaml"
else
  echo "→ Instalando dependencias del proyecto..."
  pnpm install
  if [ -n "$LOCK_HASH" ]; then
    printf '%s\n' "$LOCK_HASH" > "$LOCK_STAMP"
  fi
fi

# ── 2. .env.local ─────────────────────────────────────────────────────────────
# Requerido para servidor de dev y E2E tests.
# Los unit tests mockean las variables (src/test/setup.ts) y funcionan sin él.
if [ ! -f ".env.local" ]; then
  echo "→ Creando .env.local desde .env.example..."
  cp .env.example .env.local
  echo "⚠️  .env.local creado con valores de placeholder."
  echo "   Actualiza VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para usar el servidor de dev."
else
  echo "✓ .env.local ya existe"
fi

# ── 3. Playwright — compatibilidad de versiones del browser ───────────────────
# El entorno web tiene browsers pre-instalados en /opt/pw-browsers con una versión
# anterior a la que espera el proyecto. Las descargas están bloqueadas (403).
# Solución: crear symlinks/estructuras de dir compatibles para las versiones esperadas.
PW_BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"

# Obtener versión esperada desde browsers.json de playwright-core (estructura pnpm)
EXPECTED_REVISION=$(node -e "
  const path = require('path');
  const fs = require('fs');
  try {
    const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    const entries = fs.readdirSync(pnpmDir).filter(e => e.startsWith('playwright-core@'));
    if (!entries.length) { console.log(''); process.exit(0); }
    const pkg = entries.sort().pop();
    const browsersJson = path.join(pnpmDir, pkg, 'node_modules', 'playwright-core', 'browsers.json');
    const b = JSON.parse(fs.readFileSync(browsersJson, 'utf8'));
    const c = b.browsers.find(x => x.name === 'chromium');
    console.log(c ? c.revision : '');
  } catch(e) { console.log(''); }
" 2>/dev/null || echo "")

if [ -z "$EXPECTED_REVISION" ]; then
  echo "ℹ️  No se pudo determinar la revisión de Playwright, omitiendo symlinks"
else
  # Detectar versión instalada más reciente
  INSTALLED_REVISION=$(ls "$PW_BROWSERS" | grep "^chromium-[0-9]" | sed 's/chromium-//' | sort -n | tail -1 || echo "")

  if [ -z "$INSTALLED_REVISION" ]; then
    echo "⚠️  No se encontraron browsers de Playwright en $PW_BROWSERS"
  elif [ "$EXPECTED_REVISION" = "$INSTALLED_REVISION" ]; then
    echo "✓ Playwright browser ya en versión correcta (revision $EXPECTED_REVISION)"
  else
    echo "→ Vinculando browsers para compatibilidad: r$INSTALLED_REVISION → r$EXPECTED_REVISION..."

    # ── Chromium (estructura idéntica entre versiones: chrome-linux/chrome) ──
    EXPECTED_CHROMIUM="$PW_BROWSERS/chromium-$EXPECTED_REVISION"
    INSTALLED_CHROMIUM="$PW_BROWSERS/chromium-$INSTALLED_REVISION"
    if [ ! -e "$EXPECTED_CHROMIUM" ] && [ -d "$INSTALLED_CHROMIUM" ]; then
      ln -sfn "$INSTALLED_CHROMIUM" "$EXPECTED_CHROMIUM"
    fi

    # ── Chromium Headless Shell (estructura diferente entre versiones) ────────
    # r1194: chromium_headless_shell-1194/chrome-linux/headless_shell
    # r1208: chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
    EXPECTED_SHELL="$PW_BROWSERS/chromium_headless_shell-$EXPECTED_REVISION"
    INSTALLED_SHELL="$PW_BROWSERS/chromium_headless_shell-$INSTALLED_REVISION"
    if [ ! -e "$EXPECTED_SHELL" ] && [ -d "$INSTALLED_SHELL" ]; then
      SHELL_BINARY="$INSTALLED_SHELL/chrome-linux/headless_shell"
      if [ -f "$SHELL_BINARY" ]; then
        # Crear estructura de directorios que espera la nueva versión
        mkdir -p "$EXPECTED_SHELL/chrome-headless-shell-linux64"
        ln -sf "$SHELL_BINARY" \
               "$EXPECTED_SHELL/chrome-headless-shell-linux64/chrome-headless-shell"
      fi
    fi

    echo "✓ Symlinks de Playwright creados (r$INSTALLED_REVISION → r$EXPECTED_REVISION)"
  fi
fi

# ── 4. Variables de entorno de sesión ─────────────────────────────────────────
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PLAYWRIGHT_BROWSERS_PATH=${PW_BROWSERS}" >> "$CLAUDE_ENV_FILE"
fi

echo ""
echo "✅ Entorno listo"
# Sin `pnpm --version`: 0,8 s —un tercio de lo que cuesta una instalación en
# caliente— por imprimir un número que nadie consulta.
echo "   node $(node --version)"
echo "   Unit tests:  pnpm test:run"
echo "   Lint:        pnpm lint"
echo "   Typecheck:   pnpm typecheck"
echo "   E2E tests:   pnpm test:e2e"

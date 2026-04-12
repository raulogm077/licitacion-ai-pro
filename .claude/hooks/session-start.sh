#!/bin/bash
set -euo pipefail

# =============================================================================
# SessionStart hook — Analista de Pliegos
# Prepara el entorno de Claude Code en la web antes de arrancar la sesión.
# =============================================================================

echo '{"async": false}'

cd "$CLAUDE_PROJECT_DIR"

# ── 1. Dependencias npm ───────────────────────────────────────────────────────
echo "→ Instalando dependencias del proyecto..."
pnpm install

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
echo "   node $(node --version) | pnpm $(pnpm --version)"
echo "   Unit tests:  pnpm test:run"
echo "   Lint:        pnpm lint"
echo "   Typecheck:   pnpm typecheck"
echo "   E2E tests:   pnpm test:e2e"

#!/usr/bin/env bash
# guard.sh <pm|tech|ia|qa>
# Decide si merece la pena lanzar la sesión del agente. Escribe run=true|false
# en GITHUB_OUTPUT. Reglas:
#   1. Nunca dos PRs abiertos del mismo rol (serialización sin humanos).
#   2. No lanzar dev/qa si no hay tareas elegibles en BACKLOG.md (ahorro de tokens).
# Convenciones REALES del repo: sección "## To Do (Iteración Actual)",
# "## Ready for QA"; las tareas de IA se marcan con "[Tipo: AI]".
set -euo pipefail

ROLE="${1:?Uso: guard.sh <pm|tech|ia|qa>}"
BACKLOG="BACKLOG.md"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

deny() { echo "guard[$ROLE]: SKIP — $1"; echo "run=false" >> "$OUT"; exit 0; }
allow() { echo "guard[$ROLE]: OK — $1"; echo "run=true" >> "$OUT"; exit 0; }

# --- Regla 1: PR abierto del mismo rol -> no lanzar otra sesión -------------
if command -v gh >/dev/null 2>&1; then
  OPEN=$(gh pr list --state open --json headRefName \
        --jq "[.[] | select(.headRefName | startswith(\"agents/${ROLE}/\"))] | length" || echo 0)
  [ "${OPEN}" -gt 0 ] && deny "ya existe un PR abierto de agents/${ROLE}/* (esperando CI/auto-merge)"
fi

[ -f "$BACKLOG" ] || deny "no existe $BACKLOG en main"

# Extrae las líneas '- [ ]' de una sección '## <prefijo>' del backlog.
section_tasks() {
  awk -v s="^## $1" '$0 ~ s {f=1; next} /^## / {f=0} f' "$BACKLOG" \
    | grep -E '^[[:space:]]*-[[:space:]]\[ \]' || true
}

case "$ROLE" in
  pm)
    allow "PM siempre elegible (auditar, refinar, documentar)" ;;
  tech)
    TASKS=$(section_tasks "To Do" | grep -v '\[Tipo: AI\]' || true)
    [ -n "$TASKS" ] && allow "hay tareas no-IA en To Do" \
                    || deny "sin tareas no-IA en To Do" ;;
  ia)
    TASKS=$(section_tasks "To Do" | grep '\[Tipo: AI\]' || true)
    [ -n "$TASKS" ] && allow "hay tareas [Tipo: AI] en To Do" \
                    || deny "sin tareas [Tipo: AI] en To Do" ;;
  qa)
    TASKS=$(section_tasks "Ready for QA")
    [ -n "$TASKS" ] && allow "hay tareas en Ready for QA" \
                    || deny "Ready for QA vacío" ;;
  *)
    deny "rol desconocido: $ROLE" ;;
esac

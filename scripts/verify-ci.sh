#!/bin/bash
set -e

echo "Iniciando verificacion Pre-Push (Simulacion de CI)..."

# 1. Type Check & Lint
echo "Verificando Tipos y Linting..."
pnpm typecheck
pnpm lint
echo "Codigo estatico correcto."

# 2. Tests Unitarios
echo "Ejecutando Tests Unitarios..."
pnpm test -- --run
echo "Tests unitarios pasados."

# 3. Build
echo "Intentando build de produccion..."
pnpm build
echo "Build correcto."

echo "TODO LISTO. Puedes hacer 'git push' con confianza."

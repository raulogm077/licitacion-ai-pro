#!/bin/bash
set -e

echo "🚀 Iniciando verificación Pre-Push (Simulación de CI)..."

# 1. Verificar sincronización de dependencias
echo "📦 Verificando package-lock.json..."
if git diff --name-only | grep -q 'package-lock.json'; then
    echo "❌ Error: Tienes cambios sin commitear en package-lock.json."
    echo "   Por favor, haz commit de package-lock.json antes de empujar."
    exit 1
fi

# 2. Simular instalación limpia (Dry run)
echo "🧹 Simulando 'npm ci'..."
# No ejecutamos npm ci real para no borrar node_modules locales cada vez, 
# pero verificamos la integridad del lockfile.
npm ci --dry-run
echo "✅ Lockfile correcto."

# 3. Type Check & Lint
echo "🛡️ Verificando Tipos y Linting..."
npm run typecheck
npm run lint
echo "✅ Código estático correcto."

# 4. Tests Unitarios (Fast)
echo "🧪 Ejecutando Tests Unitarios..."
npm run test -- run
echo "✅ Tests unitarios pasados."

# 5. Build
echo "🏗️ Intentando build de producción..."
npm run build
echo "✅ Build correcto."

echo "🎉 TODO LISTO. Puedes hacer 'git push' con confianza."

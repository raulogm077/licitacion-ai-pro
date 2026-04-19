#!/bin/bash

set -euo pipefail

# Este script ayuda a configurar las variables de entorno en Vercel rápidamente

echo "Configurando variables de entorno en Vercel..."

# Supabase URL
read -r -p "Introduce Supabase URL (o pulsa enter para usar la del .env si existe): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
  if [ -f .env ]; then
    SUPABASE_URL=$(grep -m1 '^VITE_SUPABASE_URL=' .env | cut -d '=' -f2- || true)
  fi
fi
if [ -n "$SUPABASE_URL" ]; then
  echo "$SUPABASE_URL" | npx vercel env add VITE_SUPABASE_URL production 2>/dev/null || echo "VITE_SUPABASE_URL ya existe o error."
fi

# Supabase Anon Key
read -r -p "Introduce Supabase Anon Key (o pulsa enter para usar la del .env si existe): " SUPABASE_KEY
if [ -z "$SUPABASE_KEY" ]; then
  if [ -f .env ]; then
    SUPABASE_KEY=$(grep -m1 '^VITE_SUPABASE_ANON_KEY=' .env | cut -d '=' -f2- || true)
  fi
fi
if [ -n "$SUPABASE_KEY" ]; then
  echo "$SUPABASE_KEY" | npx vercel env add VITE_SUPABASE_ANON_KEY production 2>/dev/null || echo "VITE_SUPABASE_ANON_KEY ya existe o error."
fi

echo "✅ Configuración finalizada."

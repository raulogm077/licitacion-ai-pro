#!/bin/bash

# Este script ayuda a configurar las variables de entorno en Vercel rápidamente

echo "Configurando variables de entorno en Vercel..."

# Supabase URL
read -p "Introduce Supabase URL (o pulsa enter para usar la del .env si existe): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
  SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2)
fi
if [ ! -z "$SUPABASE_URL" ]; then
  echo "$SUPABASE_URL" | npx vercel env add VITE_SUPABASE_URL production 2>/dev/null || echo "VITE_SUPABASE_URL ya existe o error."
fi

# Supabase Anon Key
read -p "Introduce Supabase Anon Key (o pulsa enter para usar la del .env si existe): " SUPABASE_KEY
if [ -z "$SUPABASE_KEY" ]; then
  SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)
fi
if [ ! -z "$SUPABASE_KEY" ]; then
  echo "$SUPABASE_KEY" | npx vercel env add VITE_SUPABASE_ANON_KEY production 2>/dev/null || echo "VITE_SUPABASE_ANON_KEY ya existe o error."
fi

# Gemini Key
read -p "Introduce Gemini API Key (o pulsa enter para usar la del .env si existe): " GEMINI_KEY
if [ -z "$GEMINI_KEY" ]; then
  GEMINI_KEY=$(grep VITE_GEMINI_API_KEY .env | cut -d '=' -f2)
fi
echo "$GEMINI_KEY" | npx vercel env add VITE_GEMINI_API_KEY production 2>/dev/null || echo "VITE_GEMINI_API_KEY ya existe o error."

echo "✅ Configuración finalizada."

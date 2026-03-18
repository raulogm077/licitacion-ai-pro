#!/bin/bash
set -e

# Crea o actualiza .env.local con las variables mínimas necesarias para los tests y dev locales
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creando $ENV_FILE..."
    touch "$ENV_FILE"
else
    echo "Actualizando $ENV_FILE..."
fi

# Añade VITE_SUPABASE_URL si no existe
if ! grep -q "^VITE_SUPABASE_URL=" "$ENV_FILE"; then
    echo "VITE_SUPABASE_URL=http://localhost:54321" >> "$ENV_FILE"
    echo "Añadida VITE_SUPABASE_URL a $ENV_FILE"
fi

# Añade VITE_SUPABASE_ANON_KEY si no existe
if ! grep -q "^VITE_SUPABASE_ANON_KEY=" "$ENV_FILE"; then
    echo "VITE_SUPABASE_ANON_KEY=your-anon-key-here" >> "$ENV_FILE"
    echo "Añadida VITE_SUPABASE_ANON_KEY a $ENV_FILE"
fi

echo "Variables de entorno inicializadas en $ENV_FILE"

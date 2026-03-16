# Especificación y Realidad de Implementación (Spec-Anchored)

## Estado del Proyecto

- **App de análisis de pliegos:** Interfaz para que el usuario suba pliegos en formato PDF (y opcionalmente una guía de lectura en PDF) y los analice usando OpenAI Agents.
- **Backend:** Supabase Edge Functions (`analyze-with-agents`) usan OpenAI Assistants SDK con Vector Stores para indexar documentos (streaming vía Server-Sent Events).

## Detalles de Implementación (Iteración Actual)

### 1. Script `.env.local`
- **Script:** `scripts/init-env.sh` (Ejecutable bash).
- **Acción:** Comprueba la existencia de `.env.local` y, si faltan, inyecta `VITE_SUPABASE_URL` (valor dummy `http://localhost:54321`) y `VITE_SUPABASE_ANON_KEY` (valor JWT dummy) para evitar que Vitest o Zod emitan warnings en stderr sobre variables de entorno ausentes.

### 2. Tests de UI - Warnings Vitest / React Testing Library
- **Archivos:** `src/components/layout/__tests__/Header.test.tsx`, `src/components/domain/__tests__/TagManager.test.tsx`, `src/config/__tests__/env.test.ts`.
- **Implementación:**
  - `Header.test.tsx`: Las interacciones del menú de usuario simuladas en tests (abrir menú, click en cerrar sesión) ahora son capturadas por `waitFor(...)` para esperar asincronamente al estado `mockSignOut`.
  - `TagManager.test.tsx` / `env.test.ts`: Las declaraciones `vi.mock` y `vi.unmock` fueron elevadas al nivel superior (top-level) del archivo, resolviendo la advertencia de Vitest de `mock hoisting`.

### 3. Soporte de Guía en Base64
- **Archivo:** `supabase/functions/analyze-with-agents/index.ts`.
- **Implementación:** El backend ahora usa un helper `extractBase64Data` para procesar la entrada `guiaBase64`. Esto limpia proactivamente el prefijo de Data URL (`data:application/pdf;base64,...`) si está presente antes de ser decodificado vía `atob` e instanciado en un `Uint8Array`. El sistema ahora es agnóstico y robusto a ambas representaciones en base64 de la guía de usuario.

### 4. Backlog
- Se actualizaron las tareas correspondientes moviéndolas de la sección `## To Do` a la sección `## Done` y marcándolas como completadas en `BACKLOG.md`.

### 5. Módulo Avanzado de Historial de Licitaciones
- **Historia de Usuario:** Como analista, quiero poder buscar, filtrar por estado y exportar mi histórico de licitaciones analizadas para encontrar pliegos relevantes rápidamente sin tener que re-analizar.
- **Requerimientos de Datos (Supabase):** Aprovechar y ampliar los métodos de búsqueda existentes (se requiere integrar o potenciar `advancedSearch` en `src/services/db.service.ts` para que soporte de manera eficiente filtrados complejos de JSONB en la UI).
- **UX Esperada (v0):** Reemplazar el listado básico actual de `HistoryView` con una UI moderna que incluya una tabla avanzada, filtros rápidos (rango de fechas, cliente, presupuesto mínimo/máximo), barra de búsqueda general y paginación.

# Analista de Pliegos - Backlog

## To Do (Iteración Actual)

## Deuda Técnica / Refactorización
*   **Limpieza de código viejo (pgmq + cron).** Se observa que el código ha migrado a una arquitectura basada en Server-Sent Events (SSE) y OpenAI Agents. Se deben revisar los archivos bajo `supabase/functions/` (ej. `openai-runner/` si aún existe pero no se usa). El JobService `startJob` y `pollJob` parecen ser versiones legacy en `src/services/job.service.ts` que se deberían remover o limpiar a favor de `analyzeWithAgents`.
*   **Variables de entorno requeridas en Unit tests.** Las advertencias de Zod/EnvSchema contaminan la salida del log de Vitest. Se debería considerar mockear el módulo de config en tests de setup.

## Ideas de Producto
*   **Gestión de plantillas (Guía de análisis).** Poder configurar distintas guías de extracción a nivel UI.
*   **Múltiples Documentos por Licitación.** Aún cuando parece que los sube en un Vector Store, la UI actual sube solo 1 PDF principal (más la guía opcional).

## Done
*   *Configuración inicial de vitest y NPM verificada.*
- [x] **Crear script para inicialización de variables de entorno locales** (`.env.local`). El entorno no tiene las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, lo que causa que algunos tests impriman errores en stderr.
- [x] **Revisar los tests de UI.** En el test `Header.test.tsx` hay un warning por un estado asíncrono no envuelto en `act(...)`.
- [x] **Implementar soporte completo para PDFs sin anexos/guía**. El sistema asume a veces la carga de la guía; evaluar si hay que limpiar ese path.
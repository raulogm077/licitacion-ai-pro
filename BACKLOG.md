# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual
Estamos en plena migración de una arquitectura legacy (pgmq + cron) a un sistema en tiempo real basado en Server-Sent Events (SSE) y el OpenAI Agents SDK.

## To Do (Iteración Actual)
## Ideas de Producto
- **Gestión de plantillas:** Poder configurar distintas guías de extracción a nivel UI.
- **Múltiples Documentos por Licitación:** Adaptar la UI y el Vector Store para subir más de 1 PDF principal (más allá de la guía opcional).

## Ready for QA
- [x] Implementar Módulo Avanzado de Historial de Licitaciones según especificación en SPEC.md
- [x] Limpieza de código legacy: Revisar `supabase/functions/` y eliminar código viejo de colas. Limpiar `startJob` y `pollJob` en `src/services/job.service.ts`.
- [x] Refactor de Tests: Mockear el módulo de config en tests de setup para silenciar las advertencias de Zod/EnvSchema en Vitest.

## Done
- [x] Crear script para inicialización de variables de entorno locales (`.env.local`). 
- [x] Revisar los tests de UI (warning en Header.test.tsx).
- [x] Implementar soporte completo para PDFs sin anexos/guía.

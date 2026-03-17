# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual
La migración de la arquitectura legacy a un sistema en tiempo real basado en Server-Sent Events (SSE) y OpenAI Agents SDK ha finalizado con éxito. El enfoque actual es habilitar la personalización del usuario, comenzando con la posibilidad de definir plantillas dinámicas de extracción en lugar de depender de esquemas estáticos.

## To Do (Iteración Actual)
- [ ] Implementar Gestión de Plantillas de Extracción según SPEC.md

## Ideas de Producto
- **Múltiples Documentos por Licitación:** Adaptar la UI y el Vector Store para subir más de 1 PDF principal (más allá de la guía opcional).

## Ready for QA

## Done
- [x] Implementar Módulo Avanzado de Historial de Licitaciones según especificación en SPEC.md
- [x] Limpieza de código legacy: Revisar `supabase/functions/` y eliminar código viejo de colas. Limpiar `startJob` y `pollJob` en `src/services/job.service.ts`.
- [x] Refactor de Tests: Mockear el módulo de config en tests de setup para silenciar las advertencias de Zod/EnvSchema en Vitest.
- [x] Crear script para inicialización de variables de entorno locales (`.env.local`). 
- [x] Revisar los tests de UI (warning en Header.test.tsx).
- [x] Implementar soporte completo para PDFs sin anexos/guía.

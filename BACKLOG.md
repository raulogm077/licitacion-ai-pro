# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual
La migración de la arquitectura legacy a un sistema en tiempo real basado en Server-Sent Events (SSE) y OpenAI Agents SDK ha finalizado con éxito. El enfoque actual se divide en habilitar la personalización de la extracción mediante plantillas dinámicas y en mejorar la capacidad de ingesta permitiendo la subida de múltiples documentos simultáneos para el análisis de la licitación completa.

## To Do (Iteración Actual)
- [ ] Implementar Gestión de Plantillas de Extracción según SPEC.md

- [ ] Implementar UI de Múltiples Documentos por Licitación según SPEC.md
- [ ] 🧠 [AI] Mejorar Edge Function para soportar múltiples archivos según SPEC.md
## Ideas de Producto

## Ready for QA

## Done
- [x] Implementar Módulo Avanzado de Historial de Licitaciones según especificación en SPEC.md
- [x] Limpieza de código legacy: Revisar `supabase/functions/` y eliminar código viejo de colas. Limpiar `startJob` y `pollJob` en `src/services/job.service.ts`.
- [x] Refactor de Tests: Mockear el módulo de config en tests de setup para silenciar las advertencias de Zod/EnvSchema en Vitest.
- [x] Crear script para inicialización de variables de entorno locales (`.env.local`). 
- [x] Revisar los tests de UI (warning en Header.test.tsx).
- [x] Implementar soporte completo para PDFs sin anexos/guía.

# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual
La migración de la arquitectura legacy a un sistema en tiempo real basado en Server-Sent Events (SSE) y OpenAI Agents SDK ha finalizado con éxito. El enfoque actual se divide en habilitar la personalización de la extracción mediante plantillas dinámicas y en mejorar la capacidad de ingesta permitiendo la subida de múltiples documentos simultáneos para el análisis de la licitación completa.

## To Do (Iteración Actual)

- [ ] Configurar Playwright para pruebas E2E automatizadas. El test debe simular la subida de un PDF y verificar que el JobService recibe los eventos SSE según lo descrito en ARCHITECTURE.md. Actualizar el script `test:e2e` en el package.json.
- [ ] Crear tabla `extraction_templates` en Supabase con RLS y políticas para usuarios autenticados, según SPEC.md (Sección 4).
- [ ] Desarrollar UI para Gestión de Plantillas (`/templates`) usando componentes de v0: Listado, Crear, Editar, Eliminar. El esquema visual debe permitir definir campos y tipos de datos, según SPEC.md.
- [ ] Integrar un selector de "Plantilla" en el Dropzone principal de subida de pliegos y pasarlo como parámetro al `JobService.analyzeWithAgents()`.
- [ ] 🧠 [AI] Modificar la Edge Function `analyze-with-agents` para recibir el ID de la plantilla, consultarla en base de datos, generar el esquema de extracción dinámicamente para OpenAI y mantener el fallback estático si no hay plantilla, según SPEC.md.
- [ ] Implementar UI de Múltiples Documentos por Licitación según SPEC.md (Iteración 5).
- [ ] 🧠 [AI] Mejorar Edge Function para soportar múltiples archivos según SPEC.md (Iteración 5).
## Ideas de Producto

## Ready for QA

## Done
- [x] Implementar Módulo Avanzado de Historial de Licitaciones según especificación en SPEC.md
- [x] Limpieza de código legacy: Revisar `supabase/functions/` y eliminar código viejo de colas. Limpiar `startJob` y `pollJob` en `src/services/job.service.ts`.
- [x] Refactor de Tests: Mockear el módulo de config en tests de setup para silenciar las advertencias de Zod/EnvSchema en Vitest.
- [x] Crear script para inicialización de variables de entorno locales (`.env.local`). 
- [x] Revisar los tests de UI (warning en Header.test.tsx).
- [x] Implementar soporte completo para PDFs sin anexos/guía.

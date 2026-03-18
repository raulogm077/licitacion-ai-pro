# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual

La migración a análisis en tiempo real con **OpenAI Agents SDK + SSE** está completada. La iteración de **Plantillas dinámicas de extracción** está terminada a nivel de desarrollo y documentación. La iteración activa se centra exclusivamente en **Soporte multi-documento por licitación**.

## Reglas de priorización

1. Los **bugs** devueltos por QA tienen prioridad sobre cualquier feature.
2. Las tareas deben caber en una sola sesión.
3. Si una tarea es demasiado grande, debe dividirse antes de desarrollarse.

## Formato obligatorio de cada tarea

```md
- [ ] [Tipo: UI|Backend|AI|Docs|QA] [Área: Templates|Analysis|Upload|History|Infra] Título claro
  - Objetivo:
  - Alcance:
  - Criterios de aceptación:
  - Archivos probables:
  - Dependencias:
```

## To Do (Iteración Actual)

- [ ] [Tipo: UI] [Área: Upload] Implementar soporte UI de múltiples documentos por licitación
  - Objetivo: permitir cargar varios documentos relacionados dentro del mismo análisis.
  - Alcance: actualizar dropzone en `AnalysisWizard.tsx`, manejo de estado global con múltiples archivos en `useAnalysisStore`, permitir añadir/quitar de la lista, y validación de máximo 5 archivos según `SPEC.md`.
  - Criterios de aceptación:
    - se pueden seleccionar y soltar varios archivos PDF
    - el usuario ve el listado de documentos cargados en el frontend con opción a eliminar
    - el flujo mantiene claridad de UX y emite errores si se supera el límite de archivos o tamaño
    - la UI envía un array de documentos al Store
  - Archivos probables:
    - `src/features/upload/components/AnalysisWizard.tsx`
    - `src/stores/analysis.store.ts`
  - Dependencias: ninguna

- [ ] [Tipo: QA] [Área: Upload] Validar E2E el soporte de múltiples documentos
  - Objetivo: Asegurar que el flujo completo de análisis con múltiples archivos funcione correctamente desde la UI hasta el Edge Function.
  - Alcance: Creación o actualización de pruebas Playwright para la subida concurrente de documentos.
  - Criterios de aceptación: Un test E2E sube múltiples documentos y verifica que el resultado se genera sin errores SSE.
  - Archivos probables: `e2e/critical-flows.spec.ts`
  - Dependencias: Implementar soporte UI de múltiples documentos por licitación.


- [ ] [Tipo: Backend] [Área: Analysis] Actualizar firmas de servicios para soporte multi-documento
  - Objetivo: Permitir que `analysis.store.ts` envíe múltiples archivos a través de la capa de servicios hasta la Edge Function.
  - Alcance: Modificar `ai.service.ts` (`analyzePdfContent`) para aceptar el array de archivos adicionales y pasarlos a `JobService.analyzeWithAgents`.
  - Criterios de aceptación:
    - `ai.service.ts` acepta un array de archivos (ej. `{ name: string, base64: string }[]`).
    - Los archivos se transfieren correctamente a `JobService.analyzeWithAgents`.
    - La compilación TypeScript (`pnpm typecheck`) pasa sin errores tras los cambios.
  - Archivos probables:
    - `src/services/ai.service.ts`
    - `src/stores/analysis.store.ts` (llamada a `analyzePdfContent`)
  - Dependencias: Soporte UI multi-documento

## Ready for QA

- [ ] 🧠 [AI] [Tipo: AI] [Área: Upload] Adaptar `analyze-with-agents` para múltiples archivos
  - Objetivo: soportar análisis conjunto de varios documentos sin romper el contrato actual.
  - Alcance: entrada multiarchivo, estrategia de ingestión y transformación compatible con frontend.
  - Criterios de aceptación:
    - la Edge Function acepta varios archivos
    - el análisis mantiene salida válida
    - se documenta el comportamiento y límites
  - Archivos probables:
    - `supabase/functions/analyze-with-agents/**`
    - transformación de resultados y schemas asociados
  - Dependencias: soporte UI multi-documento y definición cerrada del contrato de entrada

## Deuda Técnica / Refactorización

- (Vacío por el momento)

## Ideas de Producto

- (Vacío por el momento)

## Done

- [x] [Tipo: UI] [Área: Templates] Desarrollar pantalla de gestión de plantillas (`/templates`)
- [x] 🧠 [AI] [Tipo: AI] [Área: Templates] Hacer dinámica la extracción en `analyze-with-agents` a partir de `templateId`
- [x] [Tipo: Backend] [Área: Templates] Crear soporte persistente para `extraction_templates` en Supabase
- [x] [Tipo: UI] [Área: Templates] Integrar selector de plantilla en el flujo principal de análisis
- [x] [Tipo: QA] [Área: Analysis] Configurar Playwright para pruebas E2E del flujo SSE de análisis
- [x] [Tipo: UI] [Área: History] Implementar módulo avanzado de historial de licitaciones
- [x] [Tipo: Docs] [Área: Infra] Limpiar código legacy de colas y referencias obsoletas en servicios
- [x] [Tipo: QA] [Área: Infra] Refactor de tests para silenciar advertencias de configuración en Vitest
- [x] [Tipo: Docs] [Área: Infra] Crear script para inicialización de variables de entorno locales
- [x] [Tipo: QA] [Área: Analysis] Revisar warnings en tests de UI
- [x] [Tipo: AI] [Área: Analysis] Implementar soporte completo para PDFs sin anexos o guía

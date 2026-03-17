# Analista de Pliegos - Backlog

## Contexto actual

La migración a análisis en tiempo real con **OpenAI Agents SDK + SSE** está completada. La iteración activa se centra en dos líneas, pero **no deben mezclarse en la misma noche**:

1. **Plantillas dinámicas de extracción**
2. **Soporte multi-documento por licitación**

## Reglas de priorización

1. Los **bugs** devueltos por QA tienen prioridad sobre cualquier feature.
3. Primero se cierra la línea de **plantillas** antes de abordar **multi-documento**.
4. Las tareas deben caber en una sola sesión.
5. Si una tarea es demasiado grande, debe dividirse antes de desarrollarse.

## Formato obligatorio de cada tarea

```md
- [ ] [Tipo: UI|Backend|AI|Docs|QA] [Área: Templates|Analysis|Upload|History|Infra] Título claro
  - Objetivo:
  - Alcance:
  - Criterios de aceptación:
  - Archivos probables:
  - Dependencias:
```

## To Do

- [ ] [Tipo: Backend] [Área: Templates] Crear soporte persistente para `extraction_templates` en Supabase
  - Objetivo: disponer de una base persistente para plantillas de extracción.
  - Alcance: tabla, RLS y políticas para usuarios autenticados según `SPEC.md`.
  - Criterios de aceptación:
    - existe tabla `extraction_templates`
    - existen políticas compatibles con usuarios autenticados
    - el modelo queda documentado en `ARCHITECTURE.md` y `SPEC.md`
  - Archivos probables:
    - `supabase/migrations/**`
    - documentación asociada
  - Dependencias: ninguna

- [ ] [Tipo: UI] [Área: Templates] Desarrollar pantalla de gestión de plantillas (`/templates`)
  - Objetivo: permitir listar, crear, editar y eliminar plantillas desde la aplicación.
  - Alcance: UI y wiring frontend para CRUD de plantillas.
  - Criterios de aceptación:
    - existe listado de plantillas
    - se puede crear, editar y eliminar
    - el esquema visual permite definir campos y tipos
  - Archivos probables:
    - `src/pages/**`
    - `src/components/**`
    - `src/services/**`
  - Dependencias: soporte persistente para `extraction_templates`

- [ ] [Tipo: UI] [Área: Templates] Integrar selector de plantilla en el flujo principal de análisis
  - Objetivo: permitir elegir una plantilla antes de iniciar el análisis.
  - Alcance: wizard/dropzone principal y envío de `templateId` a `JobService.analyzeWithAgents()`.
  - Criterios de aceptación:
    - el selector se muestra en el flujo principal
    - el usuario puede continuar sin plantilla
    - si selecciona plantilla, se envía `templateId`
  - Archivos probables:
    - `src/features/**`
    - `src/components/**`
    - `src/services/job.service.ts`
  - Dependencias: CRUD o servicio de lectura de plantillas disponible

- [ ] [Tipo: UI] [Área: Upload] Implementar soporte UI de múltiples documentos por licitación
  - Objetivo: permitir cargar varios documentos relacionados dentro del mismo análisis.
  - Alcance: experiencia de subida, validación, listado y estado en frontend.
  - Criterios de aceptación:
    - se pueden seleccionar varios archivos
    - el usuario ve el listado de documentos cargados
    - el flujo mantiene claridad de UX y validaciones básicas
  - Archivos probables:
    - `src/features/**`
    - `src/components/**`
    - `src/services/job.service.ts`
  - Dependencias: cierre de la línea de plantillas en la iteración actual

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

## Ready for QA
- [ ] 🧠 [AI] [Tipo: AI] [Área: Templates] Hacer dinámica la extracción en `analyze-with-agents` a partir de `templateId`
  - Objetivo: permitir que la Edge Function use una plantilla de extracción dinámica sin romper el flujo actual.
  - Alcance: consulta de plantilla, generación dinámica de esquema y mantenimiento de fallback estático.
  - Criterios de aceptación:
    - la función acepta `templateId`
    - si existe plantilla válida, se usa para construir la extracción
    - si no existe plantilla, se mantiene fallback estático
    - no se rompe SSE ni el contrato frontend
  - Archivos probables:
    - `supabase/functions/analyze-with-agents/**`
    - `src/lib/schemas/**`
    - `src/agents/**`
  - Dependencias: soporte persistente para `extraction_templates`


## Done

- [x] [Tipo: QA] [Área: Analysis] Configurar Playwright para pruebas E2E del flujo SSE de análisis

- [x] [Tipo: UI] [Área: History] Implementar módulo avanzado de historial de licitaciones
- [x] [Tipo: Docs] [Área: Infra] Limpiar código legacy de colas y referencias obsoletas en servicios
- [x] [Tipo: QA] [Área: Infra] Refactor de tests para silenciar advertencias de configuración en Vitest
- [x] [Tipo: Docs] [Área: Infra] Crear script para inicialización de variables de entorno locales
- [x] [Tipo: QA] [Área: Analysis] Revisar warnings en tests de UI
- [x] [Tipo: AI] [Área: Analysis] Implementar soporte completo para PDFs sin anexos o guía

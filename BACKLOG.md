# Analista de Pliegos - Backlog

## 🧠 Contexto y Estado Actual

La migración a análisis en tiempo real con **OpenAI Agents SDK + SSE** está completada. La iteración de **Plantillas dinámicas de extracción** está terminada a nivel de desarrollo y documentación. La iteración activa se centra en la **Mejora del Análisis de Calidad y Consistencia** (Quality & Consistency Analysis Improvement).

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

## Ready for QA



## To Do (Iteración Actual)

- [ ] [Tipo: UI] [Área: Analysis] Integrar advertencias de consistencia semántica en la interfaz
  - Objetivo: Mostrar al usuario las advertencias de calidad (QualityService) generadas para el análisis.
  - Alcance: Integrar en la vista de resultados (`src/features/analytics/components/`) el renderizado de `warnings` del análisis, mejorando la fiabilidad visible para el usuario.
  - Criterios de aceptación: Las advertencias (ej. presupuesto vs solvencia) se visualizan claramente en la pantalla de resultados.
  - Archivos probables: `src/features/analytics/components/ChartsSection.tsx` (u otros en este directorio), `src/services/quality.service.ts`
  - Dependencias: Ninguna.



## Deuda Técnica / Refactorización

- (Vacío por el momento)

## Ideas de Producto

- (Vacío por el momento)

## Done

- [x] 🧠 [AI] [Tipo: AI] [Área: Analysis] Inyectar "Guía de lectura de pliegos.md" en el Vector Store del análisis
  - Objetivo: Resolver el error 401 Unauthorized detectado al ejecutar la Edge Function tras inyectar la guía de lectura.
  - Alcance: El error indica que la Edge Function fue desplegada requiriendo verificación JWT (`--verify-jwt`). El cliente no envía credenciales o la función debe ser pública. La acción correctiva requiere redesplegar la función con el flag `--no-verify-jwt`.
  - Criterios de aceptación: La ejecución de `analyze-with-agents` retorna 200 OK y el flujo SSE funciona sin error 401.
  - Archivos probables: `supabase/functions/analyze-with-agents/index.ts` (solo revisión), documentación de despliegue.
  - Dependencias: Ninguna.

- [x] [Tipo: Docs] [Área: Infra] Limpieza de estructura de proyectos y arquitectura de skills
  - Objetivo: Eliminar carpetas innecesarias generadas por múltiples agentes IA y consolidar la arquitectura de skills con Jules.
  - Alcance: Eliminar carpetas como `.adal`, `.agent`, `.claude`, `.roo`, etc. Mantener solo lo necesario (`.jules`, `.agents`, `skills/`). Documentar el patrón usado en `ARCHITECTURE.md`.
  - Criterios de aceptación: Las carpetas redundantes se eliminan del directorio raíz y la arquitectura limpia queda documentada.
  - Archivos probables: `ARCHITECTURE.md`, `SPEC.md`, `BACKLOG.md`
  - Dependencias: Ninguna.

- [x] [Tipo: Docs] [Área: Analysis] Convertir "Guia Lectura de Pliegos .pdf" a formato Markdown ("Guía de lectura de pliegos.md")
  - Objetivo: Disponer de las directrices de lectura de pliegos en un formato fácilmente analizable (Markdown) para los agentes AI.
  - Alcance: Extracción del contenido de "Guia Lectura de Pliegos .pdf" y creación del archivo "Guía de lectura de pliegos.md", alojándolo en el directorio de la Edge Function (`supabase/functions/analyze-with-agents/`) para que sea accesible en tiempo de ejecución.
  - Criterios de aceptación: El archivo "Guía de lectura de pliegos.md" se crea y contiene la transcripción fiel del PDF original en una ruta accesible por Deno.
  - Archivos probables: `supabase/functions/analyze-with-agents/Guía de lectura de pliegos.md`

- [x] 🧠 [AI] [Tipo: AI] [Área: Analysis] Inyectar "Guía de lectura de pliegos.md" en el Vector Store del análisis
  - Objetivo: Garantizar que el agente tenga acceso a las instrucciones metodológicas de la guía (cerrando el hueco funcional de inyección omitida).
  - Alcance: Modificar `analyze-with-agents/index.ts` para que lea el archivo local `Guía de lectura de pliegos.md` y lo suba al Vector Store de OpenAI (junto con los PDFs del expediente) antes de inicializar el streaming.
  - Criterios de aceptación: El Vector Store generado incluye la guía. El agente puede usar file_search para extraer directrices de lectura.
  - Archivos probables: `supabase/functions/analyze-with-agents/index.ts`
  - Dependencias: La conversión de la Guía de lectura a Markdown debe estar completada.

## Deuda Técnica / Refactorización

- (Vacío por el momento)

## Ideas de Producto

- (Vacío por el momento)

## Done

- [x] [Tipo: QA] [Área: Upload] Validar E2E el soporte de múltiples documentos
  - Objetivo: Asegurar que el flujo completo de análisis con múltiples archivos funcione correctamente desde la UI hasta el Edge Function (solucionar timeout).
  - Alcance: Actualización de pruebas Playwright (`e2e/multi-upload.spec.ts`) y posible ajuste en `AnalysisWizard.tsx` (exposición del input) para la subida concurrente de documentos en entorno aislado.
  - Criterios de aceptación: Un test E2E sube múltiples documentos correctamente, resolviendo el timeout de `locator('input[type="file"]')`, y verifica que el resultado se genera sin errores SSE.
  - Archivos probables: `e2e/multi-upload.spec.ts`, `src/features/upload/components/AnalysisWizard.tsx`
  - Dependencias: Ninguna.

- [x] 🧠 [AI] [Tipo: AI] [Área: Upload] Adaptar `analyze-with-agents` para múltiples archivos
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

- [x] [Tipo: UI] [Área: Upload] Implementar soporte UI de múltiples documentos por licitación
  - Objetivo: permitir cargar varios documentos relacionados dentro del mismo análisis.
  - Alcance: actualizar dropzone en `AnalysisWizard.tsx`, manejo de estado global con múltiples archivos en `useAnalysisStore`, permitir añadir/quitar de la lista, y validación de máximo 5 archivos según `SPEC.md`. Modificar `analyzeFile` para procesar el array de archivos con `processFile` obteniendo el hash y base64 de todos.
  - Criterios de aceptación:
    - se pueden seleccionar y soltar varios archivos PDF
    - el usuario ve el listado de documentos cargados en el frontend con opción a eliminar
    - el flujo mantiene claridad de UX y emite errores si se supera el límite de archivos o tamaño
    - la UI envía un array de documentos (o el documento principal y el array de adicionales pre-procesados en base64) al store
  - Archivos probables:
    - `src/features/upload/components/AnalysisWizard.tsx`
    - `src/stores/analysis.store.ts`
  - Dependencias: ninguna

- [x] [Tipo: QA] [Área: Upload] Validar E2E el soporte de múltiples documentos
  - Objetivo: Asegurar que el flujo completo de análisis con múltiples archivos funcione correctamente desde la UI hasta el Edge Function (solucionar timeout).
  - Alcance: Actualización de pruebas Playwright (`e2e/multi-upload.spec.ts`) y posible ajuste en `AnalysisWizard.tsx` (exposición del input) para la subida concurrente de documentos en entorno aislado.
  - Criterios de aceptación: Un test E2E sube múltiples documentos correctamente, resolviendo el timeout de `locator('input[type="file"]')`, y verifica que el resultado se genera sin errores SSE.
  - Archivos probables: `e2e/multi-upload.spec.ts`, `src/features/upload/components/AnalysisWizard.tsx`
  - Dependencias: Ninguna.

- [x] [Tipo: Docs] [Área: Analysis] Convertir "Guia Lectura de Pliegos .pdf" a formato Markdown ("Guía de lectura de pliegos.md")
  - Objetivo: Disponer de las directrices de lectura de pliegos en un formato fácilmente analizable (Markdown) para los agentes AI.
  - Alcance: Extracción del contenido de "Guia Lectura de Pliegos .pdf" y creación del archivo "Guía de lectura de pliegos.md", alojándolo en el directorio de la Edge Function (`supabase/functions/analyze-with-agents/`) para que sea accesible en tiempo de ejecución.
  - Criterios de aceptación: El archivo "Guía de lectura de pliegos.md" se crea y contiene la transcripción fiel del PDF original en una ruta accesible por Deno.
  - Archivos probables: `supabase/functions/analyze-with-agents/Guía de lectura de pliegos.md`

- [x] [Tipo: Backend] [Área: Infra] 🛡️ Sentinel: [CRITICAL] Remover credenciales expuestas y hardcodeadas
  - Objetivo: Identificar y eliminar cualquier credencial hardcodeada (API keys de Gemini, Supabase, Vercel, etc.) del repositorio para garantizar la seguridad del código público.
  - Alcance: Revisión de `scripts/setup-vercel-env.sh`, `scripts/init-env.sh` y otros scripts susceptibles.
  - Criterios de aceptación:
    - El repositorio no contiene secretos reales hardcodeados.
    - Todas las credenciales se inyectan dinámicamente vía entorno.
  - Archivos probables:
    - `scripts/setup-vercel-env.sh`
    - `scripts/init-env.sh`
  - Dependencias: Ninguna

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

# SPEC - Analista de Pliegos

## 1. Visión del producto

El producto debe permitir analizar pliegos de licitación de forma rápida, precisa y navegable, siguiendo la **Guía de lectura de pliegos** como referencia principal de negocio. La aplicación no sustituye la revisión humana; la acelera y la estructura.

## 2. Estado actual confirmado

Estado funcional confirmado a fecha de esta especificación:

- el análisis principal usa **OpenAI Agents SDK**
- el flujo de ejecución usa **streaming por SSE**
- existe historial de licitaciones y análisis ya implementado
- el sistema soporta análisis de PDF principal y múltiples documentos (backend/AI)
- el sistema soporta plantillas dinámicas de extracción en todos los niveles
- la arquitectura legacy de colas/polling quedó fuera del flujo operativo principal

## 3. Iteración activa

### 3.1. Objetivo

Añadir soporte **multi-documento por licitación** sin comprometer la claridad de UX ni la robustez del pipeline actual.

### 3.2. Historia de usuario principal

Como usuario interno que analiza pliegos, quiero poder seleccionar varios documentos complementarios al pliego base para que la IA disponga de todo el contexto necesario al generar el análisis.

### 3.3. Entregables esperados

1. Adaptación UI de wizard para soltar varios documentos
2. Ajuste de estado de `analysis.store`
3. Refuerzo E2E (QA)

### 3.4. Criterios de aceptación globales

- el usuario puede subir de 1 a 5 documentos
- la validación rechaza tamaños conjuntos por encima de lo estipulado (ej. 30MB)
- se lista visualmente qué archivos están cargados y permite borrarlos individualmente antes de enviarlos
- el backend y Vector Store procesan los documentos con éxito
- la función de `analyze-with-agents` ya adaptada es capaz de recibir este input y procesarlo

### 3.5. Impacto técnico esperado

Superficies afectadas en esta iteración:

- `src/features/upload/components/AnalysisWizard.tsx`
- `src/stores/analysis.store.ts`
- Tests E2E Playwright asociados

## 4. Diseño funcional y técnico de la iteración activa

### 4.1. Módulo UI (Frontend)

- **Carga de archivos:** Modificar `AnalysisWizard.tsx` (wizard/dropzone) para admitir la selección y drop de múltiples documentos PDF simultáneamente.
- **Estado Global:** Adaptar `useAnalysisStore` y cualquier store relevante para manejar un array de `File` en lugar de un único archivo, gestionando el progreso y mensajes globales o por archivo según convenga.
- **Listado y previsualización:** Mostrar de manera clara al usuario la lista de documentos que se van a procesar antes de enviarlos, permitiendo eliminar archivos de la cola.
- **Validaciones:** Verificar en frontend los tamaños máximos acumulados y número de documentos permitidos (ej. máx 5 documentos).
- **Servicio Job:** Asegurarse que `JobService.analyzeWithAgents` reciba el array de strings base64 o de objetos con `{ filename, base64 }`.

## 5. Próxima iteración

### 5.1. Objetivo
(Por definir)

## 6. Decisiones abiertas

- estrategia de composición del contexto cuando entren múltiples documentos (AI Prompting/Vector Store vs Assistants v2 limitations)
- límites operativos para número y tamaño de archivos multi-documento (si el cliente pide más de 5 en el futuro)

## 7. Riesgos y mitigaciones

### Riesgo 1: romper el contrato SSE
Mitigación: todo cambio en `analyze-with-agents` debe validar compatibilidad de eventos y consumo frontend.

### Riesgo 2: documentación obsoleta
Mitigación: ningún cambio pasa a QA sin actualizar documentación mínima afectada.

### Riesgo 3: tareas demasiado grandes
Mitigación: dividir cualquier épica en entregables de una sola sesión.

### Riesgo 4: desalineación con la Guía de lectura
Mitigación: el AI Engineer debe contrastar cada cambio de extracción contra la guía antes de entregar.

## 8. Historial de implementación

### Implementado previamente
- migración a OpenAI Agents SDK
- streaming por SSE
- historial avanzado de licitaciones
- limpieza principal de arquitectura legacy de colas
- Plantillas Dinámicas de Extracción (Back, Front, CRUD, AI Integrations)
- Soporte Multi-documento Backend (Edge Function adaptada para recibir Array de files)

### Iteración activa
- Soporte Multi-documento Frontend y QA

### 4.2. Refinamiento Multi-Documento (Frontend)

El flujo de carga en `AnalysisWizard.tsx` debe modificarse de la siguiente manera:
1.  **Estado:** Reemplazar `selectedFile` (tipo `File | null`) por `selectedFiles` (tipo `File[]`).
2.  **Límite:** Validar que `selectedFiles.length <= 5`. Mostrar mensaje de error claro si se excede.
3.  **Tamaño total:** Sumar el tamaño de todos los archivos en `selectedFiles` y validar contra `MAX_PDF_SIZE_BYTES` (30MB).
4.  **UI de Listado:** Reemplazar el bloque que muestra el único archivo seleccionado por un listado mapeando `selectedFiles`. Cada elemento debe tener su botón para eliminarlo del array.
5.  **Store:**
    - Modificar `analyzeFile` en `analysis.store.ts` para que reciba un array `files: File[]`.
    - Actualizar llamadas a `processFile(file)` para iterar y extraer `{ name, base64 }` de todos los documentos, pasando el primero como principal y el resto en el array `files`.
    - Enviar el objeto o parámetros correspondientes a `services.ai.analyzePdfContent`.

6.  **AI Service / Job Service:**
    - `analyzePdfContent` en `ai.service.ts` debe recibir `files` y pasarlo a `JobService.analyzeWithAgents`.
    - Asegurarse que el backend (`analyze-with-agents`) está preparado para el array de `files` extra que recibe `JobService`.

*Nota de implementación: Es crucial que el archivo principal se pase como `pdfBase64` y los adicionales en el array `files` para mantener retrocompatibilidad con la Edge Function, o refactorizar el backend para que todo entre por `files`.*

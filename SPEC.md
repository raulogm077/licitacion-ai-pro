# SPEC - Analista de Pliegos

## 1. Visión del producto

El producto debe permitir analizar pliegos de licitación de forma rápida, precisa y navegable, siguiendo la **Guía de lectura de pliegos** como referencia principal de negocio. La aplicación no sustituye la revisión humana; la acelera y la estructura.

## 2. Estado actual confirmado

Estado funcional confirmado a fecha de esta especificación:

- el análisis principal usa **OpenAI Agents SDK**
- el flujo de ejecución usa **streaming por SSE**
- existe historial de licitaciones y análisis ya implementado
- el sistema soporta análisis de PDF principal y prepara la evolución a plantillas dinámicas y múltiples documentos
- la arquitectura legacy de colas/polling quedó fuera del flujo operativo principal

## 3. Iteración activa

### 3.1. Objetivo

Cerrar la línea de **plantillas dinámicas de extracción** con una implementación segura, documentada y compatible con el flujo actual de análisis.

### 3.2. Historia de usuario principal

Como usuario interno que analiza pliegos, quiero poder seleccionar una plantilla de extracción antes de iniciar el análisis para adaptar el resultado estructurado al tipo de licitación sin perder robustez ni compatibilidad con la interfaz actual.

### 3.3. Entregables esperados

1. Soporte persistente para `extraction_templates` (✅ **Completado**)
2. Pantalla de gestión CRUD de plantillas (✅ **Completado**)
3. Selector de plantilla en el flujo principal de análisis (✅ **Completado**)
4. Adaptación de `analyze-with-agents` para usar `templateId` (✅ **Completado**)
5. Fallback estático cuando no haya plantilla válida (✅ **Completado**)
6. Validación automática con tests y cobertura mínima del flujo SSE/E2E

### 3.4. Criterios de aceptación globales

- la creación y edición de plantillas es posible desde la UI
- el usuario puede lanzar análisis con o sin plantilla
- si se selecciona plantilla, el `templateId` llega a la Edge Function
- la Edge Function usa la plantilla si existe y es válida
- si no existe plantilla, se usa el comportamiento estático actual
- no se rompe el contrato SSE
- no se rompe la validación Zod ni el render del frontend
- la documentación queda actualizada

### 3.5. Impacto técnico esperado

Superficies afectadas en esta iteración:

- migraciones y modelo persistente en Supabase
- servicios frontend/backend para plantillas
- wizard o flujo principal de subida/análisis
- `JobService.analyzeWithAgents()`
- Edge Function `analyze-with-agents`
- esquemas o utilidades de extracción si aplica
- tests unitarios y E2E relacionados

## 4. Diseño funcional y técnico de la iteración activa

### 4.1. Plantillas de extracción

La entidad `extraction_templates` debe permitir definir una estructura de extracción configurable por usuario autenticado.

Capacidades mínimas:

- nombre de plantilla
- descripción opcional
- definición de campos
- tipo de dato por campo
- activación/uso en análisis

### 4.2. Gestión de plantillas en UI

Debe existir una pantalla `/templates` que permita:

- listar plantillas
- crear plantilla
- editar plantilla
- eliminar plantilla

La pantalla debe estar pensada para que el usuario defina de forma clara qué campos quiere extraer y de qué tipo son.

### 4.3. Selector de plantilla en análisis

El flujo principal de análisis debe permitir seleccionar una plantilla antes de iniciar el procesamiento.

Comportamiento requerido:

- la selección es opcional
- si no hay selección, el sistema sigue funcionando como ahora
- si hay selección, el `templateId` debe viajar desde frontend hasta `analyze-with-agents`

### 4.4. Extracción dinámica en la Edge Function

La Edge Function debe:

- aceptar `templateId`
- consultar la plantilla en persistencia
- construir el esquema dinámico si la plantilla es válida
- aplicar fallback al esquema estático actual si no existe plantilla válida
- mantener compatibilidad con el contrato SSE y el frontend

### 4.5. Requisitos de validación

Para cerrar una tarea de esta iteración deben pasar, según aplique:

- `npm run type-check`
- `npm test`
- `npm run test:e2e` si el cambio toca UI, flujo principal o SSE
- test:e2e configurado con Playwright para pruebas E2E automatizadas


### 4.6. Implementación IA - Extracción Dinámica
- La Edge Function `analyze-with-agents` procesa un nuevo campo `template` en su request y genera un `response_format` dinámico para estructurar las respuestas combinando los campos por defecto y las propiedades extraídas mediante `plantilla_personalizada`.
- Actualizamos los schemas Zod (Frontend & Agent) asegurando que el schema Agent maneje la nueva clave de forma opcional y que el `transformAgentResponseToFrontend` mueva la data correctamente a través de la tubería para evitar corromper la pantalla de análisis con variables nulas o tipos incompatibles (TS/Zod).
- Se parcheo incompatibilidades de Zod con el JSON Schema estricto del OpenAI Agents SDK asegurando de usar `.nullable()` tras usar `.optional()`.

### 4.7. Implementación IA - Soporte Multi-documento
- La Edge Function `analyze-with-agents` se adaptó para procesar un nuevo campo `files` (array de objetos `{ name, base64 }`) además del `pdfBase64` principal.
- Esto permite la ingestión concurrente de múltiples documentos (ej. anexos técnicos, pliegos complementarios) en el mismo Vector Store para un análisis holístico de todo el expediente de licitación.
- Para no romper la compatibilidad de los contratos actuales, el campo `files` es opcional, y se mantiene activa la ruta de ingesta tradicional por `pdfBase64`.
- A nivel del `JobService`, la función `analyzeWithAgents` expone un nuevo argumento opcional `files?: { name: string; base64: string }[]` listo para ser consumido por la futura iteración de UI.

## 5. Próxima iteración

### 5.1. Objetivo

Añadir soporte **multi-documento por licitación** sin comprometer la claridad de UX ni la robustez del pipeline actual.

### 5.2. Alcance previsto

**Módulo UI (Frontend):**
- **Carga de archivos:** Modificar `AnalysisWizard.tsx` (wizard/dropzone) para admitir la selección y drop de múltiples documentos PDF simultáneamente.
- **Estado Global:** Adaptar `useAnalysisStore` y cualquier store relevante para manejar un array de `File` en lugar de un único archivo, gestionando el progreso y mensajes globales o por archivo según convenga.
- **Listado y previsualización:** Mostrar de manera clara al usuario la lista de documentos que se van a procesar antes de enviarlos, permitiendo eliminar archivos de la cola.
- **Validaciones:** Verificar en frontend los tamaños máximos acumulados y número de documentos permitidos (ej. máx 5 documentos).
- **Servicio Job:** Actualizar `JobService.analyzeWithAgents` para soportar el envío de un array de strings base64 o de objetos con `{ filename, base64 }`.

**Módulo Backend/AI:**
- **Adaptación Edge Function:** Modificar `analyze-with-agents` para procesar múltiples archivos.
- **Estrategia Ingestión Vector Store:** Asegurar que todos los archivos se suban y enlacen al `Vector Store` de la sesión del asistente en OpenAI.
- **Límites documentados:** Explicitar y controlar en la API el límite de tokens/tamaño para prevenir abusos.


### 5.3. Regla importante

La línea de plantillas y la línea multi-documento no deben mezclarse en la misma noche salvo ticket explícito.

## 6. Decisiones abiertas

- definición exacta del modelo de campos de `extraction_templates`
- nivel de flexibilidad admitido en los tipos de dato de plantilla
- estrategia de composición del contexto cuando entren múltiples documentos
- límites operativos para número y tamaño de archivos multi-documento

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

### Iteración activa
- pendiente de cierre completo según backlog

### Próxima iteración
- soporte multi-documento

### Hallazgos técnicos de iteración (Gestión Plantillas UI)
- La UI implementa una tabla intuitiva para el schema (nombre de campo, tipo y obligatoriedad).
- Existe un servicio `/src/services/template.service.ts` encargado de intermediar la comunicación con Supabase mediante el `supabaseClient`. Las vistas acceden mediante los métodos `createTemplate`, `getTemplates`, `getTemplate`, `deleteTemplate`, `updateTemplate`.
- Las plantillas se pueden duplicar para facilitar flujos de creación complejos basados en uno base.
- Ya se introdujo la validación unitaria exhaustiva en `TemplatesPage.test.tsx` garantizando su correcto renderizado ante listas vacías y datos de base de datos mockeados.

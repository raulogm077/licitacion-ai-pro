# ARCHITECTURE - Analista de Pliegos

## 1. Propósito

Este documento describe la arquitectura vigente de la aplicación y define qué cambios obligan a actualizarlo. Debe mantenerse alineado con el código real.

## 2. Regla de mantenimiento

Este documento es obligatorio actualizarlo cuando cambie cualquiera de estos puntos:

- flujo principal de análisis
- `JobService`
- contrato SSE
- estructura de entrada o salida del análisis
- arquitectura de plantillas
- soporte multi-documento
- responsabilidades técnicas relevantes de los agentes

## 3. Vista general

La aplicación analiza documentos PDF de licitaciones usando una Edge Function con **OpenAI Responses API** organizada en un **pipeline de 5 fases**, con streaming de progreso al frontend mediante **Server-Sent Events (SSE)**. Además, incorpora una capa conversacional productiva con **OpenAI Agents SDK** sobre análisis ya persistidos, sin alterar el flujo batch vigente.

Flujo actual:

```text
Frontend
  └─ JobService.analyzeWithAgents()
       └─ Supabase Edge Function: analyze-with-agents
            ├─ Fase A: Ingesta (Files API + Vector Store)
            ├─ Fase B: Mapa Documental (Responses API + file_search)
            ├─ Fase C: Extracción por Bloques (~9 llamadas Responses API)
            ├─ Fase D: Consolidación (merge + prelación documental)
            └─ Fase E: Validación Final (quality scoring)
                 └─ SSE → Frontend (progreso por fase + resultado)
```

## 4. Componentes principales

### 4.1. Frontend

Responsabilidades principales:

- subida de documentos
- interacción del usuario con el flujo de análisis
- visualización del progreso en tiempo real
- render del resultado estructurado
- visualización de advertencias de calidad (QualityService)
- gestión de historial de análisis
- futura gestión de plantillas y multi-documento

Superficies típicas:

- `src/components/**`
- `src/features/**`
- `src/pages/**`
- `src/stores/**`
- `src/services/**`

### 4.2. JobService

`JobService` actúa como capa de orquestación frontend para el análisis.

Responsabilidades:

- preparar la petición al backend
- invocar `analyze-with-agents`
- consumir eventos SSE
- notificar progreso a la UI
- transformar o encaminar el resultado al flujo de render

Cualquier cambio relevante en este servicio obliga a revisar este documento.

### 4.3. Edge Function `analyze-with-agents`

Es el núcleo del pipeline de IA. La función requiere autenticación JWT (validado manualmente dentro de la función). El frontend envía el token de sesión en el header `Authorization: Bearer <token>` desde `JobService`.

Responsabilidades:

- verificar la autenticación del usuario (JWT validado internamente con Supabase SDK)
- recibir la solicitud de análisis
- ejecutar pipeline de 5 fases usando **OpenAI Responses API** (`openai.responses.create()`)
- cada fase usa `file_search` sobre Vector Store para acceder al contenido de los documentos
- la "Guía de lectura de pliegos" se inyecta como contenido en los system prompts (no en Vector Store)
- emitir eventos SSE por fase (phase_started, phase_completed, heartbeat, complete)
- devolver resultado en formato canónico rico con evidencias por campo
- persistir estado del job en `analysis_jobs` para recovery de fallos parciales

#### Fases del pipeline:

| Fase | Descripción | Llamadas API |
|------|-------------|--------------|
| A: Ingesta | Subir archivos a OpenAI Files API, crear Vector Store | 0 (solo REST) |
| B: Mapa Documental | Identificar documentos (PCAP, PPT, anexos) | 1 |
| C: Extracción por Bloques | Extraer datos por sección (3 bloques en paralelo) | ~9 |
| D: Consolidación | Unificar bloques, resolver conflictos, prelación documental | 0 (local) |
| E: Validación | Quality scoring, verificar campos críticos, evidencias | 1 |

**Optimizaciones del pipeline:**
- Fase C usa `runWithConcurrency(tasks, 3)` para ejecutar bloques en paralelo (~3x speedup)
- Cada llamada API tiene timeout individual de 90s (`callWithTimeout`)
- Constantes centralizadas en `_shared/config.ts` (modelo, timeouts, concurrencia)
- Errores de OpenAI mapeados a mensajes legibles (`mapOpenAIError`)

### 4.4. Edge Function `chat-with-analysis-agent`

`chat-with-analysis-agent` es la capa conversacional productiva sobre análisis ya persistidos. Se apoya en OpenAI Agents SDK, pero permanece aislada del pipeline batch principal.

Responsabilidades:

- verificar JWT con el mismo patrón que `analyze-with-agents`
- cargar un análisis existente por `analysisHash`
- recuperar y persistir historial conversacional por sesión
- ejecutar un manager agent con especialistas vía `agent.asTool()`
- devolver una respuesta estructurada con citas y herramientas utilizadas
- ser consumida por el dashboard solo cuando existe un análisis persistido seleccionable

Restricciones:

- no relee PDFs ni recrea Vector Stores
- no modifica `analysis_jobs`
- no sustituye el flujo SSE principal
- opera solo sobre resultados ya guardados en `licitaciones`

Persistencia conversacional:

- `analysis_chat_sessions` guarda la sesión por `user_id + analysis_hash`
- `analysis_chat_messages` guarda el historial serializado
- la función reconstruye el input conversacional del SDK a partir de ese historial
- el frontend conserva `sessionId` y mensajes renderizados en `localStorage` bajo la clave `analysis-chat:<hash>` para continuidad de UX sin exponer tablas internas

Integración frontend:

- `Dashboard.tsx` añade la sección `chat` cuando `useLicitacionStore().hash` está disponible
- `AnalysisChatPanel` usa `AnalysisChatService` para invocar `chat-with-analysis-agent`
- la UI no accede directamente a `analysis_chat_messages`; todo el intercambio conversacional sigue entrando por la Edge Function

### 4.5. Persistencia

Supabase se usa para:

- autenticación
- datos de historial con búsqueda full-text (FTS español + ILIKE fallback) y eliminación
- sesiones de chat conversacional (`analysis_chat_sessions` y `analysis_chat_messages`)
- plantillas de extracción (`extraction_templates`): permite definir estructuras de extracción configurables por usuario autenticado. La tabla cuenta con políticas RLS (`Row Level Security`) para garantizar que cada usuario gestione exclusivamente sus plantillas, basadas en su `user_id`.
- otras entidades de soporte del producto

#### Full-Text Search

La tabla `licitaciones` incluye una columna `search_vector` (`tsvector`, generada, `stored`) con pesos:
- **A**: título
- **B**: órgano de contratación, cliente
- **C**: nombre de archivo, tipo de contrato, procedimiento

La función RPC `search_licitaciones` combina FTS (`websearch_to_tsquery('spanish', ...)`) con fallback ILIKE para coincidencias parciales (códigos CPV, términos cortos). Índice GIN para búsqueda rápida.

## 5. Contrato SSE

El frontend depende de un contrato SSE estable para mostrar progreso en tiempo real.

Eventos esperados, a nivel lógico:

- `heartbeat`
- `phase_started` — indica inicio de una fase (A, B, C, D, E)
- `phase_completed` — indica fin de una fase con resultado parcial
- `agent_message` — progreso dentro de una fase (legacy compat)
- `complete` — resultado final con `{result, workflow}`
- `error`

Reglas:

- no romper nombres ni estructura sin coordinar backend y frontend
- cualquier cambio de contrato exige actualización de tests y de esta arquitectura
- QA debe validar el flujo si una tarea toca SSE o el proceso principal de análisis

## 6. Plantillas dinámicas de extracción

La iteración activa introduce una arquitectura de plantillas configurable, respaldada por la tabla `extraction_templates`. Dicha tabla está protegida mediante Row Level Security (RLS), garantizando que los usuarios autenticados únicamente puedan gestionar (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) las plantillas que han creado.

En frontend se gestionan en la ruta `/templates` con operaciones de listar, crear, editar, eliminar y duplicar.

El modelo consta de:
- `id` (UUID)
- `user_id` (vinculado a `auth.users`)
- `name` y `description`
- `schema` (JSONB): listado de campos con su nombre, tipo, descripción y obligatoriedad.
- `created_at` y `updated_at`

Flujo objetivo:

```text
Usuario selecciona plantilla opcional
  └─ Frontend envía `templateId`
       └─ JobService lo incluye en la petición
            └─ analyze-with-agents consulta `extraction_templates`
                 ├─ si hay plantilla válida: construye extracción dinámica
                 └─ si no: fallback al esquema estático actual
```

Impacto técnico:

- frontend: selector de plantilla y gestión CRUD
- backend: persistencia de plantillas con modelo RLS
- IA: construcción dinámica de esquema
- documentación: `SPEC.md` y este archivo

## 7. Soporte multi-documento

El soporte multi-documento está disponible a nivel de back-end a través de `analyze-with-agents` y orquestación con `JobService`, listo para integrarse en la UI.

Flujo objetivo:

```text
Usuario selecciona varios documentos
  └─ Frontend valida y lista archivos (hasta 5, max 30MB)
       └─ JobService envía entrada multiarchivo a través del parámetro opcional `files`
            └─ analyze-with-agents ingiere de manera secuencial los documentos y construye el Vector Store
                 └─ resultado único estructurado para el expediente completo
```

Riesgos principales mitigados por la estrategia actual:

- crecimiento de memoria en Edge Functions (resuelto mediante carga secuencial de `files` usando `for...of`)
- crecimiento del contexto (OpenAI Vector Stores es responsable de la partición/chunks y recuperación mediante embeddings)
- comportamiento ambiguo entre documentos (Responses API con file_search permite lectura priorizada según prompts de cada fase)
- límites de Rate Limiting en API de OpenAI (resuelto mediante Exponential Backoff en el polling del Vector Store)

## 8. Decisiones técnicas documentadas

### 8.1 Base64 vs FormData para envío de PDFs (Decisión: mantener base64)

**Contexto:** Los PDFs se envían como base64 dentro de un JSON body, lo que implica ~33% de overhead en tamaño de red.

**Alternativa evaluada:** Enviar PDFs como `FormData` con `multipart/form-data`.

**Decisión: NO migrar.** Razones:
- Supabase Edge Functions (Deno) tienen soporte limitado para streaming multipart con SSE.
- La evaluación de OpenAI Agents SDK en Edge Functions debe mantenerse fuera del pipeline batch hasta confirmar compatibilidad real de runtime y despliegue.
- El contrato actual JSON es compatible con la validación Zod del request body.
- El cuello de botella real de latencia es OpenAI Files API + Vector Store indexing (~20-60s), no la transferencia.
- La validación de payload size (50MB máx.) ya limita el riesgo de abuso.
- La complejidad de migración (frontend + backend + tests) no justifica el beneficio marginal.

**Fecha:** 2026-03-22

### 8.2 Migración de Agents SDK a Responses API (Implementado)

**Contexto:** La aplicación usaba OpenAI Agents SDK con un único run monolítico que hacía todo en una llamada.

**Decisión:** Migrar a OpenAI Responses API (`openai.responses.create()`) con pipeline de 5 fases.

### 8.4. Capa conversacional con Agents SDK (Implementado)

**Contexto:** Se quería aprovechar OpenAI Agents SDK sin reescribir ni desestabilizar el pipeline principal.

**Decisión:** Consolidar la capa conversacional productiva en `chat-with-analysis-agent` y retirar del repositorio el spike técnico una vez validado el runtime, evitando mantener dos superficies agentic con distinto nivel de madurez.

**Restricción técnica:** `file_search` y `text.format: json_schema` (structured outputs) NO pueden usarse juntos en Responses API. Se instruye JSON estricto en el prompt y se valida con Zod server-side.

**Beneficios:**
- Extracción por bloques permite evidencias por campo
- Resultado parcial persistido en DB si una fase falla
- Vector Store persiste para reintentos (cleanup por TTL)
- Schema canónico rico con TrackedField (value + status + evidence) para campos críticos

**Fecha:** 2026-04-18

### 8.3 CORS restrictivo (Implementado)

**Contexto:** CORS wildcard (`*`) permitía cualquier origen invocar la Edge Function.

**Decisión:** Restringir a orígenes autorizados (`licitacion-ai-pro.vercel.app`, `localhost:5173`, `localhost:3000`). Se usa `Vary: Origin` para compatibilidad con caches.

**Fecha:** 2026-03-22

## 9. Responsabilidades técnicas por rol

### PM
- backlog y `SPEC.md`
- no programa ni despliega

### Tech Lead
- UI, servicios tradicionales, tests y cambios no IA
- actualiza arquitectura si toca flujo, UI principal o `JobService`

### AI Engineer
- prompts, esquemas, transformación y `analyze-with-agents`
- actualiza arquitectura si cambia contrato o pipeline real

### QA
- valida, actualiza estado del backlog y despliega si corresponde
- no crea features nuevas

## 10. Reglas de calidad técnica

- no trabajar sobre `main`
- una sola tarea de desarrollo por noche
- no mezclar plantillas y multi-documento en la misma noche salvo ticket explícito
- no mover una tarea a QA sin tests y sin documentación mínima actualizada

## 11. Fuentes vigentes

Documentos operativos vigentes:

- `README.md`
- `SPEC.md`
- `BACKLOG.md`
- `AGENTS.md`
- `DEPLOYMENT.md`

Documento histórico no operativo:

- `DEPRECATED.md`

## Agent Skill Modular Pattern (Infraestructura AI)
Para asegurar que la integración de *skills* en Jules siga principios de arquitectura limpia y evite la contaminación del proyecto raíz, el sistema adopta un modelo estricto de carpetas:

1. **Directorio `.agents`:** Contiene configuraciones, plugins o recursos centrales que Jules u otros agentes core requieran a nivel de proyecto base, actuando como espacio aislado oculto.
2. **Directorio `.jules`:** Espacio estricto de configuración exclusiva para la instancia actual de Jules, donde residen referencias propias, reglas y personalizaciones.
3. **Directorio `skills`:** Todas las habilidades extendidas que actúan como plugins independientes quedan centralizadas aquí.

> *Importante:* El repositorio no admite la proliferación de carpetas punto (`.`) por cada modelo/herramienta (ej. `.claude`, `.roo`, `.qoder`) para evitar desorden arquitectónico. Todo *skill* se inyecta o referencia bajo el entorno modularizado provisto por Jules.

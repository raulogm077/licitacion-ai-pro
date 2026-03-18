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

La aplicación está diseñada para analizar documentos PDF de licitaciones usando una Edge Function con **OpenAI Agents SDK** y enviar el progreso al frontend mediante **Server-Sent Events (SSE)**.

Flujo actual:

```text
Frontend
  └─ JobService.analyzeWithAgents()
       └─ Supabase Edge Function: analyze-with-agents
            └─ OpenAI Files API / Vector Store
                 └─ Agents SDK
                      └─ SSE → Frontend
```

## 4. Componentes principales

### 4.1. Frontend

Responsabilidades principales:

- subida de documentos
- interacción del usuario con el flujo de análisis
- visualización del progreso en tiempo real
- render del resultado estructurado
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

Es el núcleo del pipeline de IA.

Responsabilidades:

- recibir la solicitud de análisis
- cargar uno o múltiples archivos (mediante `pdfBase64` o el array `files`) a OpenAI cuando aplique
- construir un contexto consolidado en el Vector Store con el expediente completo
- ejecutar análisis con Agents SDK
- emitir eventos SSE
- devolver resultado estructurado compatible con frontend

### 4.4. Persistencia

Supabase se usa para:

- autenticación
- datos de historial
- plantillas de extracción (`extraction_templates`): permite definir estructuras de extracción configurables por usuario autenticado. La tabla cuenta con políticas RLS (`Row Level Security`) para garantizar que cada usuario gestione exclusivamente sus plantillas, basadas en su `user_id`.
- otras entidades de soporte del producto

## 5. Contrato SSE

El frontend depende de un contrato SSE estable para mostrar progreso en tiempo real.

Eventos esperados, a nivel lógico:

- `heartbeat`
- `agent_message`
- `complete`
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

Flujo objetivo parcial:

```text
Usuario selecciona varios documentos
  └─ Frontend valida y lista archivos (WIP - Pendiente UI)
       └─ JobService envía entrada multiarchivo a través del parámetro opcional `files`
            └─ analyze-with-agents ingiere varios documentos y construye el Vector Store
                 └─ resultado único estructurado para la licitación
```

Riesgos principales mitigados por la estrategia actual:

- crecimiento del contexto (OpenAI Vector Stores es responsable de la partición/chunks y recuperación mediante embeddings)
- comportamiento ambiguo entre documentos (Agent SDK orquesta la lectura priorizada según `instructions`)
- complejidad de UX (Pendiente de cierre iterativo en UI)

## 8. Responsabilidades técnicas por rol

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

## 9. Reglas de calidad técnica

- no trabajar sobre `main`
- una sola tarea de desarrollo por noche
- no mezclar plantillas y multi-documento en la misma noche salvo ticket explícito
- no mover una tarea a QA sin tests y sin documentación mínima actualizada

## 10. Fuentes vigentes

Documentos operativos vigentes:

- `README.md`
- `SPEC.md`
- `BACKLOG.md`
- `AGENTS.md`
- `DEPLOYMENT.md`

Documento histórico no operativo:

- `DEPRECATED.md`

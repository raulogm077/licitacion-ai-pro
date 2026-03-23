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

Es el núcleo del pipeline de IA. La función requiere autenticación JWT (`verify_jwt = true` en `supabase/config.toml`). El frontend envía el token de sesión en el header `Authorization: Bearer <token>` desde `JobService`.

Responsabilidades:

- verificar la autenticación del usuario (JWT validado por Supabase runtime)
- recibir la solicitud de análisis
- cargar uno o múltiples archivos (mediante `pdfBase64` o el array `files`) a OpenAI. La carga de múltiples archivos se realiza de forma **secuencial** para evitar picos de consumo de memoria que rompan el límite del Edge Runtime.
- construir un contexto consolidado en el Vector Store con el expediente completo (polling mediante exponential backoff) y la "Guía de lectura de pliegos". Ésta última se incluye localmente usando `Deno.readTextFile(new URL('./Guía de lectura de pliegos.md', import.meta.url))` de manera que la IA siempre tenga la guía de negocio disponible por sistema y de forma automática como archivo `.md`.
- ejecutar análisis con Agents SDK (inyectando mensaje con los nombres de los documentos del expediente)
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
- comportamiento ambiguo entre documentos (Agent SDK orquesta la lectura priorizada según `instructions` donde se define que la IA analiza un expediente)
- límites de Rate Limiting en API de OpenAI (resuelto mediante Exponential Backoff en el polling del Vector Store)

## 8. Decisiones técnicas documentadas

### 8.1 Base64 vs FormData para envío de PDFs (Decisión: mantener base64)

**Contexto:** Los PDFs se envían como base64 dentro de un JSON body, lo que implica ~33% de overhead en tamaño de red.

**Alternativa evaluada:** Enviar PDFs como `FormData` con `multipart/form-data`.

**Decisión: NO migrar.** Razones:
- Supabase Edge Functions (Deno) tienen soporte limitado para streaming multipart con SSE.
- El contrato actual JSON es compatible con la validación Zod del request body.
- El cuello de botella real de latencia es OpenAI Files API + Vector Store indexing (~20-60s), no la transferencia.
- La validación de payload size (50MB máx.) ya limita el riesgo de abuso.
- La complejidad de migración (frontend + backend + tests) no justifica el beneficio marginal.

**Fecha:** 2026-03-22

### 8.2 CORS restrictivo (Implementado)

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

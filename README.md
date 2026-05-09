# Analista de Pliegos

Aplicación interna para analizar pliegos de licitación en PDF, extraer información estructurada y presentar el resultado de forma navegable para acelerar la revisión funcional y técnica.

<!-- release-contract:start -->
- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
<!-- release-contract:end -->

## Qué hace

- permite subir un PDF completo de pliego como camino principal y más fiable
- acepta documentos adicionales de refuerzo cuando no existe un único PDF completo, pero ese no es el gate principal de release
- ejecuta análisis asistido por IA con streaming en tiempo real
- valida y transforma la salida a un modelo tipado
- guarda historial de análisis para su consulta posterior
- permite consultar un análisis persistido desde el dashboard mediante un copiloto conversacional
- búsqueda full-text en español (FTS + ILIKE fallback) sobre el historial
- eliminación de registros del historial con confirmación
- prepara el terreno para plantillas dinámicas de extracción y soporte multi-documento

## Arquitectura actual

La arquitectura vigente usa **OpenAI Responses API** con un **pipeline de 5 fases**, **Supabase Edge Functions** y **SSE** para streaming del análisis. Las fases B y C de `analyze-with-agents` se ejecutan a través del SDK `@openai/agents@0.3.1`.

De forma complementaria, el backend incorpora una capa conversacional aislada con **OpenAI Agents SDK** sobre análisis ya persistidos. Esta capa vive en la Edge Function `chat-with-analysis-agent` y no sustituye el pipeline principal.

**Postura de auth**: ambas Edge Functions usan `verify_jwt = true` en `supabase/config.toml`. Las peticiones sin un JWT válido son rechazadas con `401` por el gateway de Supabase antes de invocar el código de la función. Detalle operativo en `DEPLOYMENT.md` §5 y `AGENTS.md`.

El frontend consume la capa conversacional desde el dashboard mediante una sección `Copiloto IA`, visible cuando la licitación cargada tiene `analysisHash`. La conversación mantiene continuidad reutilizando `sessionId` y el historial visible en `localStorage`.

Flujo lógico actual:

```text
Usuario → Frontend → Edge Function `analyze-with-agents`
                     ↓
              Fase A: Ingesta (Files API + Vector Store)
              Fase B: Mapa Documental (Agent + run() + file_search)
              Fase C: Extracción por Bloques (~9 Agents, concurrencia 3)
              Fase D: Consolidación
              Fase E: Validación Final
                     ↓
                 SSE → Frontend (progreso por fase + reintentos visibles)
```

Contrato compartido relevante:

- `src/shared/analysis-contract.ts` define el wire contract común entre frontend y backend para eventos SSE, `TrackedFieldWire` y `partial_reasons`
- `workflow.quality.section_diagnostics` distingue si una sección está presente, ausente en los documentos subidos o recuperada tras degradación de schema/extracción
- `supabase/functions/_shared/schemas/canonical.ts` sigue siendo la fuente canónica del schema validado del análisis
- el frontend debe consumir `workflow.quality` emitido por backend antes de aplicar heurísticas locales

Documentación viva del sistema:

- `ARCHITECTURE.md`: arquitectura vigente y contratos técnicos
- `SPEC.md`: iteración activa, criterios y decisiones
- `BACKLOG.md`: cola operativa de trabajo nocturno
- `AGENTS.md`: reglas de funcionamiento de la fábrica de agentes (incluye postura de auth)
- `DEPLOYMENT.md`: proceso actual de despliegue
- `TECHNICAL_DOCS.md`: contratos técnicos detallados
- `CHANGELOG.md`: historial de cambios por release

## Stack real

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router
- Zod

### Backend y servicios
- Supabase
- Supabase Edge Functions (Deno runtime)
- OpenAI Responses API (pipeline por fases)
- `@openai/agents@0.3.1` para fases B y C de `analyze-with-agents`
- OpenAI Files API / Vector Store
- Vercel para hosting frontend

### Calidad
- Vitest
- Playwright
- ESLint
- TypeScript strict mode

## Cómo ejecutar en local

### Requisitos

- Node.js 20+
- pnpm 9+
- proyecto de Supabase configurado
- variables de entorno locales completas
- secreto `OPENAI_API_KEY` configurado en Supabase para la Edge Function

### Instalación

```bash
git clone https://github.com/raulogm077/licitacion-ai-pro.git
cd licitacion-ai-pro
pnpm install
```

### Variables de entorno

Crea `.env.local` a partir de `.env.example` y completa al menos:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
VITE_ENVIRONMENT=local
```

`OPENAI_API_KEY` no debe vivir en el frontend. Debe configurarse como secreto en Supabase para las funciones `analyze-with-agents` y `chat-with-analysis-agent`.

### Ejecución local

```bash
pnpm dev
```

## Testing

```bash
pnpm typecheck
pnpm test
pnpm benchmark:pliegos
pnpm test:e2e
pnpm verify:integrity
pnpm verify:release
```

Notas:
- `pnpm test:e2e` debe usarse cuando una tarea toque UI, flujo principal de análisis o SSE.
- `pnpm benchmark:pliegos` valida el caso principal de producto con fixtures versionados y es obligatorio cuando cambian contrato, pipeline o dashboard del análisis.
- El benchmark también protege regresiones silenciosas de reconciliación canónica, por ejemplo presupuesto/plazo completados desde bloques económicos o diagnósticos por sección.
- Una tarea no está lista para QA si cambia comportamiento real y no actualiza la documentación correspondiente.

## Flujo de ramas y entrega

Este repositorio sigue una política de **rama efímera por tarea**.

- ningún agente trabaja directamente sobre `main`
- cada ejecución crea una rama efímera propia
- el `submit` del agente se hace sobre esa rama
- **QA** es la única puerta a `Done`
- el despliegue productivo ocurre solo al fusionar una PR verde sobre `main`

Flujo recomendado:

1. trabajar en rama efímera
2. ejecutar `pnpm verify:release`
3. abrir o actualizar PR
4. esperar CI en verde
5. fusionar en `main`
6. dejar que GitHub Actions despliegue producción

Formato recomendado de ramas:

- `jules/pm/<slug-tarea>`
- `jules/tech/<slug-tarea>`
- `jules/ai/<slug-tarea>`
- `jules/qa/<fecha-o-lote>`

## Flujo nocturno de agentes

Orden de ejecución:

1. PM
2. Tech Lead o AI Engineer
3. QA

Reglas clave:
- nunca hay más de un agente trabajando a la vez
- solo se ejecuta una tarea de desarrollo por noche
- QA valida antes de mover una tarea a `Done`
- solo QA puede desplegar la Edge Function

## Documentación viva

La documentación forma parte del entregable.

Se debe actualizar como mínimo:

- `SPEC.md` si cambia funcionalidad o criterios
- `ARCHITECTURE.md` si cambia flujo, contrato, SSE, `JobService` o Edge Function
- `README.md` si cambia stack, setup o forma de trabajo
- `DEPLOYMENT.md` si cambia el proceso real de despliegue
- `TECHNICAL_DOCS.md` si cambia backend, tablas o contratos técnicos

# Analista de Pliegos

Aplicación interna para analizar pliegos de licitación en PDF, extraer información estructurada y presentar el resultado de forma navegable para acelerar la revisión funcional y técnica.

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
- AI runtime changes must keep `pnpm eval:pliegos:check` green and record a manual `pnpm eval:pliegos:live` baseline before model, prompt, retrieval, or orchestration promotion.

<!-- release-contract:end -->

## Qué hace

- permite subir un PDF completo de pliego como camino principal y más fiable
- acepta documentos adicionales de refuerzo cuando no existe un único PDF completo, pero ese no es el gate principal de release
- ejecuta análisis asistido por IA como job durable, con progreso Realtime y polling de respaldo
- valida y transforma la salida a un modelo tipado
- guarda historial de análisis para su consulta posterior
- permite consultar un análisis persistido desde el dashboard mediante un copiloto conversacional
- búsqueda full-text en español (FTS + ILIKE fallback) sobre el historial
- eliminación de registros del historial con confirmación
- prepara el terreno para plantillas dinámicas de extracción y soporte multi-documento
- interfaz con sistema de diseño «Iris» (marca índigo→violeta, fuentes Inter/Space Grotesk self-hosted), **modo oscuro funcional** y notificaciones tipo toast; respeta `prefers-reduced-motion`

Dependencias frontend de UI (solo cliente, no afectan al runtime Deno de las Edge Functions): `motion`, `sonner`, `recharts`, `canvas-confetti`, `tailwindcss-animate`, `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk`.

## Arquitectura actual

La arquitectura vigente separa el control HTTP del trabajo de IA. Cada ejecución nace como un job idempotente en Postgres; el navegador recibe tokens de subida firmados y envía los bytes directamente al bucket privado; `analysis-worker` consume PGMQ, persiste checkpoints por fase y publica el siguiente paso de forma atómica. El navegador recibe avisos privados de Supabase Realtime y vuelve a leer el job por RLS, con polling como respaldo. Las fases B y C siguen ejecutándose mediante `@openai/agents@0.3.1` y el schema canónico no cambia.

De forma complementaria, el backend incorpora una capa conversacional aislada con **OpenAI Agents SDK** sobre análisis ya persistidos. Esta capa vive en la Edge Function `chat-with-analysis-agent` y no sustituye el pipeline principal.

**Postura de auth**: `analysis-jobs`, `analyze-with-agents` y `chat-with-analysis-agent` usan `verify_jwt = true`. `analysis-worker` no acepta usuarios: usa `verify_jwt = false` con un token M2M generado en Postgres, guardado en Vault y comparado por SHA-256. Detalle operativo en `DEPLOYMENT.md` §5 y `AGENTS.md`.

El frontend consume la capa conversacional desde el dashboard mediante una sección `Copiloto IA`, visible cuando la licitación cargada tiene `analysisHash`. La conversación mantiene continuidad reutilizando `sessionId` y el historial visible en `localStorage`.

Flujo lógico actual:

```text
Usuario → Frontend (`X-Idempotency-Key` + SHA-256)
              ├─ `analysis-jobs:init` → job + plan de upload firmado
              ├─ Storage privado ← bytes directos del navegador
              └─ `analysis-jobs:submit` → outbox + PGMQ → HTTP 202
                                                └─ `analysis-worker`
                                                     ├─ lease/retry/DLQ
                                                     ├─ pipeline A-E por checkpoints
                                                     └─ transición + siguiente enqueue atómicos
                                                           ↓
                                      Realtime Broadcast privado → lectura RLS
                                                           └─ polling de respaldo
```

`analyze-with-agents` y su contrato SSE permanecen desplegables durante Fase 1B como rollback controlado, pero la UI nueva no transporta documentos en base64 ni depende de mantener ese stream abierto.

Contrato compartido relevante:

- `src/shared/analysis-contract.ts` mantiene los eventos de progreso; `job_created` entrega el `jobId` antes de subir o procesar documentos
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
- `CHANGELOG.md`: historial de cambios por release (última entrada: Fase 1B de upload firmado, worker independiente y recovery durable)
- `docs/adr/ADR-001-arquitectura-ia-durable-y-evaluable.md`: arquitectura objetivo de IA y migración incremental aprobada

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
- Supabase Edge Functions (control plane + worker Deno)
- Supabase Storage, Queues/PGMQ, Realtime Broadcast, pg_net, pg_cron y Vault
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

- Node.js 20+ (el toolchain de CI está unificado en Node 22)
- pnpm 9+
- proyecto de Supabase configurado
- variables de entorno locales completas
- secreto `OPENAI_API_KEY` configurado en Supabase para las funciones que llaman a OpenAI

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

`OPENAI_API_KEY` no debe vivir en el frontend. Debe configurarse como secreto en Supabase para `analysis-worker`, `analyze-with-agents` y `chat-with-analysis-agent`. El token interno del worker no se configura manualmente: la migración lo genera y lo conserva en Vault.

Para la evaluación live local, `OPENAI_API_KEY` se lee desde `.env.local`, que está ignorado por Git. El evaluador no usa las variables `VITE_*` ni persiste la clave en sus informes.

### Ejecución local

```bash
pnpm dev
```

## Testing

```bash
pnpm typecheck
pnpm test
pnpm benchmark:pliegos
pnpm eval:pliegos:check
pnpm test:e2e
pnpm verify:integrity
pnpm verify:release
```

Notas:

- `pnpm test:e2e` debe usarse cuando una tarea toque UI, flujo principal de análisis o SSE.
- `pnpm benchmark:pliegos` valida el caso principal de producto con fixtures versionados y es obligatorio cuando cambian contrato, pipeline o dashboard del análisis.
- El benchmark también protege regresiones silenciosas de reconciliación canónica, por ejemplo presupuesto/plazo completados desde bloques económicos o diagnósticos por sección.
- `pnpm eval:pliegos:check` valida en CI el contrato determinista de métricas. `pnpm eval:pliegos:live` ejecuta manualmente las cinco fases reales contra OpenAI y compara hechos, ausencias, grounding y calidad; consume API y no forma parte del CI.
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

## Fábrica de agentes autónomos

El repo incluye cuatro agentes autónomos (PM, Tech, IA, QA) que corren en GitHub
Actions con `anthropics/claude-code-action@v1`, se coordinan por `BACKLOG.md` e
integran sus PRs vía auto-merge cuando el CI `Productive CI/CD Pipeline` está en
verde. El kill switch global es la variable de repositorio `AGENTS_ENABLED`
(arranque en frío en `false`; `workflow_dispatch` lo salta). Detalle operativo
—workflows, prompts en `.claude/commands/`, `scripts/agents/guard.sh`, secrets y
protección de rama— en [`DEPLOYMENT.md`](./DEPLOYMENT.md).

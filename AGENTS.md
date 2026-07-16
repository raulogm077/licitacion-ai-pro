# Arquitectura del pipeline `analyze-with-agents`

Esta nota describe cómo el pipeline de análisis usa el SDK `@openai/agents` y
dónde vive cada pieza. Es la referencia operativa para añadir o modificar
fases que llamen al modelo.

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
- AI runtime changes must keep `pnpm eval:pliegos:check` green and record a manual `pnpm eval:pliegos:live` baseline before model, prompt, retrieval, or orchestration promotion.

<!-- release-contract:end -->

## Frontend UI stack (rediseño «Iris»)

- Las dependencias de UI del rediseño (`motion`, `sonner`, `recharts`,
  `canvas-confetti`, `tailwindcss-animate`, `@fontsource-variable/*`) son **solo
  de cliente**: no las importa ninguna Edge Function ni entran en `deno check`.
- El modo oscuro depende de `darkMode: 'class'` en `tailwind.config.js`; no
  reintroducir estilos que asuman el esquema del sistema en vez de la clase
  `.dark`.
- Toda animación debe respetar `prefers-reduced-motion` (guard global en
  `src/index.css` + `MotionProvider` con `reducedMotion: 'user'`).

## Diagnóstico y límites operativos del pipeline

- `BLOCK_CONCURRENCY = 2` (config.ts): no subirlo sin verificar el TPM de la
  cuenta OpenAI — con file_search cada bloque consume mucho presupuesto de
  tokens y 3 simultáneos provocaban cascadas de 429.
- Los `partial_reasons` deben ser veraces: nunca añadir un motivo que culpe al
  documento (`ocr_or_indexing_low_signal`) a partir de estados desconocidos
  (ver `IngestionDiagnostics.pollFailed` y `ARCHITECTURE.md` §8.10).
- Las escrituras de cierre de `analysis_jobs` van con `await` antes de cerrar
  el stream SSE; el runtime mata los fetch pendientes al terminar la request.

## SDK + versión

- `npm:@openai/agents@0.3.1` — última versión cuyo `peerDependency` es
  `"zod":"^3.25.40 || ^4.0"`. A partir de `0.3.2` el SDK exige zod ^4 estricto;
  el bump está deferido (riesgo de breaking changes en `z.preprocess` y
  `.default`).
- `npm:zod@3.25.76` — mínimo aceptado por el SDK; mayor 3.x estable.
- Toda importación del SDK pasa por `_shared/agents/sdk.ts` con re-exports
  nombrados explícitos (no `export *`). El export-* de un especificador `npm:`
  pierde los nombres en Deno y rompe `deno check` en los consumidores.
- Desde 2026-07-12 esto aplica también a `chat-with-analysis-agent`: ya no
  importa `npm:@openai/agents@0.1.0` directo en 4 archivos (index/agents/tools/
  session), sino que consume `sdk.ts`, que re-exporta además `tool`, `user` y el
  tipo `AgentInputItem`. El modelo del chat vive en la constante `CHAT_MODEL`
  (`_shared/config.ts`), no hardcodeado; el pipeline de análisis sigue en
  `OPENAI_MODEL`.

## Auth model (ambas Edge Functions)

Tanto `analyze-with-agents` como `chat-with-analysis-agent` usan
`verify_jwt = true` en `supabase/config.toml`. El gateway de Supabase
rechaza con 401 las peticiones sin JWT válido antes de invocar el
código de la función. Esto significa:

- los handlers ya no contienen el bloque "si no hay token → 401"; eso lo
  hace el gateway.
- los handlers sí siguen llamando a `supabase.auth.getUser(token)` para
  resolver el `user` que se necesita para rate-limiting y ownership
  contra `licitaciones` / `analysis_chat_sessions`.
- el comando de despliegue NO lleva `--no-verify-jwt`. Si se añade ese
  flag, sobrescribe la config y la función queda abierta. Detalles en
  `DEPLOYMENT.md` §5 y §5.2.
- el job `Smoke Test` de `ci-cd.yml` valida tras cada deploy que un POST
  sin JWT recibe 401 desde el gateway en ambas funciones.
- además del JWT, `chat-with-analysis-agent` aplica rate limiting por usuario
  (`CHAT_MAX_REQUESTS_PER_HOUR=60`, `checkRateLimit` con clave namespaced
  `chat:`/`analyze:`) y tope de payload real (`MAX_CHAT_PAYLOAD_BYTES=64KB`);
  `analyze-with-agents` valida la longitud real del body para cerrar el bypass
  del límite de payload que dependía del header `content-length`.
- el `SupabaseLogTraceProcessor` redacta `spanData` (`sanitizeSpanData`:
  allowlist + truncado + `redacted_keys`) antes de emitir cada línea `[trace]`,
  para no filtrar contenido del pliego a los logs.

## Layout

```
supabase/functions/_shared/agents/
  sdk.ts          — re-export pinned del SDK (único import surface)
  context.ts      — PipelineContext + factory
  guardrails.ts   — jsonShapeGuardrail + templateSanitizationGuardrail
  tracing.ts      — SupabaseLogTraceProcessor

supabase/functions/analyze-with-agents/
  index.ts                              — orquestador SSE
  prompts/index.ts                      — strings de instructions externalizados
  agents/
    document-map.agent.ts               — Fase B (1 agent)
    block-extractor.agent.ts            — Fase C (factory por bloque)
    custom-template.agent.ts            — Fase C, plantilla personalizada
  phases/
    ingestion.ts                        — Fase A (sin LLM)
    document-map.ts                     — wrapper de Agent + run()
    block-extraction.ts                 — wrapper de Agent + run() (single path; legacy fallback eliminado)
    consolidation.ts                    — Fase D (sin LLM)
    validation.ts                       — Fase E (sin LLM)
  __tests__/agents.test.ts              — tests unitarios de guardrails
```

## Reglas duras

1. **No `outputType` con `file_search`**. La hosted tool `file_search` y un
   `outputType` con JSON schema son incompatibles en Responses API. La forma
   JSON se valida con `jsonShapeGuardrail` en `outputGuardrails`. Hay un
   comentario `// DO NOT add outputType` en cada definición de Agent.
2. **Per-request agents, no caché módulo-global**. `fileSearchTool` enlaza
   `vectorStoreIds` en construcción; cada request tiene su vector store, así
   que se construyen 1 + 9 + 1 agents por petición. Coste despreciable
   (objetos JS planos, ~µs).
3. **Prompts byte-a-byte**. Las strings en `prompts/index.ts` son copia
   literal de las que vivían en `phases/*.ts` antes de la migración. Si se
   reescriben hace falta justificarlo y validar paridad semántica con
   `pnpm benchmark:pliegos`.
4. **`requestId` en todo**. `crypto.randomUUID()` se genera al inicio del
   handler y viaja en logs, en `PipelineContext` y por tanto en cada span
   del SDK. Para correlacionar SSE ↔ logs ↔ trace.
5. **`// @ts-nocheck` a nivel módulo en consumidores del SDK**. El re-export
   de `npm:@openai/agents@0.3.1` no expone tipos por el camino de Deno;
   `// @ts-nocheck` evita falsos positivos de `deno check` sin afectar
   runtime. Mismo patrón que ya usábamos en `_shared/schemas/*.ts`.
6. **Auth en el gateway**. NO reintroducir validación manual del token en
   los handlers. El gateway rechaza con 401 si falta el JWT; el handler
   sólo resuelve `user` para ownership/rate-limit. Añadir `--no-verify-jwt`
   al despliegue invalida esta postura.
7. **Sin fallback inline**. El antiguo `phases/block-extraction.legacy.ts`
   y el flag `USE_AGENTS_SDK` se eliminaron una vez confirmada paridad en
   producción. Si en el futuro hay que revertir a Responses API directa,
   el path correcto es `git revert` del PR responsable, no reanimar el
   archivo legacy ni reintroducir un flag.
8. **Sin docs ni scripts históricos sueltos**. El repo no mantiene
   archivos históricos no operativos (`DEPRECATED.md`, `AUDIT.md`) ni
   scripts de conveniencia que no se invoquen desde `package.json`,
   `.github/workflows/` o `.husky/`. La trazabilidad histórica vive como
   entradas fechadas en `SPEC.md` (§2.x, §10.x), `ARCHITECTURE.md`
   (§8.x) y `CHANGELOG.md`.

## Cómo añadir un nuevo Agent

1. Crear un schema Zod en `_shared/schemas/`.
2. Añadir las strings de instructions en `prompts/index.ts` (no inline en el agent).
3. Crear `agents/<feature>.agent.ts`:
    ```ts
    // @ts-nocheck
    export function buildMyAgent(vectorStoreId: string) {
        return new Agent<PipelineContext>({
            name: 'myAgent',
            model: OPENAI_MODEL,
            instructions: ({ context }) => buildMyInstructions(context.context),
            tools: [fileSearchTool({ vectorStoreIds: [vectorStoreId] })],
            outputGuardrails: [jsonShapeGuardrail(MySchema, 'my-agent')],
        });
    }
    ```
4. Invocar desde la fase con `run(buildMyAgent(vsId), userInput, { context })`.
5. Si la respuesta es JSON, _no_ re-parsear: leer
   `result.outputGuardrailResults.find(r => r.outputInfo.label === '<label>').outputInfo.value`.

## Cómo añadir un guardrail

- **Output (forma JSON / Zod)**: usar `jsonShapeGuardrail(schema, label)`.
  El label aparece en logs `[trace]` y en `outputGuardrailResults`, así que
  conviene que sea único por agent.
- **Input (validación previa al LLM)**: implementar como objeto
  `{ name, execute(input) }` que devuelve
  `{ tripwireTriggered, outputInfo }`. Pasar al campo `inputGuardrails` del
  Agent. Ver `templateSanitizationGuardrail` como ejemplo.

## Cómo leer los spans en logs

```bash
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
```

Cada línea es JSON: `event` (`trace_start|trace_end|span_start|span_end`),
`spanId`, `parentId`, `traceId`, `name`, `durationMs` y, si aplica, `error`.
Filtrar por `traceId` reconstruye una ejecución completa.

## Fábrica de agentes de GitHub Actions (no confundir con el pipeline SDK)

Además del pipeline de análisis basado en `@openai/agents` documentado arriba, el
repo opera una fábrica de cuatro agentes de desarrollo (PM, Tech, IA, QA) que se
ejecutan con `anthropics/claude-code-action@v1` en `.github/workflows/agent-*.yml`
y siguen sus prompts en `.claude/commands/agent-*.md`. Son planos distintos: esta
fábrica **produce** cambios sobre el repo (incluido el pipeline SDK); no forma
parte del runtime de análisis. El agente `agent-ia.md` es el único autorizado a
tocar prompts/schemas/SSE de `analyze-with-agents` y `chat-with-analysis-agent`, y
debe respetar las reglas duras de este documento. Operativa completa (coordinación
por `BACKLOG.md`, `guard.sh`, kill switch `AGENTS_ENABLED`, auto-merge sobre el CI
existente) en [`DEPLOYMENT.md`](./DEPLOYMENT.md).

> Nota (2026-07-12b): las herramientas de CI se descargan con versión fija
> (OSV Scanner `v2.4.0`, actionlint, supabase/vercel CLI); las interpolaciones
> shell de esas versiones deben ir entre comillas (`"vercel@${VERCEL_CLI_VERSION}"`)
> para no disparar `actionlint`/SC2086. Detalle en `CHANGELOG.md`.

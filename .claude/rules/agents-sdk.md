---
paths:
    - 'supabase/functions/**'
---

# Reglas duras del SDK `@openai/agents` (pipeline `analyze-with-agents`)

Claude Code lee `CLAUDE.md`, **no** `AGENTS.md`. Esta regla existe para que las
reglas duras del SDK entren en contexto al trabajar bajo `supabase/functions/`,
sin cargar los 12 KB de `AGENTS.md` en cada sesión.

**Fuente única de verdad: [`AGENTS.md`](../../AGENTS.md).** Lo de abajo es el
índice de invariantes; antes de modificar un Agent, un guardrail, el handler de
auth o la máquina de estados durable, lee la sección correspondiente allí.

## Invariantes que no se tocan sin justificarlo en el PR

1. **No `outputType` con `file_search`** — incompatibles en Responses API. La
   forma JSON se valida con `jsonShapeGuardrail` en `outputGuardrails`. Hay un
   `// DO NOT add outputType` en cada definición de Agent.
2. **Agents per-request, sin caché módulo-global** — `fileSearchTool` enlaza
   `vectorStoreIds` en construcción y cada request tiene su vector store.
3. **Prompts byte-a-byte** — las strings de `prompts/index.ts` son copia literal.
   Reescribirlas exige justificación y `pnpm benchmark:pliegos` en verde.
4. **`requestId` en todo** — generado al inicio del handler, viaja en logs,
   `PipelineContext` y cada span del SDK.
5. **`// @ts-nocheck` a nivel módulo en consumidores del SDK** — el re-export de
   `npm:@openai/agents@0.3.1` no expone tipos por el camino de Deno.
6. **Auth en el gateway** — `verify_jwt = true` para ambas Edge Functions. NO
   reintroducir validación manual del token. `--no-verify-jwt` en el deploy
   invalida la postura en silencio.
7. **Sin fallback inline** — `block-extraction.legacy.ts` y `USE_AGENTS_SDK`
   están eliminados. Revertir = `git revert` del PR, no reanimar el legacy.
8. **Job antes de efectos externos** — nada de crear el durable después de
   Storage / OpenAI Files / Vector Stores. `X-Idempotency-Key` se conserva al
   reintentar y no acepta otro fingerprint de entrada.
9. **PGMQ solo backend** — no exponer `pgmq_public` ni dar acceso de cola a
   `anon`/`authenticated`.
10. **No archivar antes del checkpoint** — `complete_analysis_step` persiste y
    archiva en la misma transacción; en error, `fail_analysis_step`
    (`set_vt`/retry/DLQ). Nunca borrar el mensaje desde el handler.

## Imports

Importar el SDK siempre desde `_shared/agents/sdk.ts`, nunca con
`npm:@openai/agents@x` directo (riesgo de múltiples instancias del SDK).
Constantes en `_shared/config.ts`; nunca hardcodear modelos ni timeouts.

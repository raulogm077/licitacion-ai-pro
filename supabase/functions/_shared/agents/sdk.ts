/**
 * Single import surface for @openai/agents inside this Deno project.
 *
 * Pinning the SDK version in one place avoids npm: import drift between
 * agent files (each `npm:@openai/agents@x.y.z` import becomes its own cached
 * specifier in Deno; mismatched versions silently produce two SDK instances
 * in the same process, breaking trace processor registration and global state).
 *
 * Targeted version: 0.3.1 — the last release whose peerDependency string is
 * `"zod":"^3.25.40 || ^4.0"`. From 0.3.2 onward the SDK requires zod ^4.0
 * exclusively, which would force a Zod 4 schema migration we are deferring.
 *
 * IMPORTANT: explicit named re-exports (not `export *`). Deno's npm: resolver
 * needs the import names spelled out at module scope to bind them at type
 * level; `export *` from an npm: specifier loses the names through the
 * re-export and breaks `deno check` on consumers.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export {
    Agent,
    run,
    fileSearchTool,
    setTraceProcessors,
    OutputGuardrailTripwireTriggered,
    InputGuardrailTripwireTriggered,
} from 'npm:@openai/agents@0.3.1';

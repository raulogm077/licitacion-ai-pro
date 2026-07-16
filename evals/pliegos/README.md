# Evaluación live del pipeline de pliegos

Esta suite ejecuta las mismas fases A-E de `analyze-with-agents` contra OpenAI. Complementa —no sustituye— al benchmark determinista de `benchmarks/pliegos`, que valida fixtures ya generados y el contrato de presentación.

## Contratos

- `cases.jsonl`: casos versionados y expectativas de hechos, ausencias, evidencia y calidad.
- `score.ts`: scoring determinista, sin llamadas externas.
- `score_test.ts`: regresión del contrato de scoring; forma parte de `verify:release`.
- `run.ts`: evaluación end-to-end real; solo se ejecuta manualmente porque consume API y puede tardar varios minutos.
- `evals/results/`: métricas y latencias locales sin el contenido completo del análisis; está ignorado por Git.

## Ejecución

```bash
pnpm eval:pliegos:check
pnpm eval:pliegos:live
pnpm eval:pliegos:live -- --case=memo-p2-live
```

El comando live lee `OPENAI_API_KEY` desde `.env.local`, crea recursos temporales de Files/Vector Store y los elimina en `finally`. Nunca se debe versionar `.env.local` ni copiar la clave a un fixture o resultado.

Cada informe registra versiones semánticas del pipeline/prompts/schema/modelo y un fingerprint SHA-256 de los ficheros efectivos del runtime. Un cambio de IA no se considera comparable si cambia el dataset o el fingerprint sin conservar el informe baseline fuera del repositorio.

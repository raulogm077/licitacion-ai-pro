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
pnpm eval:pliegos:diff <baseline.json> [head.json]   # head por defecto: evals/results/latest.json
```

## Comparar dos informes

`diff.ts` contrasta una baseline con una segunda pasada y es lo que convierte
«tengo dos JSON» en «puedo autorizar esta promoción». Tres cosas que hace y que
la comparación a ojo no hacía:

- **Se niega a comparar lo que no es comparable.** Si cambia `datasetVersion`,
  `reportVersion` o el conjunto de casos, sale con código 2 y no imprime diff.
  Una comparación inválida presentada como válida es peor que ninguna, porque
  autoriza una promoción con la firma equivocada.
- **Respeta la dirección de cada métrica.** Cinco suben para mejorar;
  `degradedBlockCount` baja. Es la única que mide daño y la única donde
  confundirse invierte el veredicto.
- **Cuenta como regresión el deterioro que aún no rompe.** Un caso que sigue en
  `passed` mientras su `factAccuracy` cae hacia el umbral es exactamente lo que
  produce una promoción barata antes de fallar. Sale con código 1.

Que el runtime salga idéntico no es «sin regresión»: es la señal de que lo que
querías promover no está aplicado, y el informe lo dice explícitamente.

La lógica es pura y se testea sin clave (`diff_test.ts`, dentro de
`verify:release` y del job `edge-checks` del CI).

El comando live lee `OPENAI_API_KEY` desde `.env.local`, crea recursos temporales de Files/Vector Store y los elimina en `finally`. Nunca se debe versionar `.env.local` ni copiar la clave a un fixture o resultado.

Cada informe registra versiones semánticas del pipeline/prompts/schema/modelo y un fingerprint SHA-256 de los ficheros efectivos del runtime. Un cambio de IA no se considera comparable si cambia el dataset o el fingerprint sin conservar el informe baseline fuera del repositorio.

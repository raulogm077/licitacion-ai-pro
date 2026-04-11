1.  **Resolver el bloqueo de Vitest:** Identificar que el error provenía de que en `vitest.config.ts` no se estaba excluyendo correctamente la carpeta E2E real (`e2e/`), sino una ruta obsoleta (`src/test/e2e/**`), por lo que Vitest intentaba ejecutar las pruebas E2E con el entorno `jsdom`, causando errores y lentitud (que se manifestaban como bloqueos y excepciones de error). Se corrigió agregando `'e2e/**'` al array `exclude`.
2.  **Limpiar archivos temporales/artefactos:** Se eliminaron archivos `.py` y `.js` ajenos a este PR que estaban ensuciando el directorio de trabajo (e.g. `pm_script.py`, `test-plan.js`).
3.  **Actualizar el tracking:** Mover la tarea de `## To Do` a `## Ready for QA` en `BACKLOG.md` mediante un script idempotente de Python.
4.  **Actualizar la Especificación (SPEC.md):** Registrar los cambios y la resolución en `SPEC.md` mediante un script de Python.
5.  **Validar:** Ejecutar las pruebas completas `pnpm typecheck && pnpm test && pnpm run lint` y verificar que pasen correctamente.
6.  **Pre-commit:** Ejecutar la verificación de pre-commit final.
7.  **Submit:** Someter los cambios.

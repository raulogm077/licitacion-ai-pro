1. **Auditar Tareas en Ready for QA:**
   - Hay tres tareas en `Ready for QA` en `BACKLOG.md`:
     1. `🧠 [AI] [Tipo: AI] [Área: Upload] Adaptar analyze-with-agents para múltiples archivos`
     2. `[Tipo: UI] [Área: Upload] Implementar soporte UI de múltiples documentos por licitación`
     3. `[Tipo: Backend] [Área: Infra] 🛡️ Sentinel: [CRITICAL] Remover credenciales expuestas y hardcodeadas`

2. **Validación Técnica de cada tarea:**
   - La tarea 3 (Remover credenciales) expone URLs por defecto pero no contiene credenciales *reales* expuestas o hardcodeadas. Revisé `scripts/init-env.sh` (tiene "your-anon-key-here" pero no un key real, y "http://localhost:54321"). En `scripts/setup-vercel-env.sh` las lee dinámicamente de `.env`. Voy a darle PASS o FAIL según si el criterio de no credenciales reales hardcodeadas se cumple. (Se cumple, solo hay texto dummy).
   - La tarea 2 (Soporte UI multi-documento): En `AnalysisWizard.tsx` sí se manejan múltiples archivos. En `useAnalysisStore.ts` se recogen los archivos de `AnalysisWizard` y se leen todos, pero se llama a `services.ai.analyzePdfContent` y allí se pasan los adicionales correctamente. Pero voy a analizar bien si se cumple con UI. `AnalysisWizard` tiene una validación de `MAX_FILES = 5`.
   - La tarea 1 (Adaptar Edge Function): Revisé `supabase/functions/analyze-with-agents/index.ts`. Acepta un campo `files` (array), sube todo al Vector Store.

3. **Pruebas y Ejecuciones:**
   - He ejecutado `pnpm typecheck` -> Todo bien.
   - He ejecutado `pnpm test` -> 36 archivos de test pasados.
   - He ejecutado `pnpm build && pnpm test:e2e` -> 20 pasaron, 7 omitidos. El test `upload-sse.spec.ts` que prueba la subida mockeada funciona bien.

4. **El Test de Múltiples Documentos:**
   - Se menciona en `BACKLOG.md` que la tarea `Validar E2E el soporte de múltiples documentos` está en `To Do`, no en `Ready for QA`. Así que está bien que no la hayamos hecho todavía. Mi labor de QA sobre UI y Edge Function puede ser solo comprobar el código estático y las pruebas automatizadas que ya corren (typecheck, tests, etc).

5. **Decision and Status Update (BACKLOG.md)**:
   - Tarea 1 (Edge Function AI): PASS. La Edge Function se modificó correctamente (acepta el array `files`, sube cada archivo y usa el Vector Store). No rompe contrato SSE, ni Schema.
   - Tarea 2 (UI): PASS. `AnalysisWizard.tsx` implementó el Drag and drop para 5 archivos. `analysis.store.ts` maneja el estado global correctamente.
   - Tarea 3 (Sentinel Credenciales): PASS. No hay credenciales reales en `scripts/*`.
   - Actualizaré `BACKLOG.md` moviendo las tres a `## Done` con un checkbox `- [x]`.

6. **Despliegue**
   - Como la Tarea 1 es un cambio en `analyze-with-agents` y pasó la validación de manera completa, se ejecutará el comando: `npx supabase functions deploy analyze-with-agents --no-verify-jwt`.

7. **Pasos pre-commit y submit**
   - Usar tool de pasos pre-commit.
   - Sincronizar con `submit` en la rama `jules/qa/batch-validation-1`.

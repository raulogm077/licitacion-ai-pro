# Backlog Analista de Pliegos

## To Do (Siguiente Iteración)

- [ ] Revisar y actualizar la documentación principal (`README.md`, `ARCHITECTURE.md`) para reflejar los cambios realizados y la arquitectura actual puramente OpenAI Agents SDK.
- [ ] Explorar mejoras en la UI para el streaming en tiempo real (manejo de errores SSE y feedback visual del proceso de agentes).
- [ ] Preparar el soporte para carga de múltiples pliegos en lote para análisis conjunto en el Agent.

## Deuda Técnica / Refactorización

- Revisar si se puede unificar el manejo de variables de entorno obsoletas que correspondan a features desactivadas o legacy (ej. VITE_FEATURE_AI_ANALYSIS, que ahora asume que OpenAI Agents siempre está activo).
- Limpieza de features toggles innecesarios ahora que el motor principal está consolidado y las rutas legacy eliminadas.

## Ideas de Producto

- Exportación de los análisis consolidados a múltiples formatos (Word, Excel) con un formato estandarizado superior.
- Incluir un historial de las ejecuciones del agente por cada usuario y la posibilidad de retomar chats/análisis.

## Done

- [x] Limpiar dependencias y referencias de Gemini AI y actualizar documentación.
- [x] Eliminar código legacy y funciones sin uso de la arquitectura antigua (`pgmq`, `openai-runner`).
- [x] Integrar el uso de `guiaBase64` en el flujo de `JobService.analyzeWithAgents` usando el OpenAI Agents SDK.
- [x] Limpieza de tests antiguos que dependan de la arquitectura de colas o `openai-runner`.

# Backlog Analista de Pliegos

## To Do (Iteración Actual)

- [ ] Limpiar dependencias y referencias de Gemini AI y actualizar documentación.
- [ ] Eliminar código legacy y funciones sin uso de la arquitectura antigua (`pgmq`, `openai-runner`).
- [ ] Integrar el uso de `guiaBase64` en el flujo de `JobService.analyzeWithAgents` usando el OpenAI Agents SDK.

## Deuda Técnica / Refactorización

- Limpieza de tests antiguos que dependan de la arquitectura de colas o `openai-runner`.
- Revisar si se puede unificar el manejo de variables de entorno obsoletas que correspondan a features desactivadas o legacy.

## Ideas de Producto

- [Feature] - Verificación Contextual (Split-view con PDF): Como analista, quiero poder hacer clic en un dato extraído (ej. importe, fechas, cláusulas) y que la aplicación me muestre de lado a lado la página exacta del PDF original resaltando de dónde sacó la IA ese dato, para poder verificar su exactitud sin tener que abrir el PDF en otra ventana y buscar manualmente.
- [Feature] - Modificación y Corrección Manual de Datos: Como analista, quiero poder editar manualmente cualquier campo extraído por la IA en el dashboard antes de guardar o exportar, porque a veces la inteligencia artificial puede omitir un matiz importante o cometer un error sutil, y necesito garantizar un 100% de precisión legal.
- [Feature] - Exportación Dinámica B2B (Excel/Word/PDF Personalizado): Como analista, quiero poder seleccionar qué secciones de la extracción quiero exportar y en qué formato (especialmente Excel para los cuadros de precios y Word para los resúmenes ejecutivos), para poder integrar rápidamente esta información en las plantillas y flujos de trabajo internos de mi empresa o bufete.
- Explorar mejoras en la UI para el streaming en tiempo real (manejo de errores SSE).
- Soportar carga de múltiples pliegos en lote para análisis conjunto en el Agent.
- Exportación de los análisis consolidados a múltiples formatos (Word, Excel) con un formato estandarizado superior.

## Done

- (En blanco por ahora, se llenará conforme se completen tareas)

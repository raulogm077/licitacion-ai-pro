# Backlog del Producto - Analista de Pliegos

## To Do (Iteración Actual)
- [ ] [Feature] - UI de Carga Progresiva (Streaming Data Reveal): Como analista, quiero ver cómo se van rellenando visualmente los campos críticos (presupuesto, fechas, solvencia) en tiempo real en el Dashboard mientras la IA procesa el pliego, para empezar mi evaluación inmediatamente sin esperar al 100% del análisis.
  - **Criterios de Aceptación Técnicos:**
    1. **Frontend (Zustand Store):** Modificar el store que maneja el estado de la licitación (presumiblemente donde se usa `JobService.analyzeWithAgents()`) para que soporte actualizaciones parciales del estado.
    2. **SSE Parsing:** Escuchar el evento `agent_message` en la UI y parsear el payload JSON parcial. Si se detecta un campo clave válido (ej. `presupuesto`, `datos_generales.titulo`), hacer merge con los datos actuales en el store.
    3. **UI (Skeleton/Loading States):** Si un capítulo o sección (`ChapterDatos`, `ChapterCriterios`) del Dashboard tiene datos nulos o vacíos mientras se está "Cargando", mostrar un `Skeleton` animado local. En cuanto los datos parciales lleguen por SSE, reemplazar el Skeleton por el valor renderizado y aplicar un micro-efecto de "fade-in" o un indicador (badge "Actualizado") para guiar el ojo del usuario.
    4. **Sin refetches:** No se deben hacer peticiones adicionales al backend (Supabase); todo debe construirse a partir del ReadableStream de SSE.

- [ ] [Feature] - Checklist de Viabilidad Rápida (Go / No-Go): Como analista, quiero tener un checklist interactivo generado automáticamente en el panel lateral con los requisitos excluyentes (certificaciones ISO, solvencia mínima), para ir marcando si mi empresa los cumple y decidir rápidamente si descartar o no la licitación.
  - **Criterios de Aceptación Técnicos:**
    1. **Backend (Agent Schema):** Asegurar que el `LicitacionContentSchema` (Zod) extraiga explícitamente un array de "requisitos_excluyentes" o "criterios_go_nogo". Si no existe, actualizar las instrucciones del agente (`instructions.ts`) para que identifique estos puntos.
    2. **Frontend (Right Drawer):** Añadir una nueva pestaña o sección en el componente `RightDrawer` (o donde se ubique el panel lateral) llamada "Checklist de Viabilidad".
    3. **UI/UX Interactivo:** Renderizar la lista de requisitos con checkboxes `[ ]`. El estado de check debe ser persistente en local (estado del componente o Zustand) durante la sesión actual (o guardarse junto con los datos de la licitación si `onUpdate` está soportado, aunque no es estricto en V1).
    4. **Indicador Visual:** Añadir un indicador semáforo (Verde/Rojo) o una barra de progreso que refleje cuántos requisitos se han cumplido frente al total, indicando "Viable" si están todos marcados.

## Deuda Técnica / Refactorización

## Ideas de Producto
- [Feature] - Exportación Selectiva y Editable (Excel/Word): Como analista, quiero poder seleccionar secciones específicas del pliego analizado (ej. solo 'Criterios de Adjudicación' y 'Riesgos') para exportarlas a Excel o Word, facilitando su integración directa en las plantillas y flujos de trabajo internos de mi equipo.

## Done

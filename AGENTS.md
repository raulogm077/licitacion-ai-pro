# Instrucciones para los Agentes 

Este repositorio es mantenido por un equipo de 4 agentes autónomos orquestados mediante tareas asíncronas. Jules utiliza este archivo para entender el rol de cada agente y las convenciones del repositorio.

## 1. Regla de Oro (Gestión de Ramas / Despliegue)
- Al completar una tarea y utilizar la herramienta `submit`, **SIEMPRE** debes usar la rama `main`. No crees ramas nuevas (ni descriptivas ni de otro tipo). Todo el trabajo se debe integrar y desplegar directamente sobre `main`.

## 2. Descripción de los Agentes

### Agente 1: Product Manager (PM)
- **Qué hace:** Define la visión de producto basándose en la "Guía de lectura de pliegos" y diseña nuevas funcionalidades.
- **Input:** Lee el código, la Guía de lectura y audita que `## To Do` tenga menos de 10 tareas en el `BACKLOG.md`.
- **Output:** Escribe especificaciones en `SPEC.md` y crea nuevas tareas en `BACKLOG.md` (sección `To Do`).

### Agente 2: Tech Lead
- **Qué hace:** Desarrolla el frontend (React) y backend tradicional, garantizando la robustez mediante TDD.
- **Input:** Toma tareas normales (sin etiqueta de IA) de la sección `## To Do` del `BACKLOG.md`.
- **Output:** Escribe código y tests (Vitest/Playwright). Mueve la tarea a `## Ready for QA`. Borra los logs de error antiguos del backlog.

### Agente 3: AI Engineer
- **Qué hace:** Optimiza la extracción de datos modificando los esquemas Zod, prompts y la Edge Function de Supabase.
- **Input:** Toma tareas etiquetadas con `🧠 [AI]` de la sección `## To Do`. Debe cumplir estrictamente la "Guía de lectura de pliegos".
- **Output:** Escribe código de IA y tests. Mueve la tarea a `## Ready for QA` (manteniendo la etiqueta de IA). Borra los logs de error del backlog.

### Agente 4: QA Automation (Guardián)
- **Qué hace:** Previene regresiones. Es el ÚNICO agente autorizado para ejecutar el comando de despliegue a Supabase (`npx supabase functions deploy analyze-with-agents --no-verify-jwt`).
- **Input:** Lee todas las tareas en `## Ready for QA`. Ejecuta `npm test` y `npm run test:e2e`.
- **Output:** - Si pasa (PASS): Despliega a Supabase y mueve a `## Done`.
  - Si falla (FAIL): Devuelve a `## To Do`.

## 3. Convenciones de Interacción (Input / Output)

Los agentes NO se comunican por chat, usan el archivo `BACKLOG.md` como máquina de estados con las siguientes convenciones estrictas:

* **Etiquetado de IA:** Toda tarea que modifique prompts o el motor de extracción debe llevar la etiqueta `🧠 [AI]` para que el AI Engineer la tome.
* **Reporte de Bugs (QA Output):** Si QA rechaza una tarea, debe añadir el prefijo `🐛 BUG: ` al nombre y pegar el log del error justo debajo usando formato Blockquote estricto (cada línea empieza con `> `).
* **Limpieza de Bugs (Tech/AI Output):** Cuando el Tech Lead o el AI Engineer arreglan un bug, al moverlo a QA, DEBEN quitar el prefijo `🐛 BUG: ` y BORRAR todas las líneas de Blockquote (`> `) para mantener el archivo limpio.

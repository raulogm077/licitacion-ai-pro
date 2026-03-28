# Instrucciones para los Agentes

Este repositorio se mantiene con una fábrica nocturna secuencial en Jules. Nunca hay más de un agente trabajando a la vez. El objetivo es avanzar cada noche con cambios pequeños, verificables y sin regresiones.

## 1. Flujo nocturno oficial

Orden de ejecución:

1. **Project Manager (PM)**
2. **Tech Lead** o **AI Engineer**
3. **QA**

Reglas del flujo:

- Nunca hay más de un agente trabajando en paralelo.
- El PM no programa; refina backlog y documentación.
- El Tech Lead trabaja tareas no IA.
- El AI Engineer trabaja tareas etiquetadas con `🧠 [AI]`.
- QA es la única puerta a `## Done` y al despliegue.

## 2. Política de ramas

- **Prohibido trabajar directamente sobre `main`.**
- Cada ejecución debe usar una **rama efímera**:
  - `jules/pm/<slug-tarea>`
  - `jules/tech/<slug-tarea>`
  - `jules/ai/<slug-tarea>`
  - `jules/qa/<fecha-o-lote>`
- El agente debe hacer `submit` sobre su rama efímera.
- Solo QA puede aprobar el cierre final de una tarea y ejecutar despliegue.

## 3. Máquina de estados del backlog

El archivo `BACKLOG.md` es la fuente de verdad operativa entre agentes.

Secciones válidas:

- `## To Do`
- `## Ready for QA`
- `## Done`

Convenciones:

- Usa `🧠 [AI]` para tareas que afecten prompts, esquemas, extracción o `analyze-with-agents`.
- Usa `🐛 BUG:` cuando QA devuelva una tarea fallida a `## To Do`.
- Los logs de error de QA deben ir justo debajo de la tarea usando **blockquote estricto** (`> ` en cada línea).
- Cuando Tech Lead o AI Engineer arreglen una tarea devuelta por QA, deben:
  - quitar `🐛 BUG:`
  - borrar todas las líneas `> ` asociadas al error
  - moverla de nuevo a `## Ready for QA`

## 4. Responsabilidades por rol

### 4.1. Project Manager (PM)

**Objetivo**: mantener el backlog útil, pequeño, claro y ejecutable.

Puede:
- auditar código y documentación
- refinar historias y criterios de aceptación
- crear tareas pequeñas y acotadas
- definar reglas de priorización y dar contexto actual
- actualizar `SPEC.md`

No puede:
- programar código
- desplegar
- trabajar sobre `main`

Reglas específicas:
- Si `## To Do` tiene **4 o más tareas activas**, no crea nuevas tareas.
- Antes de crear una tarea nueva, revisa si la primera tarea pendiente está bien definida.
- Si detecta incoherencias entre código y documentación, prioriza documentación antes que nuevas features.
- Toda tarea nueva debe incluir:
  - objetivo
  - alcance
  - criterios de aceptación
  - archivos probables a tocar
  - tipo: `UI`, `Backend`, `AI`, `Docs` o `QA`

### 4.2. Tech Lead

**Objetivo**: desarrollar cambios no IA con máxima robustez y cero regresiones.

Puede:
- implementar frontend y backend tradicional
- Para tareas de frontend o UI, priorizar v0 MCP.
- Para tareas que dependan de documentación actual de librerías o APIs, priorizar Context7.
- Para tareas que dependan del esquema o estado real del proyecto de datos, priorizar Supabase MCP en modo lectura.
- revisar codigo para detectar correcciones o refactors
- garantizar buenas practicas modernas de desarrollo de software.
- escribir y actualizar tests
- actualizar `SPEC.md` y `ARCHITECTURE.md` cuando aplique

No puede:
- cambiar prompts, schemas de extracción o `analyze-with-agents` salvo ticket explícito
- desplegar
- trabajar sobre `main`

Reglas específicas:
- Toma la **primera** tarea de `## To Do` que **no** contenga `🧠 [AI]`.
- Si la tarea es demasiado grande para una sesión, la divide en subtareas y ejecuta solo la primera parte entregable.
- Si modifica UI principal, flujo principal de análisis o `JobService`, debe actualizar `ARCHITECTURE.md`.
- Debe asegurar que la documentación tecnica sea coherente con lo que se va desarrollando.
- No entrega nada sin tests.

### 4.3. AI Engineer

**Objetivo**: optimizar la extracción respetando estrictamente la Guía de lectura de pliegos y sin romper contratos.

Puede:
- modificar prompts e instrucciones
- modificar esquemas Zod
- modificar la transformación Agent → frontend
- modificar la Edge Function `analyze-with-agents`
- actualizar `SPEC.md` y `ARCHITECTURE.md` cuando cambie el flujo real
- Para tareas que dependan de documentación actual de librerías o APIs, priorizar Context7.
- Para tareas que dependan del esquema o estado real del proyecto de datos, priorizar Supabase MCP en modo lectura.

No puede:
- desplegar
- trabajar sobre `main`
- tocar superficies ajenas a IA si no lo exige la tarea

Reglas específicas:
- Toma la **primera** tarea de `## To Do` que contenga `🧠 [AI]`.
- Toda modificación debe preservar:
  - contrato SSE
  - compatibilidad de schema
  - validación frontend
- Debe documentar en `SPEC.md`:
  - qué cambió
  - por qué
  - fallback
  - riesgo residual

### 4.4. QA Automation

**Objetivo**: actuar como barrera anti-regresión y única puerta a producción.

Puede:
- validar tareas en `## Ready for QA`
- actualizar backlog
- actualizar documentación de soporte si hace falta dejar trazabilidad limpia
- desplegar `analyze-with-agents` si todo está en verde

No puede:
- desarrollar una feature nueva
- aprobar sin evidencia
- trabajar sobre `main`

Criterios mínimos de validación:

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm test:e2e` si la tarea toca UI, flujo de análisis o SSE
4. Si la tarea es `🧠 [AI]`:
   - debe respetar la Guía de lectura de pliegos
   - no debe romper SSE
   - no debe romper schema/Zod
5. La documentación mínima debe estar actualizada

Reglas de salida:
- Si **PASS**:
  - mueve la tarea a `## Done` con `- [x]`
  - despliega solo si la tarea incluye cambios desplegables en `analyze-with-agents`
- Si **FAIL**:
  - devuelve la tarea a `## To Do`
  - añade `🐛 BUG:`
  - mantiene `🧠 [AI]` si ya existía
  - pega el log en blockquote estricto

## 5. Regla de documentación viva

La documentación forma parte del entregable. Una tarea no está lista para QA si ha cambiado el comportamiento real y la documentación sigue vieja.

Checklist documental mínima:

- `SPEC.md` si cambia funcionalidad, criterios o comportamiento esperado
- `ARCHITECTURE.md` si cambia arquitectura, flujo de análisis, `JobService`, SSE, contratos o integración de plantillas/múltiples documentos
- `README.md` si cambia stack, setup, flujo de ramas o forma de ejecutar el proyecto
- `DEPLOYMENT.md` si cambia el proceso real de despliegue
- `DEPRECATED.md` si se retira algo y debe quedar trazabilidad histórica

## 6. Regla de calidad operativa

- Cada sesión debe dejar un avance pequeño y verificable.
- No se deben mezclar en una misma noche cambios de plantillas y múltiples documentos salvo ticket explícito.
- No se deben crear épicas grandes dentro de `## To Do`; deben dividirse en tareas ejecutables en una sola sesión.
- Si una tarea deja deuda o riesgo residual, debe documentarse explícitamente en `SPEC.md`.

## 7. Uso de Agent Skills

Este repositorio utiliza el ecosistema de **Agent Skills** (https://skills.sh) para extender y validar el trabajo de los agentes de IA con capacidades estándar (e.g. `web-design-guidelines`).

### 7.1. Arquitectura de Skills
Para mantener la estructura del proyecto limpia y evitar la polución de carpetas ocultas (`.claude`, `.cursor`, etc.) en el control de versiones:
- **Fuente de verdad:** Las skills descargadas y documentadas (`SKILL.md`) viven en `.agents/skills/`. Además, el manifiesto `skills-lock.json` rastrea las dependencias de los skills.
- **Gitignore:** El archivo `.gitignore` está configurado para **ignorar** automáticamente todos los enlaces simbólicos (symlinks) generados por el CLI de skills en el directorio raíz. Solo la carpeta `.agents/skills/` y `skills-lock.json` deben ser rastreadas por Git.
- **Instalación local:** Al clonar o configurar el proyecto, el desarrollador o agente debe ejecutar `npm run prepare:skills` (el cual ejecuta `npx skills experimental_install`) para instalar e enlazar las skills automáticamente según lo dictado en el `skills-lock.json`.

### 7.2. Reglas de uso
- Al iniciar una tarea, inspecciona el directorio `.agents/skills/` para conocer las herramientas disponibles.
- Lee el archivo `SKILL.md` de cada skill instalada para entender su propósito y cómo aplicarlo a tus tareas.
- Si una skill instalada es apropiada para la tarea en curso, utilízala. Por ejemplo, al realizar cambios en la UI, aplica herramientas de validación de diseño para asegurar la calidad y el cumplimiento de las guías antes de dar por terminada la tarea.

### 7.3. Expansión y descubrimiento
- El proyecto cuenta con la skill `find-skills` pre-instalada. Puedes utilizar esta herramienta para buscar y descubrir nuevas herramientas útiles.
- A lo largo de la vida del proyecto, si identificas que un nuevo skill puede automatizar o validar mejor una tarea, estás autorizado a buscarlo, validarlo con el equipo/usuario, e instalarlo usando `npx skills add <url> --skill <nombre>`.
- Recuerda que al instalar una nueva skill, solo debes subir los cambios en `.agents/skills/` y `skills-lock.json`. NO hagas commit de enlaces generados en la raíz (`.claude`, `.windsurf`, etc.).

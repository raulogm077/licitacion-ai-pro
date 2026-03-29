# Analista de Pliegos

Aplicación interna para analizar pliegos de licitación en PDF, extraer información estructurada y presentar el resultado de forma navegable para acelerar la revisión funcional y técnica.

## Qué hace

- permite subir uno o más documentos PDF relacionados con una licitación
- ejecuta análisis asistido por IA con streaming en tiempo real
- valida y transforma la salida a un modelo tipado
- guarda historial de análisis para su consulta posterior
- búsqueda full-text en español (FTS + ILIKE fallback) sobre el historial
- eliminación de registros del historial con confirmación
- prepara el terreno para plantillas dinámicas de extracción y soporte multi-documento

## Arquitectura actual

La arquitectura vigente usa **OpenAI Responses API** con un **pipeline de 5 fases**, **Supabase Edge Functions** y **SSE** para streaming del análisis.

Flujo lógico actual:

```text
Usuario → Frontend → Edge Function `analyze-with-agents`
                     ↓
              Fase A: Ingesta (Files API + Vector Store)
              Fase B: Mapa Documental (Responses API)
              Fase C: Extracción por Bloques (~9 llamadas)
              Fase D: Consolidación
              Fase E: Validación Final
                     ↓
                 SSE → Frontend (progreso por fase)
```

Documentación viva del sistema:

- `ARCHITECTURE.md`: arquitectura vigente y contratos técnicos
- `SPEC.md`: iteración activa, criterios y decisiones
- `BACKLOG.md`: cola operativa de trabajo nocturno
- `AGENTS.md`: reglas de funcionamiento de la fábrica de agentes
- `DEPLOYMENT.md`: proceso actual de despliegue
- `DEPRECATED.md`: referencia histórica, no operativa

## Stack real

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router
- Zod

### Backend y servicios
- Supabase
- Supabase Edge Functions (Deno runtime)
- OpenAI Responses API (pipeline por fases)
- OpenAI Files API / Vector Store
- Vercel para hosting frontend

### Calidad
- Vitest
- Playwright
- ESLint
- TypeScript strict mode

## Cómo ejecutar en local

### Requisitos

- Node.js 20+
- pnpm 9+
- proyecto de Supabase configurado
- variables de entorno locales completas
- secreto `OPENAI_API_KEY` configurado en Supabase para la Edge Function

### Instalación

```bash
git clone https://github.com/raulogm077/licitacion-ai-pro.git
cd licitacion-ai-pro
pnpm install
```

### Variables de entorno

Crea `.env.local` a partir de la plantilla del proyecto y completa al menos:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
VITE_ENVIRONMENT=local
```

`OPENAI_API_KEY` no debe vivir en el frontend. Debe configurarse como secreto en Supabase para la función `analyze-with-agents`.

### Ejecución local

```bash
pnpm dev
```

## Testing

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

Notas:
- `pnpm test:e2e` debe usarse cuando una tarea toque UI, flujo principal de análisis o SSE.
- Una tarea no está lista para QA si cambia comportamiento real y no actualiza la documentación correspondiente.

## Flujo de ramas y entrega

Este repositorio sigue una política de **rama efímera por tarea**.

- ningún agente trabaja directamente sobre `main`
- cada ejecución crea una rama efímera propia
- el `submit` del agente se hace sobre esa rama
- **QA** es la única puerta a `Done` y al despliegue

Formato recomendado de ramas:

- `jules/pm/<slug-tarea>`
- `jules/tech/<slug-tarea>`
- `jules/ai/<slug-tarea>`
- `jules/qa/<fecha-o-lote>`

## Flujo nocturno de agentes

Orden de ejecución:

1. PM
2. Tech Lead o AI Engineer
3. QA

Reglas clave:
- nunca hay más de un agente trabajando a la vez
- solo se ejecuta una tarea de desarrollo por noche
- QA valida antes de mover una tarea a `Done`
- solo QA puede desplegar la Edge Function

## Documentación viva

La documentación forma parte del entregable.

Se debe actualizar como mínimo:

- `SPEC.md` si cambia funcionalidad o criterios
- `ARCHITECTURE.md` si cambia flujo, contrato, SSE, `JobService` o Edge Function
- `README.md` si cambia stack, setup o forma de trabajo
- `DEPLOYMENT.md` si cambia el proceso real de despliegue

## Documentación histórica

`DEPRECATED.md` conserva trazabilidad de componentes retirados o migraciones antiguas. No debe usarse como fuente operativa para los agentes.

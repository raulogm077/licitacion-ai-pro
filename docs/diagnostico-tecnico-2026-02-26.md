# Diagnóstico técnico integral del código

Fecha: 2026-02-26
Alcance: revisión estática del repositorio completo + validaciones automáticas (typecheck, lint, tests).

## Resumen ejecutivo

El proyecto tiene una base sólida: tipado estricto en TypeScript, cobertura de tests amplia y separación inicial por capas (`config`, `services`, `stores`, `features`). Sin embargo, hay deuda técnica relevante en **gestión de estado/orquestación**, **manejo de errores**, y **observabilidad**. El riesgo principal no es de compilación (todo compila), sino de mantenibilidad y estabilidad operativa al crecer el producto.

### Riesgos prioritarios (Top 7)

1. **Store monolítico y con `eslint-disable` global** en `analysis.store.ts`, con alto acoplamiento a infraestructura y múltiples responsabilidades.
2. **Manejo de errores no tipado (`any`) y capturas silenciosas**, que dificulta trazabilidad y recuperación.
3. **Logging con `console.*` disperso** en servicios críticos, sin estrategia homogénea por entorno.
4. **Validación de entorno con side-effects en import-time** (`console.error` al importar), generando ruido y potenciales falsos positivos.
5. **Polling de jobs con intervalo fijo de 60s**, sin backoff/adaptación y con latencia de UX innecesaria.
6. **Persistencia parcial con warnings no estructurados**, riesgo de inconsistencia entre estado local/remoto.
7. **Contratos de datos complejos con casteos `as unknown as`**, síntoma de desalineación entre modelos de dominio.

---

## Hallazgos detallados

## 1) Arquitectura y diseño

### 1.1 Store de análisis con demasiadas responsabilidades
`src/stores/analysis.store.ts` valida archivos, orquesta IA, gestiona progreso, persiste datos, traduce errores HTTP/Supabase y maneja provider/localStorage en una única unidad. Además, comienza con `/* eslint-disable */`.

**Impacto**
- Violación de SRP (Single Responsibility Principle).
- Difícil de testear en aislamiento.
- Mayor probabilidad de regresiones al tocar cualquier parte del flujo.

**Recomendación**
- Extraer un `AnalysisOrchestrator` de aplicación (caso de uso) y dejar el store como adaptador UI state.
- Rehabilitar ESLint en el archivo y corregir reglas gradualmente.

### 1.2 Acoplamiento fuerte a infraestructura en capa de dominio de UI
El store depende de `services`, `processFile`, `localStorage` y detalles de HTTP error-shape.

**Recomendación**
- Introducir puertos/interfaces (`IAnalysisService`, `IStorageGateway`, `IHistoryRepository`) e inyectarlas.
- Evitar lógica de parseo de respuestas HTTP en store; mover a servicios especializados.

## 2) Calidad de código y mantenibilidad

### 2.1 Uso de `any` y casteos forzados
Se detectan `catch (error: any)` y varios `as unknown as`, especialmente en zonas críticas de IA y mapeo.

**Impacto**
- Reduce garantías de TypeScript.
- Esconde incompatibilidades contractuales reales.

**Recomendación**
- Estandarizar `AppError` discriminada por `kind/code`.
- Reemplazar casteos por mappers validados con Zod y tipos intermedios explícitos.

### 2.2 Capturas silenciosas
Ejemplo: parseo de eventos SSE ignora errores de parseo con warning genérico; otros bloques hacen `catch {}` implícito.

**Recomendación**
- Capturar solo errores esperados.
- Anotar contexto mínimo estructurado (`jobId`, `eventType`, `offset`, `provider`).

## 3) Manejo de errores y resiliencia

### 3.1 Errores de entorno emitidos al importar módulos
`src/config/env.ts` ejecuta `console.error` cuando faltan variables.

**Impacto**
- Contamina logs de test/CI.
- Efectos secundarios en import-time.

**Recomendación**
- Cambiar a validación perezosa (`validateEnv()` explícito) y que el entrypoint decida cómo reportar.

### 3.2 Errores heterogéneos entre servicios
`AIService`, `JobService`, store y providers levantan errores distintos (`Error`, custom error, objetos con `context/status`).

**Recomendación**
- Taxonomía unificada de errores.
- Adaptadores que normalicen errores externos (Supabase/OpenAI/Gemini) a errores de dominio.

## 4) Rendimiento y UX

### 4.1 Polling demasiado espaciado
`waitForCompletion` usa 60s fijo. El usuario puede esperar hasta 60s para ver actualización.

**Recomendación**
- Polling adaptativo: rápido al inicio (2-5s), luego backoff con jitter.
- Alternativa prioritaria: stream/SSE como camino principal, polling como fallback.

### 4.2 Esperas fijas entre secciones IA
En análisis secuencial se aplica `setTimeout(10000)` por sección.

**Riesgo**
- Penalización severa de tiempo total.

**Recomendación**
- Rate limiter token-bucket configurable por provider y plan de cuota.
- Telemetría real de latencia/reintentos para ajustar dinámicamente.

## 5) Observabilidad y logging

### 5.1 Uso extensivo de `console.log/warn/error`
Hay logging mixto en múltiples módulos, incluyendo rutas de producción.

**Recomendación**
- Centralizar en `logger` con niveles, sampling, redacción PII, correlation IDs.
- Bloquear `console.*` fuera de tests/dev con regla lint.

## 6) Seguridad

### 6.1 Puntos positivos
- API key de OpenAI no expuesta por `VITE_` según comentario de configuración.
- Supabase client lazy con validación previa de entorno.

### 6.2 Mejoras sugeridas
- Revisar y documentar política de retención de PDFs en bucket `analysis-pdfs`.
- Asegurar cifrado y lifecycle para documentos sensibles.
- Aumentar auditoría de trazas para acciones críticas (subida PDF, enqueue, resultado).

## 7) Testing

### 7.1 Estado actual
- Suite robusta: 140 tests pasando.
- Lint y typecheck en verde.

### 7.2 Oportunidades
- Agregar pruebas de contrato para streams SSE malformados.
- Tests de resiliencia del polling (timeout, backoff, reintentos).
- Tests de integración sobre taxonomía de errores normalizada.

---

## Plan de mejora propuesto (priorizado)

### Fase 1 (1-2 semanas, alto impacto / bajo riesgo)
1. Quitar `/* eslint-disable */` de `analysis.store.ts` y corregir reglas críticas.
2. Introducir `AppError` unificada + normalizador de errores externos.
3. Eliminar side-effect de `env.ts` en import-time.
4. Sustituir `console.*` críticos por `logger` estructurado.

### Fase 2 (2-3 semanas, impacto alto)
5. Extraer `AnalysisOrchestrator` y adelgazar store (estado UI puro).
6. Implementar polling adaptativo o migrar completamente a SSE.
7. Reducir casteos con mappers tipados y validación Zod por frontera.

### Fase 3 (continuo)
8. Endurecer observabilidad: correlation IDs, métricas de latencia/error por provider.
9. Política formal de seguridad documental (retención, borrado, auditoría).
10. Quality gates: bloquear PRs con `any` nuevo en `src/` (exceptos explícitos).

---

## Métricas objetivo sugeridas

- Tiempo medio de análisis end-to-end: **-30%**.
- Errores no clasificados en frontend: **-80%**.
- Archivos con `any` en capa de aplicación: **0 nuevos por sprint**.
- Cobertura de tests de errores/transporte (SSE/polling): **>85% en módulos críticos**.

## Conclusión

El proyecto está en un estado funcional y con buenas bases técnicas, pero sufre deuda en la capa de orquestación y en estandarización de errores/logs. Atacando primero esos frentes se consigue mayor robustez, mejor diagnóstica operativa y menor costo de evolución.

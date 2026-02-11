# Revisión Arquitectónica (Principal Software Architect)

## Contexto y alcance
Este documento evalúa la arquitectura actual de `licitacion-ai-pro` desde una perspectiva de producción (escalabilidad, seguridad, mantenibilidad y operabilidad).

Se revisaron principalmente:
- `ARCHITECTURE.md`
- `README.md`
- `src/services/ai.service.ts`
- `src/services/job.service.ts`
- `src/config/service-registry.ts`
- `src/stores/analysis.store.ts`
- `src/config/env.ts`
- `src/config/features.ts`
- `src/services/db.service.ts`

## Diagnóstico ejecutivo

### Fortalezas observadas
1. **Base técnica sólida**: TypeScript + Zod + pruebas unitarias/e2e ya integradas.
2. **Separación funcional razonable**: capas de `services`, `stores`, `features`, `config`.
3. **Migración hacia streaming**: enfoque moderno con SSE para feedback en tiempo real.
4. **Validación de configuración**: validación de `env` con Zod para evitar arranques inválidos.

### Riesgos de arquitectura prioritarios
1. **Coexistencia de dos arquitecturas de análisis** (job polling + SSE Agents), lo que incrementa complejidad accidental y deuda técnica.
2. **Orquestación de dominio en la store de UI** (flujo de negocio demasiado acoplado a Zustand), dificultando testeo y evolución.
3. **Inconsistencia documental/stack** (README menciona Gemini como principal mientras arquitectura y servicios empujan OpenAI Agents).
4. **Patrones de error observability-light** (errores con `throw Error` genérico y logging disperso sin correlación global).
5. **Service Registry acoplado a concretos** (singleton con `new` directo), limita inversión de dependencias real.

---

## Puntos de mejora recomendados

## 1) Consolidar una sola arquitectura de análisis

### Hallazgo
`JobService` mantiene métodos de cola/polling (`startJob`, `pollJob`, `waitForCompletion`) y además método streaming (`analyzeWithAgents`). Esto sugiere transición incompleta y rutas paralelas de ejecución.

### Impacto
- Mayor superficie de bugs.
- Duplicación de responsabilidad operativa.
- Dificultad para on-call y troubleshooting.

### Mejora propuesta
- Definir **arquitectura target única** (preferible streaming/SSE).
- Marcar formalmente el flujo antiguo como `deprecated` y removerlo por fases.
- Exponer una sola interfaz de caso de uso: `AnalyzeTenderUseCase.execute(...)` con estrategia interna.

### Resultado esperado
Menor complejidad ciclomática del flujo crítico, menor MTTR en incidencias y reducción de costo de mantenimiento.

## 2) Extraer la orquestación de negocio fuera de Zustand

### Hallazgo
`analysis.store.ts` concentra lógica de negocio compleja (validación de archivo, selección de proveedor, persistencia parcial/final, manejo de cancelación y mapeo de errores HTTP/backend).

### Impacto
- Store “gorda” y difícil de testear en aislamiento.
- Acoplamiento UI ↔ dominio.
- Mayor riesgo de regresiones al tocar UX.

### Mejora propuesta
- Introducir capa de **Application Use Cases**:
  - `AnalyzeTenderUseCase`
  - `CancelAnalysisUseCase`
  - `PersistAnalysisUseCase`
- Dejar la store como adaptador de estado (input/output), no como orquestador.

### Resultado esperado
Mejor testabilidad, menor acoplamiento y evolución más segura del producto.

## 3) Aplicar inversión de dependencias real en servicios

### Hallazgo
`service-registry.ts` instancia concretos (`new AIService()`, `new DBService()`) dentro de un singleton global.

### Impacto
- Dificulta mocking fino y pruebas de integración controladas.
- Complica escenarios multi-entorno/multi-tenant.

### Mejora propuesta
- Reemplazar singleton por **composition root** explícito.
- Dependencias por interfaz (`IAIService`, `IDBService`, `IJobGateway`).
- Inyectar implementaciones por entorno (prod/test/dev).

### Resultado esperado
Mayor adherencia SOLID (DIP), mejor aislamiento en tests y menor acoplamiento temporal.

## 4) Unificar estrategia de errores y trazabilidad

### Hallazgo
Se usan `throw new Error(...)` en distintos puntos con mensajes útiles pero sin taxonomía uniforme para infraestructura/dominio/aplicación. El logging mezcla `console.*` y logger dedicado.

### Impacto
- Errores difíciles de clasificar automáticamente.
- Menor observabilidad para incident response.

### Mejora propuesta
- Definir jerarquía de errores:
  - `DomainError`
  - `ApplicationError`
  - `InfrastructureError`
  - `ExternalProviderError`
- Añadir `error_code`, `correlation_id`, `provider`, `operation` en logs estructurados.
- Estandarizar `Result<T, E>` para bordes externos críticos.

### Resultado esperado
Triage más rápido, alertas más precisas y métricas de fiabilidad accionables.

## 5) Endurecer contratos de integración (SSE + schemas)

### Hallazgo
En streaming se parsea SSE manualmente y luego se transforma/valida al final.

### Impacto
- Riesgo de eventos parcialmente malformados.
- Errores tardíos (al final del flujo).

### Mejora propuesta
- Validar **cada evento SSE** con schema discriminado (`type`) al recibirlo.
- Introducir versión de contrato (`schemaVersion`) en payload.
- Añadir pruebas de contrato consumer-driven para eventos críticos (`agent_message`, `complete`, `error`).

### Resultado esperado
Menos fallos en runtime y mayor resiliencia ante cambios del backend.

## 6) Revisar consistencia documental y operativa

### Hallazgo
El README aún presenta partes del stack centradas en Gemini, mientras arquitectura reciente enfatiza OpenAI Agents.

### Impacto
- Onboarding confuso.
- Riesgo de mala configuración en despliegues.

### Mejora propuesta
- Definir “fuente de verdad” arquitectónica única.
- Alinear README, ARCHITECTURE y scripts de despliegue con estado real.
- Añadir ADR corto: “Decisión de motor AI primario + fallback policy”.

### Resultado esperado
Menor fricción de equipo y menor probabilidad de errores de configuración.

## 7) Fortalecer gobierno de feature flags

### Hallazgo
`features.ts` opera con `import.meta.env` y defaults por entorno, pero sin ciclo explícito de retiro de flags ni metadatos de ownership.

### Impacto
- “Flag debt” con comportamiento difícil de razonar.

### Mejora propuesta
- Registrar metadata por flag (`owner`, `expiry`, `ticket`, `risk`).
- Pipeline que falle si hay flags expiradas.
- Separar release toggles de ops toggles.

### Resultado esperado
Menor deuda de configuración y despliegues más predecibles.

## 8) Optimización de datos y búsqueda

### Hallazgo
`DBService.advancedSearch` aplica parte de filtros en DB y parte en memoria (tags), con comentarios de limitaciones.

### Impacto
- Escalabilidad limitada conforme crezca el volumen.
- Riesgo de latencia y costo innecesario.

### Mejora propuesta
- Diseñar query server-side completa para tags (OR semántico) vía RPC o vista materializada.
- Definir índices JSONB y métricas de consulta.
- Introducir presupuesto de performance por endpoint.

### Resultado esperado
Mejor escalabilidad y tiempos de respuesta estables.

---

## Roadmap sugerido (90 días)

### Fase 1 (Semanas 1-3): estabilización
- Congelar arquitectura target y deprecaciones.
- Error model + logging estructurado.
- Alineación documental (README/ARCHITECTURE/ADR).

### Fase 2 (Semanas 4-7): desacoplamiento
- Use cases de aplicación.
- DI real y composition root.
- Simplificación de `analysis.store`.

### Fase 3 (Semanas 8-12): escalado
- Contratos SSE versionados + contract tests.
- Optimización de búsqueda server-side.
- Gobierno de feature flags con caducidad.

## KPIs de éxito
- **MTTR** de incidencias de análisis: -30%.
- **Lead time** de cambios en flujo de análisis: -25%.
- **Error rate** de integración provider/backend: -40%.
- **p95 latency** de búsquedas avanzadas: -35%.

## Conclusión
El producto tiene una base robusta y cercana a producción. La principal oportunidad no es “más features”, sino **reducir complejidad accidental** (dualidad de flujos, orquestación en store, y observabilidad heterogénea). Resolver estos puntos mejorará de forma directa la velocidad del equipo y la confiabilidad en producción.

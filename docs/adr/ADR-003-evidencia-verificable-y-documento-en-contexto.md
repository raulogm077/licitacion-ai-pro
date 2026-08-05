# ADR-003 — Evidencia verificable y documento en contexto

- **Estado:** Aceptada — implementación por fases, la primera ya entregada
- **Fecha:** 2026-07-28
- **Ámbito:** Fases A–C del pipeline de análisis, contrato de evidencias, presentación de citas
- **Sustituye parcialmente a:** ADR-001 (retrieval explícito vía Vector Store como camino principal)

## El incidente que la motiva

Seis análisis de **los mismos dos PDFs** —SHA-256 idénticos, verificados byte a byte en la tabla `analysis_job_documents`— produjeron seis licitaciones distintas:

| Job        | Título extraído            | Órgano                  | Presupuesto |
| ---------- | -------------------------- | ----------------------- | ----------- |
| `9617574e` | Archivo Central            | SERMAS Madrid           | 891.738 €   |
| `01e7a0a4` | _no encontrado_            | Grupo AENA              | 0 €         |
| `8e851069` | Mantenimiento de edificios | Distrito de Tetuán      | 2.219.824 € |
| `0f707cdb` | Almacenamiento y respaldo  | MITECO                  | 370.000 €   |
| `54fadbb0` | Distribución farmacéutica  | AGS Sur de Sevilla      | 1.953.261 € |
| `b48b69f4` | Asistencia informática     | Consejería de Educación | 405.000 €   |

El expediente real es **DDT 163/2026 — suministro de una solución para «Contratación de Clientes»**. Ninguno de los seis lo identifica.

**Cada título venía acompañado de su cita literal**, del tipo `"Título: Servicios de apoyo a la gestión del Archivo Central…"`. Seis extractos textuales mutuamente excluyentes del mismo documento: como máximo uno es real y al menos cinco están fabricados, cita incluida.

Y no es que el documento no se leyera. En `9617574e`, el bloque `criteriosAdjudicacion` extrajo _«apartado 3.1 del PPT: Suministro de la solución: 'Contratación de Clientes'»_ — el pliego real, textual — **mientras el bloque `datosGenerales` de la misma ejecución describía un contrato del Servicio Madrileño de Salud**. Mismo vector store, misma ejecución, 217 segundos.

## Diagnóstico

Dos defectos de diseño independientes, ninguno de ellos un bug puntual.

### 1. RAG para un corpus que cabe en contexto

El pipeline monta un Vector Store y consulta con `file_search`. RAG existe para corpus que **no caben** en la ventana de contexto. Un expediente son 2–5 PDFs; los del incidente suman 3,9 MB y el límite de un único request de la Responses API es **50 MB**.

Adoptamos la complejidad del RAG y heredamos su peor modo de fallo sin necesitar ninguno de sus beneficios. Peor: `file_search` es una **herramienta opcional** que el modelo decide si invoca. Nunca forzamos `tool_choice` ni inspeccionamos los tool calls, así que el modelo puede responder sin haber mirado el documento — y el prompt le sigue exigiendo rellenar un formulario. Inventar una licitación española plausible es el camino de menor resistencia.

### 2. La evidencia se la autoacredita el modelo

`evidence.quote` es **prosa generada por el modelo**, no un fragmento extraído del documento. Nadie comprueba jamás que ese texto exista en el PDF.

> **Un grounding que el propio modelo se acredita no es grounding.** Es una afirmación adicional del mismo generador, presentada con la autoridad de una verificación que nunca ocurrió.

Este es el defecto profundo, y el que mantuvo el fallo invisible: un bloque vacío se nota; un bloque inventado con cita convincente, no.

**El trabajo de `SPEC.md` §11.2 empeoró esto.** Al extender `TrackedField` a importes y ponderaciones aumentamos la _confianza_ en un dato no verificable. La premisa que se escribió entonces en `block-expectations.ts` —«cuando `file_search` no recupera nada, el modelo responde con un JSON vacío en lugar de inventar»— **es falsa**, y las seis ejecuciones la refutan. A veces devuelve vacío y a veces fabrica.

Por eso el mecanismo de §11.4 es estructuralmente ciego a este fallo: detecta el vacío, que es el caso benigno.

## Decisión

Se sustituye _recuperación opcional + evidencia autoacreditada_ por **documento en contexto + evidencia verificada contra la fuente**.

### La primitiva que falta

Hoy el pipeline **nunca ve el contenido de los PDFs**: los sube a OpenAI y pregunta. Sin el texto en nuestro lado no existe forma de comprobar nada. Todo lo demás depende de recuperar esa primitiva.

| Pieza                                                  | Qué aporta                                                   | Determinista |
| ------------------------------------------------------ | ------------------------------------------------------------ | ------------ |
| Texto extraído en ingesta, persistido con el job       | Oráculo de verificación                                      | sí           |
| `input_file` (por `file_id`) en lugar de `file_search` | El modelo **no puede** no ver el documento                   | sí           |
| Verificación de cada `evidence.quote` contra el texto  | Cita ausente ⇒ campo rechazado                               | sí, sin LLM  |
| Ancla de identidad del expediente entre bloques        | Coherencia; detecta el caso «bloques de contratos distintos» | sí           |

**La verificación de citas sola habría cazado las seis alucinaciones en la primera ejecución**: `"Título: Servicios de apoyo a la gestión del Archivo Central…"` no aparece en el DDT 163/2026. Es una comparación de cadenas normalizada.

### Por qué `input_file` y no seguir con el Vector Store

`input_file` admite el PDF por `file_id` —ya subimos los ficheros a la Files API— y lo coloca **incondicionalmente en el contexto**. Desaparece la clase entera de «el modelo no lo leyó e inventó», que no se puede cerrar mientras la recuperación sea una decisión del modelo.

Límites verificados en la documentación de OpenAI: 50 MB por fichero y 50 MB por request. El parseo de PDF de OpenAI incluye texto **e imágenes de página**, controlables con `detail`, y exige modelo con visión.

## Fases

**Fase 1 — Dejar de mentir (entregada con esta ADR).** Las citas dejan de presentarse como acreditadas. El contrato de evidencias gana un estado de verificación que hoy vale «sin verificar» para todo, y la interfaz lo dice. No arregla la extracción; retira una autoridad que nunca existió.

**Fase 2 — Texto en ingesta.** Extraer y persistir el texto de cada documento. Habilita la verificación.

**Fase 3 — Verificación de citas.** Toda `evidence.quote` que no aparezca en el texto invalida su campo, que pasa a `no_encontrado` con motivo. Determinista y testeable sin clave de OpenAI.

**Fase 4 — `input_file` sustituye a `file_search`.** Requiere medición previa (ver abajo).

**Fase 5 — Replantear los nueve bloques.** La división en nueve llamadas existía para mantener enfocada cada recuperación. Con el documento entero en contexto, buena parte de su razón de ser desaparece.

## Lo que hay que medir antes de la Fase 4

No hay datos y **no se promueve sin ellos** — la misma regla que gobierna `BLOCK_MODEL_OVERRIDES`:

1. **Coste por análisis.** Documento en contexto × N bloques. Con caché de prompt e `detail: low` frente al coste actual de `file_search`.
2. **Latencia bajo el techo de 150 s.** Un contexto grande es más lento; hay que confirmar que el expediente real cabe en el presupuesto de slice.
3. **Exactitud sobre el DDT 163/2026.** Un banco que compare las dos arquitecturas sobre el mismo expediente, con el título y el órgano reales como verdad.

## Riesgos asumidos

**PDFs escaneados.** Hoy OpenAI hace el OCR. Si extrajéramos texto por nuestra cuenta y el PDF fuese un escaneo, obtendríamos vacío. Por eso el diseño **no sustituye su parseo por el nuestro**: el documento sigue yendo a OpenAI, y nuestro texto se usa solo como oráculo de verificación. Cuando la extracción local salga vacía **no se puede verificar, y hay que decirlo** — nunca dar la cita por buena por defecto.

**Coste.** Puede subir de forma significativa. Es un intercambio consciente: un análisis caro y correcto vale más que uno barato e inventado, en un producto donde el usuario decide si concurre a un contrato de millones.

## Alternativas descartadas

**Forzar `tool_choice: 'required'` y quedarnos con RAG.** Reduce el fallo pero no lo cierra: obliga a llamar a `file_search`, no a que devuelva lo pertinente, y sigue sin verificar las citas. Vale como mitigación temporal, no como arquitectura.

**Un LLM-juez que valide las extracciones.** Añade un segundo generador no verificable para auditar al primero. Ante una alucinación con cita coherente, un juez sin acceso a la fuente no tiene con qué falsarla.

**Extraer texto nosotros y prescindir de OpenAI para el parseo.** Rompe los PDFs escaneados, que son frecuentes en contratación pública.

**Parchear el mecanismo de §11.4 para detectar alucinaciones.** Detecta vacíos; el problema es lo lleno-e-inventado. No hay parche que lo alcance sin la primitiva del texto.

## Consecuencias

**Los análisis existentes no son de fiar.** Los seis del incidente están en la base de datos con datos fabricados y citas de apoyo. No se purgan automáticamente: la decisión de qué hacer con el histórico es de producto.

**`SPEC.md` §11.2 queda matizada.** El grounding de importes y ponderaciones sigue siendo la estructura correcta; lo que no es cierto es que acredite nada mientras la cita no se verifique. La Fase 3 lo completa.

**La regla que unifica los cuatro incidentes de julio** (`ARCHITECTURE.md` §8.22–8.24 y esta ADR) es una sola: **antes de afirmar algo, comprobar que el dato en el que se apoya la afirmación es verificable.** Vale para un contador que nunca se midió, para un bloque vacío que no se contrastó y para una cita que nadie buscó en el documento.

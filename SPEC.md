# Product Specification (SPEC.md)

## Visión Core
Hacer que la extracción, lectura y análisis de pliegos de licitaciones complejos sea rápida, precisa y con una UX inmejorable para analistas legales/técnicos, apoyándonos en IA.

---

## Feature 1: Chat Contextual con el Pliego (Q&A)

**Historia de Usuario:**
Como analista de licitaciones, quiero un chat integrado en la vista de detalle del pliego para hacer preguntas específicas (ej. "¿Cuáles son las penalidades por retraso?", "¿Cuáles son los hitos de entrega?"), de modo que pueda resolver dudas legales sin tener que leer manualmente todo el PDF.

**Requerimientos de Datos (Supabase / OpenAI):**
- Utilizar el *Vector Store* de OpenAI ya generado durante el análisis principal en `JobService.analyzeWithAgents()`.
- Crear una nueva Edge Function en Supabase (`chat-with-document`) que reciba el `thread_id` y el texto de la pregunta, y ejecute un chat usando el Agents SDK con `file_search`.
- Guardar el historial de mensajes en una nueva tabla de Supabase `chat_messages` (campos: `id`, `licitacion_id`, `role`, `content`, `created_at`).

**UX Esperada (Diseño para v0):**
- **Layout:** Panel lateral derecho deslizable ("drawer" o "sidebar") en la vista de Detalles de Licitación.
- **UI Component:** Interfaz de chat fluida con estilo ChatGPT, soportando Markdown en las respuestas.
- **Feedback:** Indicadores de estado ("Agente leyendo documento...", "Agente escribiendo...") y soporte para Streaming (Server-Sent Events) para respuestas progresivas.
- **Acciones Rápidas:** Botones con "Preguntas sugeridas" basadas en el contexto general de licitaciones.

---

## Feature 2: Visor de PDF Integrado Lado-a-Lado ("Split View")

**Historia de Usuario:**
Como analista de licitaciones, quiero visualizar el PDF original en la misma pantalla junto a los datos extraídos por la IA, para poder verificar manualmente fragmentos dudosos sin cambiar de ventana o aplicación.

**Requerimientos de Datos (Supabase):**
- Los PDFs deben subirse y persistir temporal o permanentemente en un bucket de Supabase Storage (`pliegos_archivos`).
- El frontend debe solicitar una URL prefirmada (`signed_url`) con tiempo de expiración para renderizar el documento de manera segura.

**UX Esperada (Diseño para v0):**
- **Layout:** Vista dividida (Split-pane layout) con un control central (Drag bar) para ajustar el ancho de las columnas.
- **Izquierda:** Formulario/Tarjetas con los datos extraídos estructurados.
- **Derecha:** Visor de PDF embebido (iframe o `react-pdf`).
- **Controles del Visor:** Barra de herramientas superior con paginación, zoom, y búsqueda de texto nativa del visor.

---

## Feature 3: Modo "Corrección Humana" y Trazabilidad

**Historia de Usuario:**
Como analista técnico, quiero poder editar manualmente los campos extraídos si la IA cometió un error o la extracción fue marcada con calidad "PARCIAL", guardando un registro de quién y qué se modificó.

**Requerimientos de Datos (Supabase):**
- Las vistas de datos extraídos pasan de "solo lectura" a formularios editables.
- Actualizar el registro JSON de `LicitacionData` en la base de datos a través de una nueva llamada a Supabase.
- Crear tabla `audit_logs` (campos: `licitacion_id`, `user_id`, `field_changed`, `old_value`, `new_value`, `timestamp`).

**UX Esperada (Diseño para v0):**
- **UI Component:** Campos de texto y selectores que por defecto muestran el dato de la IA, pero incluyen un ícono de "lápiz" para editar.
- **Feedback Visual:** Si un campo fue editado manualmente, mostrar una pequeña etiqueta "Editado por Humano" para diferenciarlo del dato original de la IA.
- **Acciones:** Botón flotante "Guardar Cambios" que aparece al detectar modificaciones en el estado (Zustand).

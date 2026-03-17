# Product Specification (SPEC)

## 1. Visión Core y Estado del Proyecto
**Visión Core:** Hacer que la extracción, lectura y análisis de pliegos de licitaciones complejos sea rápida, precisa y con una UX inmejorable para analistas legales/técnicos, apoyándonos en IA.
**Estado Actual:** Interfaz para que el usuario suba pliegos en formato PDF (y guía opcional) y los analice. El backend usa Supabase Edge Functions (`analyze-with-agents`) con OpenAI Assistants SDK y Vector Stores (streaming vía Server-Sent Events).

## 2. Funcionalidad en Desarrollo: Historial de Análisis (Cloud Sync)
**Problema:** Al recargar la página o perder la sesión, la información analizada se pierde. No hay forma de recuperar análisis sin volver a gastar tokens.
**Solución:** Guardar automáticamente en Supabase los resultados y proveer una vista de "Historial" avanzada.
**User Story:** Como analista, quiero que mis análisis se guarden automáticamente para buscar, filtrar y exportar mi histórico rápidamente sin tener que re-analizar.

**Requerimientos de Datos (Supabase):**
- Tabla `licitaciones` con RLS activado.
- Esquema base (`DbLicitacion`): `id` (UUID), `user_id` (UUID), `hash`, `fileName`, `timestamp`, `data` (JSONB), `metadata` (JSONB).
- Integrar o potenciar `advancedSearch` en `src/services/db.service.ts` para soportar filtrados complejos de JSONB.

**UX Esperada (v0 / Frontend):**
- **Auto-Guardado:** Llamada silenciosa al backend al terminar (`status === 'COMPLETED'`) con toast de "Guardado en la nube".
- **Vista `/history`:** Reemplazar el listado básico actual con una UI moderna generada por v0. 
- **Componentes de la Vista:** Tabla avanzada, filtros rápidos (fechas, cliente, presupuesto), barra de búsqueda general y paginación.
- **Acciones:** "Ver Análisis" (carga JSON en el store global `useLicitacionStore` y navega a `/`), "Eliminar".

**Criterios de Aceptación Técnicos:**
- Auto-guardado solo si el usuario está autenticado.
- Carga de datos paginada o limitada (ej. top 50).
- Uso exclusivo de componentes UI existentes o generados por v0 alineados al diseño actual.

## 3. Realidad Técnica Implementada (Iteración Anterior)
- **Historial Avanzado:** Se implementó una vista `/history` renovada usando v0, con filtros funcionales (cliente, fecha, presupuesto) que interactúan con Supabase vía `dbService.advancedSearch`.
- **Limpieza de Legado:** Se eliminaron las funciones de polling (`startJob`, `pollJob`) en favor de SSE y se validó la ausencia del Edge Function deprecado `openai-runner`.

## 4. Nueva Funcionalidad (Iteración Actual): Gestión de Plantillas de Extracción (Templates)
**Problema:** Actualmente, la IA extrae siempre el mismo esquema de datos definido de forma estática en el código (schema de Zod). Los usuarios tienen diferentes necesidades (ej. algunos buscan cláusulas penales, otros solo criterios de solvencia técnica) y necesitan poder personalizar qué información extrae el Analista.
**Solución:** Implementar un sistema de "Plantillas de Extracción" que permita a los usuarios definir esquemas personalizados y guardarlos para usarlos en futuros análisis.
**User Story:** Como analista técnico, quiero poder crear y guardar mis propias plantillas con los campos específicos que me interesan de un pliego, para que la IA extraiga solo la información relevante para mi caso de uso.

**Requerimientos de Datos (Supabase):**
- Nueva tabla `extraction_templates` con RLS. Implementado: ID, User ID, Nombre, Descripción y Schema (JSONB).
- Integrado un servicio CRUD `template.service.ts` para manejar consultas desde el frontend.

**UX Esperada (v0 / Frontend):**
- **Vista de Gestión (`/templates`):** Listado de plantillas guardadas implementado, con botones de Crear, Editar, Eliminar y Duplicar.
- **Creador de Plantillas:** Formulario dinámico para añadir campos al schema.
- **Selector en Análisis:** Añadido selector `<select>` en el `AnalysisWizard.tsx` para escoger plantilla antes de iniciar el análisis.

**Métricas de IA / Backend:**
- Modificado Edge Function `analyze-with-agents` para incluir instrucciones dinámicas inyectadas basadas en el template recibido.

## 5. Nueva Funcionalidad (Próxima Iteración): Soporte para Múltiples Documentos por Licitación
**Problema:** Actualmente el sistema solo permite subir un único archivo PDF principal (y una guía opcional). Las licitaciones suelen estar compuestas por múltiples documentos (ej. Pliego de Cláusulas Administrativas, Pliego de Prescripciones Técnicas, Anexos). Los usuarios tienen que unir los PDFs manualmente antes de subirlos.
**Solución:** Permitir la subida múltiple de documentos y enviarlos en conjunto al Vector Store de OpenAI para su análisis unificado.
**User Story:** Como analista técnico, quiero poder subir todos los documentos que componen una licitación a la vez, para que la IA analice el contexto completo sin que yo tenga que combinar los PDFs previamente.

**Requerimientos de Datos (Supabase):**
- Modificar la tabla `licitaciones` para que `fileName` pueda representar múltiples archivos, o añadir una nueva columna `files` (array de JSON con nombre y path).
- Ajustar el almacenamiento en Supabase Storage si es necesario para agrupar múltiples archivos bajo una misma licitación.

**UX Esperada (v0 / Frontend):**
- **Subida de Archivos:** Refactorizar el componente principal (Dropzone) para aceptar múltiples archivos simultáneos (e.g., `<input type="file" multiple />`).
- **Lista de Archivos:** Mostrar los documentos subidos en forma de lista, con su peso y un botón para eliminar archivos individuales antes de lanzar el análisis.
- **Feedback Visual:** Mantener un estado de carga claro mientras se procesan múltiples documentos.

**Métricas de IA / Backend:**
- Actualizar el Edge Function `analyze-with-agents` para recibir un array de documentos (Base64) en lugar de uno único.
- Iterar sobre el array para subir todos los documentos a OpenAI usando el endpoint de Files, y luego asociarlos todos al mismo Vector Store para que el Agent tenga acceso al contexto completo.

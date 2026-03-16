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
- **Script `.env.local`:** Creado `scripts/init-env.sh` para inyectar variables dummy (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) y evitar warnings de Zod/Vitest.
- **Tests de UI:** Resueltos warnings de Vitest en `Header.test.tsx` (usando `waitFor`), `TagManager.test.tsx` y `env.test.ts` (mock hoisting).
- **Soporte Base64:** Backend usa `extractBase64Data` en `analyze-with-agents` para limpiar prefijos Data URL de forma robusta.

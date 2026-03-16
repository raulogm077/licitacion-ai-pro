<<<<<<< pm-spec-cloud-sync-1282142944083801968
# Product Specification (SPEC)

## 1. Visión Core
"Hacer que la extracción, lectura y análisis de pliegos de licitaciones complejos sea rápida, precisa y con una UX inmejorable para analistas legales/técnicos, apoyándonos en IA."

## 2. Funcionalidad a Desarrollar: Historial de Análisis Guardados (Cloud Sync)

### 2.1. Problema Actual
Actualmente, el usuario sube un PDF, la IA lo analiza en tiempo real y muestra los resultados en el Dashboard, pero si el usuario recarga la página o pierde la sesión, la información analizada se pierde. No hay forma de recuperar análisis anteriores sin volver a gastar tokens de IA ni tiempo.

### 2.2. Solución Propuesta
Aprovechar la integración existente con Supabase para guardar automáticamente los resultados de los análisis completados en la base de datos vinculados al usuario autenticado. Proveer una vista de "Historial" (`HistoryPage.tsx` ya existe como scaffold) donde el usuario pueda ver, buscar y recuperar análisis previos instantáneamente.

### 2.3. User Story
**Como** analista legal/técnico,
**Quiero** que mis análisis de pliegos se guarden automáticamente en la nube,
**Para poder** consultarlos más tarde sin tener que volver a procesar el PDF y comparar diferentes licitaciones a lo largo del tiempo.

### 2.4. Requerimientos de Datos (Supabase)
Se debe asegurar la existencia de una tabla `licitaciones` (o similar) con RLS (Row Level Security) activado para que cada usuario solo vea sus propios registros.
Esquema propuesto (si no existe, el Tech Lead deberá crearlo/ajustarlo basado en `DbLicitacion` de `src/types.ts`):
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key a `auth.users`)
- `hash` (String, identificador único del documento/análisis)
- `fileName` (String)
- `timestamp` (Timestamp)
- `data` (JSONB, contiene `LicitacionData`)
- `metadata` (JSONB, contiene `LicitacionMetadata`)

### 2.5. UX Esperada (para v0 / Frontend)
1. **Auto-Guardado:** Cuando un análisis termina exitosamente (`status === 'COMPLETED'`), el sistema debe realizar una llamada silenciosa al backend (Supabase) para persistir el `LicitacionData` y `LicitacionMetadata`. Mostrar un pequeño toast de "Guardado en la nube".
2. **Vista de Historial (`/history`):**
   - Una tabla o grid de tarjetas modernas (diseño tipo v0).
   - Columnas/Campos: Nombre del archivo, Fecha de análisis, Cliente (extraído), Presupuesto, Estado (ej. Adjudicada, Publicada).
   - Acciones: "Ver Análisis" (Carga el JSON en el store global y navega al Dashboard/Home), "Eliminar".
   - Estado de carga elegante (skeleton loaders).
   - Estado vacío ("Aún no tienes análisis guardados. Ve al inicio para analizar tu primer pliego.").

### 2.6. Criterios de Aceptación Técnicos
- El auto-guardado en Supabase debe ejecutarse solo si el usuario está autenticado.
- La página `/history` debe cargar los datos desde Supabase paginados o limitados (ej. top 50).
- Al hacer clic en "Ver Análisis" desde el historial, se debe popular `useLicitacionStore` y navegar a `/` para que el Dashboard muestre los datos sin re-procesar.
- Uso exclusivo de componentes de UI existentes (`lucide-react`, Tailwind) o generados por v0 alineados al diseño actual.
=======
# Especificación y Realidad de Implementación (Spec-Anchored)

## Estado del Proyecto

- **App de análisis de pliegos:** Interfaz para que el usuario suba pliegos en formato PDF (y opcionalmente una guía de lectura en PDF) y los analice usando OpenAI Agents.
- **Backend:** Supabase Edge Functions (`analyze-with-agents`) usan OpenAI Assistants SDK con Vector Stores para indexar documentos (streaming vía Server-Sent Events).

## Detalles de Implementación (Iteración Actual)

### 1. Script `.env.local`
- **Script:** `scripts/init-env.sh` (Ejecutable bash).
- **Acción:** Comprueba la existencia de `.env.local` y, si faltan, inyecta `VITE_SUPABASE_URL` (valor dummy `http://localhost:54321`) y `VITE_SUPABASE_ANON_KEY` (valor JWT dummy) para evitar que Vitest o Zod emitan warnings en stderr sobre variables de entorno ausentes.

### 2. Tests de UI - Warnings Vitest / React Testing Library
- **Archivos:** `src/components/layout/__tests__/Header.test.tsx`, `src/components/domain/__tests__/TagManager.test.tsx`, `src/config/__tests__/env.test.ts`.
- **Implementación:**
  - `Header.test.tsx`: Las interacciones del menú de usuario simuladas en tests (abrir menú, click en cerrar sesión) ahora son capturadas por `waitFor(...)` para esperar asincronamente al estado `mockSignOut`.
  - `TagManager.test.tsx` / `env.test.ts`: Las declaraciones `vi.mock` y `vi.unmock` fueron elevadas al nivel superior (top-level) del archivo, resolviendo la advertencia de Vitest de `mock hoisting`.

### 3. Soporte de Guía en Base64
- **Archivo:** `supabase/functions/analyze-with-agents/index.ts`.
- **Implementación:** El backend ahora usa un helper `extractBase64Data` para procesar la entrada `guiaBase64`. Esto limpia proactivamente el prefijo de Data URL (`data:application/pdf;base64,...`) si está presente antes de ser decodificado vía `atob` e instanciado en un `Uint8Array`. El sistema ahora es agnóstico y robusto a ambas representaciones en base64 de la guía de usuario.

### 4. Backlog
- Se actualizaron las tareas correspondientes moviéndolas de la sección `## To Do` a la sección `## Done` y marcándolas como completadas en `BACKLOG.md`.

### 5. Módulo Avanzado de Historial de Licitaciones
- **Historia de Usuario:** Como analista, quiero poder buscar, filtrar por estado y exportar mi histórico de licitaciones analizadas para encontrar pliegos relevantes rápidamente sin tener que re-analizar.
- **Requerimientos de Datos (Supabase):** Aprovechar y ampliar los métodos de búsqueda existentes (se requiere integrar o potenciar `advancedSearch` en `src/services/db.service.ts` para que soporte de manera eficiente filtrados complejos de JSONB en la UI).
- **UX Esperada (v0):** Reemplazar el listado básico actual de `HistoryView` con una UI moderna que incluya una tabla avanzada, filtros rápidos (rango de fechas, cliente, presupuesto mínimo/máximo), barra de búsqueda general y paginación.
>>>>>>> main

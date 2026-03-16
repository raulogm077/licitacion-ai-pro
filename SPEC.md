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

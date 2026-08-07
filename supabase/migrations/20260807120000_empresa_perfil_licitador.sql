-- ADR-002 Paso 1 — el otro lado de la comparación.
--
-- El pipeline extrae con evidencia lo que el órgano de contratación EXIGE:
-- cifra de negocio mínima, proyectos similares, certificaciones. Lo que no
-- existe es contra qué compararlo. La Guía §3.1.1 lo dice literalmente
-- —«recuperar VAN_empresa de la base de datos interna»— y esa base de datos
-- interna es esto.
--
-- Cuatro decisiones de producto lo condicionan (ADR-002 §7, tomadas 2026-08-07).
-- Dos afectan a este fichero:
--
--   7.1 El perfil es POR USUARIO, pero las tablas hijas cuelgan de `perfil_id`,
--       nunca de `user_id`. Hoy son equivalentes; el día que el perfil pase a
--       ser de organización, `perfil_id` convierte esa migración en añadir una
--       columna en vez de reescribir el modelo. Es la razón de que
--       `empresa_perfil` tenga `id` propio además de `user_id` único.
--
--   7.4 Un campo ausente NO es un incumplimiento. Ninguna columna de datos
--       lleva DEFAULT numérico ni NOT NULL con relleno: la diferencia entre
--       «cero» y «no lo sé» tiene que sobrevivir hasta el motor de Go/No-Go,
--       que responderá «no verificable». Poner `DEFAULT 0` aquí produciría
--       exactamente el veredicto sobre un dato ausente que la decisión prohíbe.
--
-- A diferencia de las tablas de análisis, este dato lo escribe el usuario: las
-- políticas son owner-scoped de lectura Y escritura. La validación de forma es
-- responsabilidad del cliente (`safeParse` antes de escribir), no de RLS.

-- ─── empresa_perfil ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa_perfil (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    razon_social text,
    -- Dato identificativo: nunca debe aparecer en logs, trazas ni payloads
    -- enviados a OpenAI. La decisión 7.3 mantiene el perfil fuera del contexto
    -- del copiloto justamente por esto.
    nif text,
    -- Habilita el chequeo de plan de igualdad para >50 empleados (Guía §3.3).
    -- Nullable a propósito: «no lo ha rellenado» no es «tiene cero empleados».
    num_empleados integer,
    clasificacion_empresarial jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_perfil
    DROP CONSTRAINT IF EXISTS empresa_perfil_num_empleados_check,
    ADD CONSTRAINT empresa_perfil_num_empleados_check CHECK (num_empleados IS NULL OR num_empleados >= 0);

-- ─── empresa_ejercicio ──────────────────────────────────────────────────────
--
-- El VAN se declara POR EJERCICIO, no como número único. La LCSP pide «el mejor
-- ejercicio de los últimos tres disponibles»: guardar un solo total obligaría al
-- usuario a hacer esa selección de cabeza, y la app perdería la posibilidad de
-- hacerla bien.

CREATE TABLE IF NOT EXISTS public.empresa_ejercicio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id uuid NOT NULL REFERENCES public.empresa_perfil (id) ON DELETE CASCADE,
    ejercicio integer NOT NULL,
    volumen_negocio numeric,
    -- Volumen «en el ámbito» del contrato. Muchos pliegos lo exigen así y NO es
    -- el total: mantenerlos en la misma columna haría pasar uno por el otro.
    volumen_ambito numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (perfil_id, ejercicio)
);

ALTER TABLE public.empresa_ejercicio
    DROP CONSTRAINT IF EXISTS empresa_ejercicio_ejercicio_check,
    ADD CONSTRAINT empresa_ejercicio_ejercicio_check CHECK (ejercicio BETWEEN 1900 AND 2200),
    DROP CONSTRAINT IF EXISTS empresa_ejercicio_volumen_negocio_check,
    ADD CONSTRAINT empresa_ejercicio_volumen_negocio_check CHECK (volumen_negocio IS NULL OR volumen_negocio >= 0),
    DROP CONSTRAINT IF EXISTS empresa_ejercicio_volumen_ambito_check,
    ADD CONSTRAINT empresa_ejercicio_volumen_ambito_check CHECK (volumen_ambito IS NULL OR volumen_ambito >= 0);

CREATE INDEX IF NOT EXISTS idx_empresa_ejercicio_perfil ON public.empresa_ejercicio (perfil_id);

-- ─── empresa_proyecto ───────────────────────────────────────────────────────
--
-- La «past performance database» de la Guía §3.2.1.

CREATE TABLE IF NOT EXISTS public.empresa_proyecto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id uuid NOT NULL REFERENCES public.empresa_perfil (id) ON DELETE CASCADE,
    denominacion text,
    cliente text,
    -- Códigos CPV completos. El truncado a 3 dígitos que exige la presunción
    -- legal de similitud se hace en consulta, no al guardar: almacenar ya
    -- truncado perdería el dato original sin poder recuperarlo.
    cpv text [] NOT NULL DEFAULT '{}',
    importe numeric,
    -- Necesarias para la ventana de 3 años (servicios/suministros) o 5 (obras).
    fecha_inicio date,
    fecha_fin date,
    -- Un proyecto sin certificado puede no computar como acreditación.
    certificado_buena_ejecucion boolean,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_proyecto
    DROP CONSTRAINT IF EXISTS empresa_proyecto_importe_check,
    ADD CONSTRAINT empresa_proyecto_importe_check CHECK (importe IS NULL OR importe >= 0),
    DROP CONSTRAINT IF EXISTS empresa_proyecto_fechas_check,
    ADD CONSTRAINT empresa_proyecto_fechas_check CHECK (
        fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio
    );

CREATE INDEX IF NOT EXISTS idx_empresa_proyecto_perfil ON public.empresa_proyecto (perfil_id);

-- El filtro por prefijo de CPV recorre todo el histórico de proyectos del
-- licitador en cada Go/No-Go. Sin este índice degrada con el crecimiento.
CREATE INDEX IF NOT EXISTS idx_empresa_proyecto_cpv ON public.empresa_proyecto USING GIN (cpv);

-- ─── empresa_acreditacion ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa_acreditacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id uuid NOT NULL REFERENCES public.empresa_perfil (id) ON DELETE CASCADE,
    tipo text NOT NULL,
    identificador text,
    -- Solo para seguros de responsabilidad civil (Guía §3.1.2).
    importe_cobertura numeric,
    -- Una certificación caducada es un NO-cumple, no un cumple. El motor tendrá
    -- que mirarla; guardarla nullable permite distinguir «sin fecha declarada»
    -- de «vigente», que no son lo mismo.
    fecha_caducidad date,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_acreditacion
    DROP CONSTRAINT IF EXISTS empresa_acreditacion_tipo_check,
    ADD CONSTRAINT empresa_acreditacion_tipo_check CHECK (tipo IN ('iso', 'ens', 'seguro_rc', 'otra')),
    DROP CONSTRAINT IF EXISTS empresa_acreditacion_importe_cobertura_check,
    ADD CONSTRAINT empresa_acreditacion_importe_cobertura_check CHECK (
        importe_cobertura IS NULL OR importe_cobertura >= 0
    );

CREATE INDEX IF NOT EXISTS idx_empresa_acreditacion_perfil ON public.empresa_acreditacion (perfil_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
--
-- El perfil se comprueba contra `auth.uid()` directo; las hijas, atravesando
-- `empresa_perfil`. Esa indirección es el coste de la decisión 7.1 y es
-- deliberada: el día que el dueño sea una organización, solo cambia el EXISTS.

ALTER TABLE public.empresa_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_ejercicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_acreditacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_perfil_owner" ON public.empresa_perfil;
CREATE POLICY "empresa_perfil_owner" ON public.empresa_perfil
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "empresa_ejercicio_owner" ON public.empresa_ejercicio;
CREATE POLICY "empresa_ejercicio_owner" ON public.empresa_ejercicio
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_ejercicio.perfil_id AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_ejercicio.perfil_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "empresa_proyecto_owner" ON public.empresa_proyecto;
CREATE POLICY "empresa_proyecto_owner" ON public.empresa_proyecto
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_proyecto.perfil_id AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_proyecto.perfil_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "empresa_acreditacion_owner" ON public.empresa_acreditacion;
CREATE POLICY "empresa_acreditacion_owner" ON public.empresa_acreditacion
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_acreditacion.perfil_id AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.empresa_perfil p
            WHERE p.id = empresa_acreditacion.perfil_id AND p.user_id = auth.uid()
        )
    );

-- ─── updated_at ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_empresa_perfil_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_empresa_perfil_updated_at ON public.empresa_perfil;
CREATE TRIGGER update_empresa_perfil_updated_at
BEFORE UPDATE ON public.empresa_perfil
FOR EACH ROW
EXECUTE FUNCTION public.update_empresa_perfil_updated_at();

-- ─── Documentación en catálogo ──────────────────────────────────────────────

COMMENT ON TABLE public.empresa_perfil IS
    'Perfil del licitador (ADR-002). Una fila por usuario; las hijas cuelgan de `id`, no de `user_id`, para que pasar a perfil de organización sea añadir una columna.';
COMMENT ON COLUMN public.empresa_perfil.nif IS
    'Identificativo. Nunca en logs, trazas ni payloads a OpenAI (decisión 7.3).';
COMMENT ON TABLE public.empresa_ejercicio IS
    'VAN por ejercicio. La LCSP pide el mejor de los tres últimos, así que no se guarda un total único.';
COMMENT ON COLUMN public.empresa_ejercicio.volumen_ambito IS
    'Volumen en el ámbito del contrato. No es el total: muchos pliegos exigen este y no aquel.';
COMMENT ON TABLE public.empresa_proyecto IS
    'Past performance (Guía §3.2.1). `cpv` se guarda completo; el truncado a 3 dígitos ocurre en consulta.';
COMMENT ON TABLE public.empresa_acreditacion IS
    'ISO/ENS/seguros. `fecha_caducidad` nullable distingue «sin fecha declarada» de «vigente»: una caducada es un no-cumple.';

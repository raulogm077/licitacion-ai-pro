-- pg_net is non-relocatable. Environments that already applied the first
-- Fase 1B migration may therefore have registered it in `public`, which the
-- Supabase security advisor flags. Fresh environments install it directly in
-- `extensions`; this compatibility migration safely repairs existing previews.
DO $$
DECLARE
    v_extension_schema text;
BEGIN
    SELECT namespace.nspname
    INTO v_extension_schema
    FROM pg_extension AS extension
    JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'pg_net';

    IF v_extension_schema IS NULL THEN
        EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
    ELSIF v_extension_schema = 'public' THEN
        EXECUTE 'DROP EXTENSION pg_net';
        EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
    ELSIF v_extension_schema <> 'extensions' THEN
        RAISE EXCEPTION 'pg_net is installed in unsupported schema %', v_extension_schema;
    END IF;
END;
$$;

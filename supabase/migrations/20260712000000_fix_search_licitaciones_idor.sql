-- Fix IDOR in search_licitaciones (security hardening).
--
-- The previous definition (20260329000000_fulltext_search.sql) was
-- SECURITY DEFINER with a caller-controlled `user_id_param uuid` and
-- EXECUTE granted to `authenticated`. Because SECURITY DEFINER bypasses
-- RLS, any authenticated user could read another user's licitaciones by
-- passing that user's UUID as `user_id_param`.
--
-- The frontend only ever calls rpc('search_licitaciones', { search_query })
-- (src/services/db.service.ts), so the parameter can be dropped safely.
--
-- New definition:
--   * single `search_query` argument; ownership is always auth.uid()
--   * SECURITY INVOKER, so RLS on public.licitaciones applies
--   * explicit user_id filter kept as defense in depth
--   * fixed search_path (SECURITY DEFINER linter guidance; harmless here)

drop function if exists public.search_licitaciones(text, uuid);

create or replace function public.search_licitaciones(search_query text)
returns table (
  id uuid,
  hash text,
  file_name text,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    l.id,
    l.hash,
    l.file_name,
    l.data,
    l.created_at,
    l.updated_at,
    ts_rank(l.search_vector, websearch_to_tsquery('spanish', search_query)) as rank
  from public.licitaciones l
  where l.user_id = auth.uid()
    and (
      -- Full-text search (stemmed Spanish)
      l.search_vector @@ websearch_to_tsquery('spanish', search_query)
      or
      -- Partial match fallback (for CPV codes, short terms, etc.)
      l.file_name ilike '%' || search_query || '%'
      or
      l.data->'datosGenerales'->'titulo'->>'value' ilike '%' || search_query || '%'
      or
      l.data->'datosGenerales'->>'titulo' ilike '%' || search_query || '%'
      or
      l.data->'datosGenerales'->'organoContratacion'->>'value' ilike '%' || search_query || '%'
      or
      l.data->'datosGenerales'->>'organoContratacion' ilike '%' || search_query || '%'
      or
      l.data->'metadata'->>'cliente' ilike '%' || search_query || '%'
    )
  order by rank desc, l.updated_at desc;
$$;

revoke execute on function public.search_licitaciones(text) from public, anon;
grant execute on function public.search_licitaciones(text) to authenticated;

-- Harden pre-existing trigger functions flagged by the security review:
-- fix the mutable search_path (they are invoked by triggers only).
alter function public.update_updated_at_column() set search_path = public, pg_temp;
alter function public.update_extraction_templates_updated_at() set search_path = public, pg_temp;

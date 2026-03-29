-- Full-text search: add generated tsvector column for keyword + semantic-like search
-- Uses Spanish configuration for proper stemming of procurement documents

-- 1. Add a generated tsvector column combining title, org, and file_name
alter table public.licitaciones
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(data->'datosGenerales'->'titulo'->>'value', data->'datosGenerales'->>'titulo', '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(data->'datosGenerales'->'organoContratacion'->>'value', data->'datosGenerales'->>'organoContratacion', '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(file_name, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(data->'datosGenerales'->>'tipoContrato', '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(data->'datosGenerales'->>'procedimiento', '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(data->'metadata'->>'cliente', '')), 'B')
  ) stored;

-- 2. GIN index for fast full-text search
create index if not exists licitaciones_search_vector_idx
  on public.licitaciones using gin (search_vector);

-- 3. Create a search function that combines FTS ranking with partial ILIKE matching
-- This allows both exact word matches (via tsvector) and partial string matches
create or replace function public.search_licitaciones(
  search_query text,
  user_id_param uuid default auth.uid()
)
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
security definer
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
  where l.user_id = user_id_param
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

-- Grant execute to authenticated users
grant execute on function public.search_licitaciones(text, uuid) to authenticated;

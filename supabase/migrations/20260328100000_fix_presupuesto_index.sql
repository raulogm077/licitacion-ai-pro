-- Fix presupuesto index for TrackedField format
-- presupuesto is now { value: number, status: string, ... } instead of a raw number
drop index if exists licitaciones_presupuesto_idx;

create index licitaciones_presupuesto_idx on public.licitaciones
  ((cast(data->'datosGenerales'->'presupuesto'->>'value' as numeric)));

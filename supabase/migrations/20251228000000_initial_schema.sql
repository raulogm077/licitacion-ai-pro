-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: licitaciones
create table public.licitaciones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null default auth.uid(),
  hash text not null,
  file_name text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint licitaciones_user_hash_key unique(user_id, hash)
);

-- RLS Policies
alter table public.licitaciones enable row level security;

create policy "Users can view their own data" on public.licitaciones
  for select using (auth.uid() = user_id);

create policy "Users can insert their own data" on public.licitaciones
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own data" on public.licitaciones
  for update using (auth.uid() = user_id);

create policy "Users can delete their own data" on public.licitaciones
  for delete using (auth.uid() = user_id);

-- Performance Indexes
create index licitaciones_tags_idx on public.licitaciones using gin ((data->'metadata'->'tags'));
create index licitaciones_presupuesto_idx on public.licitaciones ((cast(data->'datosGenerales'->>'presupuesto' as numeric)));
create index licitaciones_cliente_idx on public.licitaciones ((data->'metadata'->>'cliente'));
create index licitaciones_estado_idx on public.licitaciones ((data->'metadata'->>'estado'));

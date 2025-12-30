-- Create analysis_jobs table for async processing
create table if not exists analysis_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    status text check (status in ('pending', 'processing', 'completed', 'failed')) not null default 'pending',
    result jsonb,
    error text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS
alter table analysis_jobs enable row level security;

-- Policies
create policy "Users can view their own jobs"
    on analysis_jobs for select
    using (auth.uid() = user_id);

create policy "Users can create their own jobs"
    on analysis_jobs for insert
    with check (auth.uid() = user_id);

-- Service Role (Edge Function) can do everything
-- Note: Service Role bypasses RLS by default, but explicitly allowing it ensures clarity if roles change
-- For now, relying on Service Role bypass.

-- Create Update Function for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_analysis_jobs_updated_at
    before update on analysis_jobs
    for each row
    execute function update_updated_at_column();

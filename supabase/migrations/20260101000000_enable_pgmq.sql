-- Enable pgmq extension for message queue
create extension if not exists pgmq;

-- Create analysis queue for PDF processing jobs
select pgmq.create('analysis_queue');

-- Grant permissions to authenticated users (for enqueue from Edge Functions)
grant usage on schema pgmq_public to authenticated;
grant execute on function pgmq_public.send(text, jsonb, integer) to authenticated;
grant execute on function pgmq_public.send(text, jsonb) to authenticated;

-- Grant permissions to service role (for dequeue/archive/read operations)
grant execute on all functions in schema pgmq_public to service_role;

-- Create index for faster queue operations
create index if not exists idx_analysis_queue_vt on pgmq_public.analysis_queue(vt);

-- Enable pg_net extension for HTTP requests from pg_cron
create extension if not exists pg_net;

-- Comment for documentation
comment on schema pgmq_public is 'Public schema for PGMQ message queue operations';
comment on table pgmq_public.analysis_queue is 'Queue for async PDF analysis jobs';

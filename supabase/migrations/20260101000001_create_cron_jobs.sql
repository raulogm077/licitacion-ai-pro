-- Create pg_cron jobs for async queue processing
-- Note: Replace PROJECT_REF and SERVICE_ROLE_KEY with actual values before deployment

-- Get current Supabase project URL for HTTP calls
-- The function URL format is: https://PROJECT_REF.supabase.co/functions/v1/queue-processor

-- Job 1: Process queue every 30 seconds
-- Dequeues messages and starts OpenAI processing
select cron.schedule(
    'process-analysis-queue',
    '*/30 * * * * *', -- Every 30 seconds (cron with seconds support)
    $$
    select net.http_post(
        url := current_setting('app.settings.project_url') || '/functions/v1/queue-processor',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('action', 'process')
    );
    $$
);

-- Job 2: Sync OpenAI runs every 60 seconds  
-- Checks status of running OpenAI jobs and updates completion
select cron.schedule(
    'sync-openai-runs',
    '*/60 * * * * *', -- Every 60 seconds
    $$
    select net.http_post(
        url := current_setting('app.settings.project_url') || '/functions/v1/queue-processor',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('action', 'sync')
    );
    $$
);

-- Setup: Store project URL and service role key as settings
-- These should be configured via Supabase dashboard or SQL after deployment
-- Example:
-- ALTER DATABASE postgres SET app.settings.project_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Verify cron jobs are created
select jobid, schedule, command 
from cron.job 
where jobname in ('process-analysis-queue', 'sync-openai-runs');

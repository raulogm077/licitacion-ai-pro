-- Durable RPCs run as SECURITY INVOKER under service_role. Keep the queue
-- private from browser roles while allowing the backend to manage message
-- visibility, archival and dead-letter publication through pgmq's API.
GRANT USAGE ON SCHEMA pgmq TO service_role;

GRANT EXECUTE ON FUNCTION pgmq.set_vt(text, bigint, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION pgmq.archive(text, bigint)
    TO service_role;
GRANT EXECUTE ON FUNCTION pgmq.send(text, jsonb)
    TO service_role;

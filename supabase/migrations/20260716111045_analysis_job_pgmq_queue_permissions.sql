-- pgmq functions are SECURITY INVOKER and operate on dynamically selected
-- queue tables. These grants are limited to the trusted backend role and to
-- the exact relations needed by claim, retry, completion and dead-lettering.
GRANT SELECT, UPDATE, DELETE
    ON TABLE pgmq.q_analysis_steps
    TO service_role;

GRANT SELECT, INSERT
    ON TABLE pgmq.a_analysis_steps
    TO service_role;

GRANT SELECT, INSERT
    ON TABLE pgmq.q_analysis_steps_dead_letter
    TO service_role;

GRANT USAGE, SELECT
    ON SEQUENCE pgmq.q_analysis_steps_dead_letter_msg_id_seq
    TO service_role;

-- pgmq.send(text, jsonb) delegates to this overload as the invoker.
GRANT EXECUTE ON FUNCTION pgmq.send(text, jsonb, jsonb, timestamp with time zone)
    TO service_role;

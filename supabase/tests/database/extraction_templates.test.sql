BEGIN;
SELECT plan(6);

-- 1. Check if table exists
SELECT has_table('public', 'extraction_templates', 'Table extraction_templates should exist');

-- 2. Check if columns exist
SELECT has_column('public', 'extraction_templates', 'id', 'id should exist');
SELECT has_column('public', 'extraction_templates', 'user_id', 'user_id should exist');
SELECT has_column('public', 'extraction_templates', 'schema', 'schema should exist');

-- 3. Check if RLS is enabled
SELECT is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'extraction_templates'),
    true,
    'RLS should be enabled on extraction_templates'
);

-- 4. Check policy existence
SELECT policies_are(
    'public',
    'extraction_templates',
    ARRAY['Users can manage their own templates'],
    'Policy "Users can manage their own templates" should exist'
);

SELECT * FROM finish();
ROLLBACK;

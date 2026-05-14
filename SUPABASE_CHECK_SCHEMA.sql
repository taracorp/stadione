-- Check and fix app_roles table schema
-- Get column info
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'app_roles' AND table_schema = 'public' 
ORDER BY ordinal_position;

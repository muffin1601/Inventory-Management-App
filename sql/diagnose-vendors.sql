-- DIAGNOSTIC: Check vendors table columns
-- Run this first to see what columns actually exist

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'vendors'
ORDER BY ordinal_position;

-- Then run this to check for constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'vendors';

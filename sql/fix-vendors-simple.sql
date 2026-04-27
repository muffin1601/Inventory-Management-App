-- SIMPLE FIX: Add only missing columns to vendors table
-- Run this if create-missing-tables.sql didn't work

BEGIN;

-- Add the columns one by one
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.vendors  
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Add status column without constraint (constraint may already exist)
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

COMMIT;

-- Verify the fix
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'vendors'
  AND column_name IN ('address', 'city', 'delivery_address', 'status')
ORDER BY column_name;

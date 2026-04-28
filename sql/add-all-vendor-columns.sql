-- Add ALL missing columns to vendors table
-- This ensures vendors table matches the schema

BEGIN;

-- Add contact information columns
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add other columns that might be missing
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Ensure payment_terms exists
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Ensure is_active exists with proper default
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add status column for vendor status tracking
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- Add timestamps if missing
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMIT;

-- Verify all columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'vendors'
ORDER BY ordinal_position;

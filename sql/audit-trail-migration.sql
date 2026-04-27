-- Migration to add performed_by_name column to audit_trail table
-- Run this after updating the database schema

-- Add the new column
ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS performed_by_name TEXT;

-- Update existing records to populate performed_by_name from user_profiles
UPDATE public.audit_trail
SET performed_by_name = COALESCE(up.full_name, up.email, 'System')
FROM public.user_profiles up
WHERE audit_trail.performed_by = up.id;

-- Update any remaining records without a performed_by_name
UPDATE public.audit_trail
SET performed_by_name = 'System'
WHERE performed_by_name IS NULL;

-- Make performed_by_name NOT NULL for future records
ALTER TABLE public.audit_trail ALTER COLUMN performed_by_name SET NOT NULL;
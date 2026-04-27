-- Verify vendors table has all required columns
-- Run this in Supabase SQL Editor to check what columns exist

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'vendors' 
ORDER BY ordinal_position;

-- You should see these columns:
-- id, name, contact_person, email, phone, address, gst_number, payment_terms, is_active, city, delivery_address, status, created_at, updated_at

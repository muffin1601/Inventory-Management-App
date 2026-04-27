

-- 1. Add missing columns to purchase_orders table
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS delivery_address TEXT COMMENT 'Delivery address for the order',
ADD COLUMN IF NOT EXISTS payment_terms TEXT COMMENT 'Payment terms e.g., Net 30, COD',
ADD COLUMN IF NOT EXISTS notes TEXT COMMENT 'Additional notes about the order';

-- 2. Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
AND column_name IN ('delivery_address', 'payment_terms', 'notes')
ORDER BY column_name;

-- 3. Show the complete purchase_orders structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- 4. Verify purchase_order_items table exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_order_items'
ORDER BY ordinal_position;

-- 5. Add performed_by_name column to audit_trail table
ALTER TABLE public.audit_trail
ADD COLUMN IF NOT EXISTS performed_by_name TEXT COMMENT 'Name of the user who performed the action';

-- 6. Verify the performed_by_name column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_trail'
AND column_name = 'performed_by_name';

-- 7. Show the complete audit_trail structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_trail'
ORDER BY ordinal_position;

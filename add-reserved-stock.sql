-- Add reserved (promised) stock column to inventory table
-- This column tracks stock that has been promised/reserved via BOQ items

BEGIN;

-- Add reserved column if it doesn't exist
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS reserved DECIMAL(15,3) NOT NULL DEFAULT 0;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_inventory_reserved ON public.inventory(reserved);

-- Ensure quantity and reserved are always non-negative
ALTER TABLE public.inventory
ADD CONSTRAINT check_inventory_quantity_non_negative CHECK (quantity >= 0),
ADD CONSTRAINT check_inventory_reserved_non_negative CHECK (reserved >= 0);

COMMIT;

-- SQL to fix ambiguous relationship and ensure stock_movements table
-- 1. Explicitly name foreign keys for easier reference (Optional but good practice)
-- If your foreign keys are not already named correctly, you can rename them:
-- ALTER TABLE product_components RENAME CONSTRAINT product_components_parent_variant_id_fkey TO product_components_parent_variant_id_fkey;
-- ALTER TABLE product_components RENAME CONSTRAINT product_components_component_variant_id_fkey TO product_components_component_variant_id_fkey;

-- 2. Ensure stock_movements table exists for full audit trail
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER')),
  quantity NUMERIC NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Create policies for stock_movements
CREATE POLICY "Allow authenticated select on stock_movements" 
ON stock_movements FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated insert on stock_movements" 
ON stock_movements FOR INSERT 
TO authenticated 
WITH CHECK (true);

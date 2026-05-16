-- SQL Migration to support SET sub-items (components)
CREATE TABLE IF NOT EXISTS product_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  component_variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_variant_id, component_variant_id)
);

-- Enable RLS for the new table
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

-- Create policies for product_components
CREATE POLICY "Allow authenticated select on product_components" 
ON product_components FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated insert on product_components" 
ON product_components FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on product_components" 
ON product_components FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated delete on product_components" 
ON product_components FOR DELETE 
TO authenticated 
USING (true);

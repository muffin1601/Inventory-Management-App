CREATE TABLE IF NOT EXISTS public.app_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('UNIT', 'REASON')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type, value)
);

CREATE INDEX IF NOT EXISTS idx_app_options_type ON public.app_options(type);

ALTER TABLE public.app_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view app options" ON public.app_options;
CREATE POLICY "Authenticated users can view app options" ON public.app_options
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authorized users can manage app options" ON public.app_options;
CREATE POLICY "Authorized users can manage app options" ON public.app_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (
        r.id IN ('r1', 'r2', 'r4')
        OR 'inventory.adjust' = ANY(r.permission_keys)
        OR 'products.edit' = ANY(r.permission_keys)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (
        r.id IN ('r1', 'r2', 'r4')
        OR 'inventory.adjust' = ANY(r.permission_keys)
        OR 'products.edit' = ANY(r.permission_keys)
      )
    )
  );

DROP TRIGGER IF EXISTS update_app_options_updated_at ON public.app_options;
CREATE TRIGGER update_app_options_updated_at
  BEFORE UPDATE ON public.app_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.app_options (type, value) VALUES
  ('UNIT', 'Numbers'),
  ('UNIT', 'Pcs'),
  ('UNIT', 'Pieces'),
  ('UNIT', 'Sets'),
  ('UNIT', 'Boxes'),
  ('UNIT', 'Bags'),
  ('UNIT', 'Kilograms'),
  ('UNIT', 'Liters'),
  ('UNIT', 'Meters'),
  ('UNIT', 'Square Feet'),
  ('UNIT', 'Square Meter'),
  ('UNIT', 'Tons'),
  ('REASON', 'Cycle Count'),
  ('REASON', 'Stock Correction'),
  ('REASON', 'Damaged Goods'),
  ('REASON', 'Supplier Return'),
  ('REASON', 'Customer Allocation'),
  ('REASON', 'Warehouse Reallocation'),
  ('REASON', 'Data Cleanup'),
  ('REASON', 'Obsolete Item'),
  ('REASON', 'Goods Received'),
  ('REASON', 'Goods Issued'),
  ('REASON', 'Warehouse Transfer')
ON CONFLICT (type, value) DO NOTHING;

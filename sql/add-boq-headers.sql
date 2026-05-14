-- Persist BOQ section headers so they are visible in production and across users.

CREATE TABLE IF NOT EXISTS public.boq_headers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.project_orders(id) ON DELETE CASCADE,
  after_index INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boq_headers_project_id ON public.boq_headers(project_id);
CREATE INDEX IF NOT EXISTS idx_boq_headers_order_id ON public.boq_headers(order_id);

ALTER TABLE public.boq_headers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view BOQ headers" ON public.boq_headers;
CREATE POLICY "Authenticated users can view BOQ headers" ON public.boq_headers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authorized users can manage BOQ headers" ON public.boq_headers;
CREATE POLICY "Authorized users can manage BOQ headers" ON public.boq_headers
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2') OR 'boq.create' = ANY(r.permission_keys) OR 'boq.edit' = ANY(r.permission_keys))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2') OR 'boq.create' = ANY(r.permission_keys) OR 'boq.edit' = ANY(r.permission_keys))
    )
  );

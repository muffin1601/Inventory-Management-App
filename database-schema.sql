-- Production-ready user management schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS auth.users ENABLE ROW LEVEL SECURITY;

-- Create custom user profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id TEXT NOT NULL DEFAULT 'r6', -- Default to 'Viewer'
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  custom_permission_keys TEXT[] DEFAULT '{}',
  revoked_permission_keys TEXT[] DEFAULT '{}',
  temporary_password TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permission_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit trail table (if not exists)
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  reason TEXT,
  performed_by TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO public.roles (id, name, permission_keys) VALUES
  ('r1', 'Super Admin', ARRAY[
    'dashboard.view', 'products.view', 'products.create', 'products.edit', 'products.delete',
    'stock.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
    'boq.view', 'boq.create', 'boq.edit', 'boq.delete',
    'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete',
    'orders.view', 'orders.create', 'orders.approve', 'orders.cancel',
    'challans.view', 'challans.create', 'challans.update_status', 'challans.delete',
    'deliveries.view', 'deliveries.create', 'deliveries.delete',
    'payments.view', 'payments.create', 'payments.edit', 'payments.delete', 'payments.financial_view',
    'rate_inquiry.view', 'rate_inquiry.create',
    'reports.view', 'reports.export',
    'audit.view',
    'users.view', 'users.invite', 'users.edit', 'users.disable', 'roles.manage'
  ]),
  ('r2', 'Admin', ARRAY[
    'dashboard.view', 'products.view', 'products.create', 'products.edit', 'products.delete',
    'stock.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
    'boq.view', 'boq.create', 'boq.edit', 'boq.delete',
    'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete',
    'orders.view', 'orders.create', 'orders.approve', 'orders.cancel',
    'challans.view', 'challans.create', 'challans.update_status', 'challans.delete',
    'deliveries.view', 'deliveries.create', 'deliveries.delete',
    'payments.view', 'payments.create', 'payments.edit', 'payments.delete', 'payments.financial_view',
    'rate_inquiry.view', 'rate_inquiry.create',
    'reports.view', 'reports.export',
    'audit.view',
    'users.view', 'users.invite', 'users.edit', 'users.disable', 'roles.manage'
  ]),
  ('r3', 'Purchase Manager', ARRAY[
    'dashboard.view', 'products.view', 'projects.view', 'boq.view',
    'vendors.view', 'vendors.create', 'vendors.edit',
    'orders.view', 'orders.create', 'orders.approve',
    'challans.view', 'deliveries.view', 'payments.view', 'payments.financial_view',
    'rate_inquiry.view', 'rate_inquiry.create',
    'reports.view', 'reports.export', 'audit.view'
  ]),
  ('r4', 'Store Manager', ARRAY[
    'dashboard.view', 'products.view', 'stock.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'projects.view', 'boq.view', 'orders.view', 'challans.view', 'challans.create', 'challans.update_status',
    'deliveries.view', 'deliveries.create', 'reports.view', 'audit.view'
  ]),
  ('r5', 'Accounts', ARRAY[
    'dashboard.view', 'vendors.view', 'orders.view', 'deliveries.view',
    'payments.view', 'payments.create', 'payments.edit', 'payments.financial_view',
    'reports.view', 'reports.export', 'audit.view'
  ]),
  ('r6', 'Viewer', ARRAY[
    'dashboard.view', 'products.view', 'stock.view', 'inventory.view',
    'projects.view', 'boq.view', 'vendors.view', 'orders.view',
    'challans.view', 'deliveries.view', 'payments.view',
    'reports.view', 'audit.view'
  ])
ON CONFLICT (id) DO NOTHING;

-- Create default admin user (you'll need to create this via Supabase Auth first)
-- This will be handled by the migration script

-- Enable RLS policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

-- RLS Policies for roles
CREATE POLICY "Authenticated users can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

-- RLS Policies for audit_trail
CREATE POLICY "Authenticated users can view audit trail" ON public.audit_trail
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert audit trail" ON public.audit_trail
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_id ON public.user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_type ON public.audit_trail(entity_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
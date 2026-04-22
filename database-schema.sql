
DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS public.user_activity_log CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.audit_trail CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- ============================================================================
-- STEP 2: CREATE ROLES TABLE
-- ============================================================================
CREATE TABLE public.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permission_keys TEXT[] NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: CREATE PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE public.permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  is_admin_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: CREATE USER PROFILES TABLE
-- ============================================================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id TEXT NOT NULL REFERENCES public.roles(id) DEFAULT 'r6',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'PENDING')),
  custom_permission_keys TEXT[] DEFAULT '{}',
  revoked_permission_keys TEXT[] DEFAULT '{}',
  phone_number TEXT,
  department TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  requires_password_change BOOLEAN DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: CREATE USER SESSIONS TABLE
-- ============================================================================
CREATE TABLE public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: CREATE USER ACTIVITY LOG TABLE
-- ============================================================================
CREATE TABLE public.user_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 7: CREATE AUDIT TRAIL TABLE
-- ============================================================================
CREATE TABLE public.audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  reason TEXT,
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  details TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_id ON public.user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON public.user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_type ON public.audit_trail(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at);

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

-- ============================================================================
-- STEP 8: AUTO-CREATE user_profiles ON AUTH SIGNUP
-- ============================================================================
-- If an auth user exists without a matching row in public.user_profiles,
-- the app will not be able to resolve role/permission data at login.
-- This trigger creates a default profile row for every new auth.users record.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    full_name,
    email,
    role_id,
    status,
    custom_permission_keys,
    revoked_permission_keys,
    is_admin,
    requires_password_change,
    last_active_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'r6',
    'ACTIVE',
    '{}',
    '{}',
    FALSE,
    FALSE,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- INVENTORY MANAGEMENT TABLES
-- ============================================================================

-- Products table
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT,
  attributes JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants table
CREATE TABLE public.variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table (current stock levels)
CREATE TABLE public.inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(15,3) DEFAULT 0,
  max_stock DECIMAL(15,3),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variant_id, warehouse_id)
);

-- Stock movements table
CREATE TABLE public.stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  quantity DECIMAL(15,3) NOT NULL,
  reference_type TEXT, -- 'ORDER', 'CHALLAN', 'RECEIPT', etc.
  reference_id TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  gst_number TEXT,
  payment_terms TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED')),
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id),
  project_id UUID REFERENCES public.projects(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'CANCELLED')),
  delivery_address TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id),
  approved_by UUID REFERENCES public.user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase order items table
CREATE TABLE public.purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.variants(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2),
  gst_rate DECIMAL(5,2) DEFAULT 18,
  gst_amount DECIMAL(15,2),
  total_price DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challans table
CREATE TABLE public.challans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challan_no TEXT NOT NULL UNIQUE,
  po_no TEXT,
  project_id UUID REFERENCES public.projects(id),
  vendor_id UUID REFERENCES public.vendors(id),
  dispatch_date DATE NOT NULL,
  status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'DISPATCHED', 'DELIVERED')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challan items table
CREATE TABLE public.challan_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challan_id UUID NOT NULL REFERENCES public.challans(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.variants(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery receipts table
CREATE TABLE public.delivery_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'SITE_DELIVERY' CHECK (type IN ('SITE_DELIVERY', 'STORE_DELIVERY')),
  date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  linked_po TEXT,
  receiver_name TEXT,
  contact TEXT,
  vendor_id UUID REFERENCES public.vendors(id),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('VERIFIED', 'PENDING', 'DAMAGED')),
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy receipts table (for backward compatibility)
CREATE TABLE public.receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'SITE_DELIVERY' CHECK (type IN ('SITE_DELIVERY', 'STORE_DELIVERY')),
  date DATE NOT NULL,
  project_name TEXT,
  linked_po TEXT,
  receiver_name TEXT,
  contact TEXT,
  vendor_name TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('VERIFIED', 'PENDING', 'DAMAGED')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery receipt items table
CREATE TABLE public.delivery_receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.delivery_receipts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.variants(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit TEXT,
  condition TEXT DEFAULT 'GOOD' CHECK (condition IN ('GOOD', 'DAMAGED', 'SHORTAGE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment slips table
CREATE TABLE public.payment_slips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slip_no TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  due_date DATE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  po_ref TEXT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI')),
  ref_no TEXT,
  prepared_by UUID NOT NULL REFERENCES public.user_profiles(id),
  status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'DUE', 'PAID')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy payments table (for backward compatibility)
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slip_no TEXT,
  date DATE NOT NULL,
  due_date DATE,
  vendor_name TEXT NOT NULL,
  po_ref TEXT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI')),
  ref_no TEXT,
  prepared_by TEXT NOT NULL,
  status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'DUE', 'PAID')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR INVENTORY TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON public.variants(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON public.inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON public.inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON public.stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(name);
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id ON public.purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_challans_po_no ON public.challans(po_no);
CREATE INDEX IF NOT EXISTS idx_challans_status ON public.challans(status);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan_id ON public.challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_date ON public.delivery_receipts(date);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_status ON public.delivery_receipts(status);
CREATE INDEX IF NOT EXISTS idx_delivery_receipt_items_receipt_id ON public.delivery_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);
CREATE INDEX IF NOT EXISTS idx_payment_slips_vendor_id ON public.payment_slips(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_slips_date ON public.payment_slips(date);
CREATE INDEX IF NOT EXISTS idx_payment_slips_status ON public.payment_slips(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================================================
-- RLS POLICIES FOR INVENTORY TABLES
-- ============================================================================

-- Enable RLS on all inventory tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

-- Variants policies
CREATE POLICY "Authenticated users can view variants" ON public.variants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage variants" ON public.variants
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

-- Warehouses policies
CREATE POLICY "Authenticated users can view warehouses" ON public.warehouses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage warehouses" ON public.warehouses
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND r.id IN ('r1', 'r2') -- Super Admin and Admin
    )
  );

-- Inventory policies
CREATE POLICY "Authenticated users can view inventory" ON public.inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage inventory" ON public.inventory
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'inventory.adjust' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Stock movements policies
CREATE POLICY "Authenticated users can view stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can create stock movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'inventory.adjust' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Vendors policies
CREATE POLICY "Authenticated users can view vendors" ON public.vendors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage vendors" ON public.vendors
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r3') OR 'vendors.create' = ANY(r.permission_keys)) -- Admin, Purchase Manager
    )
  );

-- Projects policies
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage projects" ON public.projects
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2') OR 'projects.create' = ANY(r.permission_keys)) -- Admin
    )
  );

-- Purchase orders policies
CREATE POLICY "Authenticated users can view purchase orders" ON public.purchase_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage purchase orders" ON public.purchase_orders
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r3') OR 'orders.create' = ANY(r.permission_keys)) -- Admin, Purchase Manager
    )
  );

-- Purchase order items policies
CREATE POLICY "Authenticated users can view purchase order items" ON public.purchase_order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage purchase order items" ON public.purchase_order_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r3') OR 'orders.create' = ANY(r.permission_keys)) -- Admin, Purchase Manager
    )
  );

-- Challans policies
CREATE POLICY "Authenticated users can view challans" ON public.challans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage challans" ON public.challans
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'challans.create' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Challan items policies
CREATE POLICY "Authenticated users can view challan items" ON public.challan_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage challan items" ON public.challan_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'challans.create' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Delivery receipts policies
CREATE POLICY "Authenticated users can view delivery receipts" ON public.delivery_receipts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage delivery receipts" ON public.delivery_receipts
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'deliveries.create' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Legacy receipts policies
CREATE POLICY "Authenticated users can view receipts" ON public.receipts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage receipts" ON public.receipts
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'deliveries.create' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Delivery receipt items policies
CREATE POLICY "Authenticated users can view delivery receipt items" ON public.delivery_receipt_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage delivery receipt items" ON public.delivery_receipt_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r4') OR 'deliveries.create' = ANY(r.permission_keys)) -- Admin, Store Manager
    )
  );

-- Payment slips policies
CREATE POLICY "Authenticated users can view payment slips" ON public.payment_slips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage payment slips" ON public.payment_slips
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r5') OR 'payments.create' = ANY(r.permission_keys)) -- Admin, Accounts
    )
  );

-- Legacy payments policies
CREATE POLICY "Authenticated users can view payments" ON public.payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage payments" ON public.payments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.id = auth.uid()
      AND (r.id IN ('r1', 'r2', 'r5') OR 'payments.create' = ANY(r.permission_keys)) -- Admin, Accounts
    )
  );

-- ============================================================================
-- UPDATE TRIGGERS FOR INVENTORY TABLES
-- ============================================================================

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON public.variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challans_updated_at
  BEFORE UPDATE ON public.challans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_receipts_updated_at
  BEFORE UPDATE ON public.delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_slips_updated_at
  BEFORE UPDATE ON public.payment_slips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default warehouse
INSERT INTO public.warehouses (name, location) VALUES
  ('Main Warehouse', 'Company Headquarters')
ON CONFLICT DO NOTHING;

-- Insert sample products and variants (optional - for testing)
-- These can be removed in production
INSERT INTO public.products (name, description, category, unit, attributes) VALUES
  ('Cement', 'Portland Cement 53 Grade', 'Construction Materials', 'Bags', '{"brand": "ACC", "grade": "53"}'),
  ('Steel Bars', 'TMT Steel Bars', 'Construction Materials', 'Ton', '{"grade": "Fe500", "diameter": "12mm"}'),
  ('Sand', 'River Sand', 'Construction Materials', 'Cubic Meter', '{"type": "river"}')
ON CONFLICT DO NOTHING;

-- Insert variants for the products
INSERT INTO public.variants (product_id, sku, attributes)
SELECT 
  p.id,
  CASE 
    WHEN p.name = 'Cement' THEN 'CEM-ACC-53-50KG'
    WHEN p.name = 'Steel Bars' THEN 'STL-TMT-500-12MM'
    WHEN p.name = 'Sand' THEN 'SND-RIVER-FINE'
  END,
  p.attributes
FROM public.products p
WHERE p.name IN ('Cement', 'Steel Bars', 'Sand')
ON CONFLICT DO NOTHING;
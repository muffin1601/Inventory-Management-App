-- Create missing tables in Supabase
-- This ensures all required tables exist with proper schema

BEGIN;

-- ============================================================================
-- 1. CREATE APP_OPTIONS TABLE (completely missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, value)
);

CREATE INDEX IF NOT EXISTS idx_app_options_type ON public.app_options(type);
CREATE INDEX IF NOT EXISTS idx_app_options_value ON public.app_options(value);

-- ============================================================================
-- 2. ENSURE PAYMENT_SLIPS TABLE EXISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_slips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slip_no TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  due_date DATE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  po_ref TEXT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI')),
  ref_no TEXT,
  prepared_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'DUE', 'PAID')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_slips_vendor_id ON public.payment_slips(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_slips_date ON public.payment_slips(date);
CREATE INDEX IF NOT EXISTS idx_payment_slips_status ON public.payment_slips(status);

-- ============================================================================
-- 3. ENSURE DELIVERY_RECEIPTS TABLE EXISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'SITE_DELIVERY' CHECK (type IN ('SITE_DELIVERY', 'STORE_DELIVERY')),
  date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  linked_po TEXT,
  receiver_name TEXT,
  contact TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('VERIFIED', 'PENDING', 'DAMAGED')),
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_receipts_date ON public.delivery_receipts(date);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_status ON public.delivery_receipts(status);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_project_id ON public.delivery_receipts(project_id);

-- ============================================================================
-- 4. ENSURE DELIVERY_RECEIPT_ITEMS TABLE EXISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.delivery_receipts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE RESTRICT,
  quantity DECIMAL(15,3) NOT NULL,
  unit TEXT,
  condition TEXT DEFAULT 'GOOD' CHECK (condition IN ('GOOD', 'DAMAGED', 'SHORTAGE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_receipt_items_receipt_id ON public.delivery_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipt_items_variant_id ON public.delivery_receipt_items(variant_id);

-- ============================================================================
-- 5. ENSURE RECEIPTS TABLE EXISTS (legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receipts (
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

CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);

-- ============================================================================
-- 6. ADD MISSING COLUMNS TO VENDORS TABLE
-- ============================================================================
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- ============================================================================
-- 7. ENABLE RLS AND SET POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE public.app_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies for app_options
DROP POLICY IF EXISTS app_options_select_policy ON public.app_options;
CREATE POLICY app_options_select_policy ON public.app_options FOR SELECT USING (true);

DROP POLICY IF EXISTS app_options_insert_policy ON public.app_options;
CREATE POLICY app_options_insert_policy ON public.app_options FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS app_options_update_policy ON public.app_options;
CREATE POLICY app_options_update_policy ON public.app_options FOR UPDATE USING (true);

-- Create permissive RLS policies for payment_slips
DROP POLICY IF EXISTS payment_slips_select_policy ON public.payment_slips;
CREATE POLICY payment_slips_select_policy ON public.payment_slips FOR SELECT USING (true);

DROP POLICY IF EXISTS payment_slips_insert_policy ON public.payment_slips;
CREATE POLICY payment_slips_insert_policy ON public.payment_slips FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS payment_slips_update_policy ON public.payment_slips;
CREATE POLICY payment_slips_update_policy ON public.payment_slips FOR UPDATE USING (true);

-- Create permissive RLS policies for delivery_receipts
DROP POLICY IF EXISTS delivery_receipts_select_policy ON public.delivery_receipts;
CREATE POLICY delivery_receipts_select_policy ON public.delivery_receipts FOR SELECT USING (true);

DROP POLICY IF EXISTS delivery_receipts_insert_policy ON public.delivery_receipts;
CREATE POLICY delivery_receipts_insert_policy ON public.delivery_receipts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS delivery_receipts_update_policy ON public.delivery_receipts;
CREATE POLICY delivery_receipts_update_policy ON public.delivery_receipts FOR UPDATE USING (true);

-- Create permissive RLS policies for delivery_receipt_items
DROP POLICY IF EXISTS delivery_receipt_items_select_policy ON public.delivery_receipt_items;
CREATE POLICY delivery_receipt_items_select_policy ON public.delivery_receipt_items FOR SELECT USING (true);

DROP POLICY IF EXISTS delivery_receipt_items_insert_policy ON public.delivery_receipt_items;
CREATE POLICY delivery_receipt_items_insert_policy ON public.delivery_receipt_items FOR INSERT WITH CHECK (true);

-- Create permissive RLS policies for receipts
DROP POLICY IF EXISTS receipts_select_policy ON public.receipts;
CREATE POLICY receipts_select_policy ON public.receipts FOR SELECT USING (true);

DROP POLICY IF EXISTS receipts_insert_policy ON public.receipts;
CREATE POLICY receipts_insert_policy ON public.receipts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS receipts_update_policy ON public.receipts;
CREATE POLICY receipts_update_policy ON public.receipts FOR UPDATE USING (true);

COMMIT;

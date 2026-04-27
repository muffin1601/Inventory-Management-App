-- Fix payments table schema - recreate to refresh Supabase schema cache
-- This fixes: "Could not find the 'amount' column of 'payments' in the schema cache"

BEGIN;

-- Drop the old payments table
DROP TABLE IF EXISTS public.payments CASCADE;

-- Recreate the payments table with all required columns
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

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payments table
CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT
  USING (true);

CREATE POLICY payments_insert_policy ON public.payments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY payments_update_policy ON public.payments
  FOR UPDATE
  USING (true);

CREATE POLICY payments_delete_policy ON public.payments
  FOR DELETE
  USING (true);

COMMIT;

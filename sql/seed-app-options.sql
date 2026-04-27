-- Seed data for app_options table
-- This populates the common options used by the application

BEGIN;

-- UNIT types (for inventory items)
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('UNIT', 'KG', 'Kilogram', 1, true),
  ('UNIT', 'METER', 'Meter', 2, true),
  ('UNIT', 'PIECE', 'Piece', 3, true),
  ('UNIT', 'BOX', 'Box', 4, true),
  ('UNIT', 'LITER', 'Liter', 5, true),
  ('UNIT', 'ROLL', 'Roll', 6, true),
  ('UNIT', 'SET', 'Set', 7, true),
  ('UNIT', 'SHEET', 'Sheet', 8, true),
  ('UNIT', 'SQUARE_METER', 'Square Meter', 9, true),
  ('UNIT', 'CUBIC_METER', 'Cubic Meter', 10, true)
ON CONFLICT (type, value) DO NOTHING;

-- REASON types (for stock movements)
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('REASON', 'STOCK_IN', 'Stock Inward', 1, true),
  ('REASON', 'STOCK_OUT', 'Stock Outward', 2, true),
  ('REASON', 'DAMAGE', 'Damaged Stock', 3, true),
  ('REASON', 'SHORTAGE', 'Stock Shortage', 4, true),
  ('REASON', 'ADJUSTMENT', 'Stock Adjustment', 5, true),
  ('REASON', 'USAGE', 'Site Usage', 6, true),
  ('REASON', 'RETURN', 'Material Return', 7, true),
  ('REASON', 'SCRAP', 'Scrap/Wastage', 8, true),
  ('REASON', 'TRANSFER', 'Transfer Between Stores', 9, true),
  ('REASON', 'CORRECTION', 'Correction Entry', 10, true)
ON CONFLICT (type, value) DO NOTHING;

-- STATUS types (for various entities)
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('STATUS', 'ACTIVE', 'Active', 1, true),
  ('STATUS', 'INACTIVE', 'Inactive', 2, true),
  ('STATUS', 'PENDING', 'Pending', 3, true),
  ('STATUS', 'APPROVED', 'Approved', 4, true),
  ('STATUS', 'REJECTED', 'Rejected', 5, true),
  ('STATUS', 'COMPLETED', 'Completed', 6, true)
ON CONFLICT (type, value) DO NOTHING;

-- PAYMENT_METHOD types
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('PAYMENT_METHOD', 'BANK_TRANSFER', 'Bank Transfer', 1, true),
  ('PAYMENT_METHOD', 'CASH', 'Cash', 2, true),
  ('PAYMENT_METHOD', 'CHEQUE', 'Cheque', 3, true),
  ('PAYMENT_METHOD', 'UPI', 'UPI', 4, true),
  ('PAYMENT_METHOD', 'CREDIT_CARD', 'Credit Card', 5, true),
  ('PAYMENT_METHOD', 'NEFT', 'NEFT', 6, true)
ON CONFLICT (type, value) DO NOTHING;

-- DELIVERY_TYPE types
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('DELIVERY_TYPE', 'SITE_DELIVERY', 'Site Delivery', 1, true),
  ('DELIVERY_TYPE', 'STORE_DELIVERY', 'Store Delivery', 2, true)
ON CONFLICT (type, value) DO NOTHING;

-- CONDITION types (for receipts)
INSERT INTO public.app_options (type, value, description, display_order, is_active)
VALUES 
  ('CONDITION', 'GOOD', 'Good Condition', 1, true),
  ('CONDITION', 'DAMAGED', 'Damaged', 2, true),
  ('CONDITION', 'SHORTAGE', 'Shortage', 3, true)
ON CONFLICT (type, value) DO NOTHING;

COMMIT;

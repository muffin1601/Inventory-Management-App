-- Link dispatch challan rows to exact BOQ and stock rows.
-- Run this once on existing databases before relying on exact BOQ delivered sync.

ALTER TABLE public.challan_items
  ADD COLUMN IF NOT EXISTS boq_item_id UUID REFERENCES public.boq_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

ALTER TABLE public.challan_items
  ADD COLUMN IF NOT EXISTS name TEXT;

CREATE INDEX IF NOT EXISTS idx_challan_items_boq_item_id ON public.challan_items(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_variant_warehouse ON public.challan_items(variant_id, warehouse_id);

export interface Product {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  barcode?: string;
  price: number;
  attributes: Record<string, string>;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AttributeType {
  id: string;
  name: string;
}

export interface AttributeValue {
  id: string;
  attribute_type_id: string;
  value: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

export interface Inventory {
  id: string;
  variant_id: string;
  warehouse_id: string;
  quantity: number;
  last_updated: string;
}

export interface ProductWithVariants extends Product {
  variants: Variant[];
}

export interface ProductSummary extends Product {
  variant_count: number;
  total_stock: number;
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface InventorySnapshotRow {
  variant_id: string;
  sku: string;
  product_name: string;
  attributes: Record<string, string>;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
}

export interface StockMovementRow {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  type: MovementType;
  quantity: number;
  notes?: string;
  created_at: string;
}

export type OrderType = 'PURCHASE' | 'SALE' | 'RETURN';
export type OrderStatus = 'PENDING' | 'APPROVED' | 'CANCELLED';

export interface OrderLine {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  unit?: string;
  quantity: number;
  price?: number;
  gst_rate?: number;
  gst_amount?: number;
  total_price?: number;
  warehouse_id?: string;
  warehouse_name?: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  type: OrderType;
  vendor_id?: string;
  vendor_name: string;
  project_id?: string;
  project_name?: string;
  items: OrderLine[];
  status: OrderStatus;
  created_at: string;
  created_by: string;
  entity_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  variant_id?: string;
  sku?: string;
  quantity?: number;
  delivery_address?: string;
  payment_terms?: string;
}

export interface PermissionRow {
  id: string;
  key: string;
  label: string;
  module: 'Products' | 'Inventory' | 'Orders' | 'Users' | 'Reports';
}

export interface RoleRow {
  id: string;
  name: string;
  permission_keys: string[];
}

export interface UserAccessRow {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  status: 'ACTIVE' | 'DISABLED';
  custom_permission_keys: string[];
}

export interface AuditTrailRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  reason: string;
  performed_by: string;
  details?: string;
  created_at: string;
}

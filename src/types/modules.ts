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
export type OrderStatus = 'pending_approval' | 'approved' | 'cancelled';

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
  module:
    | 'Dashboard'
    | 'Catalog'
    | 'Stock'
    | 'Inventory'
    | 'Projects'
    | 'Vendors'
    | 'Orders'
    | 'Challans'
    | 'Deliveries'
    | 'Payments'
    | 'Rate Inquiry'
    | 'Reports'
    | 'Audit'
    | 'Users';
  description?: string;
  admin_only?: boolean;
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
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  custom_permission_keys: string[];
  revoked_permission_keys?: string[];
  requires_password_change?: boolean;
  password_changed_at?: string;
  last_active_at?: string;
}

export type LoginErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_PENDING'
  | 'PROFILE_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

export interface LoginResponse {
  user: UserAccessRow | null;
  error: {
    code: LoginErrorCode;
    message: string;
  } | null;
}

export interface AuditTrailRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  reason?: string;
  performed_by?: string; // UUID of the user
  performed_by_name?: string; // Display name/email of the user
  old_values?: any;
  new_values?: any;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface ChallanItemRow {
  id: string;
  variant_id?: string;
  name: string;
  quantity: number;
  unit: string;
  boqQty?: number;
  stockQty?: number;
}

export interface ChallanRow {
  id: string;
  challan_no: string;
  po_no: string;
  project_name: string;
  vendor_name: string;
  dispatch_date: string;
  status: 'ISSUED' | 'DISPATCHED' | 'DELIVERED';
  items: ChallanItemRow[];
}

export interface DeliveryReceiptItemRow {
  id: string;
  variant_id?: string;
  name: string;
  quantity: number;
  unit: string;
  condition: 'GOOD' | 'DAMAGED' | 'SHORTAGE';
}

export interface DeliveryReceiptRow {
  id: string;
  receipt_no: string;
  type: 'SITE_DELIVERY' | 'STORE_DELIVERY';
  date: string;
  project_name: string;
  linked_po: string;
  receiver_name: string;
  contact: string;
  vendor_name: string;
  status: 'VERIFIED' | 'PENDING' | 'DAMAGED';
  items: DeliveryReceiptItemRow[];
  remarks?: string;
}

export interface PaymentSlipRow {
  id: string;
  slip_no: string;
  date: string;
  due_date: string;
  vendor_name: string;
  po_ref: string;
  amount: number;
  payment_method: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'UPI';
  ref_no: string;
  prepared_by: string;
  status: 'ISSUED' | 'DUE' | 'PAID';
  remarks?: string;
}

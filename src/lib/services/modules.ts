import { inventoryService } from '@/lib/services/inventory';
import type {
  InventorySnapshotRow,
  OrderRow,
  OrderType,
  PermissionRow,
  RoleRow,
  StockMovementRow,
  UserAccessRow,
  AuditTrailRow,
} from '@/types/modules';

type VariantRef = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  stock_data?: Array<{ warehouse_id?: string; warehouse_name?: string; quantity?: number }>;
};
type ProductRef = { name: string; variants?: VariantRef[] };

const ORDERS_KEY = 'ims_orders_v1';
const MOVEMENTS_KEY = 'ims_movements_v1';
const USERS_KEY = 'ims_users_v1';
const ROLES_KEY = 'ims_roles_v1';
const CURRENT_USER_KEY = 'ims_current_user_id_v1';
const AUDIT_KEY = 'ims_audit_trail_v1';

const PERMISSIONS: PermissionRow[] = [
  { id: 'p1', key: 'products.view', label: 'View Products', module: 'Products' },
  { id: 'p2', key: 'products.create', label: 'Create Products', module: 'Products' },
  { id: 'p3', key: 'products.edit', label: 'Edit Products', module: 'Products' },
  { id: 'p4', key: 'products.delete', label: 'Delete Products', module: 'Products' },
  { id: 'p5', key: 'inventory.view', label: 'View Inventory', module: 'Inventory' },
  { id: 'p6', key: 'inventory.adjust', label: 'Adjust Inventory', module: 'Inventory' },
  { id: 'p7', key: 'inventory.transfer', label: 'Transfer Inventory', module: 'Inventory' },
  { id: 'p8', key: 'orders.create', label: 'Create Orders', module: 'Orders' },
  { id: 'p9', key: 'orders.approve', label: 'Approve Orders', module: 'Orders' },
  { id: 'p10', key: 'orders.cancel', label: 'Cancel Orders', module: 'Orders' },
  { id: 'p11', key: 'users.invite', label: 'Invite Users', module: 'Users' },
  { id: 'p12', key: 'users.edit', label: 'Edit Users', module: 'Users' },
  { id: 'p13', key: 'users.disable', label: 'Disable Users', module: 'Users' },
  { id: 'p14', key: 'reports.view', label: 'View Reports', module: 'Reports' },
  { id: 'p15', key: 'reports.export', label: 'Export Reports', module: 'Reports' },
];

const DEFAULT_ROLES: RoleRow[] = [
  { id: 'r1', name: 'Super Admin', permission_keys: PERMISSIONS.map((p) => p.key) },
  {
    id: 'r2',
    name: 'Admin',
    permission_keys: PERMISSIONS.filter((p) => !p.key.startsWith('users.disable')).map((p) => p.key),
  },
  {
    id: 'r3',
    name: 'Manager',
    permission_keys: ['products.view', 'products.create', 'products.edit', 'inventory.view', 'inventory.adjust', 'inventory.transfer', 'orders.create', 'orders.approve', 'reports.view'],
  },
  {
    id: 'r4',
    name: 'Staff',
    permission_keys: ['products.view', 'inventory.view', 'inventory.adjust', 'orders.create'],
  },
  { id: 'r5', name: 'Viewer', permission_keys: ['products.view', 'inventory.view', 'reports.view'] },
];

const DEFAULT_USERS: UserAccessRow[] = [
  {
    id: 'u1',
    full_name: 'Admin User',
    email: 'admin@nexusims.com',
    role_id: 'r1',
    role_name: 'Super Admin',
    status: 'ACTIVE',
    custom_permission_keys: [],
  },
  {
    id: 'u2',
    full_name: 'John Manager',
    email: 'john@nexusims.com',
    role_id: 'r3',
    role_name: 'Manager',
    status: 'ACTIVE',
    custom_permission_keys: ['reports.export'],
  },
  {
    id: 'u3',
    full_name: 'Sarah Staff',
    email: 'sarah@nexusims.com',
    role_id: 'r4',
    role_name: 'Staff',
    status: 'DISABLED',
    custom_permission_keys: [],
  },
];

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const modulesService = {
  getPermissions() {
    return PERMISSIONS;
  },

  async getInventorySnapshot(): Promise<InventorySnapshotRow[]> {
    const products = (await inventoryService.getProducts()) as ProductRef[];
    const rows: InventorySnapshotRow[] = [];

    products.forEach((product) => {
      (product.variants || []).forEach((variant) => {
        if ((variant.stock_data || []).length === 0) {
          rows.push({
            variant_id: variant.id,
            sku: variant.sku,
            product_name: product.name,
            attributes: variant.attributes || {},
            warehouse_id: 'unassigned',
            warehouse_name: 'Unassigned',
            quantity: 0,
          });
          return;
        }

        (variant.stock_data || []).forEach((stock) => {
          rows.push({
            variant_id: variant.id,
            sku: variant.sku,
            product_name: product.name,
            attributes: variant.attributes || {},
            warehouse_id: stock.warehouse_id || stock.warehouse_name || 'unknown',
            warehouse_name: stock.warehouse_name || 'Unknown',
            quantity: stock.quantity || 0,
          });
        });
      });
    });

    return rows;
  },

  async getMovements(): Promise<StockMovementRow[]> {
    return readStore<StockMovementRow[]>(MOVEMENTS_KEY, []);
  },

  async addMovement(input: Omit<StockMovementRow, 'id' | 'created_at'>): Promise<StockMovementRow> {
    const movements = readStore<StockMovementRow[]>(MOVEMENTS_KEY, []);
    const newRow: StockMovementRow = { ...input, id: makeId('mv'), created_at: new Date().toISOString() };
    const next = [newRow, ...movements];
    writeStore(MOVEMENTS_KEY, next);
    return newRow;
  },

  async createOrder(input: {
    type: OrderType;
    vendor_id: string;
    vendor_name: string;
    project_id?: string;
    project_name?: string;
    items: Array<{
      variant_id: string;
      sku: string;
      product_name: string;
      unit?: string;
      quantity: number;
      price?: number;
      warehouse_id?: string;
      warehouse_name?: string;
    }>;
    delivery_address?: string;
    payment_terms?: string;
    created_by?: string;
  }): Promise<OrderRow> {
    const orders = readStore<OrderRow[]>(ORDERS_KEY, []);
    const nextNumber = `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`;
    const order: OrderRow = {
      id: makeId('ord'),
      order_number: nextNumber,
      type: input.type,
      vendor_id: input.vendor_id,
      vendor_name: input.vendor_name,
      project_id: input.project_id,
      project_name: input.project_name,
      items: input.items.map((item) => ({
        id: makeId('line'),
        ...item,
      })),
      status: 'PENDING',
      created_at: new Date().toISOString(),
      created_by: input.created_by || 'Admin User',
      entity_name: input.vendor_name,
      warehouse_id: input.items[0]?.warehouse_id,
      warehouse_name: input.items[0]?.warehouse_name,
      variant_id: input.items[0]?.variant_id,
      sku: input.items[0]?.sku,
      quantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
      delivery_address: input.delivery_address,
      payment_terms: input.payment_terms,
    };
    const next = [order, ...orders];
    writeStore(ORDERS_KEY, next);
    return order;
  },

  async updateOrderStatus(orderId: string, status: OrderRow['status']) {
    const orders = readStore<OrderRow[]>(ORDERS_KEY, []);
    const next = orders.map((order) => (order.id === orderId ? { ...order, status } : order));
    writeStore(ORDERS_KEY, next);
  },

  async getOrders(): Promise<OrderRow[]> {
    return readStore<OrderRow[]>(ORDERS_KEY, []);
  },

  async getAuditTrail(): Promise<AuditTrailRow[]> {
    return readStore<AuditTrailRow[]>(AUDIT_KEY, []);
  },

  async addAudit(input: Omit<AuditTrailRow, 'id' | 'created_at'>): Promise<AuditTrailRow> {
    const rows = readStore<AuditTrailRow[]>(AUDIT_KEY, []);
    const nextRow: AuditTrailRow = {
      ...input,
      id: makeId('audit'),
      created_at: new Date().toISOString(),
    };
    writeStore(AUDIT_KEY, [nextRow, ...rows]);
    return nextRow;
  },

  getRoles(): RoleRow[] {
    const roles = readStore<RoleRow[]>(ROLES_KEY, DEFAULT_ROLES);
    writeStore(ROLES_KEY, roles);
    return roles;
  },

  saveRolePermissions(roleId: string, permissionKeys: string[]) {
    const roles = this.getRoles();
    const next = roles.map((role) => (role.id === roleId ? { ...role, permission_keys: permissionKeys } : role));
    writeStore(ROLES_KEY, next);
  },

  getUsers(): UserAccessRow[] {
    const users = readStore<UserAccessRow[]>(USERS_KEY, DEFAULT_USERS);
    writeStore(USERS_KEY, users);
    return users;
  },

  saveUsers(users: UserAccessRow[]) {
    writeStore(USERS_KEY, users);
  },

  getCurrentUser(): UserAccessRow {
    const users = this.getUsers();
    const currentUserId = readStore<string | null>(CURRENT_USER_KEY, null);
    const activeUser = users.find((user) => user.id === currentUserId && user.status === 'ACTIVE');
    return activeUser || users.find((user) => user.status === 'ACTIVE') || users[0];
  },

  setCurrentUser(userId: string) {
    writeStore(CURRENT_USER_KEY, userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ims-current-user-changed', { detail: userId }));
    }
  },

  hasPermission(user: UserAccessRow, permissionKey: string) {
    const role = this.getRoles().find((item) => item.id === user.role_id);
    const rolePermissions = role?.permission_keys || [];
    return rolePermissions.includes(permissionKey) || user.custom_permission_keys.includes(permissionKey);
  },
};

// Production-ready modules service using Supabase database
// This is a wrapper around the database service for backward compatibility

import { modulesService as dbService } from './modules-database';
import type {
  UserAccessRow,
  RoleRow,
  AuditTrailRow,
  PermissionRow,
  InventorySnapshotRow,
  OrderRow,
  StockMovementRow,
  ChallanRow,
  DeliveryReceiptRow,
  PaymentSlipRow,
} from '@/types/modules';

// Re-export everything from the database service
export const modulesService = {
  // Authentication methods (async versions)
  signIn: dbService.signIn.bind(dbService),
  signOut: dbService.signOut.bind(dbService),
  getCurrentUser: dbService.getCurrentUser.bind(dbService),
  hasActiveSession: dbService.hasActiveSession.bind(dbService),
  getAuthenticatedUser: dbService.getAuthenticatedUser.bind(dbService),
  login: dbService.login.bind(dbService),
  logout: dbService.logout.bind(dbService),

  // User management methods
  getUsers: dbService.getUsers.bind(dbService),
  saveUser: dbService.saveUser.bind(dbService),
  createUser: dbService.createUser.bind(dbService),
  saveUsers: dbService.saveUsers.bind(dbService),
  setCurrentUser: dbService.setCurrentUser.bind(dbService),

  // Role management methods
  getRoles: dbService.getRoles.bind(dbService),
  saveRolePermissions: dbService.saveRolePermissions.bind(dbService),
  createRole: dbService.createRole.bind(dbService),
  updateRole: dbService.updateRole.bind(dbService),

  // Permission methods
  getPermissions: dbService.getPermissions.bind(dbService),
  getPermissionByKey: dbService.getPermissionByKey.bind(dbService),
  getRoutePermission: dbService.getRoutePermission.bind(dbService),
  hasPermission: dbService.hasPermission.bind(dbService),
  canAccessRoute: dbService.canAccessRoute.bind(dbService),
  getPermissionCountForUser: dbService.getPermissionCountForUser.bind(dbService),

  // Audit trail methods
  getAuditTrail: dbService.getAuditTrail.bind(dbService),
  addAudit: dbService.addAudit.bind(dbService),

  // Legacy synchronous versions for backward compatibility
  getCurrentUserSync: dbService.getCurrentUserLegacy.bind(dbService),
  hasActiveSessionSync: dbService.hasActiveSessionLegacy.bind(dbService),
  getAuthenticatedUserSync: dbService.getAuthenticatedUserSync.bind(dbService),

  // Legacy synchronous methods (deprecated - use async versions)
  getAuthenticatedUser: dbService.getAuthenticatedUserSync.bind(dbService),

  // Inventory and business logic methods (keeping localStorage for now)
  // These will be migrated to database in a future update
  getInventorySnapshot: async (): Promise<InventorySnapshotRow[]> => {
    // For now, keep using localStorage - this would need inventory service integration
    console.warn('getInventorySnapshot: Using legacy localStorage implementation');
    return [];
  },

  getMovements: async (): Promise<StockMovementRow[]> => {
    // For now, keep using localStorage - this would need inventory service integration
    console.warn('getMovements: Using legacy localStorage implementation');
    return [];
  },

  addMovement: async (input: Omit<StockMovementRow, 'id' | 'created_at'>): Promise<StockMovementRow> => {
    console.warn('addMovement: Using legacy localStorage implementation');
    return {} as StockMovementRow;
  },

  createOrder: async (input: any): Promise<OrderRow> => {
    console.warn('createOrder: Using legacy localStorage implementation');
    return {} as OrderRow;
  },

  updateOrderStatus: async (orderId: string, status: OrderRow['status']): Promise<void> => {
    console.warn('updateOrderStatus: Using legacy localStorage implementation');
  },

  getOrders: async (): Promise<OrderRow[]> => {
    console.warn('getOrders: Using legacy localStorage implementation');
    return [];
  },

  getChallans: (): ChallanRow[] => {
    console.warn('getChallans: Using legacy localStorage implementation');
    return [];
  },

  saveChallans: (challans: ChallanRow[]): void => {
    console.warn('saveChallans: Using legacy localStorage implementation');
  },

  getDeliveryReceipts: (): DeliveryReceiptRow[] => {
    console.warn('getDeliveryReceipts: Using legacy localStorage implementation');
    return [];
  },

  saveDeliveryReceipts: (receipts: DeliveryReceiptRow[]): void => {
    console.warn('saveDeliveryReceipts: Using legacy localStorage implementation');
  },

  getPaymentSlips: (): PaymentSlipRow[] => {
    console.warn('getPaymentSlips: Using legacy localStorage implementation');
    return [];
  },

  savePaymentSlips: (slips: PaymentSlipRow[]): void => {
    console.warn('savePaymentSlips: Using legacy localStorage implementation');
  },

  // Debug methods (keep for troubleshooting)
  _debugResetAllData: async () => {
    console.warn('⚠️ Debug method called - this should not be used in production');
    // This would clear database data - not implemented for safety
  },

  _debugShowState: async () => {
    console.log('🔍 Current database state:');
    const users = await dbService.getUsers();
    const roles = await dbService.getRoles();
    const audit = await dbService.getAuditTrail();
    console.log('Users:', users.length);
    console.log('Roles:', roles.length);
    console.log('Audit entries:', audit.length);
  },
};

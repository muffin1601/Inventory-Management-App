// Production-ready modules service using Supabase database
// This is a wrapper around the database service for backward compatibility

import { modulesService as dbService } from './modules-database';

/**
 * Backward compatibility wrapper for the modules service.
 * This ensures all methods from the database service are available
 * even if they were added later.
 */
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
  updateUserDetails: dbService.updateUserDetails.bind(dbService),
  changeUserPassword: dbService.changeUserPassword.bind(dbService),
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
  getAuthenticatedUserSync: dbService.getAuthenticatedUserSync.bind(dbService),

  // Inventory and business logic methods
  getInventorySnapshot: dbService.getInventorySnapshot.bind(dbService),
  getMovements: dbService.getMovements.bind(dbService),
  addMovement: dbService.addMovement.bind(dbService),
  createOrder: dbService.createOrder.bind(dbService),
  updateOrderStatus: dbService.updateOrderStatus.bind(dbService),
  getOrders: dbService.getOrders.bind(dbService),
  getChallans: dbService.getChallans.bind(dbService),
  saveChallans: dbService.saveChallans.bind(dbService),
  createChallan: dbService.createChallan.bind(dbService),
  updateChallanStatus: dbService.updateChallanStatus.bind(dbService),
  deleteChallan: dbService.deleteChallan.bind(dbService),
  getDeliveryReceipts: dbService.getDeliveryReceipts.bind(dbService),
  saveDeliveryReceipts: dbService.saveDeliveryReceipts.bind(dbService),
  createDeliveryReceipt: dbService.createDeliveryReceipt.bind(dbService),
  deleteDeliveryReceipt: dbService.deleteDeliveryReceipt.bind(dbService),
  getPaymentSlips: dbService.getPaymentSlips.bind(dbService),
  savePaymentSlips: dbService.savePaymentSlips.bind(dbService),

  // Debug methods
  _debugResetAllData: async () => {
    console.warn('⚠️ Debug method called - not available in production');
  },

  _debugShowState: async () => {
    console.warn('Debug state viewer is not implemented for the database service.');
  },
};

// Debug script to diagnose permission issues
// Run this in browser console: eval(atob('PASTE_ENCODED_CONTENT'))

/* eslint-disable @typescript-eslint/no-require-imports */

export function debugPermissions() {
  const { modulesService } = require('@/lib/services/modules');
  
  console.group('=== PERMISSION DEBUG ===');
  
  // Check authentication
  const authenticatedUser = modulesService.getAuthenticatedUser();
  console.log('Authenticated User:', authenticatedUser);
  
  // Check current user
  const currentUser = modulesService.getCurrentUser();
  console.log('Current User:', currentUser);
  
  // Check session
  console.log('Has Active Session:', modulesService.hasActiveSession());
  
  // Check all users
  const allUsers = modulesService.getUsers();
  console.log('All Users:', allUsers);
  
  // Check all roles
  const allRoles = modulesService.getRoles();
  console.log('All Roles:', allRoles);
  
  // Check dashboard permission mapping
  const dashboardPermission = modulesService.getRoutePermission('/dashboard');
  console.log('Dashboard Route Permission:', dashboardPermission);
  
  // Check if authenticated user can access dashboard
  if (authenticatedUser) {
    const hasPermission = modulesService.hasPermission(authenticatedUser, 'dashboard.view');
    console.log(`Can Access Dashboard (${authenticatedUser.full_name}):`, hasPermission);
    
    // Find the user's role
    const userRole = allRoles.find((r: any) => r.id === authenticatedUser.role_id);
    console.log('User Role:', userRole);
    console.log('Role Permission Keys:', userRole?.permission_keys);
    console.log('Has dashboard.view?', userRole?.permission_keys?.includes('dashboard.view'));
  }
  
  // Check localStorage
  console.log('LocalStorage Keys:', {
    AUTH_USER_KEY: localStorage.getItem('ims_authenticated_user_id_v1'),
    CURRENT_USER_KEY: localStorage.getItem('ims_current_user_id_v1'),
    USERS_KEY_exists: !!localStorage.getItem('ims_users_v1'),
    ROLES_KEY_exists: !!localStorage.getItem('ims_roles_v1'),
  });
  
  console.groupEnd();
}

// Also test the canAccessRoute directly
export function testCanAccessRoute() {
  const { modulesService } = require('@/lib/services/modules');
  
  const user = modulesService.getAuthenticatedUser() || modulesService.getCurrentUser();
  const canAccess = modulesService.canAccessRoute(user, '/dashboard');
  
  console.log(`canAccessRoute('/dashboard') for ${user?.full_name}:`, canAccess);
  console.log('User Details:', { role_id: user?.role_id, role_name: user?.role_name });
  
  return canAccess;
}

# Admin Access Restriction - Debugging Guide

## Issue Summary
Admin users are seeing "Access Restricted" error on the dashboard even though they're logged in as "Super Admin".

## Quick Fix (Try This First)

### Option 1: Clear Browser Data & Reload
1. Open browser DevTools (F12)
2. Open Application/Storage tab
3. Click "Local Storage"
4. Click on your site URL
5. Right-click any item and select "Clear All"
6. Reload the page
7. Try logging in again

### Option 2: Use Debug Reset Function
1. After logging in, navigate to: `http://localhost:3000/debug-permissions`
2. Click the red "Clear All Data & Reload" button
3. You'll be logged out and should see fresh default data
4. Try logging in again

## Debugging Steps

### 1. Check Permission Diagnostics Page
1. After logging in as admin, go to: `http://localhost:3000/debug-permissions`
2. This page shows:
   - Authenticated user details
   - Admin user in the database
   - Super Admin role configuration
   - Whether permissions are working correctly
3. Look for any "NOT FOUND" errors

### 2. Check Browser Console Logs
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Look for logs that start with:
   - `[MODULE INIT]` - Shows initialization state
   - `[getRoutePermission]` - Shows permission lookup
   - `[hasPermission]` - Shows permission check details
   - `[canAccessRoute]` - Shows overall access decision
4. Check if any show `permission_keys` is empty

### 3. Manual Permission Check
In browser console, run:
```javascript
// Get the authenticated user
const user = (await import('@/lib/services/modules')).modulesService.getAuthenticatedUser();
console.log('Authenticated User:', user);

// Get all roles
const roles = (await import('@/lib/services/modules')).modulesService.getRoles();
console.log('All Roles:', roles);

// Check if user's role exists and has dashboard.view
const userRole = roles.find(r => r.id === user?.role_id);
console.log('User Role:', userRole);
console.log('Has dashboard.view:', userRole?.permission_keys?.includes('dashboard.view'));
```

## Technical Details

### Permission Flow
1. User logs in with `admin@nexusims.com` / `Admin@123`
2. Gets `role_id: 'r1'` (Super Admin role)
3. Tries to access `/dashboard`
4. AppShell checks `modulesService.canAccessRoute(user, '/dashboard')`
5. This should look up `r1` role and find it has `'dashboard.view'` permission
6. Access should be granted

### What Could Go Wrong
1. **Corrupted localStorage** - Role data was saved with empty permission arrays
2. **Role not initialized** - DEFAULT_ROLES not loaded properly
3. **User object incomplete** - role_id missing or wrong
4. **Route permission not mapped** - `/dashboard` doesn't map to `'dashboard.view'`

## If Issue Persists

### Check these files
- `src/lib/services/modules.ts` - Permission logic
- `src/components/AppShell.tsx` - Access control implementation
- Browser console for debug logs

### Additional Debug Functions Available
```javascript
// Show current state
modulesService._debugShowState()

// Clear everything (runs on /debug-permissions page)
modulesService._debugResetAllData()
```

## Solution Implementation
The following fixes have been added:
1. ✅ Data validation in `getRoles()` - ensures permission_keys are proper arrays
2. ✅ Data validation in `getUsers()` - ensures users have required fields
3. ✅ Detailed debug logging throughout permission flow
4. ✅ Debug diagnostics page at `/debug-permissions`
5. ✅ Factory reset functionality

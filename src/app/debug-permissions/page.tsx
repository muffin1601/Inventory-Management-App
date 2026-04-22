// Permission Diagnostics Page
// This page shows the current state of authentication and permissions
// It can be accessed at /debug-permissions (won't require dashboard.view permission)

"use client";

import React from 'react';
import { modulesService } from '@/lib/services/modules';

export default function PermissionTest() {
  const [debug, setDebug] = React.useState<Record<string, any>>({});
  const [showRaw, setShowRaw] = React.useState(false);

  const runDiagnostics = React.useCallback(async () => {
    // Run permission diagnostic
    const authUser = await modulesService.getAuthenticatedUser();
    const allRoles = await modulesService.getRoles();
    const allUsers = await modulesService.getUsers();
    const superAdminRole = allRoles.find(r => r.id === 'r1');
    const adminUser = allUsers.find(u => u.email === 'admin@nexusims.com');

    const diagnostics = {
      authenticatedUser: authUser ? {
        id: authUser.id,
        email: authUser.email,
        role_id: authUser.role_id,
        role_name: authUser.role_name,
        status: authUser.status,
      } : null,
      
      adminUserStored: adminUser ? {
        id: adminUser.id,
        email: adminUser.email,
        role_id: adminUser.role_id,
        role_name: adminUser.role_name,
        status: adminUser.status,
      } : null,
      
      userRole: authUser ? allRoles.find(r => r.id === authUser.role_id) : null,
      
      superAdminRole: superAdminRole ? {
        id: superAdminRole.id,
        name: superAdminRole.name,
        permissionCount: superAdminRole.permission_keys.length,
        hasDashboardView: superAdminRole.permission_keys.includes('dashboard.view'),
      } : null,
      
      dashboardPermissionRequired: modulesService.getRoutePermission('/dashboard'),
      
      canAccessDashboard: authUser ? modulesService.canAccessRoute(authUser, '/dashboard') : false,
      
      allRoles: allRoles.map(r => ({
        id: r.id,
        name: r.name,
        permissionCount: r.permission_keys.length,
        hasDashboardView: r.permission_keys.includes('dashboard.view'),
      })),
      
      localStorage: {
        AUTH_USER_KEY: localStorage.getItem('ims_authenticated_user_id_v1'),
        CURRENT_USER_KEY: localStorage.getItem('ims_current_user_id_v1'),
        USERS_KEY_LENGTH: localStorage.getItem('ims_users_v1')?.length || 0,
        ROLES_KEY_LENGTH: localStorage.getItem('ims_roles_v1')?.length || 0,
      },
    };
    
    setDebug(diagnostics);
    console.log('=== PERMISSION DIAGNOSTICS ===', diagnostics);
  }, []);

  React.useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const adminRole = debug.superAdminRole as any;
  const isAdmin = debug.authenticatedUser?.email === 'admin@nexusims.com';

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '13px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1>🔍 Permission Diagnostics</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={runDiagnostics}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Refresh Diagnostics
          </button>
          {' '}
          <button 
            onClick={() => {
              modulesService._debugResetAllData();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🗑️ Clear All Data & Reload
          </button>
          {' '}
          <label style={{ marginLeft: '20px' }}>
            <input 
              type="checkbox" 
              checked={showRaw} 
              onChange={(e) => setShowRaw(e.target.checked)}
            />
            {' '}Show Raw JSON
          </label>
        </div>

        {isAdmin && debug.canAccessDashboard === false && (
          <div style={{ 
            backgroundColor: '#ffe0e0', 
            border: '2px solid #ff4444', 
            padding: '15px', 
            marginBottom: '20px',
            borderRadius: '4px'
          }}>
            <strong style={{ fontSize: '16px' }}>❌ ISSUE FOUND:</strong>
            <br />Admin user is logged in but <strong>CANNOT</strong> access the dashboard!
            <br />
            <br />
            Role: <strong>{debug.userRole?.name || 'NOT FOUND'}</strong>
            <br />Has dashboard.view permission: <strong style={{ color: debug.userRole?.hasDashboardView ? 'green' : 'red' }}>
              {debug.userRole?.hasDashboardView ? 'YES ✓' : 'NO ✗'}
            </strong>
            <br />
            <br />
            <small>Check browser console (F12) for detailed logs. Try clicking "Clear All Data & Reload" button.</small>
          </div>
        )}

        {isAdmin && debug.canAccessDashboard === true && (
          <div style={{ 
            backgroundColor: '#e0ffe0', 
            border: '2px solid #44ff44', 
            padding: '15px', 
            marginBottom: '20px',
            borderRadius: '4px'
          }}>
            <strong style={{ fontSize: '16px' }}>✓ OK:</strong> Admin user can access the dashboard!
          </div>
        )}

        {!showRaw && (
          <>
            <h2>Authenticated User</h2>
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(debug.authenticatedUser || 'NOT LOGGED IN', null, 2)}
            </pre>

            <h2>Admin User in Database</h2>
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(debug.adminUserStored || 'NOT FOUND', null, 2)}
            </pre>

            <h2>Super Admin Role (r1)</h2>
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(debug.superAdminRole || 'NOT FOUND', null, 2)}
            </pre>

            <h2>Permission Check Result</h2>
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify({
                dashboardPermissionRequired: debug.dashboardPermissionRequired,
                canAccessDashboard: debug.canAccessDashboard,
              }, null, 2)}
            </pre>
          </>
        )}

        {showRaw && (
          <>
            <h2>Full Diagnostic Data (JSON)</h2>
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto', maxHeight: '600px' }}>
              {JSON.stringify(debug, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

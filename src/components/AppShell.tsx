"use client";

import React, { Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';
import { modulesService } from '@/lib/services/modules';

const SIDEBAR_STATE_KEY = 'ims_sidebar_collapsed_v1';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/login';
  const [hasSession, setHasSession] = React.useState(false);
  const [canAccessRoute, setCanAccessRoute] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved === 'true') {
      setCollapsed(true);
    }
  }, []);

  // Mark as client-side after first render
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize permissions on mount
  React.useEffect(() => {
    const initPermissions = async () => {
      const sessionActive = modulesService.hasActiveSession();
      setHasSession(sessionActive);

      if (sessionActive) {
        const authenticatedUser = modulesService.getAuthenticatedUser();
        const userToCheck = authenticatedUser || await modulesService.getCurrentUser();
        const routeAccess = userToCheck ? modulesService.canAccessRoute(userToCheck, pathname) : false;
        setCanAccessRoute(routeAccess);
      } else {
        setCanAccessRoute(false);
      }
    };

    initPermissions();
  }, [pathname]);

  React.useEffect(() => {
    const syncAccess = async () => {
      const authenticatedUser = modulesService.getAuthenticatedUser();
      const sessionActive = Boolean(authenticatedUser);
      const userToCheck = authenticatedUser || await modulesService.getCurrentUser();
      const allRoles = await modulesService.getRoles();
      const routeAccess = sessionActive && userToCheck ? modulesService.canAccessRoute(userToCheck, pathname) : false;

      // DEBUG LOGGING
      console.log('[AppShell] Permission Check:', {
        pathname,
        authenticatedUser: authenticatedUser?.email,
        authenticatedUserRole: authenticatedUser?.role_id,
        userToCheck: userToCheck?.email,
        userRole: userToCheck?.role_id,
        routePermissionRequired: modulesService.getRoutePermission(pathname),
        hasPermission: authenticatedUser ? modulesService.hasPermission(authenticatedUser, modulesService.getRoutePermission(pathname) || '') : 'N/A',
        canAccess: routeAccess,
        allRoles: allRoles.map(r => ({ id: r.id, name: r.name, permissions: r.permission_keys.length })),
      });
      
      setHasSession(sessionActive);
      setCanAccessRoute(routeAccess);
    };

    syncAccess();
    window.addEventListener('ims-current-user-changed', syncAccess);
    window.addEventListener('ims-users-changed', syncAccess);
    window.addEventListener('ims-auth-changed', syncAccess);
    return () => {
      window.removeEventListener('ims-current-user-changed', syncAccess);
      window.removeEventListener('ims-users-changed', syncAccess);
      window.removeEventListener('ims-auth-changed', syncAccess);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!hasSession && !isLoginRoute) {
      router.replace('/login');
      return;
    }

    if (hasSession && isLoginRoute) {
      router.replace('/dashboard');
    }
  }, [hasSession, isLoginRoute, router]);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    isLoginRoute ? (
      <div className={styles.authLayout}>{children}</div>
    ) : (
    <div className={`${styles.layout} ${collapsed ? styles.layoutCollapsed : ''}`}>
      <Suspense fallback={<div style={{ width: collapsed ? '70px' : '260px' }} />}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </Suspense>
      <main className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''}`}>
        <Header />
        <div className={styles.pageContent}>
          {!isClient ? (
            // Show loading state during SSR to prevent hydration mismatch
            <div className={styles.loadingState}>
              <div>Loading...</div>
            </div>
          ) : canAccessRoute ? (
            children
          ) : (
            <div className={styles.accessDenied}>
              <h2>Access Restricted</h2>
              <p>Your current role does not have permission to open this page. Ask an admin to update your access.</p>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
    )
  );
}

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

  // Consolidate auth and permission checks
  React.useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      // First check session
      const authenticatedUser = await modulesService.getAuthenticatedUser();
      if (!mounted) return;

      const sessionActive = Boolean(authenticatedUser);
      setHasSession(sessionActive);

      if (sessionActive && authenticatedUser) {
        // Check route access
        const routeAccess = await modulesService.canAccessRoute(authenticatedUser, pathname);
        if (!mounted) return;

        // DEBUG LOGGING
        const allRoles = await modulesService.getRoles();
        console.log('[AppShell] Permission Check:', {
          pathname,
          user: authenticatedUser.email,
          role: authenticatedUser.role_id,
          routePermission: modulesService.getRoutePermission(pathname),
          canAccess: routeAccess,
          availableRoles: allRoles.map(r => r.id),
        });

        setCanAccessRoute(routeAccess);
      } else {
        setCanAccessRoute(false);
      }
      
      setIsClient(true);
    };

    checkAccess();

    const handleAuthChange = () => checkAccess();
    window.addEventListener('ims-auth-changed', handleAuthChange);
    window.addEventListener('ims-current-user-changed', handleAuthChange);
    
    return () => {
      mounted = false;
      window.removeEventListener('ims-auth-changed', handleAuthChange);
      window.removeEventListener('ims-current-user-changed', handleAuthChange);
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

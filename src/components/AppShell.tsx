"use client";

import React, { Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { LoadingPage } from './LoadingPage';
import styles from './Layout.module.css';
import { useAuth } from '@/lib/AuthContext';
import { modulesService } from '@/lib/services/modules';

const SIDEBAR_STATE_KEY = 'ims_sidebar_collapsed_v1';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isClient } = useAuth();
  const [canAccessRoute, setCanAccessRoute] = React.useState(true); // Default to true (fail open)
  const [lastCheckedRoute, setLastCheckedRoute] = React.useState<string>('');

  const isLoginRoute = pathname === '/login';

  React.useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved === 'true') {
      setCollapsed(true);
    }
  }, []);

  // Check route access - but only if route changed and user is ready
  React.useEffect(() => {
    // Skip checks on login route or during loading
    if (isLoginRoute || !isClient || !user || lastCheckedRoute === pathname) {
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Defer the check slightly to not block navigation
    timeoutId = setTimeout(async () => {
      if (!mounted) return;

      try {
        console.log('[AppShell] Checking route access', { user: user?.email, pathname });
        
        const accessPromise = modulesService.canAccessRoute(user, pathname);
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            resolve(true); // Fail open if check takes too long
          }, 5000); // Shorter timeout, non-blocking
        });

        const routeAccess = await Promise.race([accessPromise, timeoutPromise]);
        if (mounted) {
          setCanAccessRoute(routeAccess);
          setLastCheckedRoute(pathname);
        }
      } catch (error) {
        console.error('[AppShell] Error checking route access:', error);
        if (mounted) {
          setCanAccessRoute(true); // Fail open on error
          setLastCheckedRoute(pathname);
        }
      }
    }, 100); // Small delay to debounce rapid route changes

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [pathname, isClient, user, isLoginRoute, lastCheckedRoute]);

  // Handle navigation based on auth state
  React.useEffect(() => {
    if (!isLoading && isClient) {
      if (!user && !isLoginRoute) {
        // User is not logged in and not on login route - redirect to login
        router.replace('/login');
      } else if (user && isLoginRoute) {
        // User is logged in and on login route - redirect to dashboard
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, isLoginRoute, router, isClient]);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      return next;
    });
  }, []);

  // Show loading state while auth is initializing
  if (!isClient || isLoading) {
    return <LoadingPage />;
  }

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
          {canAccessRoute ? (
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

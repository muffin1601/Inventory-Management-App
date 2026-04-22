"use client";

import styles from './Layout.module.css';
import { Bell, LogOut, ShieldCheck } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { modulesService } from '@/lib/services/modules';
import type { UserAccessRow } from '@/types/modules';
import React from 'react';

const TITLE_MAP: Record<string, string> = {
  '/projects': 'Projects & BOQ',
  '/dashboard': 'Dashboard',
  '/orders': 'Purchase Orders',
  '/inventory': 'Inventory Flow',
  '/stock': 'Stock Management',
  '/catalog': 'Item Catalog',
  '/vendors': 'Vendors',
  '/rate-inquiry': 'Rate Inquiry',
  '/rate-comparison': 'Rate Comparison',
  '/challans': 'Challans & Dispatch',
  '/site-records': 'Delivery & Payments',
  '/audit': 'Audit Trail',
  '/reports': 'Reports & Export',
  '/users': 'User Management',
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = React.useState<UserAccessRow | null>(null);
  
  // Create a formatted title from pathname
  const normalizedPath = pathname.startsWith('/projects') ? '/projects' : pathname;
  const title =
    TITLE_MAP[normalizedPath] ||
    (pathname === '/'
      ? 'Projects & BOQ'
      : pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1));

  React.useEffect(() => {
    const syncUser = async () => {
      const user = await modulesService.getAuthenticatedUser();
      setCurrentUser(user);
    };

    syncUser();
    window.addEventListener('ims-current-user-changed', syncUser);
    window.addEventListener('ims-users-changed', syncUser);
    window.addEventListener('ims-auth-changed', syncUser);
    return () => {
      window.removeEventListener('ims-current-user-changed', syncUser);
      window.removeEventListener('ims-users-changed', syncUser);
      window.removeEventListener('ims-auth-changed', syncUser);
    };
  }, []);

  const userLabel = currentUser
    ? `${currentUser.full_name} • ${currentUser.role_name}`
    : 'Not signed in';

  return (
    <header className={styles.mainHeader}>
      <div className={styles.headerTitleWrap}>
        <div className={styles.headerTitle}>
          {title}
        </div>
      </div>
      
      <div className={styles.headerActions}>
        <div className={styles.currentUserBadge}>
          <ShieldCheck size={15} />
          <span>{userLabel}</span>
        </div>
        <button className={styles.iconButton}>
          <Bell size={18} />
        </button>
        <button
          className={styles.iconButton}
          title="Logout"
          onClick={() => {
            modulesService.logout();
            router.replace('/login');
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

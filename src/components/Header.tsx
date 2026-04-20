"use client";

import styles from './Layout.module.css';
import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
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
  const [users, setUsers] = React.useState<UserAccessRow[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState('');
  
  // Create a formatted title from pathname
  const normalizedPath = pathname.startsWith('/projects') ? '/projects' : pathname;
  const title =
    TITLE_MAP[normalizedPath] ||
    (pathname === '/'
      ? 'Projects & BOQ'
      : pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1));

  React.useEffect(() => {
    const allUsers = modulesService.getUsers().filter((user) => user.status === 'ACTIVE');
    const current = modulesService.getCurrentUser();
    setUsers(allUsers);
    setCurrentUserId(current.id);
    const onUserChange = () => {
      const refreshed = modulesService.getCurrentUser();
      setCurrentUserId(refreshed.id);
    };
    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, []);

  return (
    <header className={styles.mainHeader}>
      <div className={styles.headerTitleWrap}>
        <div className={styles.headerTitle}>
          {title}
        </div>
      </div>
      
      <div className={styles.headerActions}>
        <select
          className={styles.userSelect}
          value={currentUserId}
          onChange={(event) => {
            modulesService.setCurrentUser(event.target.value);
            setCurrentUserId(event.target.value);
          }}
          title="Switch role (demo)"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name} ({user.role_name})
            </option>
          ))}
        </select>
        <button className={styles.iconButton}>
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}

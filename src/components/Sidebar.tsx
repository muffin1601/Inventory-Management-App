"use client";

import styles from './Layout.module.css';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Box,
  Boxes,
  Building2,
  Users,
  ClipboardList,
  ShoppingCart,
  FileText,
  UploadCloud,
  History,
  Shield,
  ArrowRightLeft,
  CreditCard,
  Truck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import React from 'react';
import { modulesService } from '@/lib/services/modules';

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  const navGroups = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: <Home size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
    {
      label: 'Inventory & Projects',
      items: [
        { name: 'Item Catalog', path: '/catalog', icon: <Box size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Stock Management', path: '/stock', icon: <Boxes size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Inventory Flow', path: '/inventory', icon: <ArrowRightLeft size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Projects & BOQ', path: '/projects', icon: <Building2 size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
    {
      label: 'Procurement',
      items: [
        { name: 'Vendors', path: '/vendors', icon: <Users size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Purchase Orders', path: '/orders', icon: <ShoppingCart size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Rate Inquiry', path: '/rate-inquiry', icon: <ClipboardList size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { name: 'Payment Records', path: '/site-records', icon: <FileText size={18} strokeWidth={1.5} color="currentColor" /> },
        // { name: 'Payments', path: '/payments', icon: <CreditCard size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Challans', path: '/challans', icon: <Truck size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
    {
      label: 'Reports & Admin',
      items: [
        { name: 'Reports & Export', path: '/reports', icon: <UploadCloud size={18} strokeWidth={1.5} color="currentColor" /> },
        // { name: 'Audit Trail', path: '/audit', icon: <History size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'User Management', path: '/users', icon: <Shield size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
  ];

  const visibleNavGroups = navGroups;
  const [currentUserLabel, setCurrentUserLabel] = React.useState<{
    name: string;
    role: string;
    email: string;
    initial: string;
  } | null>(null);

  React.useEffect(() => {
    const syncCurrentUser = async () => {
      const current = (await modulesService.getAuthenticatedUser()) || await modulesService.getCurrentUser();
      if (current) {
        setCurrentUserLabel({
          name: current.full_name,
          role: current.role_name,
          email: current.email,
          initial: current.full_name.charAt(0).toUpperCase(),
        });
      }
    };

    void syncCurrentUser();
    window.addEventListener('ims-current-user-changed', syncCurrentUser);
    window.addEventListener('ims-users-changed', syncCurrentUser);
    return () => {
      window.removeEventListener('ims-current-user-changed', syncCurrentUser);
      window.removeEventListener('ims-users-changed', syncCurrentUser);
    };
  }, []);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <Image src="/logo1.png" alt="Watcon International" className={styles.logoImage} width={180} height={34} priority />
        </div>
      </div>

      <nav className={styles.nav}>
        {visibleNavGroups.map((group) => {

          return (
            <div key={group.label} className={styles.navGroup}>
              <span className={styles.navLabel}>{collapsed ? '•' : group.label}</span>
              {group.items.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`${styles.navItem} ${isActive ? styles.active : ''} ${collapsed ? styles.navItemCollapsed : ''}`}
                    title={item.name}
                  >
                    {item.icon}
                    <span className={collapsed ? styles.navTextHidden : ''}>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {currentUserLabel && (
          <div className={`${styles.userCard} ${collapsed ? styles.userCardCollapsed : ''}`}>
            <div className={styles.avatar}>{currentUserLabel.initial}</div>
            <div className={`${styles.userInfo} ${collapsed ? styles.userInfoHidden : ''}`}>
              <span className={styles.userName}>{currentUserLabel.name}</span>
              <span className={styles.userRole}>{currentUserLabel.role}</span>
              <span className={styles.userRole}>{currentUserLabel.email}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  );
}

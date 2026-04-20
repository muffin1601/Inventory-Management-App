"use client";

import styles from './Layout.module.css';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home,
  Box,
  Boxes,
  Building2,
  Users,
  ClipboardList,
  Scale,
  ShoppingCart,
  FileText,
  Package,
  Truck,
  CreditCard,
  UploadCloud,
  History,
  Shield,
  ArrowRightLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import React from 'react';

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
      label: 'Operations & Finance',
      items: [
        { name: 'Challans & Dispatch', path: '/challans', icon: <FileText size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Delivery & Payments', path: '/site-records', icon: <Package size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
    {
      label: 'Administration',
      items: [
        { name: 'Reports & Export', path: '/reports', icon: <UploadCloud size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'Audit Trail', path: '/audit', icon: <History size={18} strokeWidth={1.5} color="currentColor" /> },
        { name: 'User Management', path: '/users', icon: <Shield size={18} strokeWidth={1.5} color="currentColor" /> },
      ],
    },
  ];

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo1.png" alt="Watcon International" className={styles.logoImage} />
        </div>
      </div>

      <nav className={styles.nav}>
        {navGroups.map((group) => (
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
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={`${styles.userCard} ${collapsed ? styles.userCardCollapsed : ''}`}>
          <div className={styles.avatar}>A</div>
          <div className={`${styles.userInfo} ${collapsed ? styles.userInfoHidden : ''}`}>
            <span className={styles.userName}>Admin</span>
            <span className={styles.userRole}>Admin</span>
          </div>
        </div>

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

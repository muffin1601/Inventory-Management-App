"use client";

import styles from './Layout.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Box, Boxes, Building2, Users, ClipboardList, Scale,
  ShoppingCart, FileText, Truck, CreditCard, UploadCloud, 
  History, Shield
} from 'lucide-react';
import React from 'react';

export default function Sidebar() {
  const pathname = usePathname();

  const navGroups = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', path: '/', icon: <Home size={18} strokeWidth={1.5} color="#6366f1" /> }
      ]
    },
    {
      label: 'Inventory & Projects',
      items: [
        { name: 'Item Catalog', path: '/catalog', icon: <Box size={18} strokeWidth={1.5} color="#ec4899" /> },
        { name: 'Stock Management', path: '/stock', icon: <Boxes size={18} strokeWidth={1.5} color="#8b5cf6" /> },
        { name: 'Projects & BOQ', path: '/projects', icon: <Building2 size={18} strokeWidth={1.5} color="#06b6d4" /> },
      ]
    },
    {
      label: 'Procurement',
      items: [
        { name: 'Vendors', path: '/vendors', icon: <Users size={18} strokeWidth={1.5} color="#f59e0b" /> },
        { name: 'Rate Inquiry', path: '/rate-inquiry', icon: <ClipboardList size={18} strokeWidth={1.5} color="#10b981" /> },
        { name: 'Rate Comparison', path: '/rate-comparison', icon: <Scale size={18} strokeWidth={1.5} color="#3b82f6" /> },
        { name: 'Purchase Orders', path: '/purchase-orders', icon: <ShoppingCart size={18} strokeWidth={1.5} color="#ef4444" /> },
      ]
    },
    {
      label: 'Operations & Finance',
      items: [
        { name: 'Challans & Dispatch', path: '/challans', icon: <FileText size={18} strokeWidth={1.5} color="#8b5cf6" /> },
        { name: 'Delivery Receipts', path: '/delivery-receipts', icon: <Truck size={18} strokeWidth={1.5} color="#ec4899" /> },
        { name: 'Payment Slips', path: '/payments', icon: <CreditCard size={18} strokeWidth={1.5} color="#10b981" /> },
      ]
    },
    {
      label: 'Administration',
      items: [
        { name: 'Reports & Export', path: '/reports', icon: <UploadCloud size={18} strokeWidth={1.5} color="#3b82f6" /> },
        { name: 'Audit Trail', path: '/audit', icon: <History size={18} strokeWidth={1.5} color="#6b7280" /> },
        { name: 'User Management', path: '/users', icon: <Shield size={18} strokeWidth={1.5} color="#ef4444" /> },
      ]
    }
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo1.png" alt="Watcon International" className={styles.logoImage} />
        </div>
      </div>
      
      <nav className={styles.nav}>
        {navGroups.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <span className={styles.navLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.name}
                  href={item.path} 
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>A</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Admin</span>
            <span className={styles.userRole}>Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import styles from './Layout.module.css';
import { Bell, Search, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  
  // Create a formatted title from pathname
  const title = pathname === '/' 
    ? 'Dashboard' 
    : pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1);

  return (
    <header className={styles.mainHeader}>
      <div className={styles.headerTitle}>
        {title}
      </div>
      
      <div className={styles.headerActions}>
        <button className={styles.iconButton}>
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}

"use client";

import React, { Suspense } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

const SIDEBAR_STATE_KEY = 'ims_sidebar_collapsed_v1';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved === 'true') {
      setCollapsed(true);
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className={`${styles.layout} ${collapsed ? styles.layoutCollapsed : ''}`}>
      <Suspense fallback={<div style={{ width: collapsed ? '70px' : '260px' }} />}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </Suspense>
      <main className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''}`}>
        <Header />
        <div className={styles.pageContent}>{children}</div>
        <Footer />
      </main>
    </div>
  );
}

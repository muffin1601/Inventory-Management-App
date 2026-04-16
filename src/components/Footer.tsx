"use client";

import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      width: '100%',
      padding: '24px 2rem',
      borderTop: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-elevated)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: 'var(--text-secondary)',
      fontSize: '0.85rem'
    }}>
      <div>
        &copy; {new Date().getFullYear()} Watcon International. All rights reserved.
      </div>
      <div>
        Inventory Management System v1.0
      </div>
    </footer>
  );
}

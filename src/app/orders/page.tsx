"use client";

import React from 'react';
import styles from './Orders.module.css';
import { ShoppingCart, Search, Filter, ArrowRight, Eye } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Orders & Transactions</h1>
          <p className={styles.subtitle}>Manage incoming purchases and outgoing sales.</p>
        </div>
        <button className={styles.primaryAction}>
          <span>+ Create Order</span>
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input type="text" placeholder="Search Order ID or Customer..." className={styles.searchInput} />
          </div>
          <div className={styles.filters}>
            <select className={styles.select}>
              <option>All Types</option>
              <option>Purchase (In)</option>
              <option>Sale (Out)</option>
            </select>
            <select className={styles.select}>
              <option>All Status</option>
              <option>Completed</option>
              <option>Pending</option>
              <option>Cancelled</option>
            </select>
            <button className={styles.iconButton}><Filter size={18} /></button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Type</th>
              <th>Date</th>
              <th>Entity (Vendor/Customer)</th>
              <th>Total Items</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>ORD-2026-001</strong></td>
              <td><span className={styles.typeIn}>Purchase (In)</span></td>
              <td>Apr 15, 2026</td>
              <td>Philips Distributor Inc.</td>
              <td>500</td>
              <td><span className={styles.statusCompleted}>Completed</span></td>
              <td><button className={styles.actionBtn}><Eye size={16} /></button></td>
            </tr>
            <tr>
              <td><strong>ORD-2026-002</strong></td>
              <td><span className={styles.typeOut}>Sale (Out)</span></td>
              <td>Apr 14, 2026</td>
              <td>Tech Retailers LLC</td>
              <td>120</td>
              <td><span className={styles.statusPending}>Pending</span></td>
              <td><button className={styles.actionBtn}><Eye size={16} /></button></td>
            </tr>
            <tr>
              <td><strong>ORD-2026-003</strong></td>
              <td><span className={styles.typeOut}>Sale (Out)</span></td>
              <td>Apr 14, 2026</td>
              <td>John Doe</td>
              <td>2</td>
              <td><span className={styles.statusCompleted}>Completed</span></td>
              <td><button className={styles.actionBtn}><Eye size={16} /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

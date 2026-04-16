"use client";

import React, { useState } from 'react';
import styles from './Inventory.module.css';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Search, Filter } from 'lucide-react';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'movement'>('stock');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventory Management</h1>
          <p className={styles.subtitle}>Track stock per SKU, process inwards, and manage transfers.</p>
        </div>
        <div className={styles.actionGroup}>
          <button className={`${styles.actionBtn} ${styles.btnIn}`}>
            <ArrowDownLeft size={16} /> Stock In
          </button>
          <button className={`${styles.actionBtn} ${styles.btnOut}`}>
            <ArrowUpRight size={16} /> Stock Out
          </button>
          <button className={`${styles.actionBtn} ${styles.btnTransfer}`}>
            <ArrowRightLeft size={16} /> Transfer
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'stock' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          Current Stock
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'movement' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('movement')}
        >
          Stock Movement
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input type="text" placeholder="Search SKU or Product..." className={styles.searchInput} />
          </div>
          <div className={styles.filters}>
            <select className={styles.select}>
              <option>All Warehouses</option>
              <option>Main Hub</option>
              <option>Store A</option>
            </select>
            <button className={styles.iconButton}><Filter size={18} /></button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Details</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>PREM-TSH-RED-S</strong></td>
              <td>Premium T-Shirt <br/><span className={styles.subText}>Color: Red | Size: S</span></td>
              <td>Main Hub</td>
              <td className={styles.qtyHigh}>150</td>
              <td><span className={styles.statusGood}>In Stock</span></td>
            </tr>
            <tr>
              <td><strong>PREM-TSH-BLU-L</strong></td>
              <td>Premium T-Shirt <br/><span className={styles.subText}>Color: Blue | Size: L</span></td>
              <td>Store A</td>
              <td className={styles.qtyLow}>12</td>
              <td><span className={styles.statusLow}>Low Stock</span></td>
            </tr>
            <tr>
              <td><strong>LED-RGB-12W-PHI</strong></td>
              <td>LED Strip RGB 12W <br/><span className={styles.subText}>Philips</span></td>
              <td>Main Hub</td>
              <td className={styles.qtyHigh}>1,240</td>
              <td><span className={styles.statusGood}>In Stock</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

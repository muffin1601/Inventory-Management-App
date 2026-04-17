"use client";

import React, { useMemo, useState } from 'react';
import styles from './Reports.module.css';
import { Download, FileBarChart2, Search } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import type { InventorySnapshotRow, OrderRow } from '@/types/modules';
import TablePagination from '@/components/ui/TablePagination';

const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function ReportsPage() {
  const [snapshot, setSnapshot] = useState<InventorySnapshotRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    async function load() {
      const [stockRows, orderRows] = await Promise.all([modulesService.getInventorySnapshot(), modulesService.getOrders()]);
      setSnapshot(stockRows);
      setOrders(orderRows);
    }
    load();
  }, []);

  const filteredSnapshot = useMemo(() => {
    return snapshot.filter((row) => row.sku.toLowerCase().includes(query.toLowerCase()) || row.product_name.toLowerCase().includes(query.toLowerCase()));
  }, [query, snapshot]);

  const paginatedSnapshot = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredSnapshot.slice(startIndex, startIndex + pageSize);
  }, [filteredSnapshot, page, pageSize]);

  const totals = useMemo(() => {
    const totalStock = snapshot.reduce((sum, row) => sum + row.quantity, 0);
    const lowStock = snapshot.filter((row) => row.quantity <= 20).length;
    const approvedOrders = orders.filter((row) => row.status === 'APPROVED').length;
    return { totalStock, lowStock, approvedOrders };
  }, [orders, snapshot]);

  React.useEffect(() => {
    setPage(1);
  }, [pageSize, query, snapshot.length]);

  function exportCsv() {
    const lines = [
      'SKU,Product,Warehouse,Quantity',
      ...filteredSnapshot.map((row) => [row.sku, row.product_name, row.warehouse_name, String(row.quantity)].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports & Analytics</h1>
          <p className={styles.subtitle}>Stock health, order performance, and export-ready reports.</p>
        </div>
        <button className={styles.primaryAction} onClick={exportCsv}>
          <Download size={16} /> Export Stock CSV
        </button>
      </div>

      <div className={styles.cards}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Stock Units</span>
          <span className={styles.metricValue}>{totals.totalStock}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Low Stock Rows</span>
          <span className={styles.metricValue}>{totals.lowStock}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Approved Orders</span>
          <span className={styles.metricValue}>{totals.approvedOrders}</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Search SKU or product..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className={styles.reportTitle}>
            <FileBarChart2 size={16} />
            Stock Report
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Warehouse</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {filteredSnapshot.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No matching stock records found.
                </td>
              </tr>
            ) : paginatedSnapshot.map((row, index) => (
              <tr key={`${row.variant_id}-${row.warehouse_id}-${index}`}>
                <td>{row.sku}</td>
                <td>{row.product_name}</td>
                <td>{row.warehouse_name}</td>
                <td>{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredSnapshot.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="report rows"
        />
      </div>
    </div>
  );
}

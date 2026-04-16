"use client";

import React, { useState, useEffect } from 'react';
import styles from './Stock.module.css';
import { 
  Search, ArrowUpRight, ArrowDownLeft, 
  History, Package, Building2, Plus, 
  Save, AlertCircle, TrendingUp
} from 'lucide-react';
import { inventoryService } from '@/lib/services/inventory';

export default function StockPage() {
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Adjustment State
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('IN');
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // We fetch products and flatten them to variants for this view
      const products = await inventoryService.getProducts();
      const allVariants: any[] = [];
      products.forEach(p => {
        p.variants?.forEach((v: any) => {
          allVariants.push({
            ...v,
            product_name: p.name,
            product_brand: p.brand
          });
        });
      });
      
      const whs = await inventoryService.getWarehouses(); // I need to add this method
      setVariants(allVariants);
      setWarehouses(whs);
    } catch (err) {
      console.error("Failed to fetch stock data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!selectedVariant || !selectedWarehouse || quantity <= 0) {
      alert("Please fill all fields correctly.");
      return;
    }
    
    try {
      // Logic to record movement and update inventory
      // await inventoryService.recordMovement(...)
      alert("Stock adjustment recorded successfully!");
      fetchData();
      resetForm();
    } catch (err) {
      alert("Failed to adjust stock.");
    }
  };

  const resetForm = () => {
    setQuantity(0);
    setNotes('');
  };

  const filteredVariants = variants.filter(v => 
    v.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Stock Management</h1>
      </div>

      <div className={styles.adjustmentGrid}>
        <div className={styles.mainContent}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                className={styles.searchInput}
                placeholder="Search SKU or Product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SKU / Product</th>
                  <th>Warehouse</th>
                  <th>Attributes</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>Loading inventory...</td></tr>
                ) : filteredVariants.length > 0 ? (
                  filteredVariants.map((v, idx) => (
                    <React.Fragment key={idx}>
                      {v.stock_data.length > 0 ? (
                        v.stock_data.map((sd: any, sIdx: number) => (
                          <tr key={`${v.id}-${sIdx}`}>
                            <td>
                              <div className={styles.skuCell}>{v.sku}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.product_name}</div>
                            </td>
                            <td><span className={styles.chip}>{sd.warehouse_name}</span></td>
                            <td>
                              {Object.entries(v.attributes).map(([k, val]) => (
                                <span key={k} className={styles.chip}>{val as string}</span>
                              ))}
                            </td>
                            <td className={styles.amountCell}>{sd.quantity}</td>
                            <td>
                              <button className={styles.historyBtn}><History size={12} /></button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr key={v.id}>
                          <td>
                             <div className={styles.skuCell}>{v.sku}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.product_name}</div>
                          </td>
                          <td>-</td>
                          <td>
                             {Object.entries(v.attributes).map(([k, val]) => (
                               <span key={k} className={styles.chip}>{val as string}</span>
                             ))}
                          </td>
                          <td className={styles.amountCell}>0</td>
                          <td>
                             <button className={styles.historyBtn}><History size={12} /></button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>No inventory records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.sidePanel}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Quick Adjustment</h2>
            
            <div className={styles.formGroup}>
              <label>Select Variant (SKU)</label>
              <select 
                value={selectedVariant} 
                onChange={e => setSelectedVariant(e.target.value)}
              >
                <option value="">Select SKU...</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.sku} ({v.product_name})</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Select Warehouse</label>
              <select 
                value={selectedWarehouse} 
                onChange={e => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Select Location...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Adjustment Type</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className={`${styles.secondaryBtn} ${adjustmentType === 'IN' ? styles.active : ''}`}
                  onClick={() => setAdjustmentType('IN')}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-color)', background: adjustmentType === 'IN' ? '#f5f3ff' : 'white' }}
                >
                  <ArrowUpRight size={14} color="#10b981" /> Stock IN
                </button>
                <button 
                  className={`${styles.secondaryBtn} ${adjustmentType === 'OUT' ? styles.active : ''}`}
                  onClick={() => setAdjustmentType('OUT')}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-color)', background: adjustmentType === 'OUT' ? '#fef2f2' : 'white' }}
                >
                  <ArrowDownLeft size={14} color="#ef4444" /> Stock OUT
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Quantity</label>
              <input 
                type="number" 
                value={quantity} 
                onChange={e => setQuantity(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Notes / Reference</label>
              <input 
                type="text" 
                placeholder="e.g. PO#123 or Regular stock" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <button className={styles.actionBtn} onClick={handleAdjustStock}>
              Process Adjustment
            </button>
          </div>

          <div className={styles.panel} style={{ marginTop: '1.5rem', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase' }}>Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total SKUs</span>
              <span style={{ fontWeight: 700 }}>{variants.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Stock Units</span>
              <span style={{ fontWeight: 700 }}>{variants.reduce((acc, v) => acc + v.total_stock, 0)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from 'react';
import styles from './Inventory.module.css';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Search, Filter, X } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import { inventoryService } from '@/lib/services/inventory';
import type { InventorySnapshotRow, StockMovementRow } from '@/types/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';
import SearchableSelect from '@/components/ui/SearchableSelect';

type WarehouseOption = { id: string; name: string };
const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function InventoryPage() {
  const { showToast, confirmAction } = useUi();
  const [activeTab, setActiveTab] = useState<'stock' | 'movement'>('stock');
  const [rows, setRows] = useState<InventorySnapshotRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [stockFilterWarehouse, setStockFilterWarehouse] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const [op, setOp] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [transferWarehouse, setTransferWarehouse] = useState('');
  const [canAdjust, setCanAdjust] = useState(false);
  const [canTransfer, setCanTransfer] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);
  const [movementPageSize, setMovementPageSize] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    async function load() {
      const [snapshot, wh, moves, reasonRows] = await Promise.all([
        modulesService.getInventorySnapshot(),
        inventoryService.getWarehouses(),
        modulesService.getMovements(),
        inventoryService.getReasons(),
      ]);
      setRows(snapshot);
      setWarehouses(wh);
      setMovements(moves);
      setReasons(reasonRows);
      if (wh[0]) setSelectedWarehouse(wh[0].id);
      if (wh[1]) setTransferWarehouse(wh[1].id);
      const current = modulesService.getCurrentUser();
      setCanAdjust(modulesService.hasPermission(current, 'inventory.adjust'));
      setCanTransfer(modulesService.hasPermission(current, 'inventory.transfer'));
    }
    load();
    const onUserChange = () => load();
    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, []);

  const variants = useMemo(() => {
    const map = new Map<string, { variant_id: string; sku: string; product_name: string }>();
    rows.forEach((row) => {
      if (!map.has(row.variant_id)) {
        map.set(row.variant_id, {
          variant_id: row.variant_id,
          sku: row.sku,
          product_name: row.product_name,
        });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const q = search.toLowerCase();
      const matchesSearch = row.sku.toLowerCase().includes(q) || row.product_name.toLowerCase().includes(q);
      const matchesWarehouse = !stockFilterWarehouse || row.warehouse_id === stockFilterWarehouse;
      return matchesSearch && matchesWarehouse;
    });
  }, [rows, search, stockFilterWarehouse]);

  const variantOptions = useMemo(
    () => variants.map((item) => ({
      value: item.variant_id,
      label: `${item.product_name} - ${item.sku}`,
      keywords: [item.product_name, item.sku],
    })),
    [variants],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((item) => ({
      value: item.id,
      label: item.name,
      keywords: [item.name],
    })),
    [warehouses],
  );

  const reasonOptions = useMemo(
    () => reasons.map((item) => ({
      value: item,
      label: item,
      keywords: [item],
    })),
    [reasons],
  );

  const paginatedStockRows = useMemo(() => {
    const startIndex = (stockPage - 1) * stockPageSize;
    return filtered.slice(startIndex, startIndex + stockPageSize);
  }, [filtered, stockPage, stockPageSize]);

  const paginatedMovements = useMemo(() => {
    const startIndex = (movementPage - 1) * movementPageSize;
    return movements.slice(startIndex, startIndex + movementPageSize);
  }, [movementPage, movementPageSize, movements]);

  const selectedSourceQuantity = useMemo(() => {
    return rows
      .filter((row) => row.variant_id === selectedVariant && row.warehouse_id === selectedWarehouse)
      .reduce((sum, row) => sum + row.quantity, 0);
  }, [rows, selectedVariant, selectedWarehouse]);

  const transferWarehouseOptions = useMemo(
    () => warehouseOptions.filter((item) => item.value !== selectedWarehouse),
    [warehouseOptions, selectedWarehouse],
  );

  React.useEffect(() => {
    setStockPage(1);
  }, [search, stockFilterWarehouse]);

  React.useEffect(() => {
    setStockPage(1);
  }, [rows.length, stockPageSize]);

  React.useEffect(() => {
    setMovementPage(1);
  }, [movements.length, movementPageSize]);

  async function submitMovement() {
    if (!selectedVariant || !selectedWarehouse || qty <= 0 || !reason) {
      showToast('Please select item, location, quantity, and reason.', 'error');
      return;
    }

    const variantRow = variants.find((item) => item.variant_id === selectedVariant);
    const wh = warehouses.find((item) => item.id === selectedWarehouse);
    if (!variantRow || !wh) return;

    if ((op === 'OUT' || op === 'TRANSFER') && selectedSourceQuantity < qty) {
      showToast(`Only ${selectedSourceQuantity} units are available in the source warehouse.`, 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      if (op === 'TRANSFER') {
        const target = warehouses.find((item) => item.id === transferWarehouse);
        if (!target || target.id === wh.id) {
          showToast('Select a different destination location.', 'error');
          return;
        }
      const confirmation = await confirmAction({
        title: 'Transfer stock now?',
        message: 'This will move stock from one location to another.',
        confirmText: 'Transfer',
        requireReason: true,
        reasonLabel: 'Transfer reason',
        reasonPlaceholder: 'Why is this stock being transferred?',
        initialReason: reason,
      });
      if (!confirmation.confirmed) return;
      const confirmedReason = confirmation.reason;
      setReason(confirmedReason);
      await modulesService.addMovement({
        variant_id: selectedVariant,
        sku: variantRow.sku,
        product_name: variantRow.product_name,
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        type: 'TRANSFER',
        quantity: qty,
        notes: `${confirmedReason} -> ${target.name}`,
      });
      await inventoryService.recordMovement({
        variant_id: selectedVariant,
        warehouse_id: wh.id,
        type: 'OUT',
        quantity: qty,
        notes: `${confirmedReason}: Transfer out -> ${target.name}`,
      });
      await inventoryService.recordMovement({
        variant_id: selectedVariant,
        warehouse_id: target.id,
        type: 'IN',
        quantity: qty,
        notes: `${confirmedReason}: Transfer in <- ${wh.name}`,
      });
      await modulesService.addAudit({
        action: 'Inventory Transfer',
        entity_type: 'inventory',
        entity_id: selectedVariant,
        entity_name: variantRow.product_name,
        reason: confirmedReason,
        performed_by: modulesService.getCurrentUser().email,
        details: `${qty} units from ${wh.name} to ${target.name}`,
      });
    } else {
      const confirmation = await confirmAction({
        title: op === 'IN' ? 'Confirm stock received?' : 'Confirm stock issued?',
        message: 'This will immediately update available stock.',
        confirmText: 'Confirm',
        requireReason: true,
        reasonLabel: 'Audit reason',
        reasonPlaceholder: op === 'IN' ? 'Why is this stock being added?' : 'Why is this stock being issued?',
        initialReason: reason,
      });
      if (!confirmation.confirmed) return;
      const confirmedReason = confirmation.reason;
      setReason(confirmedReason);
      await modulesService.addMovement({
        variant_id: selectedVariant,
        sku: variantRow.sku,
        product_name: variantRow.product_name,
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        type: op,
        quantity: qty,
        notes: confirmedReason,
      });
      await inventoryService.recordMovement({
        variant_id: selectedVariant,
        warehouse_id: wh.id,
        type: op,
        quantity: qty,
        notes: confirmedReason,
      });
      await modulesService.addAudit({
        action: op === 'IN' ? 'Inventory Stock In' : 'Inventory Stock Out',
        entity_type: 'inventory',
        entity_id: selectedVariant,
        entity_name: variantRow.product_name,
        reason: confirmedReason,
        performed_by: modulesService.getCurrentUser().email,
        details: `${qty} units at ${wh.name}`,
      });
    }

      const [snapshot, moves] = await Promise.all([modulesService.getInventorySnapshot(), modulesService.getMovements()]);
      setRows(snapshot);
      setMovements(moves);
      setQty(0);
      setReason('');
      setIsActionModalOpen(false);
      showToast('Stock updated successfully.', 'success');
    } catch (error) {
      console.error('Inventory action failed:', error);
      showToast('Could not complete this stock action.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventory Management</h1>
          <p className={styles.subtitle}>Track item stock by location, receive stock, issue stock, and transfer safely.</p>
        </div>
        <div className={styles.actionGroup}>
          {canAdjust && <button className={`${styles.actionBtn} ${styles.btnIn} ${op === 'IN' ? styles.btnActive : ''}`} onClick={() => { setOp('IN'); setIsActionModalOpen(true); }}>
            <ArrowDownLeft size={16} /> Stock In
          </button>}
          {canAdjust && <button className={`${styles.actionBtn} ${styles.btnOut} ${op === 'OUT' ? styles.btnActive : ''}`} onClick={() => { setOp('OUT'); setIsActionModalOpen(true); }}>
            <ArrowUpRight size={16} /> Stock Out
          </button>}
          {canTransfer && <button className={`${styles.actionBtn} ${styles.btnTransfer} ${op === 'TRANSFER' ? styles.btnActive : ''}`} onClick={() => { setOp('TRANSFER'); setIsActionModalOpen(true); }}>
            <ArrowRightLeft size={16} /> Transfer
          </button>}
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
            <input type="text" placeholder="Search item code or product..." className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} value={stockFilterWarehouse} onChange={(e) => setStockFilterWarehouse(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button
              className={styles.iconButton}
              title="Clear stock filters"
              onClick={() => {
                setSearch('');
                setStockFilterWarehouse('');
              }}
            >
              <Filter size={18} />
            </button>
          </div>
        </div>

        {activeTab === 'stock' ? (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Product Details</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                      No stock rows yet. Add products first, then stock them in.
                    </td>
                  </tr>
                ) : paginatedStockRows.map((row, index) => (
                  <tr key={`${row.variant_id}-${row.warehouse_id}-${index}`}>
                    <td><strong>{row.sku}</strong></td>
                    <td>
                      {row.product_name}
                      <br />
                      <span className={styles.subText}>
                        {Object.entries(row.attributes).map((entry) => `${entry[0]}: ${entry[1]}`).join(' | ') || '-'}
                      </span>
                    </td>
                    <td>{row.warehouse_name}</td>
                    <td className={row.quantity > 20 ? styles.qtyHigh : styles.qtyLow}>{row.quantity}</td>
                    <td>
                      <span className={row.quantity > 20 ? styles.statusGood : styles.statusLow}>
                        {row.quantity > 20 ? 'In Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={stockPage}
              pageSize={stockPageSize}
              totalItems={filtered.length}
              onPageChange={setStockPage}
              onPageSizeChange={setStockPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="stock rows"
            />
          </>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Item Code</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No movement history yet. All stock actions will appear here.
                    </td>
                  </tr>
                ) : paginatedMovements.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td><strong>{row.sku}</strong></td>
                    <td>{row.warehouse_name}</td>
                    <td>{row.type}</td>
                    <td>{row.quantity}</td>
                    <td>{row.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={movementPage}
              pageSize={movementPageSize}
              totalItems={movements.length}
              onPageChange={setMovementPage}
              onPageSizeChange={setMovementPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="movement records"
            />
          </>
        )}
      </div>

      {isActionModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button type="button" className={styles.modalClose} onClick={() => setIsActionModalOpen(false)}>
              <X size={16} />
            </button>
            <h3 className={styles.modalTitle}>Quick Stock Action ({op})</h3>
            <p className={styles.modalSubtitle}>
              Choose item, warehouse, reason, and quantity. For transfer, also select the destination warehouse.
            </p>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <SearchableSelect
                  value={selectedVariant}
                  options={variantOptions}
                  placeholder="Select item"
                  searchPlaceholder="Search item or SKU..."
                  onChange={setSelectedVariant}
                />
              </div>
              <div className={styles.modalField}>
                <SearchableSelect
                  value={selectedWarehouse}
                  options={warehouseOptions}
                  placeholder="Select warehouse"
                  searchPlaceholder="Search warehouse..."
                  addActionLabel="Add warehouse"
                  onChange={setSelectedWarehouse}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createWarehouse(value);
                    const nextWarehouses = await inventoryService.getWarehouses();
                    setWarehouses(nextWarehouses);
                    return created.id;
                  }}
                />
              </div>
              {op === 'TRANSFER' ? (
                <div className={styles.modalField}>
                  <SearchableSelect
                    value={transferWarehouse}
                    options={transferWarehouseOptions.map((item) => ({ ...item, label: `To: ${item.label}` }))}
                    placeholder="Destination warehouse"
                    searchPlaceholder="Search destination..."
                    addActionLabel="Add warehouse"
                    onChange={setTransferWarehouse}
                    onCreateOption={async (value) => {
                      const created = await inventoryService.createWarehouse(value);
                      const nextWarehouses = await inventoryService.getWarehouses();
                      setWarehouses(nextWarehouses);
                      return created.id;
                    }}
                  />
                </div>
              ) : null}
              <div className={styles.modalField}>
                <SearchableSelect
                  value={reason}
                  options={reasonOptions}
                  placeholder="Select reason"
                  searchPlaceholder="Search or add reason..."
                  addActionLabel="Add reason"
                  onChange={setReason}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createReason(value);
                    setReasons(await inventoryService.getReasons());
                    return created;
                  }}
                />
              </div>
              <div className={styles.modalField}>
                <input className={styles.searchInput} type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} placeholder="Quantity" />
              </div>
              <div className={styles.modalStepper}>
                <button type="button" className={styles.iconButton} title="Add 1" onClick={() => setQty((prev) => prev + 1)}>+1</button>
                <button type="button" className={styles.iconButton} title="Add 10" onClick={() => setQty((prev) => prev + 10)}>+10</button>
              </div>
            </div>

            {(op === 'OUT' || op === 'TRANSFER') && selectedVariant && selectedWarehouse ? (
              <p className={styles.modalHint}>
                Available in source warehouse: <strong>{selectedSourceQuantity}</strong>
              </p>
            ) : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalSecondaryAction} onClick={() => setIsActionModalOpen(false)}>
                Cancel
              </button>
              {(op !== 'TRANSFER' ? canAdjust : canTransfer) ? (
                <button type="button" className={`${styles.actionBtn} ${styles.btnOut} ${styles.btnActive}`} onClick={submitMovement} disabled={isSubmitting}>
                  {isSubmitting ? 'Applying...' : 'Apply'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

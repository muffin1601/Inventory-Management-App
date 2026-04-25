"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Stock.module.css';
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { inventoryService } from '@/lib/services/inventory';
import { modulesService } from '@/lib/services/modules';
import { projectsService, type BoqItemRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';
import SearchableSelect from '@/components/ui/SearchableSelect';
import type { OrderRow } from '@/types/modules';

type WarehouseOption = { id: string; name: string };
type StockDataRow = { inventory_id?: string; warehouse_id?: string; warehouse_name: string; quantity: number };
type StockVariant = {
  id: string;
  sku: string;
  product_name: string;
  product_brand?: string;
  attributes: Record<string, string>;
  stock_data: StockDataRow[];
  total_stock: number;
};
type FlatStockRow = {
  rowKey: string;
  inventoryId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantSummary: string;
  manufacturer: string;
  warehouseId: string;
  warehouseName: string;
  unit: string;
  stock: number;
  promised: number;
  free: number;
  attributes: Record<string, string>;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];
function sanitizeAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value && value.trim().length > 0),
  );
}

function buildVariantSummary(sku: string, attributes: Record<string, string>) {
  const visibleAttributes = Object.entries(attributes)
    .filter(([key]) => key !== 'Manufacturer' && key !== 'Unit')
    .map(([key, value]) => `${key}: ${value}`);

  return [sku, ...visibleAttributes].join(' | ');
}

function normalizeText(value: string | undefined) {
  return String(value || '').trim().toLowerCase();
}

function matchesBoqItem(variant: StockVariant, boqItem: BoqItemRecord) {
  const itemName = normalizeText(boqItem.item_name);
  const productName = normalizeText(variant.product_name);
  const sku = normalizeText(variant.sku);
  const variantSummary = normalizeText(buildVariantSummary(variant.sku, variant.attributes));
  const productManufacturer = normalizeText(variant.attributes.Manufacturer || variant.product_brand || '');
  const boqManufacturer = normalizeText(boqItem.manufacturer);
  const unit = normalizeText(variant.attributes.Unit);
  const boqUnit = normalizeText(boqItem.unit);

  if (!itemName) return false;
  
  // 1. Precise SKU match (Best)
  if (sku && (itemName === sku || itemName.includes(sku))) return true;
  
  // 2. Exact product name match
  if (itemName === productName) return true;
  
  // 3. Partial name match - only if more specific info (like SKU) isn't contradicting
  // If itemName has a SKU-like pattern in it, and it doesn't match this variant's SKU, don't match
  const itemNameSkuMatch = itemName.match(/\(([^)]+)\)/);
  if (itemNameSkuMatch && sku && itemNameSkuMatch[1] !== sku) return false;

  if (productName && itemName.includes(productName)) return true;
  
  if (boqManufacturer && productManufacturer && boqManufacturer === productManufacturer && productName && itemName.includes(productName)) return true;
  if (boqUnit && unit && boqUnit === unit && productName && itemName.includes(productName)) return true;
  return false;
}

function buildAuditNote(action: string, reason: string, actor: string, extraNotes?: string) {
  return [
    `${action}`,
    `Reason: ${reason}`,
    `By: ${actor}`,
    extraNotes?.trim() ? `Notes: ${extraNotes.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

export default function StockPage() {
  const { showToast } = useUi();
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<StockVariant[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [boqItems, setBoqItems] = useState<BoqItemRecord[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const [canAdjust, setCanAdjust] = useState(false);
  const [canEditProducts, setCanEditProducts] = useState(false);
  const [canDeleteProducts, setCanDeleteProducts] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingRow, setEditingRow] = useState<FlatStockRow | null>(null);
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editUnit, setEditUnit] = useState('Numbers');
  const [editStock, setEditStock] = useState(0);
  const [editReason, setEditReason] = useState('');

  const [deleteRow, setDeleteRow] = useState<FlatStockRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [products, warehouseRows, manufacturerRows, existingOrders, unitRows, reasonRows, boqResult] = await Promise.all([
        inventoryService.getProducts() as Promise<Array<{ name: string; brand?: string; variants?: StockVariant[] }>>,
        inventoryService.getWarehouses(),
        inventoryService.getManufacturers(),
        modulesService.getOrders(),
        inventoryService.getUnits(),
        inventoryService.getReasons(),
        projectsService.listAllBoqItems(),
      ]);

      const allVariants: StockVariant[] = [];
      products.forEach((product) => {
        product.variants?.forEach((variant) => {
          allVariants.push({
            ...variant,
            product_name: product.name,
            product_brand: product.brand,
          });
        });
      });

      setVariants(allVariants);
      setWarehouses(warehouseRows);
      setManufacturers(manufacturerRows.map((item: { name: string }) => item.name));
      setOrders(existingOrders);
      setBoqItems(boqResult);
      setUnits(unitRows);
      setReasons(reasonRows);

      const current = await modulesService.getCurrentUser();
      setCanAdjust(current ? await modulesService.hasPermission(current, 'inventory.adjust') : false);
      setCanEditProducts(current ? await modulesService.hasPermission(current, 'products.edit') : false);
      setCanDeleteProducts(current ? await modulesService.hasPermission(current, 'products.delete') : false);
    } catch (err) {
      console.error('Failed to fetch stock data:', err);
      showToast('Could not load stock data right now.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
    const onUserChange = () => fetchData();
    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, [fetchData]);

  const promisedMap = useMemo(() => {
    const next = new Map<string, number>();

    orders
      .filter((order) => order.status === 'pending_approval' && order.type === 'SALE')
      .forEach((order) => {
        const key = `${order.variant_id}::${order.warehouse_id}`;
        next.set(key, (next.get(key) || 0) + (order.quantity || 0));
      });

    return next;
  }, [orders]);

  const boqReserved = useMemo(() => {
    const warehouseMap = new Map<string, number>(); // key: variantId::warehouseId
    const globalMap = new Map<string, number>();    // key: variantId

    boqItems.forEach((item) => {
      const remaining = Math.max(item.quantity - (item.delivered || 0), 0);
      if (remaining <= 0) return;
      
      let foundVariant = item.variant_id ? variants.find((variant) => variant.id === item.variant_id) : undefined;
      if (!foundVariant) {
        foundVariant = variants.find((variant) => matchesBoqItem(variant, item));
      }
      if (!foundVariant) return;

      if (item.warehouse_id) {
        const key = `${foundVariant.id}::${item.warehouse_id}`;
        warehouseMap.set(key, (warehouseMap.get(key) || 0) + remaining);
      } else {
        globalMap.set(foundVariant.id, (globalMap.get(foundVariant.id) || 0) + remaining);
      }
    });

    return { warehouseMap, globalMap };
  }, [boqItems, variants]);

  const filteredVariants = useMemo(
    () => variants.filter((variant) => {
      const query = searchTerm.toLowerCase();
      return (
        variant.sku.toLowerCase().includes(query) ||
        variant.product_name.toLowerCase().includes(query) ||
        (variant.attributes.Manufacturer || variant.product_brand || '').toLowerCase().includes(query)
      );
    }),
    [searchTerm, variants],
  );

  const stockRows = useMemo<FlatStockRow[]>(() => (
    filteredVariants.flatMap((variant) => {
      const manufacturer = variant.attributes.Manufacturer || variant.product_brand || '-';
      const unit = variant.attributes.Unit || 'Numbers';
      const variantSummary = buildVariantSummary(variant.sku, variant.attributes);

      let remainingGlobalBoq = boqReserved.globalMap.get(variant.id) || 0;

      if (variant.stock_data.length === 0) {
        const explicitWarehousePromise = Array.from(boqReserved.warehouseMap.entries())
          .filter(([key]) => key.startsWith(`${variant.id}::`))
          .reduce((sum, [, qty]) => sum + qty, 0);
        
        const totalPromised = remainingGlobalBoq + explicitWarehousePromise;
        
        return [{
          rowKey: `${variant.id}-unassigned`,
          inventoryId: '',
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.product_name,
          variantSummary,
          manufacturer,
          warehouseId: '',
          warehouseName: '-',
          unit,
          stock: 0,
          reserved: 0,
          promised: totalPromised,
          free: -totalPromised,
          attributes: variant.attributes,
        }];
      }
      
      return variant.stock_data.map((stockRow, index) => {
        const warehouseId = stockRow.warehouse_id || '';
        const warehouseKey = `${variant.id}::${warehouseId}`;
        const orderPromised = promisedMap.get(warehouseKey) || 0;
        
        // 1. Start with explicit warehouse promise from BOQ
        const explicitBoqPromise = boqReserved.warehouseMap.get(warehouseKey) || 0;
        
        // 2. Add global BOQ promise (waterfall allocation)
        const availableForGlobalBoq = Math.max(stockRow.quantity - orderPromised - explicitBoqPromise, 0);
        const globalBoqAllocated = Math.min(availableForGlobalBoq, remainingGlobalBoq);
        remainingGlobalBoq = Math.max(remainingGlobalBoq - globalBoqAllocated, 0);
        
        // 3. Handle overflow on the last row
        const isLastRow = index === variant.stock_data.length - 1;
        const boqOverflow = isLastRow ? remainingGlobalBoq : 0;
        
        // Total promised = orders + BOQ allocation + overflow
        const totalPromised = orderPromised + explicitBoqPromise + globalBoqAllocated + boqOverflow;

        return {
          rowKey: `${variant.id}-${stockRow.warehouse_id || index}`,
          inventoryId: stockRow.inventory_id || '',
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.product_name,
          variantSummary,
          manufacturer,
          warehouseId: stockRow.warehouse_id || '',
          warehouseName: stockRow.warehouse_name,
          unit,
          stock: stockRow.quantity,
          promised: totalPromised,
          free: stockRow.quantity - totalPromised,
          attributes: variant.attributes,
        };
      });
    })
  ), [boqReserved, filteredVariants, promisedMap]);

  // Track which BOQ items are NOT matched to any inventory product
  const unmatchedBoqItems = useMemo(() => {
    return boqItems.filter(item => {
      const remaining = item.quantity - (item.delivered || 0);
      if (remaining <= 0) return false;
      
      const hasMatch = variants.some(v => 
        (item.variant_id && v.id === item.variant_id) || 
        matchesBoqItem(v, item)
      );
      return !hasMatch;
    });
  }, [boqItems, variants]);

  const paginatedStockRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return stockRows.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, stockRows]);

  const variantOptions = useMemo(
    () => variants.map((variant) => ({
      value: variant.id,
      label: `${variant.product_name} - ${variant.sku}`,
      keywords: [
        variant.product_name,
        variant.sku,
        variant.attributes.Manufacturer || variant.product_brand || '',
      ],
    })),
    [variants],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({
      value: warehouse.id,
      label: warehouse.name,
      keywords: [warehouse.name],
    })),
    [warehouses],
  );

  const reasonOptions = useMemo(
    () => reasons.map((reason) => ({
      value: reason,
      label: reason,
      keywords: [reason],
    })),
    [reasons],
  );

  const manufacturerOptions = useMemo(
    () => manufacturers.map((manufacturer) => ({
      value: manufacturer,
      label: manufacturer,
      keywords: [manufacturer],
    })),
    [manufacturers],
  );

  const unitOptions = useMemo(
    () => units.map((unit) => ({
      value: unit,
      label: unit,
      keywords: [unit],
    })),
    [units],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, searchTerm, stockRows.length]);

  function resetAdjustmentForm() {
    setSelectedVariant('');
    setSelectedWarehouse('');
    setQuantity(0);
    setAdjustmentReason('');
    setAdjustmentType('IN');
  }

  function openEditModal(row: FlatStockRow) {
    setEditingRow(row);
    setEditWarehouseId(row.warehouseId);
    setEditManufacturer(row.manufacturer === '-' ? '' : row.manufacturer);
    setEditUnit(row.unit || 'Numbers');
    setEditStock(row.stock);
    setEditReason('');
  }

  function closeEditModal() {
    setEditingRow(null);
    setEditReason('');
  }

  function openDeleteModal(row: FlatStockRow) {
    setDeleteRow(row);
    setDeleteReason('');
  }

  function closeDeleteModal() {
    setDeleteRow(null);
    setDeleteReason('');
  }

  async function handleAdjustStock() {
    if (!selectedVariant || !selectedWarehouse || quantity <= 0) {
      showToast('Please complete item, warehouse, and quantity.', 'error');
      return;
    }

    const effectiveReason = adjustmentReason || 'Stock Adjustment';

    try {
      const variant = variants.find((item) => item.id === selectedVariant);
      const warehouse = warehouses.find((item) => item.id === selectedWarehouse);
      if (!variant || !warehouse) return;

      const actor = await modulesService.getCurrentUser();
      const actorLabel = actor ? `${actor.full_name} (${actor.email})` : 'Unknown User';
      const auditNote = buildAuditNote(
        `Stock ${adjustmentType}`,
        effectiveReason,
        actorLabel,
      );

      await inventoryService.recordMovement({
        variant_id: selectedVariant,
        warehouse_id: selectedWarehouse,
        type: adjustmentType,
        quantity,
        notes: auditNote,
      });

      await modulesService.addMovement({
        variant_id: selectedVariant,
        sku: variant.sku,
        product_name: variant.product_name,
        warehouse_id: selectedWarehouse,
        warehouse_name: warehouse.name,
        type: adjustmentType,
        quantity,
        notes: auditNote,
      });

      showToast('Stock updated successfully.', 'success');
      resetAdjustmentForm();
      await fetchData();
    } catch (err) {
      console.error('Could not update stock:', err);
      showToast('Could not update stock. Please try again.', 'error');
    }
  }

  async function handleSaveEdit() {
    if (!editingRow || !editWarehouseId || editStock < 0) {
      showToast('Please complete warehouse and stock.', 'error');
      return;
    }

    const effectiveReason = editReason || 'Manual Inventory Update';

    try {
      const actor = await modulesService.getCurrentUser();
      const actorLabel = actor ? `${actor.full_name} (${actor.email})` : 'Unknown User';
      const auditNote = buildAuditNote('Stock Row Edit', effectiveReason, actorLabel);
      const sanitizedAttributes = sanitizeAttributes({
        ...editingRow.attributes,
        Manufacturer: editManufacturer.trim(),
        Unit: editUnit,
      });
      const warehouse = warehouses.find((item) => item.id === editWarehouseId);

      await inventoryService.recordMovement({
        variant_id: editingRow.variantId,
        warehouse_id: editWarehouseId,
        type: 'ADJUSTMENT',
        quantity: 0,
        notes: auditNote,
      });

      await inventoryService.updateVariantDetails({
        variantId: editingRow.variantId,
        attributes: sanitizedAttributes,
        warehouseId: editWarehouseId,
        quantity: editStock,
        inventoryId: editingRow.inventoryId,
      });

      await modulesService.addMovement({
        variant_id: editingRow.variantId,
        sku: editingRow.sku,
        product_name: editingRow.productName,
        warehouse_id: editWarehouseId,
        warehouse_name: warehouse?.name || editingRow.warehouseName,
        type: 'ADJUSTMENT',
        quantity: 0,
        notes: auditNote,
      });

      closeEditModal();
      showToast('Stock row updated.', 'success');
      await fetchData();
    } catch (err) {
      console.error('Error updating stock row:', err);
      showToast('Could not update this stock row.', 'error');
    }
  }

  async function handleDeleteRow() {
    if (!deleteRow) {
      showToast('Please select a row to delete.', 'error');
      return;
    }

    const effectiveReason = deleteReason || 'Record Deletion';

    try {
      const actor = await modulesService.getCurrentUser();
      const actorLabel = actor ? `${actor.full_name} (${actor.email})` : 'Unknown User';
      const auditNote = buildAuditNote('Variant Delete', effectiveReason, actorLabel);

      await inventoryService.recordMovement({
        variant_id: deleteRow.variantId,
        warehouse_id: deleteRow.warehouseId || 'unassigned',
        type: 'ADJUSTMENT',
        quantity: 0,
        notes: auditNote,
      });

      await modulesService.addMovement({
        variant_id: deleteRow.variantId,
        sku: deleteRow.sku,
        product_name: deleteRow.productName,
        warehouse_id: deleteRow.warehouseId || 'unassigned',
        warehouse_name: deleteRow.warehouseName,
        type: 'ADJUSTMENT',
        quantity: 0,
        notes: auditNote,
      });

      await inventoryService.deleteVariant(deleteRow.variantId);

      closeDeleteModal();
      showToast('Stock item deleted.', 'success');
      await fetchData();
    } catch (err) {
      console.error('Error deleting stock row:', err);
      showToast('Could not delete this stock item.', 'error');
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Stock Management</h1>
          <p className={styles.subtitle}>Review live stock, reserved quantities, and audited changes by product row.</p>
        </div>
      </div>

      <div className={styles.adjustmentGrid}>
        <div className={styles.mainContent}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search product, SKU, or manufacturer..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Manufacturer</th>
                  <th>Warehouse</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Promised</th>
                  <th style={{ textAlign: 'right' }}>Free</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>Loading inventory...</td>
                  </tr>
                ) : stockRows.length > 0 ? (
                  paginatedStockRows.map((row) => (
                    <tr key={row.rowKey}>
                      <td>
                        <div className={styles.itemName}>
                          {row.productName} ({row.variantSummary})
                        </div>
                      </td>
                      <td>{row.manufacturer}</td>
                      <td>{row.warehouseName === '-' ? '-' : <span className={styles.chip}>{row.warehouseName}</span>}</td>
                      <td>{row.unit}</td>
                      <td className={styles.amountCell}>{row.stock}</td>
                      <td className={styles.amountCell}>{row.promised}</td>
                      <td className={row.free < 0 ? styles.amountDanger : styles.amountFree}>{row.free}</td>
                      <td>
                        <div className={styles.actionGroup}>
                          {canEditProducts ? (
                            <button
                              type="button"
                              className={styles.iconAction}
                              title="Edit stock row"
                              onClick={() => openEditModal(row)}
                            >
                              <Pencil size={14} />
                            </button>
                          ) : null}
                          {canDeleteProducts ? (
                            <button
                              type="button"
                              className={`${styles.iconAction} ${styles.iconDelete}`}
                              title="Delete stock row"
                              onClick={() => openDeleteModal(row)}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>No inventory records found.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={stockRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="stock rows"
            />
          </div>

          {unmatchedBoqItems.length > 0 && (
            <div className={styles.warningBox}>
              <div className={styles.warningTitle}>
                <AlertCircle size={16} /> Unmatched BOQ Items ({unmatchedBoqItems.length})
              </div>
              <p className={styles.warningText}>
                The following items are in project BOQs but don't match any inventory product name/SKU. 
                They are NOT being counted in the "Promised" stock above.
              </p>
              <div className={styles.warningList}>
                {unmatchedBoqItems.slice(0, 5).map(item => (
                  <div key={item.id} className={styles.warningItem}>
                    • {item.item_name} ({item.quantity - (item.delivered || 0)} {item.unit} remaining)
                  </div>
                ))}
                {unmatchedBoqItems.length > 5 && <div className={styles.warningMore}>+ {unmatchedBoqItems.length - 5} more...</div>}
              </div>
            </div>
          )}
        </div>

        <aside className={styles.sidePanel}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Quick Adjustment</h2>

            <div className={styles.formGroup}>
              <SearchableSelect
                label="Select Item"
                value={selectedVariant}
                options={variantOptions}
                placeholder="Select item..."
                searchPlaceholder="Search item or SKU..."
                onChange={setSelectedVariant}
              />
            </div>

            <div className={styles.formGroup}>
              <SearchableSelect
                label="Select Warehouse"
                value={selectedWarehouse}
                options={warehouseOptions}
                placeholder="Select location..."
                searchPlaceholder="Search warehouse..."
                addActionLabel="Add warehouse"
                onChange={setSelectedWarehouse}
                onCreateOption={async (value) => {
                  const created = await inventoryService.createWarehouse(value);
                  setWarehouses(await inventoryService.getWarehouses());
                  return created.id;
                }}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Adjustment Type</label>
              <div className={styles.adjustmentToggle}>
                <button
                  type="button"
                  className={`${styles.secondaryBtn} ${adjustmentType === 'IN' ? styles.active : ''}`}
                  onClick={() => setAdjustmentType('IN')}
                >
                  <ArrowUpRight size={14} color="currentColor" /> Stock IN
                </button>
                <button
                  type="button"
                  className={`${styles.secondaryBtn} ${adjustmentType === 'OUT' ? styles.active : ''}`}
                  onClick={() => setAdjustmentType('OUT')}
                >
                  <ArrowDownLeft size={14} color="currentColor" /> Stock OUT
                </button>
              </div>
            </div>

            {/* Reason field temporarily removed
            <div className={styles.formGroup}>
              <SearchableSelect
                label="Reason"
                value={adjustmentReason}
                options={reasonOptions}
                placeholder="Select reason..."
                searchPlaceholder="Search or add reason..."
                addActionLabel="Add reason"
                onChange={setAdjustmentReason}
                onCreateOption={async (value) => {
                  const created = await inventoryService.createReason(value);
                  setReasons(await inventoryService.getReasons());
                  return created;
                }}
              />
            </div>
            */}

            <div className={styles.formGroup}>
              <label>Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(parseInt(event.target.value, 10) || 0)}
              />
            </div>

            {canAdjust ? (
              <button className={styles.actionBtn} onClick={handleAdjustStock}>
                Process Adjustment
              </button>
            ) : null}

            <p className={styles.helperText}>
              Every stock adjustment now requires a reason and is stamped with the acting user for audit tracing.
            </p>
          </div>

          <div className={styles.panelMuted}>
            <h3 className={styles.summaryTitle}>Summary</h3>
            <div className={styles.summaryRow}>
              <span>Total Products</span>
              <strong>{variants.length}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total Stock Units</span>
              <strong>{stockRows.reduce((sum, row) => sum + row.stock, 0)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total Promised</span>
              <strong>{stockRows.reduce((sum, row) => sum + row.promised, 0)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total Free</span>
              <strong>{stockRows.reduce((sum, row) => sum + row.free, 0)}</strong>
            </div>
          </div>
        </aside>
      </div>

      {editingRow ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button type="button" className={styles.modalClose} onClick={closeEditModal}>
              <X size={16} />
            </button>
            <h2 className={styles.modalTitle}>Edit Stock Row</h2>
            <p className={styles.modalSubtitle}>{editingRow.productName} · {editingRow.sku}</p>

            <div className={styles.modalGrid}>
              <div className={styles.formGroup}>
                <SearchableSelect
                  label="Manufacturer"
                  value={editManufacturer}
                  options={manufacturerOptions}
                  placeholder="Select manufacturer..."
                  searchPlaceholder="Search or add manufacturer..."
                  addActionLabel="Add manufacturer"
                  onChange={setEditManufacturer}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createManufacturer(value);
                    const nextManufacturers = await inventoryService.getManufacturers();
                    setManufacturers(nextManufacturers.map((item: { name: string }) => item.name));
                    return created.name;
                  }}
                />
              </div>

              <div className={styles.formGroup}>
                <SearchableSelect
                  label="Unit"
                  value={editUnit}
                  options={unitOptions}
                  placeholder="Select unit..."
                  searchPlaceholder="Search or add unit..."
                  addActionLabel="Add unit"
                  onChange={setEditUnit}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createUnit(value);
                    setUnits(await inventoryService.getUnits());
                    return created;
                  }}
                />
              </div>

              <div className={styles.formGroup}>
                <SearchableSelect
                  label="Warehouse"
                  value={editWarehouseId}
                  options={warehouseOptions}
                  placeholder="Select warehouse..."
                  searchPlaceholder="Search warehouse..."
                  addActionLabel="Add warehouse"
                  onChange={setEditWarehouseId}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createWarehouse(value);
                    setWarehouses(await inventoryService.getWarehouses());
                    return created.id;
                  }}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Stock</label>
                <input
                  type="number"
                  value={editStock}
                  onChange={(event) => setEditStock(parseInt(event.target.value, 10) || 0)}
                />
              </div>

              {/* Reason field temporarily removed
              <div className={styles.formGroup}>
                <SearchableSelect
                  label="Reason"
                  value={editReason}
                  options={reasonOptions}
                  placeholder="Select reason..."
                  searchPlaceholder="Search or add reason..."
                  addActionLabel="Add reason"
                  onChange={setEditReason}
                  onCreateOption={async (value) => {
                    const created = await inventoryService.createReason(value);
                    setReasons(await inventoryService.getReasons());
                    return created;
                  }}
                />
              </div>
              */}

            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={closeEditModal}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteRow ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button type="button" className={styles.modalClose} onClick={closeDeleteModal}>
              <X size={16} />
            </button>
            <h2 className={styles.modalTitle}>Delete Stock Item</h2>
            <p className={styles.modalSubtitle}>This removes the variant from stock tracking and requires an audit reason.</p>

            <div className={styles.formGroup}>
              <SearchableSelect
                label="Reason"
                value={deleteReason}
                options={reasonOptions}
                placeholder="Select reason..."
                searchPlaceholder="Search or add reason..."
                addActionLabel="Add reason"
                onChange={setDeleteReason}
                onCreateOption={async (value) => {
                  const created = await inventoryService.createReason(value);
                  setReasons(await inventoryService.getReasons());
                  return created;
                }}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={closeDeleteModal}>Keep Item</button>
              <button type="button" className={styles.dangerAction} onClick={handleDeleteRow}>Delete Item</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

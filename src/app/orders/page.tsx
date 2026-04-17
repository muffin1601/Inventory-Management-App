"use client";

import React, { useMemo, useState } from 'react';
import styles from './Orders.module.css';
import { Search, Filter, ArrowRight, Eye, Plus, Trash2 } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import { inventoryService } from '@/lib/services/inventory';
import { projectsService } from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderType } from '@/types/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

type VendorOption = { id: string; name: string; delivery_address?: string; payment_terms?: string };
type ProjectOption = { id: string; name: string };
type VariantOption = {
  id: string;
  sku: string;
  product_name: string;
  unit?: string;
  price?: number;
  total_stock: number;
  warehouse_id?: string;
  warehouse_name?: string;
};

type ProductWithVariants = {
  name: string;
  variants?: Array<{
    id: string;
    sku: string;
    price?: number;
    attributes?: Record<string, string>;
    total_stock?: number;
    stock_data?: Array<{ warehouse_id?: string; warehouse_name?: string }>; 
  }>;
};

type PurchaseOrderLineDraft = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  unit: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
  price: number;
  max_stock: number;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function createDraftLine(): PurchaseOrderLineDraft {
  return {
    id: `line_${Math.random().toString(36).slice(2, 10)}`,
    variant_id: '',
    sku: '',
    product_name: '',
    unit: '',
    warehouse_id: '',
    warehouse_name: '',
    quantity: 1,
    price: 0,
    max_stock: 0,
  };
}

export default function OrdersPage() {
  const { showToast, confirmAction } = useUi();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkSelectorOpen, setBulkSelectorOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({ vendor_id: '', project_id: '', delivery_address: '', payment_terms: '' });
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>([createDraftLine()]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderRow['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [canCreate, setCanCreate] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canCancel, setCanCancel] = useState(false);

  React.useEffect(() => {
    async function load() {
      const [existingOrders, productsData, vendorResponse, projectList] = await Promise.all([
        modulesService.getOrders(),
        inventoryService.getProducts(),
        supabase.from('vendors').select('id, name, delivery_address, payment_terms').order('name'),
        projectsService.listProjects(),
      ]);

      const vendorItems = vendorResponse.data || [];
      setOrders(existingOrders);
      setProducts(productsData as ProductWithVariants[]);
      setVendors(vendorItems.map((vendor) => ({ 
        id: vendor.id, 
        name: vendor.name,
        delivery_address: vendor.delivery_address || '',
        payment_terms: vendor.payment_terms || '',
      })));
      setProjects(projectList.projects || []);

      const current = modulesService.getCurrentUser();
      setCanCreate(modulesService.hasPermission(current, 'orders.create'));
      setCanApprove(modulesService.hasPermission(current, 'orders.approve'));
      setCanCancel(modulesService.hasPermission(current, 'orders.cancel'));
    }

    load();
    const onUserChange = () => load();
    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, []);

  const variantOptions = useMemo(() => {
    return products.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        product_name: product.name,
        unit: variant.attributes?.Unit || variant.attributes?.unit || '',
        price: variant.price || 0,
        total_stock: variant.total_stock || 0,
        warehouse_id: variant.stock_data?.[0]?.warehouse_id || 'unknown',
        warehouse_name: variant.stock_data?.[0]?.warehouse_name || 'Unknown',
      })),
    );
  }, [products]);

  const variantLookup = useMemo(
    () => new Map(variantOptions.map((variant) => [variant.id, variant])),
    [variantOptions],
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = search.toLowerCase();
      const entityName = (order.vendor_name || order.entity_name || '').toLowerCase();
      const projectName = (order.project_name || '').toLowerCase();
      const itemMatches = (order.items || []).some((item) => item.sku.toLowerCase().includes(query) || item.product_name.toLowerCase().includes(query));
      const hit = order.order_number.toLowerCase().includes(query) || entityName.includes(query) || projectName.includes(query) || itemMatches || (order.sku || '').toLowerCase().includes(query);
      const hitType = typeFilter === 'ALL' || order.type === typeFilter;
      const hitStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return hit && hitType && hitStatus;
    });
  }, [orders, search, statusFilter, typeFilter]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [orders.length, pageSize, search, statusFilter, typeFilter]);

  async function refreshOrders() {
    const data = await modulesService.getOrders();
    setOrders(data);
  }

  function updateLine(lineId: string, updates: Partial<PurchaseOrderLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, createDraftLine()]);
  }

  function removeLine(lineId: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  }

  function toggleBulkItemSelection(variantId: string) {
    const newSet = new Set(bulkSelectedIds);
    if (newSet.has(variantId)) {
      newSet.delete(variantId);
    } else {
      newSet.add(variantId);
    }
    setBulkSelectedIds(newSet);
  }

  function addBulkItemsToOrder() {
    if (bulkSelectedIds.size === 0) {
      showToast('Select at least one item to add.', 'info');
      return;
    }

    const newLines: PurchaseOrderLineDraft[] = [];
    bulkSelectedIds.forEach((variantId) => {
      const selected = variantLookup.get(variantId);
      if (selected) {
        newLines.push({
          id: `line_${Math.random().toString(36).slice(2, 10)}`,
          variant_id: selected.id,
          sku: selected.sku,
          product_name: selected.product_name,
          unit: selected.unit || '',
          warehouse_id: selected.warehouse_id || 'unknown',
          warehouse_name: selected.warehouse_name || 'Unknown',
          quantity: 1,
          price: selected.price || 0,
          max_stock: selected.total_stock,
        });
      }
    });

    setLines((current) => [...current.filter((l) => l.variant_id), ...newLines]);
    setBulkSelectedIds(new Set());
    setBulkSelectorOpen(false);
    showToast(`Added ${newLines.length} items to order.`, 'success');
  }

  const filteredBulkVariants = useMemo(() => {
    if (!bulkSearch.trim()) return variantOptions;
    const query = bulkSearch.toLowerCase();
    return variantOptions.filter(
      (variant) =>
        variant.product_name.toLowerCase().includes(query) ||
        variant.sku.toLowerCase().includes(query),
    );
  }, [bulkSearch, variantOptions]);

  async function createPurchaseOrder() {
    if (!draft.vendor_id) {
      showToast('Please select a vendor before creating a purchase order.', 'error');
      return;
    }

    const vendor = vendors.find((item) => item.id === draft.vendor_id);
    if (!vendor) {
      showToast('Selected vendor was not found.', 'error');
      return;
    }

    const validLines = lines.filter((line) => line.variant_id && line.quantity > 0);
    if (validLines.length === 0) {
      showToast('Add at least one product line with quantity before creating the order.', 'error');
      return;
    }

    const invalidStock = validLines.some((line) => line.max_stock > 0 && line.quantity > line.max_stock);
    if (invalidStock) {
      showToast('One or more line quantities exceed available stock for the selected variant.', 'error');
      return;
    }

    const project = projects.find((item) => item.id === draft.project_id);

    await modulesService.createOrder({
      type: 'PURCHASE',
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      project_id: project?.id,
      project_name: project?.name,
      items: validLines.map((line) => ({
        variant_id: line.variant_id,
        sku: line.sku,
        product_name: line.product_name,
        unit: line.unit,
        quantity: line.quantity,
        price: line.price || undefined,
        warehouse_id: line.warehouse_id,
        warehouse_name: line.warehouse_name,
      })),
      delivery_address: draft.delivery_address,
      payment_terms: draft.payment_terms,
    });

    setCreateOpen(false);
    setDraft({ vendor_id: '', project_id: '', delivery_address: '', payment_terms: '' });
    setLines([createDraftLine()]);
    await refreshOrders();
    showToast('Purchase order created successfully.', 'success');
  }

  async function approveOrder(order: OrderRow) {
    if (order.status !== 'PENDING') return;

    const confirmation = await confirmAction({
      title: 'Approve this order?',
      message: 'This will apply stock changes immediately.',
      confirmText: 'Approve',
      requireReason: true,
      reasonLabel: 'Approval reason',
      reasonPlaceholder: 'Why are you approving this order?',
    });
    if (!confirmation.confirmed) return;

    const items = order.items?.length ? order.items : [{
      variant_id: order.variant_id || '',
      sku: order.sku || '',
      product_name: order.items?.[0]?.product_name || 'Order Transaction',
      warehouse_id: order.warehouse_id || 'unknown',
      warehouse_name: order.warehouse_name || 'Unknown',
      quantity: order.quantity || 0,
    }];

    for (const item of items) {
      const recordWarehouseId = item.warehouse_id || order.warehouse_id || 'unknown';
      await inventoryService.recordMovement({
        variant_id: item.variant_id,
        warehouse_id: recordWarehouseId,
        type: order.type === 'SALE' ? 'OUT' : 'IN',
        quantity: item.quantity,
        notes: `${order.type} order ${order.order_number} | Reason: ${confirmation.reason}`,
      });
      await modulesService.addMovement({
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        warehouse_id: recordWarehouseId,
        warehouse_name: item.warehouse_name || order.warehouse_name || 'Unknown',
        type: order.type === 'SALE' ? 'OUT' : 'IN',
        quantity: item.quantity,
        notes: `Approved ${order.order_number} | Reason: ${confirmation.reason}`,
      });
    }

    await modulesService.addAudit({
      action: 'Order Approved',
      entity_type: 'order',
      entity_id: order.id,
      entity_name: order.order_number,
      reason: confirmation.reason,
      performed_by: modulesService.getCurrentUser().email,
      details: `${order.type} for ${order.vendor_name || order.entity_name}`,
    });
    await modulesService.updateOrderStatus(order.id, 'APPROVED');
    await refreshOrders();
    showToast('Order approved and stock updated.', 'success');
  }

  async function cancelOrder(order: OrderRow) {
    if (order.status !== 'PENDING') return;
    const confirmation = await confirmAction({
      title: 'Cancel this order?',
      message: 'The order will be marked cancelled and cannot be auto-approved later.',
      confirmText: 'Cancel Order',
      requireReason: true,
      reasonLabel: 'Cancellation reason',
      reasonPlaceholder: 'Why is this order being cancelled?',
    });
    if (!confirmation.confirmed) return;

    await modulesService.addAudit({
      action: 'Order Cancelled',
      entity_type: 'order',
      entity_id: order.id,
      entity_name: order.order_number,
      reason: confirmation.reason,
      performed_by: modulesService.getCurrentUser().email,
      details: `${order.type} for ${order.vendor_name || order.entity_name}`,
    });
    await modulesService.updateOrderStatus(order.id, 'CANCELLED');
    await refreshOrders();
    showToast('Order cancelled.', 'info');
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Purchase Orders</h1>
          <p className={styles.subtitle}>Use bulk product selection, vendor/project linkage, and approval-based stock movement.</p>
        </div>
        {canCreate && (
          <button className={styles.primaryAction} onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            <span style={{ marginLeft: 8 }}>New Purchase Order</span>
          </button>
        )}
      </div>

      {createOpen && (
        <div className={styles.bulkModalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={`${styles.bulkModalContent} ${styles.poModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div>
                <h2 className={styles.title} style={{ fontSize: '1.3rem', margin: 0 }}>Create Purchase Order</h2>
                <p className={styles.subtitle} style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Pick a vendor, project, and add one or more product lines.</p>
              </div>
              <button
                className={styles.actionBtn}
                onClick={() => setCreateOpen(false)}
                style={{ fontSize: '1.5rem', padding: '0', color: 'var(--text-secondary)' }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.bulkModalBody}>
              <div className={styles.createGrid}>
                <div>
                  <label className={styles.fieldLabel}>Vendor</label>
                  <select 
                    className={styles.select} 
                    value={draft.vendor_id} 
                    onChange={(e) => {
                      const selectedVendor = vendors.find((v) => v.id === e.target.value);
                      setDraft((prev) => ({ 
                        ...prev, 
                        vendor_id: e.target.value,
                        delivery_address: selectedVendor?.delivery_address || '',
                        payment_terms: selectedVendor?.payment_terms || '',
                      }));
                    }}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.fieldLabel}>Project (optional)</label>
                  <select className={styles.select} value={draft.project_id} onChange={(e) => setDraft((prev) => ({ ...prev, project_id: e.target.value }))}>
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {draft.vendor_id && (
                <div className={styles.vendorDetailsSection}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className={styles.fieldLabel}>Delivery Address</label>
                      <textarea
                        className={styles.vendorDetailInput}
                        value={draft.delivery_address}
                        onChange={(e) => setDraft((prev) => ({ ...prev, delivery_address: e.target.value }))}
                        placeholder="Enter delivery address"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className={styles.fieldLabel}>Payment Terms</label>
                      <textarea
                        className={styles.vendorDetailInput}
                        value={draft.payment_terms}
                        onChange={(e) => setDraft((prev) => ({ ...prev, payment_terms: e.target.value }))}
                        placeholder="e.g., Net 30, Due on delivery"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.lineHeader}>
                <h3 className={styles.title} style={{ fontSize: '1rem', margin: 0 }}>Order Lines</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className={styles.bulkSelectorBtn} onClick={() => setBulkSelectorOpen(true)}>
                    <Plus size={16} />
                    <span>Bulk Add Items</span>
                  </button>
                  <button className={styles.iconButton} onClick={addLine} title="Add a single order line">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className={styles.lineTableWrapper}>
                <table className={styles.lineTable}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '280px' }}>Product / Variant</th>
                      <th style={{ minWidth: '60px' }}>Unit</th>
                      <th style={{ minWidth: '80px' }}>Qty</th>
                      <th style={{ minWidth: '70px' }}>Available</th>
                      <th style={{ minWidth: '120px' }}>Warehouse</th>
                      <th style={{ minWidth: '50px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <select
                            className={styles.select}
                            value={line.variant_id}
                            onChange={(e) => {
                              const selected = variantLookup.get(e.target.value);
                              if (!selected) {
                                updateLine(line.id, {
                                  variant_id: '',
                                  sku: '',
                                  product_name: '',
                                  unit: '',
                                  warehouse_id: '',
                                  warehouse_name: '',
                                  price: 0,
                                  max_stock: 0,
                                });
                                return;
                              }

                              updateLine(line.id, {
                                variant_id: selected.id,
                                sku: selected.sku,
                                product_name: selected.product_name,
                                unit: selected.unit || '',
                                warehouse_id: selected.warehouse_id || 'unknown',
                                warehouse_name: selected.warehouse_name || 'Unknown',
                                price: selected.price || 0,
                                max_stock: selected.total_stock,
                                quantity: 1,
                              });
                            }}
                          >
                            <option value="">Select variant</option>
                            {variantOptions.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.product_name} — {variant.sku}
                              </option>
                            ))}
                          </select>
                          {line.sku && <div className={styles.mutedText}>{line.sku}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>{line.unit || '-'}</div>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            className={styles.searchInput}
                            onChange={(e) => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', color: line.max_stock > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {line.max_stock > 0 ? line.max_stock : 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{line.warehouse_name || '-'}</div>
                        </td>
                        <td className={styles.lineActions}>
                          <button className={styles.actionBtn} onClick={() => removeLine(line.id)} title="Remove line">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.subtitle} style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                Each purchase order can include multiple variant rows. Quantities are validated against total available stock.
              </p>
            </div>

            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button className={styles.bulkConfirmBtn} onClick={createPurchaseOrder}>
                Create PO
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkSelectorOpen && (
        <div className={styles.bulkModalOverlay} onClick={() => setBulkSelectorOpen(false)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <h2 className={styles.title} style={{ fontSize: '1.2rem', margin: 0 }}>Add Items in Bulk</h2>
              <button
                className={styles.actionBtn}
                onClick={() => setBulkSelectorOpen(false)}
                style={{ fontSize: '1.5rem', padding: '0' }}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody}>
              <input
                type="text"
                className={styles.bulkSearchInput}
                placeholder="Search by product name or SKU..."
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
              />
              <div className={styles.bulkItemsList}>
                {filteredBulkVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className={`${styles.bulkItemCard} ${bulkSelectedIds.has(variant.id) ? styles.selected : ''}`}
                    onClick={() => toggleBulkItemSelection(variant.id)}
                  >
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className={styles.bulkItemCheckbox}
                        checked={bulkSelectedIds.has(variant.id)}
                        onChange={() => {}}
                      />
                      <div style={{ flex: 1 }}>
                        <div className={styles.bulkItemName}>{variant.product_name}</div>
                        <div className={styles.bulkItemMeta}>SKU: {variant.sku}</div>
                        <div className={styles.bulkItemMeta}>
                          Stock: <strong>{variant.total_stock}</strong> | Unit: <strong>{variant.unit || '-'}</strong>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {filteredBulkVariants.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No items found. Try a different search.
                </div>
              )}
            </div>
            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setBulkSelectorOpen(false)}>
                Cancel
              </button>
              <button className={styles.bulkConfirmBtn} onClick={addBulkItemsToOrder}>
                Add {bulkSelectedIds.size} Item{bulkSelectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input type="text" placeholder="Search order number, vendor or item..." className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | OrderType)}>
              <option value="ALL">All Types</option>
              <option value="PURCHASE">Purchase (In)</option>
              <option value="SALE">Sale (Out)</option>
              <option value="RETURN">Return (In)</option>
            </select>
            <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OrderRow['status'])}>
              <option value="ALL">All Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className={styles.iconButton}><Filter size={18} /></button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor</th>
              <th>Project</th>
              <th>Lines</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No purchase orders found. Use New Purchase Order to start.
                </td>
              </tr>
            ) : paginatedOrders.map((order) => {
              const lineCount = order.items?.length ?? 1;
              const itemLabel = lineCount === 1 ? 'line' : 'lines';
              const displayName = order.vendor_name || order.entity_name || 'Unknown';
              return (
                <tr key={order.id}>
                  <td><strong>{order.order_number}</strong></td>
                  <td>{displayName}</td>
                  <td>{order.project_name || '-'}</td>
                  <td>{lineCount} {itemLabel}</td>
                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={order.status === 'APPROVED' ? styles.statusCompleted : order.status === 'CANCELLED' ? styles.statusCancelled : styles.statusPending}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    {canApprove && order.status === 'PENDING' && (
                      <button className={styles.actionBtn} title="Approve" onClick={() => approveOrder(order)}>
                        <ArrowRight size={16} />
                      </button>
                    )}
                    {canCancel && order.status === 'PENDING' && (
                      <button className={styles.actionBtn} title="Cancel" onClick={() => cancelOrder(order)}>
                        <Eye size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredOrders.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="orders"
        />
      </div>
    </div>
  );
}

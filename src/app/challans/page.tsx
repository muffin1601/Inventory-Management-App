"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Challans.module.css';
import {
  Search, Filter, Truck, CheckCircle2, Clock,
  Eye, Trash2, FileText, Printer, AlertCircle
} from 'lucide-react';
import { useUi } from '@/components/ui/AppProviders';
import { useAuth } from '@/lib/AuthContext';
import TablePagination from '@/components/ui/TablePagination';
import { projectsService, type ProjectRecord, type BoqItemRecord } from '@/lib/services/projects';
import { modulesService } from '@/lib/services/modules';
import type { ChallanRow as Challan } from '@/types/modules';
import { inventoryService } from '@/lib/services/inventory';
import { useSupabaseRealtime } from '@/lib/hooks/useSupabaseRealtime';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Generate sequential challan number with date-based prefix
function generateChallanNumber(existingCount: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const sequence = String(existingCount + 1).padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CH-${year}-${month}-${sequence}-${random}`;
}
 
interface DispatchItem extends BoqItemRecord {
  name: string;
  delivered: number;
  balance: number;
  boq_item_id: string;
  variant_id: string;
  warehouse_id: string;
  warehouse_name: string;
  manufacturer: string;
  dispatchQty: number;
  components: any[];
}

export default function ChallansPage() {
  const { showToast, confirmAction } = useUi();
  const { user, isClient } = useAuth();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewingChallan, setViewingChallan] = useState<Challan | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [loadingBoq, setLoadingBoq] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [componentsMap, setComponentsMap] = useState<Record<string, any[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newChallan, setNewChallan] = useState<Partial<Challan>>({
    status: 'ISSUED',
    items: []
  });

  const loadData = useCallback(async () => {
    if (!isClient || !user) return;

    try {
      setIsLoading(true);
      const [projRes, challansRes, warehouseRows, products] = await Promise.all([
        projectsService.listProjects(),
        modulesService.getChallans(),
        inventoryService.getWarehouses(),
        inventoryService.getProducts(),
      ]);

      setProjects(projRes);
      setChallans(challansRes);
      setWarehouses(warehouseRows);
      setCatalogProducts(products);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Failed to load challans', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isClient, user, showToast]);

  // Load projects and challans on mount
  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseRealtime(
    'challans-live',
    useMemo(() => [
      { table: 'projects' },
      { table: 'boq_items' },
      { table: 'challans' },
      { table: 'challan_items' },
      { table: 'inventory' },
      { table: 'warehouses' },
    ], []),
    loadData,
  );

  const warehouseNameById = useMemo(() => {
    return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  }, [warehouses]);

  const catalogVariants = useMemo(() => {
    return catalogProducts.flatMap((product) =>
      (product.variants || []).map((variant: any) => ({
        productName: product.name || '',
        manufacturer:
          variant.attributes?.Manufacturer ||
          variant.attributes?.manufacturer ||
          product.brand ||
          '',
        variant,
      })),
    );
  }, [catalogProducts]);

  const resolveBoqLink = useCallback((boq: any) => {
    const normalizedName = String(boq.item_name || '').trim().toLowerCase();
    const normalizedManufacturer = String(boq.manufacturer || '').trim().toLowerCase();

    const entry = catalogVariants.find((candidate) => candidate.variant.id === boq.variant_id)
      || catalogVariants.find((candidate) => String(candidate.variant.sku || '').trim().toLowerCase() === normalizedManufacturer)
      || catalogVariants.find((candidate) => {
        const productName = String(candidate.productName || '').trim().toLowerCase();
        const sku = String(candidate.variant.sku || '').trim().toLowerCase();
        const manufacturer = String(candidate.manufacturer || '').trim().toLowerCase();

        if (sku && (normalizedName.includes(sku) || normalizedManufacturer.includes(sku))) return true;
        if (!productName || normalizedName !== productName) return false;
        return !normalizedManufacturer || normalizedManufacturer === manufacturer || normalizedManufacturer === sku;
      });

    const stockRows = entry?.variant?.stock_data || [];
    const warehouseId = boq.warehouse_id || stockRows.find((row: any) => (Number(row.quantity) || 0) > 0)?.warehouse_id || stockRows[0]?.warehouse_id || '';
    const warehouseName = warehouseId
      ? warehouseNameById.get(warehouseId) || stockRows.find((row: any) => row.warehouse_id === warehouseId)?.warehouse_name || 'Linked warehouse'
      : '';

    return {
      variantId: entry?.variant?.id || boq.variant_id || '',
      warehouseId,
      warehouseName,
      manufacturer: entry?.manufacturer || boq.manufacturer || '',
    };
  }, [catalogVariants, warehouseNameById]);

  const handleProjectSelect = async (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    setNewChallan({ ...newChallan, project_name: projectName, items: [] });
    setLoadingBoq(true);
    try {
      const items = await projectsService.listBoqItems(project.id);

      // Use live delivered quantity from database
      const processedItems = items.map((boq) => {
        const resolved = resolveBoqLink(boq);
        return {
          ...boq,
          name: boq.item_name,
          delivered: boq.delivered || 0,
          balance: Math.max(0, boq.quantity - (boq.delivered || 0)),
          boq_item_id: boq.id,
          variant_id: resolved.variantId,
          warehouse_id: resolved.warehouseId,
          warehouse_name: resolved.warehouseName,
          manufacturer: resolved.manufacturer,
          dispatchQty: 0,
          components: []
        } as DispatchItem;
      });
      setDispatchItems(processedItems);

      // Fetch components for SET items
      const setVariantIds = Array.from(new Set(
        processedItems
          .filter(i => {
            const u = (i.unit || '').toUpperCase();
            return u === 'SET' || u === 'SETS';
          })
          .map(i => i.variant_id)
          .filter(Boolean)
      )) as string[];

      if (setVariantIds.length > 0) {
        const comps = await inventoryService.getBatchVariantComponents(setVariantIds);
        setComponentsMap(prev => ({ ...prev, ...comps }));
        
        // Attach components to dispatchItems
        processedItems.forEach(item => {
          const u = (item.unit || '').toUpperCase();
          if ((u === 'SET' || u === 'SETS') && item.variant_id && comps[item.variant_id]) {
            item.components = comps[item.variant_id].map((c: any) => ({
              ...c,
              dispatchQty: 0
            }));
          }
        });
      }

      await Promise.allSettled(
        processedItems
          .filter((item) => {
            const original = items.find((boq) => boq.id === item.id);
            return item.variant_id && item.warehouse_id && original && (
              original.variant_id !== item.variant_id ||
              original.warehouse_id !== item.warehouse_id ||
              original.manufacturer !== item.manufacturer
            );
          })
          .map((item) => projectsService.updateBoqItem({
            projectId: project.id,
            boqItemId: item.id,
            variant_id: item.variant_id,
            warehouse_id: item.warehouse_id,
            manufacturer: item.manufacturer,
          })),
      );
    } catch (error) {
      console.error('Error loading BOQ items:', error);
      showToast('Failed to load project items', 'error');
    } finally {
      setLoadingBoq(false);
    }
  };

  const updateDispatchQty = (index: number, val: string) => {
    const qty = parseFloat(val) || 0;
    const item = dispatchItems[index];

    if (qty > 0 && (!item.variant_id || !item.warehouse_id)) {
      showToast('This BOQ item is not linked to a catalog item and warehouse yet. Link it in BOQ before dispatch.', 'error');
      return;
    }

    if (qty > item.balance) {
      showToast(`Cannot exceed balance of ${item.balance} ${item.unit}`, 'error');
      return;
    }

    const updated = [...dispatchItems];
    updated[index].dispatchQty = qty;
    
    // Auto-update components if it's a set
    if (updated[index].components) {
      updated[index].components = updated[index].components.map((c: any) => ({
        ...c,
        dispatchQty: Number((c.quantity * qty).toFixed(2))
      }));
    }
    
    setDispatchItems(updated);
  };

  const updateComponentQty = (parentIdx: number, compIdx: number, val: string) => {
    const qty = parseFloat(val) || 0;
    const updated = [...dispatchItems];
    if (updated[parentIdx].components) {
      updated[parentIdx].components[compIdx].dispatchQty = qty;
      setDispatchItems(updated);
    }
  };

  const createChallan = async () => {
    try {
      if (!user?.id) {
        showToast('User not authenticated', 'error');
        return;
      }

      if (!newChallan.project_name?.trim()) {
        showToast('Please select a project', 'error');
        return;
      }

      /* 
      if (!newChallan.vendor_name?.trim()) {
        showToast('Please enter vendor name', 'error');
        return;
      }

      if (!newChallan.po_no?.trim()) {
        showToast('Please enter PO number', 'error');
        return;
      }
      */

      const itemsToDispatch: any[] = [];
      
      dispatchItems.forEach(i => {
        if (i.dispatchQty > 0) {
          itemsToDispatch.push({
            name: i.name,
            quantity: i.dispatchQty,
            unit: i.unit,
            boq_item_id: i.boq_item_id || i.id,
            variant_id: i.variant_id,
            warehouse_id: i.warehouse_id
          });
        }
        
        // Add components if any have quantity
        if (i.components) {
          i.components.forEach((c: any) => {
            if (c.dispatchQty > 0) {
              itemsToDispatch.push({
                name: `[Part of ${i.name}] ${c.name}`,
                quantity: c.dispatchQty,
                unit: c.unit,
                boq_item_id: i.boq_item_id || i.id,
                variant_id: c.variant_id,
                warehouse_id: i.warehouse_id, // Use parent warehouse
                skipBoqUpdate: true // Don't double count in BOQ
              });
            }
          });
        }
      });

      if (itemsToDispatch.length === 0) {
        showToast('Select at least one item to dispatch', 'info');
        return;
      }

      setIsSaving(true);

      // Generate challan number
      const challanNo = generateChallanNumber(challans.length);

      // Resolve IDs for the service
      const project = projects.find(p => p.name === newChallan.project_name);

      // Create challan in database
      const result = await modulesService.createChallan(
        challanNo,
        newChallan.po_no || 'N/A',
        newChallan.project_name,
        newChallan.vendor_name || 'N/A',
        new Date().toISOString().split('T')[0],
        itemsToDispatch,
        user.id,
        project?.id
      );

      // Fetch updated challans
      const updated = await modulesService.getChallans();
      setChallans(updated);

      setCreateOpen(false);
      setNewChallan({ status: 'ISSUED', items: [] });
      setDispatchItems([]);
      showToast(`Challan ${result.challan_no} created successfully!`, 'success');
    } catch (error: any) {
      console.error('Error creating challan:', error);
      showToast(error?.message || 'Failed to create challan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteChallan = async (id: string, challanNo: string) => {
    try {
      if (!user?.id) {
        showToast('User not authenticated', 'error');
        return;
      }

      const confirmation = await confirmAction({
        title: 'Delete Delivery Challan?',
        message: `Are you sure you want to delete ${challanNo}? This will permanently remove the record.`,
        confirmText: 'Delete Challan',
        requireReason: true,
        reasonLabel: 'Reason for deletion',
        reasonPlaceholder: 'Why are you deleting this dispatch record?'
      });

      if (!confirmation.confirmed) return;

      setIsSaving(true);
      await modulesService.deleteChallan(id, user.id);

      // Fetch updated challans
      const updated = await modulesService.getChallans();
      setChallans(updated);

      showToast('Challan deleted successfully', 'success');
    } catch (error: any) {
      console.error('Error deleting challan:', error);
      showToast(error?.message || 'Failed to delete challan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: Challan['status'], challanNo: string) => {
    try {
      if (!user?.id) {
        showToast('User not authenticated', 'error');
        return;
      }

      const existing = challans.find(c => c.id === id);
      if (!existing || existing.status === status) return;

      const statusLabels: Record<string, string> = {
        'ISSUED': 'Issued',
        'DISPATCHED': 'Dispatched / Gate Pass Generated',
        'DELIVERED': 'Delivered at Site'
      };

      const confirmation = await confirmAction({
        title: `Update Status to ${statusLabels[status]}?`,
        message: `Mark ${challanNo} as ${statusLabels[status].toLowerCase()}?`,
        confirmText: 'Update Status',
        requireReason: false
      });

      if (!confirmation.confirmed) return;

      setIsSaving(true);
      await modulesService.updateChallanStatus(id, status, user.id);

      // Fetch updated challans
      const updated = await modulesService.getChallans();
      setChallans(updated);

      // Update viewed challan if it's the one being updated
      if (viewingChallan?.id === id) {
        setViewingChallan({ ...viewingChallan, status });
      }

      if (status === 'DISPATCHED') {
        showToast('Gate Pass generated successfully', 'success');
      } else if (status === 'DELIVERED') {
        showToast('Marked as delivered', 'success');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast(error?.message || 'Failed to update status', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredChallans = challans.filter(c => {
    const matchesSearch =
      c.challan_no.toLowerCase().includes(search.toLowerCase()) ||
      c.project_name.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const paginatedChallans = filteredChallans.slice((page - 1) * pageSize, page * pageSize);

  if (!isClient || !user) {
    return (
      <div className={styles.container} style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} style={{ margin: '0 auto', color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading authentication...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dispatch Challans</h1>
          <p className={styles.subtitle}>Manage material dispatches, track delivery status, and print challan records.</p>
        </div>
        <button
          className={styles.primaryAction}
          onClick={() => setCreateOpen(true)}
          disabled={isLoading || isSaving}
        >
          <Truck size={18} />
          <span>New Dispatch</span>
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Shipments</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-amber)' }}>
            {isLoading ? '--' : challans.filter(c => c.status === 'DISPATCHED').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Delivered</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-green)' }}>
            {isLoading ? '--' : challans.filter(c => c.status === 'DELIVERED').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Dispatch</div>
          <div className={styles.statValue} style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '--' : challans.filter(c => c.status === 'ISSUED').length}
          </div>
        </div>
      </div>

      <div className={styles.mainCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by Challan, Project or Vendor..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className={styles.filters}>
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              disabled={isLoading}
            >
              <option value="ALL">All Status</option>
              <option value="ISSUED">Issued</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <button className={styles.actionBtn} disabled={isLoading}>
              <Filter size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
            Loading challans...
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Challan No</th>
                  <th>Project</th>
                  <th>Dispatch Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedChallans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {search || statusFilter !== 'ALL'
                        ? 'No challans match the current search or status filter.'
                        : 'No dispatch records yet. Click "New Dispatch" to create your first challan.'}
                    </td>
                  </tr>
                ) : (
                  paginatedChallans.map((challan, index) => (
                    <tr key={challan.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{challan.challan_no}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{challan.project_name}</div>
                      </td>
                      <td>{challan.dispatch_date}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${challan.status === 'DELIVERED' ? styles.statusDelivered :
                            challan.status === 'DISPATCHED' ? styles.statusTransit : styles.statusPending
                          }`}>
                          {challan.status === 'DELIVERED' ? <CheckCircle2 size={12} /> :
                            challan.status === 'DISPATCHED' ? <Truck size={12} /> : <Clock size={12} />}
                          {challan.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {challan.status === 'ISSUED' && (
                            <button
                              className={styles.primaryAction}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
                              onClick={() => updateStatus(challan.id, 'DISPATCHED', challan.challan_no)}
                              disabled={isSaving}
                            >
                              <Truck size={12} /> Gate Pass
                            </button>
                          )}
                          {challan.status === 'DISPATCHED' && (
                            <button
                              className={styles.primaryAction}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', whiteSpace: 'nowrap', background: 'var(--accent-green)' }}
                              onClick={() => updateStatus(challan.id, 'DELIVERED', challan.challan_no)}
                              disabled={isSaving}
                            >
                              <CheckCircle2 size={12} /> Mark Delivered
                            </button>
                          )}

                          <button
                            className={styles.actionBtn}
                            title="View Challan"
                            aria-label={`View ${challan.challan_no}`}
                            onClick={() => setViewingChallan(challan)}
                            disabled={isSaving}
                          >
                            <Eye size={16} />
                            <span>View</span>
                          </button>

                          <button
                            className={styles.actionBtn}
                            title="Print Challan"
                            aria-label={`Print ${challan.challan_no}`}
                            onClick={() => {
                              setViewingChallan(challan);
                              setTimeout(() => window.print(), 100);
                            }}
                            disabled={isSaving}
                          >
                            <Printer size={16} />
                            <span>Print</span>
                          </button>

                          <button
                            className={styles.actionBtn}
                            style={{ color: 'var(--text-secondary)' }}
                            title="Delete Challan"
                            aria-label={`Delete ${challan.challan_no}`}
                            onClick={() => deleteChallan(challan.id, challan.challan_no)}
                            disabled={isSaving}
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filteredChallans.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="challans"
            />
          </>
        )}
      </div>

      {/* Create Challan Modal */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Create Delivery Challan</h2>
              <button className={styles.actionBtn} onClick={() => setCreateOpen(false)}>Close</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                <span>Step 1</span>
                <span>Select project</span>
              </div>
              <div className={styles.fieldGroup} style={{ marginBottom: '1.5rem' }}>
                <label className={styles.fieldLabel}>Select Project *</label>
                <select
                  className={styles.select}
                  style={{ width: '100%' }}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                >
                  <option value="">Choose Project...</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              {/* PO and Vendor Selection Hidden */}
              {/* 
              {dispatchItems.length > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Vendor Name *</label>
                      <select
                        className={styles.select}
                        value={newChallan.vendor_name || ''}
                        onChange={(e) => setNewChallan({ ...newChallan, vendor_name: e.target.value })}
                        required
                      >
                        <option value="">Select or enter vendor name...</option>
                        {vendors.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>PO Number *</label>
                      <select
                        className={styles.select}
                        value={newChallan.po_no || ''}
                        onChange={(e) => setNewChallan({ ...newChallan, po_no: e.target.value })}
                        required
                      >
                        <option value="">Select PO number...</option>
                        {purchaseOrders.map(po => (
                          <option key={po} value={po}>{po}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              */}

              {loadingBoq && <div style={{ textAlign: 'center', padding: '1rem' }}>Loading BOQ Items...</div>}

              {dispatchItems.length > 0 && (
                <div className={styles.itemSelection} style={{ border: 'none' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    <span>Step 2</span>
                    <span>Choose dispatch quantities</span>
                  </div>
                  <div className={styles.fieldLabel} style={{ marginBottom: '0.5rem' }}>Dispatch Items</div>
                  <div className={styles.itemHeader} style={{ gridTemplateColumns: '40px 2fr 1fr 1fr 80px 80px 80px 100px' }}>
                    <span>#</span>
                    <span>Item</span>
                    <span>Manufacturer</span>
                    <span>Warehouse</span>
                    <span style={{ textAlign: 'center' }}>BOQ</span>
                    <span style={{ textAlign: 'center' }}>Deliv.</span>
                    <span style={{ textAlign: 'center' }}>Bal.</span>
                    <span style={{ textAlign: 'right' }}>Dispatch</span>
                  </div>
                  {dispatchItems.map((item, idx) => (
                    <div key={item.id} className={styles.itemRow} style={{ gridTemplateColumns: '40px 2fr 1fr 1fr 80px 80px 80px 100px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        {item.variant_id && item.components && item.components.length > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '8px', borderLeft: '2px solid #000', paddingLeft: '12px' }}>
                            <div style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#000' }}>Edit Assembly Components</div>
                            {item.components.map((c: any, cIdx: number) => (
                              <div key={c.variant_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ flex: 1 }}>• {c.name} ({c.sku})</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input 
                                    type="number"
                                    value={c.dispatchQty}
                                    onChange={(e) => updateComponentQty(idx, cIdx, e.target.value)}
                                    style={{ width: '50px', padding: '2px', border: '1px solid #e2e8f0', textAlign: 'right', fontSize: '0.65rem' }}
                                  />
                                  <span>{c.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span>{item.manufacturer || '-'}</span>
                      <span>{item.warehouse_name || 'Not linked'}</span>
                      <span style={{ textAlign: 'center' }}>{item.quantity}</span>
                      <span style={{ textAlign: 'center', color: 'var(--accent-green)' }}>{item.delivered}</span>
                      <span
                        style={{
                          textAlign: 'center',
                          color: 'var(--accent-amber)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline dotted'
                        }}
                        title="Click to dispatch entire balance"
                        onClick={() => updateDispatchQty(idx, item.balance.toString())}
                      >
                        {item.balance}
                      </span>
                      <input
                        className={styles.input}
                        style={{
                          padding: '0.25rem',
                          textAlign: 'right',
                          fontWeight: 800,
                          backgroundColor: '#f1f5f9'
                        }}
                        type="number"
                        value={item.dispatchQty}
                        max={item.balance}
                        onChange={(e) => updateDispatchQty(idx, e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <div style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Step 4: Review the quantities, then generate the challan.
              </div>
              <button
                className={styles.actionBtn}
                onClick={() => setCreateOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={styles.primaryAction}
                onClick={createChallan}
                disabled={isSaving || loadingBoq || dispatchItems.length === 0}
              >
                {isSaving ? 'Creating...' : 'Generate Challan & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Challan Modal */}
      {viewingChallan && (
        <div className={styles.modalOverlay} onClick={() => setViewingChallan(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0 }}>{viewingChallan.challan_no}</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{viewingChallan.dispatch_date}</p>
              </div>
              <button className={styles.actionBtn} onClick={() => setViewingChallan(null)}>Close</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div className={styles.fieldLabel}>Project</div>
                  <div style={{ fontWeight: 700 }}>{viewingChallan.project_name}</div>
                </div>
              </div>

              <div className={styles.fieldLabel}>Dispatched Items</div>
              <div className={styles.itemSelection} style={{ marginTop: '0.5rem' }}>
                <div className={styles.itemHeader} style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <span>Item Name</span>
                  <span style={{ textAlign: 'right' }}>Qty Dispatched</span>
                </div>
                {viewingChallan.items.map(item => (
                  <div key={item.id} className={styles.itemRow} style={{ gridTemplateColumns: '2fr 1fr' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{item.name}</span>
                      {item.variant_id && componentsMap[item.variant_id] && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px', borderLeft: '2px solid #e2e8f0', paddingLeft: '8px' }}>
                          {componentsMap[item.variant_id].map(c => (
                            <div key={c.variant_id}>• {c.name} ({c.sku}) x {c.quantity * (item.quantity || 0)} {c.unit}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div className={styles.fieldLabel}>Update Status</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {(['ISSUED', 'DISPATCHED', 'DELIVERED'] as const).map(s => (
                    <button
                      key={s}
                      className={styles.primaryAction}
                      style={{
                        flex: 1,
                        background: viewingChallan.status === s ? '#1e293b' : '#f1f5f9',
                        color: viewingChallan.status === s ? 'white' : '#475569',
                        fontSize: '0.65rem',
                        cursor: viewingChallan.status === s || isSaving ? 'not-allowed' : 'pointer',
                        opacity: viewingChallan.status === s || isSaving ? 0.6 : 1
                      }}
                      onClick={() => updateStatus(viewingChallan.id, s, viewingChallan.challan_no)}
                      disabled={viewingChallan.status === s || isSaving}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionBtn} onClick={() => setViewingChallan(null)} disabled={isSaving}>
                Close
              </button>
              <button
                className={styles.primaryAction}
                onClick={() => {
                  const originalTitle = document.title;
                  document.title = `Delivery_Challan_${viewingChallan.challan_no}`;
                  window.print();
                  document.title = originalTitle;
                }}
                disabled={isSaving}
              >
                <FileText size={16} /> Download PDF / Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

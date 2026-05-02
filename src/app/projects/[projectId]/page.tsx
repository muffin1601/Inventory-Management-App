"use client";

import React from 'react';
import styles from './ProjectDetail.module.css';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, X, Edit2, ClipboardList, Package } from 'lucide-react';
import { projectsService, type BoqItemRecord, type ProjectRecord, type ProjectOrderRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { inventoryService } from '@/lib/services/inventory';

const DEFAULT_UNIT = 'Numbers';

function normalizeQty(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeText(value: string | undefined) {
  return String(value || '').trim().toLowerCase();
}

function matchesBoqToVariant(
  boqItem: BoqItemRecord,
  variant: {
    id: string;
    sku: string;
    productName: string;
    manufacturer: string;
    unit: string;
    label: string;
  },
) {
  if (boqItem.variant_id && boqItem.variant_id === variant.id) return true;

  const itemName = normalizeText(boqItem.item_name);
  const productName = normalizeText(variant.productName);
  const sku = normalizeText(variant.sku);
  const label = normalizeText(variant.label);
  const boqManufacturer = normalizeText(boqItem.manufacturer);
  const variantManufacturer = normalizeText(variant.manufacturer);
  const boqUnit = normalizeText(boqItem.unit);
  const variantUnit = normalizeText(variant.unit);

  if (!itemName) return false;
  if (sku && (itemName === sku || itemName.includes(sku))) return true;
  if (itemName === productName || itemName === label) return true;

  const itemNameSkuMatch = itemName.match(/\(([^)]+)\)/);
  if (itemNameSkuMatch && sku && itemNameSkuMatch[1].trim().toLowerCase() !== sku) {
    return false;
  }

  if (productName && itemName.includes(productName)) return true;
  if (boqManufacturer && variantManufacturer && boqManufacturer === variantManufacturer && productName && itemName.includes(productName)) {
    return true;
  }
  if (boqUnit && variantUnit && boqUnit === variantUnit && productName && itemName.includes(productName)) {
    return true;
  }

  return false;
}

export default function ProjectBoqPage() {
  const ui = useUi();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = React.useState<ProjectRecord | null>(null);
  const [items, setItems] = React.useState<BoqItemRecord[]>([]);
  const [allBoqItems, setAllBoqItems] = React.useState<BoqItemRecord[]>([]);
  const [warning, setWarning] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [existingItemValue, setExistingItemValue] = React.useState('');
  const [selectedVariantId, setSelectedVariantId] = React.useState('');
  const [itemName, setItemName] = React.useState('');
  const [manufacturer, setManufacturer] = React.useState('');
  const [unit, setUnit] = React.useState(DEFAULT_UNIT);
  const [qty, setQty] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<BoqItemRecord | null>(null);
  const [editQty, setEditQty] = React.useState('');
  
  const [activeTab, setActiveTab] = React.useState<'boq' | 'orders'>('boq');
  const [orders, setOrders] = React.useState<ProjectOrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<ProjectOrderRecord | null>(null);
  const [orderItems, setOrderItems] = React.useState<BoqItemRecord[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = React.useState(false);
  const [newOrderNumber, setNewOrderNumber] = React.useState('');
  const [newOrderDate, setNewOrderDate] = React.useState(new Date().toISOString().split('T')[0]);

  const [catalogOptions, setCatalogOptions] = React.useState<Array<{ value: string; label: string; keywords?: string[] }>>([]);
  const [extraItemOptions, setExtraItemOptions] = React.useState<Array<{ value: string; label: string; keywords?: string[] }>>([]);
  const [promisedStock, setPromisedStock] = React.useState<Record<string, { thisProject: number; otherProjects: number }>>({}); // variant_id -> {thisProject, otherProjects}

  const [catalogMeta, setCatalogMeta] = React.useState<Record<string, { 
    name: string; 
    manufacturer: string; 
    unit: string; 
    label: string; 
    stock: number;
    stock_data?: Array<{ warehouse_id?: string; warehouse_name: string; quantity: number }>;
  }>>({});
  const [selectedVariantStock, setSelectedVariantStock] = React.useState<number | null>(null);
  const [nameToMeta, setNameToMeta] = React.useState(new Map<string, { manufacturer: string; unit: string; stock: number; variantId: string; stock_data?: any[] }>());
  const [units, setUnits] = React.useState<string[]>([DEFAULT_UNIT]);
  const [warehouses, setWarehouses] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState('');

  const catalogVariants = React.useMemo(() => (
    Object.entries(catalogMeta).map(([variantId, meta]) => {
      const skuMatch = meta.label.match(/\(([^)]+)\)\s*$/);
      return {
        id: variantId,
        sku: skuMatch?.[1] || '',
        productName: meta.name,
        manufacturer: meta.manufacturer,
        unit: meta.unit,
        label: meta.label,
      };
    })
  ), [catalogMeta]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setWarning('');
    try {
      const [projectResult, itemsResult, allItemsResult, ordersResult] = await Promise.all([
        projectsService.getProject(projectId),
        projectsService.listBoqItems(projectId),
        projectsService.listAllBoqItems(),
        projectsService.listProjectOrders(projectId).catch(() => [] as ProjectOrderRecord[]),
      ]);

      setProject(projectResult);
      // Filter master BOQ items (those without order_id)
      setItems(itemsResult.filter(i => !i.order_id));
      setAllBoqItems(allItemsResult);
      setOrders(ordersResult);
      
      if (selectedOrder) {
        const orderItemsResult = await projectsService.listBoqItemsForOrder(projectId, selectedOrder.id);
        setOrderItems(orderItemsResult);
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : 'Unable to load project data';
      setWarning(errorMsg);
      ui.showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, ui, selectedOrder]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadCatalogAndUnits = React.useCallback(async () => {
    try {
      const [products, unitList, warehouseList] = await Promise.all([
        inventoryService.getProducts(), 
        inventoryService.getUnits(),
        inventoryService.getWarehouses()
      ]);
      setUnits(unitList.length ? unitList : [DEFAULT_UNIT]);
      setWarehouses(warehouseList);

      const nameToMeta = new Map<string, { manufacturer: string; unit: string; stock: number; variantId: string; stock_data?: any[] }>();
      const meta: Record<string, { name: string; manufacturer: string; unit: string; label: string; stock: number; stock_data?: any[] }> = {};
      const options: Array<{ value: string; label: string; keywords?: string[] }> = [];

      (products || []).forEach((product: any) => {
        const productName = String(product?.name || '').trim();
        const brand = String(product?.brand || '').trim();
        (product?.variants || []).forEach((variant: any) => {
          const variantId = String(variant?.id || '').trim();
          if (!variantId) return;
          const sku = String(variant?.sku || '').trim();
          
          // Case-insensitive unit lookup
          const variantUnit = String(variant?.attributes?.Unit || variant?.attributes?.unit || variant?.attributes?.UNIT || '').trim();
          
          const label = productName && sku ? `${productName} (${sku})` : productName || sku || 'Item';
          const stock = Number.isFinite(Number(variant?.total_stock)) ? Number(variant.total_stock) : 0;
          const stock_data = variant?.stock_data || [];
          
          const metaEntry = { name: productName || sku || 'Item', manufacturer: brand, unit: variantUnit || '', label, stock, stock_data };
          meta[variantId] = metaEntry;
          
          // Store by label and name for auto-fill lookups
          nameToMeta.set(label.toLowerCase(), { manufacturer: brand, unit: variantUnit, stock, variantId, stock_data });
          if (productName) {
            nameToMeta.set(productName.toLowerCase(), { manufacturer: brand, unit: variantUnit, stock, variantId, stock_data });
          }

          options.push({
            value: variantId,
            label,
            keywords: [productName, sku, brand, String(product?.category || '')].filter(Boolean),
          });
        });
      });

      const unique = new Map<string, { value: string; label: string; keywords?: string[] }>();
      options.forEach((opt) => unique.set(opt.value, opt));

      setCatalogMeta(meta);
      setNameToMeta(nameToMeta);
      setCatalogOptions(Array.from(unique.values()));
    } catch (err) {
      console.error(err);
      setUnits((prev) => (prev.length ? prev : [DEFAULT_UNIT]));
    }
  }, []);

  React.useEffect(() => {
    void loadCatalogAndUnits();
  }, [loadCatalogAndUnits]);

  React.useEffect(() => {
    const promised: Record<string, { thisProject: number; otherProjects: number }> = {};
    allBoqItems.forEach((boqItem) => {
      const matchedVariant = catalogVariants.find((variant) => matchesBoqToVariant(boqItem, variant));
      if (!matchedVariant) return;

      if (!promised[matchedVariant.id]) {
        promised[matchedVariant.id] = { thisProject: 0, otherProjects: 0 };
      }

      if (boqItem.project_id === projectId) {
        promised[matchedVariant.id].thisProject += boqItem.quantity;
      } else {
        promised[matchedVariant.id].otherProjects += boqItem.quantity;
      }
    });

    setPromisedStock(promised);
  }, [allBoqItems, catalogVariants, projectId]);

  const selectedVariantWarehouseBreakdown = React.useMemo(() => {
    if (!selectedVariantId || !catalogMeta[selectedVariantId]) return [];

    const selectedMeta = catalogMeta[selectedVariantId];
    const relevantBoqItems = allBoqItems.filter((boqItem) => {
      const matchedVariant = catalogVariants.find((variant) => matchesBoqToVariant(boqItem, variant));
      return matchedVariant?.id === selectedVariantId;
    });

    const explicitThisProject = new Map<string, number>();
    const explicitOtherProjects = new Map<string, number>();
    let globalThisProject = 0;
    let globalOtherProjects = 0;

    relevantBoqItems.forEach((boqItem) => {
      const remaining = Math.max((boqItem.quantity || 0) - (boqItem.delivered || 0), 0);
      if (remaining <= 0) return;

      if (boqItem.warehouse_id) {
        const targetMap = boqItem.project_id === projectId ? explicitThisProject : explicitOtherProjects;
        targetMap.set(boqItem.warehouse_id, (targetMap.get(boqItem.warehouse_id) || 0) + remaining);
        return;
      }

      if (boqItem.project_id === projectId) {
        globalThisProject += remaining;
      } else {
        globalOtherProjects += remaining;
      }
    });

    let remainingThisGlobal = globalThisProject;
    let remainingOtherGlobal = globalOtherProjects;

    return (selectedMeta.stock_data || []).map((stockRow, index, rows) => {
      const warehouseId = String(stockRow.warehouse_id || '');
      const explicitThis = explicitThisProject.get(warehouseId) || 0;
      const explicitOther = explicitOtherProjects.get(warehouseId) || 0;

      const availableAfterExplicit = Math.max(stockRow.quantity - explicitThis - explicitOther, 0);
      let allocatedThis = Math.min(availableAfterExplicit, remainingThisGlobal);
      remainingThisGlobal -= allocatedThis;

      const availableAfterThis = Math.max(availableAfterExplicit - allocatedThis, 0);
      let allocatedOther = Math.min(availableAfterThis, remainingOtherGlobal);
      remainingOtherGlobal -= allocatedOther;

      const isLastRow = index === rows.length - 1;
      if (isLastRow) {
        allocatedThis += remainingThisGlobal;
        allocatedOther += remainingOtherGlobal;
        remainingThisGlobal = 0;
        remainingOtherGlobal = 0;
      }

      const promisedThis = explicitThis + allocatedThis;
      const promisedOther = explicitOther + allocatedOther;
      const totalPromised = promisedThis + promisedOther;

      return {
        warehouseId,
        warehouseName: stockRow.warehouse_name,
        stock: stockRow.quantity,
        promisedThis,
        promisedOther,
        free: stockRow.quantity - totalPromised,
      };
    });
  }, [allBoqItems, catalogMeta, catalogVariants, projectId, selectedVariantId]);

  const availableWarehouseOptions = React.useMemo(() => {
    if (!selectedVariantId || !catalogMeta[selectedVariantId]) return [];

    return (catalogMeta[selectedVariantId].stock_data || [])
      .filter((stockRow) => Number(stockRow.quantity) > 0)
      .map((stockRow) => ({
        value: String(stockRow.warehouse_id || ''),
        label: stockRow.warehouse_name,
        keywords: [stockRow.warehouse_name],
      }))
      .filter((option) => option.value);
  }, [catalogMeta, selectedVariantId]);

  React.useEffect(() => {
    if (!selectedWarehouseId) return;
    if (availableWarehouseOptions.some((option) => option.value === selectedWarehouseId)) return;
    setSelectedWarehouseId('');
  }, [availableWarehouseOptions, selectedWarehouseId]);

  const openAdd = React.useCallback(() => {
    setExistingItemValue('');
    setSelectedVariantId('');
    setSelectedWarehouseId('');
    setItemName('');
    setManufacturer('');
    setUnit(DEFAULT_UNIT);
    setQty('');
    setDialogOpen(true);
  }, []);

  const itemOptions = React.useMemo(() => {
    const combined = [...extraItemOptions, ...catalogOptions];
    const unique = new Map<string, { value: string; label: string; keywords?: string[] }>();
    combined.forEach((opt) => unique.set(opt.value, opt));
    return Array.from(unique.values());
  }, [catalogOptions, extraItemOptions]);

  const addItem = React.useCallback(async () => {
    const name = itemName.trim();
    const parsedQty = normalizeQty(qty);

    if (!name) {
      ui.showToast('Enter item name.', 'info');
      return;
    }
    if (!parsedQty) {
      ui.showToast('Enter a valid quantity.', 'info');
      return;
    }

    // Validation for stock removed to allow planning BOQ items even when out of stock.
    // They will appear as "Promised" in stock management to indicate future requirements.


    setIsSaving(true);
    try {
        await projectsService.addBoqItem({
        projectId,
        order_id: selectedOrder?.id,
        variant_id: selectedVariantId || undefined,
        warehouse_id: selectedWarehouseId || undefined,
        item_name: name,
        manufacturer: manufacturer.trim() || undefined,
        quantity: parsedQty,
        delivered: 0,
        unit: unit.trim() || DEFAULT_UNIT,
      });
      ui.showToast('Item added.', 'success');
      setDialogOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not save item.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [itemName, load, manufacturer, projectId, qty, selectedVariantId, selectedWarehouseId, ui, unit, selectedOrder]);

  const addOrder = React.useCallback(async () => {
    if (!newOrderNumber.trim()) {
      ui.showToast('Enter order number.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      await projectsService.createProjectOrder({
        projectId,
        order_number: newOrderNumber.trim(),
        order_date: newOrderDate,
      });
      ui.showToast('Order created.', 'success');
      setIsOrderDialogOpen(false);
      setNewOrderNumber('');
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not create order. Table might be missing.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [newOrderNumber, newOrderDate, projectId, load, ui]);

  const deleteOrder = React.useCallback(async (order: ProjectOrderRecord) => {
    const confirm = await ui.confirmAction({
      title: 'Delete Order?',
      message: 'This will delete the order and all its items. This cannot be undone.',
      confirmText: 'Delete',
    });
    if (!confirm.confirmed) return;

    try {
      await projectsService.deleteProjectOrder(projectId, order.id);
      ui.showToast('Order deleted.', 'success');
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not delete order.', 'error');
    }
  }, [projectId, load, ui, selectedOrder]);

  const deleteItem = React.useCallback(
    async (boqItem: BoqItemRecord) => {
      const confirm = await ui.confirmAction({
        title: 'Delete BOQ item?',
        message: 'This will remove the item from the BOQ list.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });

      if (!confirm.confirmed) return;

      try {
        await projectsService.deleteBoqItem(projectId, boqItem.id);
        ui.showToast('BOQ item deleted.', 'success');
        await load();
      } catch (err) {
        console.error(err);
        ui.showToast('Could not delete BOQ item.', 'error');
      }
    },
    [load, projectId, ui],
  );

  const openEdit = React.useCallback((item: BoqItemRecord) => {
    setEditingItem(item);
    setEditQty(String(item.quantity));
    setEditDialogOpen(true);
  }, []);

  const updateItem = React.useCallback(async () => {
    if (!editingItem) return;

    const parsedQty = normalizeQty(editQty);
    if (!parsedQty) {
      ui.showToast('Enter a valid quantity.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      await projectsService.updateBoqItem({
        projectId,
        boqItemId: editingItem.id,
        quantity: parsedQty,
      });
      ui.showToast('BOQ item updated.', 'success');
      setEditDialogOpen(false);
      setEditingItem(null);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not update BOQ item.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [editingItem, editQty, load, projectId, ui]);

  const title = project?.name || 'Project';
  const clientLine = project?.client_name ? `Client: ${project.client_name}` : 'Client not set';
  const addressLine = project?.delivery_address ? `• ${project.delivery_address}` : '';

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.titleRow}>
          <Link href="/projects" className={styles.backBtn} title="Back to Projects">
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.titleBlock}>
            <div className={styles.title}>{title}</div>
            <div className={styles.subtitle}>
              {clientLine} {addressLine}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.secondaryAction} onClick={() => setIsOrderDialogOpen(true)}>
            <Package size={16} /> New Order/Category
          </button>
          <button className={styles.primaryAction} onClick={openAdd}>
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      <div className={styles.categoryLayout}>
        <div className={styles.sidebar}>
          <div className={styles.label} style={{ marginBottom: '0.25rem' }}>Orders / Categories</div>
          <div className={styles.categoryList}>
            <div 
              className={`${styles.categoryItem} ${selectedOrder === null ? styles.activeCategory : ''}`}
              onClick={() => setSelectedOrder(null)}
            >
              <div>
                <div>Master BOQ</div>
                <div className={styles.categoryMeta}>Main project items</div>
              </div>
              <ClipboardList size={16} opacity={0.5} />
            </div>
            
            {orders.map(order => (
              <div 
                key={order.id} 
                className={`${styles.categoryItem} ${selectedOrder?.id === order.id ? styles.activeCategory : ''}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.order_number}
                  </div>
                  <div className={styles.categoryMeta}>Order / Section</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    className={styles.dangerIcon} 
                    style={{ width: '22px', height: '22px', padding: 0 }}
                    onClick={(e) => { e.stopPropagation(); deleteOrder(order); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.categoryHeader}>
            <div className={styles.categoryTitle}>
              {selectedOrder ? selectedOrder.order_number : 'Master Bill of Quantities'}
              {selectedOrder && <span className={styles.orderBadge}>Order</span>}
            </div>
            <div className={styles.subtitle}>
              {selectedOrder ? `Specific items for this section` : 'Uncategorized project items'}
            </div>
          </div>

          <div className={styles.card}>
            {warning ? <div className={styles.empty}>{warning}</div> : null}

            {isLoading ? (
              <div className={styles.empty}>Loading items...</div>
            ) : (selectedOrder ? orderItems : items).length === 0 ? (
              <div className={styles.empty}>
                No items in this {selectedOrder ? 'order' : 'section'} yet. 
                Click “Add Item” to add your first line.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.itemNumberHeader}>No.</th>
                      <th>Item</th>
                      <th>Manufacturers</th>
                      <th>Unit</th>
                      <th className={styles.numericCell}>Qty</th>
                      {!selectedOrder && <th className={styles.numericCell}>Delivered</th>}
                      {!selectedOrder && <th className={styles.numericCell}>Balance</th>}
                      <th className={styles.actionsCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder ? orderItems : items).map((item, index) => {
                      const delivered = item.delivered || 0;
                      const balance = Math.max((item.quantity || 0) - delivered, 0);
                      return (
                        <tr key={item.id}>
                          <td className={styles.itemNumber}>{index + 1}</td>
                          <td className={styles.itemName}>
                            <div>{item.item_name}</div>
                            {item.variant_id && catalogMeta[item.variant_id]?.label && catalogMeta[item.variant_id].label !== item.item_name ? (
                              <div className={styles.variantNote}>{catalogMeta[item.variant_id].label}</div>
                            ) : null}
                          </td>
                          <td>{item.manufacturer || '-'}</td>
                          <td>{item.unit}</td>
                          <td className={styles.numericCell}>{item.quantity}</td>
                          {!selectedOrder && <td className={`${styles.deliveredValue} ${styles.numericCell}`}>{delivered}</td>}
                          {!selectedOrder && <td className={`${styles.balanceValue} ${styles.numericCell}`}>{balance}</td>}
                          <td className={styles.actionsCell}>
                            <button
                              type="button"
                              className={styles.iconAction}
                              title="Edit"
                              onClick={() => void openEdit(item)}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.dangerIcon}
                              title="Delete"
                              onClick={() => void deleteItem(item)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOrderDialogOpen && (
        <div className={styles.overlay} onClick={() => setIsOrderDialogOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>New Order / Category</div>
              <button type="button" className={styles.closeBtn} onClick={() => setIsOrderDialogOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Category/Order Name *</label>
                  <input 
                    className={styles.input} 
                    value={newOrderNumber} 
                    onChange={(e) => setNewOrderNumber(e.target.value)} 
                    placeholder="e.g. Swimming Pools" 
                  />
                </div>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} onClick={() => setIsOrderDialogOpen(false)}>Cancel</button>
              <button className={styles.primaryAction} disabled={isSaving} onClick={addOrder}>
                {isSaving ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogOpen ? (
        <div className={styles.overlay} onClick={() => (isSaving ? null : setDialogOpen(false))}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>Add BOQ Item</div>
              <button type="button" className={styles.closeBtn} onClick={() => (isSaving ? null : setDialogOpen(false))}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Select Existing Item (or type new)</label>
                  <SearchableSelect
                    placeholder="Select item from catalog..."
                    searchPlaceholder="Type to search..."
                    emptyText="No matching items in catalog"
                    value={existingItemValue}
                    options={itemOptions}
                    onChange={(value) => {
                      setExistingItemValue(value);
                      const meta = catalogMeta[value];
                      if (meta?.name) {
                        setSelectedVariantId(value);
                        setSelectedVariantStock(meta.stock);
                        setItemName(meta.label);
                        if (meta.manufacturer) setManufacturer(meta.manufacturer);
                        if (meta.unit) setUnit(meta.unit);
                        return;
                      }
                      
                      // Custom option lookup
                      const custom = itemOptions.find((opt) => opt.value === value);
                      if (custom?.label) {
                        const label = custom.label;
                        setItemName(label);
                        
                        // Try to auto-fill based on name if not already filled
                        const lookup = nameToMeta.get(label.toLowerCase());
                        if (lookup) {
                          if (!manufacturer && lookup.manufacturer) setManufacturer(lookup.manufacturer);
                          if ((unit === DEFAULT_UNIT || !unit) && lookup.unit) setUnit(lookup.unit);
                          if (lookup.variantId) setSelectedVariantId(lookup.variantId);
                          if (lookup.stock !== undefined) setSelectedVariantStock(lookup.stock);
                        }
                      }
                    }}
                  />
                </div>

                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Warehouse (Optional: specify which warehouse will fulfill this)</label>
                  <SearchableSelect
                    placeholder="Select warehouse (Optional)..."
                    searchPlaceholder="Search warehouse..."
                    emptyText={
                      !selectedVariantId
                        ? 'Select an item first'
                        : 'This item is not available in any warehouse'
                    }
                    value={selectedWarehouseId}
                    options={availableWarehouseOptions}
                    onChange={setSelectedWarehouseId}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Unit</label>
                  <SearchableSelect
                    placeholder="Select unit..."
                    searchPlaceholder="Type to search..."
                    addActionLabel="Add unit"
                    emptyText="No matching units"
                    value={unit}
                    options={units.map((u) => ({ value: u, label: u, keywords: [u] }))}
                    onCreateOption={async (value) => {
                      const created = await inventoryService.createUnit(value);
                      const updated = await inventoryService.getUnits();
                      setUnits(updated);
                      return created;
                    }}
                    onChange={(value) => setUnit(value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Quantity *</label>
                  <input className={styles.input} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
                  {selectedVariantId && catalogMeta[selectedVariantId] ? (
                    <div className={styles.stockBreakdown}>
                      <div className={styles.stockTotal}>
                        Total Stock: <strong>{catalogMeta[selectedVariantId].stock}</strong>
                      </div>
                      <div className={styles.stockMetrics}>
                        <div className={styles.stockMetricRow}>
                          <span>Promised in This Project:</span>
                          <strong className={styles.thisProjectValue}>{promisedStock[selectedVariantId]?.thisProject || 0}</strong>
                        </div>
                        <div className={styles.stockMetricRow}>
                          <span>Promised in Other Projects:</span>
                          <strong className={styles.promisedValue}>{promisedStock[selectedVariantId]?.otherProjects || 0}</strong>
                        </div>
                        <div className={styles.stockMetricRow}>
                          <span>Available Leftovers:</span>
                          <strong className={styles.availableValue}>{Math.max((catalogMeta[selectedVariantId].stock) - ((promisedStock[selectedVariantId]?.thisProject || 0) + (promisedStock[selectedVariantId]?.otherProjects || 0)), 0)}</strong>
                        </div>
                      </div>
                      <div className={styles.warehouseList}>
                        {catalogMeta[selectedVariantId].stock_data && catalogMeta[selectedVariantId].stock_data!.length > 0 ? (
                          <>
                            <div className={styles.warehouseHeader}>Warehouse Breakdown:</div>
                            {selectedVariantWarehouseBreakdown.map((warehouse) => (
                              <div
                                key={warehouse.warehouseId || warehouse.warehouseName}
                                className={styles.warehouseRow}
                                style={{
                                  alignItems: 'flex-start',
                                  background: selectedWarehouseId && warehouse.warehouseId === selectedWarehouseId ? '#f8fafc' : 'transparent',
                                  padding: '0.35rem 0.25rem',
                                  borderRadius: '0.35rem',
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                                  <span>{warehouse.warehouseName}</span>
                                  <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                                    This: {warehouse.promisedThis} | Other: {warehouse.promisedOther} | Free: {warehouse.free}
                                  </span>
                                </div>
                                <strong>{warehouse.stock}</strong>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className={styles.noStock}>No stock available in any warehouse</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} disabled={isSaving} onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button className={styles.primaryAction} disabled={isSaving} onClick={() => void addItem()}>
                {isSaving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editDialogOpen && editingItem ? (
        <div className={styles.overlay} onClick={() => (isSaving ? null : setEditDialogOpen(false))}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>Edit BOQ Item</div>
              <button type="button" className={styles.closeBtn} onClick={() => (isSaving ? null : setEditDialogOpen(false))}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Item Name</label>
                  <div className={styles.staticField}>{editingItem.item_name}</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Manufacturer</label>
                  <div className={styles.staticField}>{editingItem.manufacturer || '-'}</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Unit</label>
                  <div className={styles.staticField}>{editingItem.unit}</div>
                </div>

                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Quantity *</label>
                  <input 
                    className={styles.input} 
                    value={editQty} 
                    onChange={(e) => setEditQty(e.target.value)} 
                    placeholder="0" 
                    autoFocus
                  />
                  <div className={styles.qtyHelp}>
                    Current: {editingItem.quantity} | Delivered: {editingItem.delivered || 0} | Balance: {Math.max((editingItem.quantity || 0) - (editingItem.delivered || 0), 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} disabled={isSaving} onClick={() => setEditDialogOpen(false)}>
                Cancel
              </button>
              <button className={styles.primaryAction} disabled={isSaving} onClick={() => void updateItem()}>
                {isSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import React from 'react';
import styles from './BoqDetail.module.css';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, X, Save, FileText, Download, Heading1, Search, Edit2, Check } from 'lucide-react';
import { projectsService, type BoqItemRecord, type ProjectRecord, type ProjectOrderRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { inventoryService } from '@/lib/services/inventory';
import { useSupabaseRealtime } from '@/lib/hooks/useSupabaseRealtime';

// A flat card entry = one variant × one warehouse slot
interface BulkCard {
  key: string;           // unique: variantId_warehouseId (or variantId if no wh)
  productName: string;
  sku: string;
  manufacturer: string;
  unit: string;
  stock: number;
  warehouseName: string;
  variantId: string;
  warehouseId: string;
  promisedProject: number;
  promisedOther: number;
  free: number;
}

// Row type for add-row form
type RowType = 'item' | 'header';
type BulkEditRow = {
  item_name: string;
  manufacturer: string;
  unit: string;
  quantity: string;
};

export default function OrderBoqPage() {
  const ui = useUi();
  const params = useParams<{ projectId: string; orderId: string }>();
  const { projectId, orderId } = params;

  const [project, setProject] = React.useState<ProjectRecord | null>(null);
  const [order, setOrder] = React.useState<ProjectOrderRecord | null>(null);
  const [items, setItems] = React.useState<BoqItemRecord[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [componentsMap, setComponentsMap] = React.useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Form for new row
  const [showAddRow, setShowAddRow] = React.useState(false);
  const [addRowType, setAddRowType] = React.useState<RowType>('item');
  const [itemName, setItemName] = React.useState('');
  const [headerText, setHeaderText] = React.useState('');
  const [manufacturer, setManufacturer] = React.useState('');
  const [unit, setUnit] = React.useState('Nos');
  const [qty, setQty] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Rows: items (from DB) + headers (DB with localStorage fallback)
  const [headers, setHeaders] = React.useState<{ id: string; afterIndex: number; text: string }[]>([]);

  // Bulk add — product card grid
  const [showBulkAdd, setShowBulkAdd] = React.useState(false);
  const [bulkSearch, setBulkSearch] = React.useState('');
  const [bulkCards, setBulkCards] = React.useState<BulkCard[]>([]);
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  const [selectedCardKey, setSelectedCardKey] = React.useState('');
  const [selectedVariantId, setSelectedVariantId] = React.useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState('');
  const [editingItem, setEditingItem] = React.useState<BoqItemRecord | null>(null);
  const [editItemName, setEditItemName] = React.useState('');
  const [editManufacturer, setEditManufacturer] = React.useState('');
  const [editUnit, setEditUnit] = React.useState('Nos');
  const [editQty, setEditQty] = React.useState('');
  const [editWarehouseId, setEditWarehouseId] = React.useState('');
  const [editWarehouseOptions, setEditWarehouseOptions] = React.useState<Array<{ value: string; label: string }>>([]);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [inlineEditItemId, setInlineEditItemId] = React.useState<string | null>(null);
  const [inlineQty, setInlineQty] = React.useState('');
  const [isBulkEditing, setIsBulkEditing] = React.useState(false);
  const [bulkEditRows, setBulkEditRows] = React.useState<Record<string, BulkEditRow>>({});

  // Save & Download dialog
  const [showDownload, setShowDownload] = React.useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = React.useState(false);

  const headersKey = `boq_headers_${orderId}`;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectResult, ordersResult, productsResult, allBoqResult] = await Promise.all([
        projectsService.getProject(projectId),
        projectsService.listProjectOrders(projectId),
        inventoryService.getProducts(),
        projectsService.listAllBoqItems(),
      ]);
      setProject(projectResult);
      setProducts(productsResult);


      const variants = buildVariantEntries(productsResult as any[]);
      const localFindVariantForBoqItem = (boqItem: BoqItemRecord) => {
        if (boqItem.variant_id) {
          const found = variants.find((entry) => entry.variant.id === boqItem.variant_id);
          if (found) return found.variant;
        }
        return variants.find((entry) => qualitativeMatch(boqItem, entry.productName, entry.variant))?.variant;
      };

      const currentProjectId = projectId;
      const projectPromiseMaps = {
        warehouseMap: new Map<string, number>(),
        globalMap: new Map<string, number>(),
      };
      const otherPromiseMaps = {
        warehouseMap: new Map<string, number>(),
        globalMap: new Map<string, number>(),
      };

      allBoqResult.forEach((item) => {
        const remaining = Math.max(item.quantity - (item.delivered || 0), 0);
        if (remaining <= 0) return;
        const variant = localFindVariantForBoqItem(item);
        if (!variant) return;
        const targetMaps = item.project_id === currentProjectId ? projectPromiseMaps : otherPromiseMaps;
        if (item.warehouse_id) {
          const key = `${variant.id}::${item.warehouse_id}`;
          targetMaps.warehouseMap.set(key, (targetMaps.warehouseMap.get(key) || 0) + remaining);
        } else {
          targetMaps.globalMap.set(variant.id, (targetMaps.globalMap.get(variant.id) || 0) + remaining);
        }
      });

      const cards: BulkCard[] = [];
      const variantGroups = new Map<string, BulkCard[]>();
      for (const entry of variants) {
        const variant = entry.variant;
        const stockData: any[] = variant.stock_data || [];
        const base = {
          productName: entry.productName,
          sku: variant.sku || '',
          manufacturer: entry.manufacturer,
          unit: entry.unit,
          variantId: variant.id,
        };

        if (stockData.length === 0) {
          const card: BulkCard = {
            key: `${variant.id}_no_wh`,
            ...base,
            stock: 0,
            warehouseName: '-',
            warehouseId: '',
            promisedProject: 0,
            promisedOther: 0,
            free: 0,
          };
          cards.push(card);
          variantGroups.set(variant.id, [card]);
        } else {
          const rows: BulkCard[] = stockData.map((slot) => ({
            key: `${variant.id}_${slot.warehouse_id || 'no_wh'}`,
            ...base,
            stock: slot.quantity || 0,
            warehouseName: slot.warehouse_name || '-',
            warehouseId: slot.warehouse_id || '',
            promisedProject: 0,
            promisedOther: 0,
            free: 0,
          }));
          rows.forEach((row) => cards.push(row));
          variantGroups.set(variant.id, rows);
        }
      }

      for (const [variantId, rows] of variantGroups.entries()) {
        let remainingProject = projectPromiseMaps.globalMap.get(variantId) || 0;
        let remainingOther = otherPromiseMaps.globalMap.get(variantId) || 0;

        rows.forEach((row, index) => {
          const warehouseKey = `${variantId}::${row.warehouseId}`;
          const explicitProject = projectPromiseMaps.warehouseMap.get(warehouseKey) || 0;
          const explicitOther = otherPromiseMaps.warehouseMap.get(warehouseKey) || 0;
          const available = Math.max(row.stock - explicitProject - explicitOther, 0);
          const allocateProject = Math.min(available, remainingProject);
          remainingProject -= allocateProject;
          const leftoverAfterProject = Math.max(available - allocateProject, 0);
          const allocateOther = Math.min(leftoverAfterProject, remainingOther);
          remainingOther -= allocateOther;
          const isLast = index === rows.length - 1;
          const overflowProject = isLast ? remainingProject : 0;
          const overflowOther = isLast ? remainingOther : 0;

          row.promisedProject = explicitProject + allocateProject + overflowProject;
          row.promisedOther = explicitOther + allocateOther + overflowOther;
          row.free = row.stock - row.promisedProject - row.promisedOther;
        });
      }

      setBulkCards(cards);
      if (orderId === 'master') {
        const itemsResult = await projectsService.listBoqItems(projectId);
        setItems(itemsResult.filter(i => !i.order_id));
        setOrder({ id: 'master', project_id: projectId, order_number: 'Master BOQ', order_date: '', status: 'ACTIVE' });
      } else {
        const currentOrder = ordersResult.find(o => o.id === orderId);
        if (currentOrder) {
          setOrder(currentOrder);
          const itemsResult = await projectsService.listBoqItemsForOrder(projectId, orderId);
          setItems(itemsResult);

          // Fetch components for variants that are SETs
          const setVariantIds = Array.from(new Set(
            itemsResult
              .map(item => findVariantForBoqItem(item)?.id)
              .filter(id => {
                if (!id) return false;
                const v = variants.find(e => e.variant.id === id);
                const u = (v?.unit || '').toUpperCase();
                return u === 'SET' || u === 'SETS';
              }) as string[]
          ));
          
          if (setVariantIds.length > 0) {
            const comps = await inventoryService.getBatchVariantComponents(setVariantIds);
            setComponentsMap(comps);
          }
        }
      }
      const dbHeaders = await projectsService.listBoqHeaders(projectId, orderId);
      if (dbHeaders.length > 0) {
        setHeaders(dbHeaders.map((header) => ({
          id: header.id,
          afterIndex: header.after_index,
          text: header.text,
        })));
        localStorage.setItem(headersKey, JSON.stringify(dbHeaders.map((header) => ({
          id: header.id,
          afterIndex: header.after_index,
          text: header.text,
        }))));
        return;
      }

      // Fallback for older deployments before the boq_headers migration is applied.
      try {
        const stored = localStorage.getItem(headersKey);
        if (stored) setHeaders(JSON.parse(stored) as { id: string; afterIndex: number; text: string }[]);
      } catch { /* ignore */ }
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to load data.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, orderId, ui, headersKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useSupabaseRealtime(
    `boq-detail-live-${projectId}-${orderId}`,
    React.useMemo(() => [
      { table: 'products' },
      { table: 'variants' },
      { table: 'inventory' },
      { table: 'warehouses' },
      { table: 'boq_items', filter: `project_id=eq.${projectId}` },
      { table: 'boq_headers', filter: `project_id=eq.${projectId}` },
      { table: 'project_orders', filter: `project_id=eq.${projectId}` },
      { table: 'challans', filter: `project_id=eq.${projectId}` },
      { table: 'challan_items' },
    ], [projectId]),
    () => {
      void load();
    },
  );

  const saveHeaders = (newHeaders: typeof headers) => {
    setHeaders(newHeaders);
    localStorage.setItem(headersKey, JSON.stringify(newHeaders));
  };

  const addHeader = async (text: string) => {
    const afterIndex = items.length > 0 ? items.length - 1 : 0;
    try {
      const created = await projectsService.createBoqHeader({
        projectId,
        orderId,
        afterIndex,
        text,
      });
      saveHeaders([...headers, { id: created.id, afterIndex: created.after_index, text: created.text }]);
    } catch (error) {
      console.warn('BOQ header database save failed; using local fallback.', error);
      saveHeaders([...headers, { id: `h_${Date.now()}`, afterIndex, text }]);
    }
  };

  const buildVariantEntries = (productData: any[]) =>
    productData.flatMap((prod) =>
      (prod.variants || []).map((variant: any) => ({
        productName: prod.name || prod.category || 'Product',
        variant,
        manufacturer:
          variant.attributes?.Manufacturer ||
          variant.attributes?.manufacturer ||
          variant.attributes?.brand ||
          prod.brand ||
          '',
        unit:
          variant.attributes?.Unit ||
          variant.attributes?.unit ||
          prod.unit ||
          'Pcs',
      })),
    );

  const qualitativeMatch = (boqItem: BoqItemRecord, productName: string, variant: any) => {
    const itemName = String(boqItem.item_name || '').trim().toLowerCase();
    const normalizedProductName = String(productName || '').trim().toLowerCase();
    const sku = String(variant.sku || '').trim().toLowerCase();
    const manufacturer = String(
      variant.attributes?.Manufacturer ||
      variant.attributes?.manufacturer ||
      variant.attributes?.brand ||
      '',
    ).trim().toLowerCase();
    const boqManufacturer = String(boqItem.manufacturer || '').trim().toLowerCase();
    if (!itemName) return false;
    if (sku && (itemName === sku || itemName.includes(sku) || boqManufacturer === sku || boqManufacturer.includes(sku))) return true;
    if (
      boqManufacturer &&
      manufacturer &&
      boqManufacturer === manufacturer &&
      normalizedProductName &&
      itemName.includes(normalizedProductName)
    ) return true;
    if (boqManufacturer && sku && boqManufacturer !== sku) return false;
    if (itemName === normalizedProductName && !boqManufacturer) return true;
    if (normalizedProductName && itemName.includes(normalizedProductName)) return true;
    return false;
  };

  const variantEntries = React.useMemo(() => buildVariantEntries(products), [products]);

  const findVariantForBoqItem = React.useCallback(
    (boqItem: BoqItemRecord) => {
      if (boqItem.variant_id) {
        const found = variantEntries.find((entry) => entry.variant.id === boqItem.variant_id);
        if (found) return found.variant;
      }
      return variantEntries.find((entry) => qualitativeMatch(boqItem, entry.productName, entry.variant))?.variant;
    },
    [variantEntries],
  );

  const getVariantSummary = React.useCallback((variantId: string) => {
    const cards = bulkCards.filter(c => c.variantId === variantId);
    const totalStock = cards.reduce((sum, c) => sum + c.stock, 0);
    const promisedThis = cards.reduce((sum, c) => sum + c.promisedProject, 0);
    const promisedOther = cards.reduce((sum, c) => sum + c.promisedOther, 0);
    const free = totalStock - promisedThis - promisedOther;
    return { totalStock, promisedThis, promisedOther, free, cards };
  }, [bulkCards]);

  const resetInlineRow = () => {
    setItemName('');
    setManufacturer('');
    setQty('');
    setUnit('Nos');
    setHeaderText('');
    setSelectedCardKey('');
    setSelectedVariantId('');
    setSelectedWarehouseId('');
  };

  const openAddItem = () => {
    resetInlineRow();
    setAddRowType('item');
    setShowAddRow(true);
  };

  const handleAddItem = async () => {
    if (addRowType === 'header') {
      if (!headerText.trim()) {
        ui.showToast('Header text is required.', 'info');
        return;
      }
      await addHeader(headerText.trim());
      ui.showToast('Header added.', 'success');
      setHeaderText('');
      setShowAddRow(false);
      return;
    }

    if (!selectedVariantId) {
      ui.showToast('Select a catalog item first. This keeps BOQ, stock, and dispatch connected.', 'info');
      return;
    }

    if (!selectedWarehouseId) {
      ui.showToast('Choose the warehouse that will fulfill this BOQ item.', 'info');
      return;
    }

    if (!itemName.trim() || !qty) {
      ui.showToast('Item and quantity are required.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      await projectsService.addBoqItem({
        projectId,
        order_id: orderId === 'master' ? undefined : orderId,
        item_name: itemName.trim(),
        manufacturer: manufacturer.trim(),
        quantity: Number(qty),
        unit: unit.trim() || 'Nos',
        variant_id: selectedVariantId || undefined,
        warehouse_id: selectedWarehouseId || undefined,
      });
      ui.showToast('Item added.', 'success');
      setAddItemDialogOpen(false);
      setShowAddRow(false);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to add item.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProductSelect = (cardKey: string) => {
    setSelectedCardKey(cardKey);
    const card = bulkCards.find((c) => c.key === cardKey);
    if (!card) return;
    setItemName(card.productName);
    setManufacturer(card.manufacturer || '');
    setUnit(card.unit || 'Nos');
    setSelectedVariantId(card.variantId || '');
    setSelectedWarehouseId(card.warehouseId || '');
  };

  const getItemDisplayName = (item: BoqItemRecord) => {
    const variant = findVariantForBoqItem(item);
    const base = item.item_name || 'Item';
    const sku = variant?.sku || '';
    const parts: string[] = [base];
    if (sku && !base.toLowerCase().includes(sku.toLowerCase())) {
      parts.push(sku);
    }
    return parts.join(' - ');
  };

  const getItemManufacturer = (item: BoqItemRecord) => {
    const entry = item.variant_id
      ? variantEntries.find((candidate) => candidate.variant.id === item.variant_id)
      : variantEntries.find((candidate) => qualitativeMatch(item, candidate.productName, candidate.variant));
    return entry?.manufacturer || item.manufacturer || '-';
  };



  const saveInlineQty = async (item: BoqItemRecord) => {
    if (!inlineQty || isNaN(Number(inlineQty)) || Number(inlineQty) <= 0) {
      ui.showToast('Please enter a valid quantity.', 'info');
      return;
    }
    try {
      await projectsService.updateBoqItem({
        projectId,
        boqItemId: item.id,
        quantity: Number(inlineQty),
      });
      ui.showToast('Quantity updated.', 'success');
      setInlineEditItemId(null);
      setInlineQty('');
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to update quantity.', 'error');
    }
  };

  const startBulkEdit = () => {
    const nextRows: Record<string, BulkEditRow> = {};
    items.forEach((item) => {
      nextRows[item.id] = {
        item_name: item.item_name || '',
        manufacturer: getItemManufacturer(item) === '-' ? '' : getItemManufacturer(item),
        unit: item.unit || 'Nos',
        quantity: String(item.quantity || 0),
      };
    });
    setInlineEditItemId(null);
    setInlineQty('');
    setBulkEditRows(nextRows);
    setIsBulkEditing(true);
  };

  const updateBulkEditRow = (itemId: string, field: keyof BulkEditRow, value: string) => {
    setBulkEditRows((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        [field]: value,
      },
    }));
  };

  const cancelBulkEdit = () => {
    setIsBulkEditing(false);
    setBulkEditRows({});
  };

  const saveBulkEdit = async () => {
    const updates = items.map((item) => ({ item, row: bulkEditRows[item.id] })).filter((entry) => entry.row);

    for (const { item, row } of updates) {
      const quantity = Number(row.quantity);
      if (!row.item_name.trim()) {
        ui.showToast('Item name cannot be empty.', 'info');
        return;
      }
      if (!row.unit.trim()) {
        ui.showToast('Unit cannot be empty.', 'info');
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        ui.showToast('Quantity must be greater than 0.', 'info');
        return;
      }
      if ((item.delivered || 0) > quantity) {
        ui.showToast('Quantity cannot be less than already delivered quantity.', 'info');
        return;
      }
    }

    setIsSaving(true);
    try {
      await Promise.all(updates.map(({ item, row }) => projectsService.updateBoqItem({
        projectId,
        boqItemId: item.id,
        item_name: row.item_name.trim(),
        manufacturer: row.manufacturer.trim(),
        unit: row.unit.trim(),
        quantity: Number(row.quantity),
      })));
      ui.showToast('BOQ items saved.', 'success');
      setIsBulkEditing(false);
      setBulkEditRows({});
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to save BOQ items.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditItem = (item: BoqItemRecord) => {
    setEditingItem(item);
    setEditItemName(item.item_name);
    setEditManufacturer(item.manufacturer || '');
    setEditUnit(item.unit || 'Nos');
    setEditQty(String(item.quantity || 0));
    setEditWarehouseId(item.warehouse_id || '');

    const variant = findVariantForBoqItem(item);
    const options = bulkCards
      .filter((card) => variant && card.variantId === variant.id)
      .reduce((acc: Array<{ value: string; label: string }>, card) => {
        const value = card.warehouseId || '';
        if (!acc.some((opt) => opt.value === value)) {
          acc.push({
            value,
            label: value ? `${card.warehouseName} (${card.stock} in stock)` : `Any warehouse (${card.stock} in stock)`,
          });
        }
        return acc;
      }, []);
    setEditWarehouseOptions(options);
    setEditDialogOpen(true);
  };

  const saveEditedItem = async () => {
    if (!editingItem) return;
    if (!editItemName.trim() || !editQty.trim()) {
      ui.showToast('Item name and quantity are required.', 'info');
      return;
    }
    const linkedVariant = findVariantForBoqItem(editingItem);
    if (linkedVariant && !editWarehouseId) {
      ui.showToast('Choose the warehouse that will fulfill this BOQ item.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      await projectsService.updateBoqItem({
        projectId,
        boqItemId: editingItem.id,
        item_name: editItemName.trim(),
        manufacturer: editManufacturer.trim(),
        quantity: Number(editQty),
        unit: editUnit.trim() || 'Nos',
        warehouse_id: editWarehouseId || undefined,
      });
      ui.showToast('Item updated.', 'success');
      setEditDialogOpen(false);
      setEditingItem(null);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to update item.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBulkCards = React.useMemo(() => {
    if (!bulkSearch.trim()) return bulkCards;
    const q = bulkSearch.toLowerCase();
    return bulkCards.filter(
      c =>
        c.productName.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q)
    );
  }, [bulkCards, bulkSearch]);

  const toggleCard = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkAdd = async () => {
    const toAdd = bulkCards.filter(c => selectedKeys.has(c.key));
    if (!toAdd.length) return;

    setIsSaving(true);
    try {
      for (const card of toAdd) {
        await projectsService.addBoqItem({
          projectId,
          order_id: orderId === 'master' ? undefined : orderId,
          item_name: card.productName,
          variant_id: card.variantId || undefined,
          warehouse_id: card.warehouseId || undefined,
          quantity: 1,
          unit: card.unit,
          manufacturer: card.manufacturer,
        });
      }
      ui.showToast(`${toAdd.length} item(s) added.`, 'success');
      setSelectedKeys(new Set());
      setBulkSearch('');
      setShowBulkAdd(false);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Failed during bulk add.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await projectsService.deleteBoqItem(projectId, id);
      ui.showToast('Item removed.', 'success');
      await load();
    } catch {
      ui.showToast('Failed to delete.', 'error');
    }
  };

  const deleteHeader = async (id: string) => {
    try {
      if (!id.startsWith('h_')) {
        await projectsService.deleteBoqHeader(id);
      }
    } catch (error) {
      console.warn('BOQ header database delete failed; removing local copy only.', error);
    }
    saveHeaders(headers.filter(h => h.id !== id));
  };

  // Build merged rows for display
  const buildRows = (): Array<{ type: 'header'; text: string; headerId: string } | { type: 'item'; item: BoqItemRecord; index: number }> => {
    const rows: Array<{ type: 'header'; text: string; headerId: string } | { type: 'item'; item: BoqItemRecord; index: number }> = [];
    let itemIdx = 0;
    // We insert headers AFTER their afterIndex (position in items array at time of creation)
    // Re-sort headers by afterIndex
    const sortedHeaders = [...headers].sort((a, b) => a.afterIndex - b.afterIndex);
    let hPtr = 0;

    for (let i = 0; i < items.length; i++) {
      rows.push({ type: 'item', item: items[i], index: ++itemIdx });
      // Insert any headers that should come after this item index
      while (hPtr < sortedHeaders.length && sortedHeaders[hPtr].afterIndex === i) {
        rows.push({ type: 'header', text: sortedHeaders[hPtr].text, headerId: sortedHeaders[hPtr].id });
        hPtr++;
      }
    }
    // Headers with afterIndex >= items.length go at the end
    while (hPtr < sortedHeaders.length) {
      rows.push({ type: 'header', text: sortedHeaders[hPtr].text, headerId: sortedHeaders[hPtr].id });
      hPtr++;
    }
    return rows;
  };

  const sanitizePdfText = (value: unknown) =>
    String(value ?? '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const truncatePdfText = (value: unknown, maxLength: number) => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
  };

  const loadPdfLogo = async () => {
    try {
      const image = new Image();
      image.src = '/logo1.png';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Logo failed to load'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return null;

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const binary = atob(dataUrl.split(',')[1] || '');
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return { bytes, width: canvas.width, height: canvas.height };
    } catch (error) {
      console.warn('Unable to embed PDF logo:', error);
      return null;
    }
  };

  const handlePdfDownload = () => {
    const rows = buildRows();
    const projectName = project?.name || 'Project';
    const clientName = project?.client_name || '';
    const orderName = order?.order_number || 'BOQ';
    const clientAddress = project?.delivery_address || 'No address provided';
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let tableRows = '';
    for (const row of rows) {
      if (row.type === 'header') {
        tableRows += `<tr class="section-header"><td colspan="7">${row.text.toUpperCase()}</td></tr>`;
      } else {
        const balance = Math.max((row.item.quantity || 0) - (row.item.delivered || 0), 0);
        const variantId = findVariantForBoqItem(row.item)?.id;
        const components = variantId ? componentsMap[variantId] : [];
        
        let componentHtml = '';
        if (components && components.length > 0) {
          componentHtml = `<div style="margin-top:4px;font-size:8.5px;color:#475569;border-left:1.5px solid #0c4a6e;padding-left:8px;font-style:italic">
            ${components.map(c => `• ${c.name} (${c.sku}) — ${c.quantity * (row.item.quantity || 0)} ${c.unit}`).join('<br>')}
          </div>`;
        }

        tableRows += `<tr>
          <td style="text-align:center;color:#64748b;width:40px">${row.index}</td>
          <td class="item-name">
            ${row.item.item_name}
            ${componentHtml}
          </td>
          <td style="color:#475569">${getItemManufacturer(row.item)}</td>
          <td style="color:#475569">${row.item.unit || 'Nos'}</td>
          <td style="text-align:right;font-weight:600">${row.item.quantity}</td>
          <td style="text-align:right;color:#64748b">${row.item.delivered || 0}</td>
          <td style="text-align:right;font-weight:700;color:${balance > 0 ? '#111111ff' : '#0f172a'}">${balance}</td>
        </tr>`;
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${orderName} - ${projectName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1f1f1fff;
      --accent: #505050ff;
      --border: #808080ff;
      --text-main: #242424ff;
      --text-muted: #858585ff;
      --row-bg: #ecececff;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Montserrat', sans-serif; 
      color: var(--text-main); 
      line-height: 1.5; 
      padding: 40px;
      font-size: 11px;
      background: white;
    }
    .header-top { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
    .logo-img { height: 60px; width: auto; object-fit: contain; }
    
    .doc-title-box { background: var(--primary); color: white; padding: 16px 32px; text-align: right; border-radius: 0; }
    .doc-title-box h1 { font-size: 16px; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.05em; }
    .doc-title-box p { font-size: 10px; opacity: 0.9; font-weight: 500; }
    
    .company-details { margin-bottom: 35px; font-size: 10px; color: var(--text-muted); line-height: 1.6; }
    .company-details strong { color: var(--primary); display: block; font-size: 12px; margin-bottom: 4px; font-weight: 700; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 35px; }
    .info-box { border: 1px solid var(--border); border-radius: 0; overflow: hidden; }
    .info-box-header { background: var(--row-bg); padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 8px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; }
    .info-box-content { padding: 14px; }
    .info-box-content strong { display: block; font-size: 12px; margin-bottom: 6px; color: var(--primary); font-weight: 700; }
    .info-box-content p { font-size: 10px; color: var(--text-muted); line-height: 1.5; }

    table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid var(--border); }
    th { background: var(--primary); color: white; padding: 12px 14px; font-size: 9px; font-weight: 700; text-transform: uppercase; text-align: left; letter-spacing: 0.05em; }
    th:nth-child(n+5) { text-align: right; }
    td { padding: 14px 14px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 10.5px; }
    tr:nth-child(even) { background-color: #fcfdfe; }
    .item-name { font-weight: 600; max-width: 280px; line-height: 1.5; color: var(--primary); }
    .section-header td { background: var(--row-bg); font-weight: 800; color: var(--primary); font-size: 10px; padding: 10px 14px; text-transform: uppercase; letter-spacing: 0.05em; border-top: 2px solid var(--primary); }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 120px; margin-top: 80px; page-break-inside: avoid; }
    .sig-box { border-top: 2px solid var(--primary); padding-top: 12px; }
    .sig-box p { font-size: 10px; font-weight: 700; margin-bottom: 4px; color: var(--primary); }
    .sig-box span { font-size: 9px; color: var(--text-muted); font-weight: 500; }

    .footer { margin-top: 60px; border-top: 1px solid var(--border); padding-top: 15px; font-size: 9px; color: var(--text-muted); text-align: right; font-weight: 500; }

    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; }
      .doc-title-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section-header td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header-top">
    <img src="/logo1.png" alt="Company Logo" class="logo-img" onerror="this.style.display='none'; document.getElementById('text-logo').style.display='block';">
    <div id="text-logo" style="display:none; font-size:24px; font-weight:800; color:var(--primary);">WATCON</div>
    <div class="doc-title-box">
      <h1>BILL OF QUANTITIES</h1>
      <p># ${orderName} | ${dateStr}</p>
    </div>
  </div>

  <div class="company-details">
    <strong>Watcon International Pvt. Ltd.</strong>
    S-36, Okhla Phase II, Pocket S, Okhla Phase II, Okhla Industrial Estate, New Delhi, Delhi 110020<br>
    www.watcon.in
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-box-header">Bill To / Site Address</div>
      <div class="info-box-content">
        <strong>${clientName}</strong>
        <p>${clientAddress}</p>
      </div>
    </div>
    <div class="info-box">
      <div class="info-box-header">Project Information</div>
      <div class="info-box-content">
        <strong>${projectName}</strong>
        <p>Project Code: ${project?.code || 'N/A'}<br>Status: ${project?.status || 'Active'}</p>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Description of Item</th>
        <th>Manufacturer</th>
        <th>Unit</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Deliv.</th>
        <th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <p>Receiver's Signature</p>
      <span>(Stamp & Date)</span>
    </div>
    <div class="sig-box" style="text-align: right;">
      <p>For Watcon International</p>
      <span>Authorized Signatory</span>
    </div>
  </div>

  <div class="footer">
    Generated on ${new Date().toLocaleString('en-IN')} | Page 1 of 1
  </div>

  <script>
    window.onload = () => {
      // Ensure images are loaded
      setTimeout(() => {
        window.print();
        window.close();
      }, 800);
    };
  </script>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
    setShowDownload(false);
  };

  // Download formatted table as HTML
  const handleDownload = () => {
    const rows = buildRows();
    const projectName = project?.name || 'Project';
    const clientName = project?.client_name || '';
    const orderName = order?.order_number || 'BOQ';

    let tableRows = '';
    for (const row of rows) {
      if (row.type === 'header') {
        tableRows += `<tr class="section-header"><td colspan="7">${row.text}</td></tr>`;
      } else {
        const balance = Math.max((row.item.quantity || 0) - (row.item.delivered || 0), 0);
        tableRows += `<tr>
          <td style="text-align:center">${row.index}</td>
          <td style="font-weight:600">${row.item.item_name}</td>
          <td>${getItemManufacturer(row.item)}</td>
          <td>${row.item.unit || 'Nos'}</td>
          <td style="text-align:right">${row.item.quantity}</td>
          <td style="text-align:right">${row.item.delivered || 0}</td>
          <td style="text-align:right">${balance}</td>
        </tr>`;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${orderName} - ${projectName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; padding: 24px; color: #111; }
  .doc-header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .doc-header h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .doc-header .meta { display: flex; gap: 24px; font-size: 11px; color: #555; margin-top: 6px; }
  .doc-header .meta span strong { color: #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  thead th:nth-child(n+5) { text-align: right; }
  tbody td { padding: 10px 10px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tr.section-header td { background: #e2e8f0; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; color: #334155; border-bottom: 1px solid #cbd5e1; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: right; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
<div class="doc-header">
  <h1>${orderName}</h1>
  <div class="meta">
    ${clientName ? `<span><strong>Client:</strong> ${clientName}</span>` : ''}
    <span><strong>Project:</strong> ${projectName}</span>
    <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:40px">S.No</th>
      <th>Description of Item</th>
      <th>Manufacturer</th>
      <th>Unit</th>
      <th style="text-align:right;width:70px">Qty</th>
      <th style="text-align:right;width:80px">Delivered</th>
      <th style="text-align:right;width:70px">Balance</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>
<div class="footer">Generated on ${new Date().toLocaleString('en-IN')}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orderName.replace(/\s+/g, '_')}_${projectName.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
    ui.showToast('Table downloaded!', 'success');
  };

  if (isLoading) return <div className={styles.loading}>Loading BOQ...</div>;

  // Build options from bulkCards so Add-Row dropdown shows all variant combinations
  const productOptions = bulkCards.map((c) => ({
    value: c.key,
    label: `${c.productName} — ${c.warehouseName.toUpperCase()} — ${c.sku || 'No SKU'}`,
    description: `Stock: ${c.stock} | Free: ${Math.max(c.free, 0)} | Promised this project: ${c.promisedProject} | Other projects: ${c.promisedOther}`,
    keywords: [c.productName, c.sku, c.warehouseName, String(c.stock), String(c.free)],
  }));

  const mergedRows = buildRows();
  const friendlyProductOptions = productOptions.map((option) => {
    const c = bulkCards.find((card) => card.key === option.value);
    if (!c) return option;
    return {
      value: c.key,
      label: c.productName,
      description: [
        c.manufacturer ? `Manufacturer: ${c.manufacturer}` : '',
        c.sku ? `SKU: ${c.sku}` : '',
        `Warehouse: ${c.warehouseName}`,
        `Stock: ${c.stock}`,
        `Free: ${Math.max(c.free, 0)}`,
      ].filter(Boolean).join(' | '),
      keywords: [c.productName, c.manufacturer, c.sku, c.warehouseName, String(c.stock), String(c.free)],
    };
  });
  const selectedCard = bulkCards.find((card) => card.key === selectedCardKey);

  return (
    <div className={styles.container}>
      <div className={styles.noPrint}>
        <div className={styles.topBar}>
          <div className={styles.titleRow}>
            <Link href={`/projects/${projectId}`} className={styles.backBtn}>
              <ArrowLeft size={16} />
            </Link>
            <div className={styles.titleBlock}>
              <div className={styles.title}>{order?.order_number}</div>
              <div className={styles.subtitle}>{project?.name}</div>
            </div>
          </div>
          <div className={styles.actions}>
            {isBulkEditing ? (
              <>
                <button className={styles.primaryAction} onClick={() => void saveBulkEdit()} disabled={isSaving}>
                  <Check size={14} /> {isSaving ? 'Saving...' : 'Save All'}
                </button>
                <button className={styles.secondaryAction} onClick={cancelBulkEdit} disabled={isSaving}>
                  <X size={14} /> Cancel
                </button>
              </>
            ) : (
              <button className={styles.secondaryAction} onClick={startBulkEdit} disabled={items.length === 0}>
                <Edit2 size={14} /> Edit All
              </button>
            )}
            <button className={styles.secondaryAction} onClick={() => setShowBulkAdd(true)} disabled={isBulkEditing}>
              <FileText size={14} /> Bulk Add
            </button>
            <button className={styles.secondaryAction} onClick={handlePdfDownload}>
              <Download size={14} /> Download PDF
            </button>
            <button className={styles.secondaryAction} onClick={() => setShowDownload(true)} disabled={isBulkEditing}>
              <Download size={14} /> Save & Download
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>S.No</th>
              <th>Description of Item</th>
              <th>Manufacturer</th>
              <th>Unit</th>
              <th className={styles.numericCell}>Qty</th>
              <th className={styles.numericCell}>Delivered</th>
              <th className={styles.numericCell}>Balance</th>
              <th className={`${styles.actionsCell} ${styles.noPrint}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mergedRows.map((row) =>
              row.type === 'header' ? (
                <tr key={row.headerId} className={styles.sectionHeaderRow}>
                  <td colSpan={7} className={styles.sectionHeaderCell}>{row.text}</td>
                  <td className={`${styles.actionsCell} ${styles.noPrint}`}>
                    <button className={styles.deleteBtn} onClick={() => void deleteHeader(row.headerId)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.item.id}>
                  <td>{row.index}</td>
                  <td className={styles.itemName}>
                    {isBulkEditing ? (
                      <input
                        className={styles.tableInput}
                        value={bulkEditRows[row.item.id]?.item_name || ''}
                        onChange={(e) => updateBulkEditRow(row.item.id, 'item_name', e.target.value)}
                      />
                     ) : getItemDisplayName(row.item)}
                    
                    {!isBulkEditing && (() => {
                      const vId = findVariantForBoqItem(row.item)?.id;
                      const comps = vId ? componentsMap[vId] : [];
                      if (!comps || comps.length === 0) return null;
                      return (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px', borderLeft: '2px solid #e2e8f0', paddingLeft: '8px' }}>
                          {comps.map(c => (
                            <div key={c.variant_id}>• {c.name} ({c.sku}) — {(c.quantity * (row.item.quantity || 0)).toFixed(2)} {c.unit}</div>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    {isBulkEditing ? (
                      <input
                        className={styles.tableInput}
                        value={bulkEditRows[row.item.id]?.manufacturer || ''}
                        onChange={(e) => updateBulkEditRow(row.item.id, 'manufacturer', e.target.value)}
                      />
                    ) : getItemManufacturer(row.item)}
                  </td>
                  <td>
                    {isBulkEditing ? (
                      <input
                        className={styles.tableInput}
                        value={bulkEditRows[row.item.id]?.unit || ''}
                        onChange={(e) => updateBulkEditRow(row.item.id, 'unit', e.target.value)}
                      />
                    ) : row.item.unit}
                  </td>
                  <td
                    className={styles.numericCell}
                    onDoubleClick={() => {
                      if (isBulkEditing) return;
                      setInlineEditItemId(row.item.id);
                      setInlineQty(String(row.item.quantity));
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: inlineEditItemId === row.item.id ? '0' : undefined,
                      fontSize: inlineEditItemId === row.item.id ? '0.85rem' : undefined,
                    }}
                  >
                    {isBulkEditing ? (
                      <input
                        className={`${styles.tableInput} ${styles.tableNumberInput}`}
                        type="number"
                        min="1"
                        value={bulkEditRows[row.item.id]?.quantity || ''}
                        onChange={(e) => updateBulkEditRow(row.item.id, 'quantity', e.target.value)}
                      />
                    ) : inlineEditItemId === row.item.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center', padding: '0.25rem' }}>
                        <input
                          type="number"
                          min="1"
                          value={inlineQty}
                          onChange={(e) => setInlineQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void saveInlineQty(row.item);
                            } else if (e.key === 'Escape') {
                              setInlineEditItemId(null);
                              setInlineQty('');
                            }
                          }}
                          autoFocus
                          style={{ width: '50px', padding: '0.25rem', fontSize: 'inherit' }}
                        />
                        <button
                          className={styles.saveBtn}
                          onClick={() => void saveInlineQty(row.item)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Check size={10} />
                        </button>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => {
                            setInlineEditItemId(null);
                            setInlineQty('');
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      row.item.quantity
                    )}
                  </td>
                  <td className={styles.numericCell}>{row.item.delivered || 0}</td>
                  <td className={styles.numericCell}>
                    {isBulkEditing
                      ? Math.max(Number(bulkEditRows[row.item.id]?.quantity || 0) - (row.item.delivered || 0), 0)
                      : Math.max(row.item.quantity - (row.item.delivered || 0), 0)}
                  </td>
                  <td className={`${styles.actionsCell} ${styles.noPrint}`}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      {isBulkEditing ? null : (
                        <>
                      <button className={styles.deleteBtn} onClick={() => openEditItem(row.item)} title="Edit item">
                        <Edit2 size={12} />
                      </button>
                      <button className={styles.deleteBtn} onClick={() => deleteItem(row.item.id)} title="Delete item">
                        <Trash2 size={12} />
                      </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}

            {showAddRow && (
              <tr className={addRowType === 'header' ? styles.sectionHeaderRow : styles.addRow}>
                <td style={{ verticalAlign: 'top' }}>
                  {addRowType === 'header' ? <span className={styles.headerBadge}>H</span> : (items.length + 1)}
                </td>
                <td className={styles.searchableTd}>
                  {addRowType === 'header' ? (
                    <input
                      className={styles.inlineInput}
                      placeholder="Section heading text..."
                      value={headerText}
                      onChange={e => setHeaderText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <SearchableSelect
                        options={friendlyProductOptions}
                        value={selectedCardKey}
                        onChange={handleProductSelect}
                        placeholder="Search items by name, SKU, or warehouse..."
                        searchPlaceholder="Type to filter..."
                      />
                      {selectedCard && (
                        <div className={styles.selectionMeta}>
                          <div className={styles.selectionMetaGrid}>
                            <div>Stock: <strong>{selectedCard.stock}</strong></div>
                            <div>Free: <strong style={{ color: '#059669' }}>{Math.max(selectedCard.free, 0)}</strong></div>
                            <div>This Project: <strong style={{ color: '#f59e0b' }}>{selectedCard.promisedProject}</strong></div>
                            <div>Other Projects: <strong style={{ color: '#64748b' }}>{selectedCard.promisedOther}</strong></div>
                          </div>
                          <div style={{ marginTop: '0.45rem', fontSize: '0.65rem', color: '#475569', fontWeight: 600, borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                            WAREHOUSE: {selectedCard.warehouseName.toUpperCase()}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  {addRowType === 'item' && (
                    <input
                      className={styles.tableInput}
                      placeholder="Manufacturer"
                      value={manufacturer}
                      onChange={e => setManufacturer(e.target.value)}
                    />
                  )}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  {addRowType === 'item' && (
                    <input
                      className={styles.tableInput}
                      placeholder="Unit"
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                    />
                  )}
                </td>
                <td className={styles.numericCell} style={{ verticalAlign: 'top' }}>
                  {addRowType === 'item' && (
                    <input
                      className={`${styles.tableInput} ${styles.tableNumberInput}`}
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                    />
                  )}
                </td>
                <td></td>
                <td></td>
                <td className={styles.actionsCell} style={{ verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <button className={styles.saveBtn} onClick={handleAddItem} disabled={isSaving}>
                      <Save size={12} />
                    </button>
                    <button className={styles.cancelBtn} onClick={() => { setShowAddRow(false); resetInlineRow(); }}>
                      <X size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {items.length === 0 && !showAddRow && (
          <div className={styles.emptyTable}>No items added yet. Click 'Add Row' below to start.</div>
        )}
      </div>

      <div className={styles.tableFooterActions}>
        {!isBulkEditing && (
          <div className={styles.footerBtnGroup}>
            <button
              className={styles.secondaryAction}
              onClick={() => { setAddRowType('header'); setShowAddRow(true); resetInlineRow(); }}
            >
              <Plus size={14} /> Add Header
            </button>
            <button
              className={styles.primaryAction}
              onClick={() => { setAddRowType('item'); setShowAddRow(true); resetInlineRow(); }}
            >
              <Plus size={14} /> Add Row
            </button>
          </div>
        )}
      </div>

      {/* Bulk Add Dialog */}
      {showBulkAdd && (
        <div className={styles.overlay} onClick={() => { setShowBulkAdd(false); setSelectedKeys(new Set()); setBulkSearch(''); }}>
          <div className={styles.bulkDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.bulkDialogHeader}>
              <div className={styles.dialogTitle}>Add Items in Bulk</div>
              <button
                className={styles.closeBtn}
                onClick={() => { setShowBulkAdd(false); setSelectedKeys(new Set()); setBulkSearch(''); }}
              >
                Close
              </button>
            </div>

            {/* Search */}
            <div className={styles.bulkSearch}>
              <Search size={15} color="#94a3b8" />
              <input
                className={styles.bulkSearchInput}
                placeholder="Search by product name or SKU..."
                value={bulkSearch}
                onChange={e => setBulkSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Card grid */}
            <div className={styles.bulkGrid}>
              {filteredBulkCards.length === 0 ? (
                <div className={styles.bulkEmpty}>No products found.</div>
              ) : (
                filteredBulkCards.map(card => {
                  const checked = selectedKeys.has(card.key);
                  return (
                    <div
                      key={card.key}
                      className={`${styles.bulkCard} ${checked ? styles.bulkCardSelected : ''}`}
                      onClick={() => toggleCard(card.key)}
                    >
                      <input
                        type="checkbox"
                        className={styles.bulkCheckbox}
                        checked={checked}
                        onChange={() => toggleCard(card.key)}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className={styles.bulkCardContent}>
                        <div className={styles.bulkCardName}>{card.productName}</div>
                        <div className={styles.bulkCardMeta}>
                          <span>Manufacturer: <strong>{card.manufacturer || '-'}</strong></span>
                        </div>
                        <div className={styles.bulkCardMeta}>
                          <span className={styles.bulkCardSku}>SKU: {card.sku || '—'}</span>
                        </div>
                        <div className={styles.bulkCardMeta}>
                          <span>Stock: <strong className={card.stock > 0 ? styles.stockGood : styles.stockZero}>{card.stock}</strong></span>
                          {' | '}
                          <span>Free: <strong>{Math.max(card.free, 0)}</strong></span>
                          {' | '}
                          <span>Warehouse: <strong>{card.warehouseName.toUpperCase()}</strong></span>
                        </div>
                        <div className={styles.bulkCardMeta}>
                          <span>Promised this PRJ: <strong>{card.promisedProject}</strong></span>
                          {' | '}
                          <span>Other PRJs: <strong>{card.promisedOther}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.bulkDialogFooter}>
              <button
                className={styles.secondaryAction}
                onClick={() => { setShowBulkAdd(false); setSelectedKeys(new Set()); setBulkSearch(''); }}
              >
                Cancel
              </button>
              <button
                className={styles.primaryAction}
                disabled={isSaving || selectedKeys.size === 0}
                onClick={handleBulkAdd}
              >
                {isSaving ? 'Processing...' : `Add ${selectedKeys.size} Item${selectedKeys.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Dialog */}
      {editDialogOpen && editingItem && (
        <div className={styles.overlay} onClick={() => setEditDialogOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>Edit BOQ Item</div>
              <button className={styles.closeBtn} onClick={() => setEditDialogOpen(false)}><X size={14} /></button>
            </div>
            <div className={styles.dialogBody} style={{ overflowY: 'auto', flex: 1 }}>
              <div className={styles.dialogContent}>
                {/* Left Side: Form */}
                <div className={styles.formSection}>
                  <div className={styles.field}>
                    <label className={styles.label}>Item Name *</label>
                    <input className={styles.input} value={editItemName} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Manufacturer</label>
                    <input className={styles.input} value={editManufacturer} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Unit</label>
                      <input className={styles.input} value={editUnit} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Quantity *</label>
                      <input className={styles.input} type="number" min="1" value={editQty} onChange={(e) => setEditQty(e.target.value)} autoFocus />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Warehouse (Optional)</label>
                    <select
                      className={styles.select}
                      value={editWarehouseId}
                      onChange={(e) => setEditWarehouseId(e.target.value)}
                    >
                      <option value="">Select warehouse (Optional)...</option>
                      {editWarehouseOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right Side: Stock Summary */}
                <div className={styles.stockSummarySidebar}>
                  {(() => {
                    const variant = findVariantForBoqItem(editingItem);
                    if (!variant) return <div style={{ padding: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>No stock data found for this item.</div>;
                    const summary = getVariantSummary(variant.id);
                    return (
                      <>
                        <div className={`${styles.summaryRow} ${styles.total}`}>
                          <span>Total Stock:</span>
                          <strong>{summary.totalStock}</strong>
                        </div>
                        <div className={`${styles.summaryRow} ${styles.promised}`}>
                          <span>Promised in This Project:</span>
                          <strong>{summary.promisedThis}</strong>
                        </div>
                        <div className={`${styles.summaryRow} ${styles.promised}`}>
                          <span>Promised in Other Projects:</span>
                          <strong>{summary.promisedOther}</strong>
                        </div>
                        <div className={`${styles.summaryRow} ${styles.available}`}>
                          <span>Available Leftovers:</span>
                          <strong>{summary.free}</strong>
                        </div>

                        <div className={styles.breakdownTitle}>Warehouse Breakdown:</div>
                        <div className={styles.breakdownList}>
                          {summary.cards.map((c) => (
                            <div key={c.key} className={styles.breakdownItem} style={{ backgroundColor: editWarehouseId === c.warehouseId ? '#f0f9ff' : 'transparent' }}>
                              <div className={styles.breakdownHeader}>
                                <span>{c.warehouseName}</span>
                                <strong>{c.stock}</strong>
                              </div>
                              <div className={styles.breakdownMeta}>
                                This: <span>{c.promisedProject}</span> | Other: <span>{c.promisedOther}</span> | Free: <span style={{ color: '#059669', fontWeight: '700' }}>{c.free}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} onClick={() => setEditDialogOpen(false)}>Cancel</button>
              <button className={styles.primaryAction} onClick={saveEditedItem} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Dialog */}
      {addItemDialogOpen && (
        <div className={styles.overlay} onClick={() => setAddItemDialogOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>Add BOQ Item</div>
              <button className={styles.closeBtn} onClick={() => setAddItemDialogOpen(false)}><X size={14} /></button>
            </div>
            <div className={styles.dialogBody} style={{ overflowY: 'auto', flex: 1 }}>
              <div className={styles.dialogContent}>
                {/* Left Side: Form */}
                <div className={styles.formSection}>
                  <div className={styles.field}>
                    <label className={styles.label}>Catalog Item *</label>
                    <SearchableSelect
                      options={friendlyProductOptions}
                      value={selectedCardKey}
                      onChange={handleProductSelect}
                      placeholder="Search by item, manufacturer, SKU, or warehouse..."
                      searchPlaceholder="Type item, manufacturer, SKU, or warehouse..."
                    />
                  </div>
                  {selectedCard ? (
                    <div className={styles.field} style={{ padding: '0.65rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>Selected Item</div>
                      <div style={{ fontWeight: 800 }}>{selectedCard.productName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem' }}>
                        Manufacturer: <strong>{selectedCard.manufacturer || '-'}</strong> | SKU: <strong>{selectedCard.sku || '-'}</strong>
                      </div>
                    </div>
                  ) : null}
                  <div className={styles.field}>
                    <label className={styles.label}>Fulfillment Warehouse *</label>
                    <select
                      className={styles.select}
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    >
                      <option value="">Choose warehouse...</option>
                      {selectedVariantId && getVariantSummary(selectedVariantId).cards.map(c => (
                        <option key={c.key} value={c.warehouseId}>
                          {c.warehouseId ? `${c.warehouseName} - Stock ${c.stock}, Free ${Math.max(c.free, 0)}` : `No warehouse assigned - Stock ${c.stock}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Unit</label>
                      <select className={styles.select} value={unit} onChange={(e) => setUnit(e.target.value)}>
                        <option value="Nos">Nos</option>
                        <option value="Sets">Sets</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Mtrs">Mtrs</option>
                        <option value="Kgs">Kgs</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Quantity *</label>
                      <input className={styles.input} type="number" min="1" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Right Side: Stock Summary */}
                <div className={styles.stockSummarySidebar}>
                  {!selectedVariantId ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                      Select a product to view stock summary and warehouse breakdown.
                    </div>
                  ) : (
                    (() => {
                      const summary = getVariantSummary(selectedVariantId);
                      return (
                        <>
                          <div className={`${styles.summaryRow} ${styles.total}`}>
                            <span>Total Stock:</span>
                            <strong>{summary.totalStock}</strong>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.promised}`}>
                            <span>Promised in This Project:</span>
                            <strong>{summary.promisedThis}</strong>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.promised}`}>
                            <span>Promised in Other Projects:</span>
                            <strong>{summary.promisedOther}</strong>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.available}`}>
                            <span>Available Leftovers:</span>
                            <strong>{summary.free}</strong>
                          </div>

                          <div className={styles.breakdownTitle}>Warehouse Breakdown:</div>
                          <div className={styles.breakdownList}>
                            {summary.cards.map((c) => (
                              <div key={c.key} className={styles.breakdownItem} style={{ backgroundColor: selectedWarehouseId === c.warehouseId ? '#f0f9ff' : 'transparent' }}>
                                <div className={styles.breakdownHeader}>
                                  <span>{c.warehouseName}</span>
                                  <strong>{c.stock}</strong>
                                </div>
                                <div className={styles.breakdownMeta}>
                                  This: <span>{c.promisedProject}</span> | Other: <span>{c.promisedOther}</span> | Free: <span style={{ color: '#059669', fontWeight: '700' }}>{c.free}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} onClick={() => setAddItemDialogOpen(false)}>Cancel</button>
              <button className={styles.primaryAction} onClick={handleAddItem} disabled={isSaving}>
                {isSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save & Download Dialog */}
      {showDownload && (
        <div className={styles.overlay} onClick={() => setShowDownload(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>Download BOQ Table</div>
              <button className={styles.closeBtn} onClick={() => setShowDownload(false)}><X size={14} /></button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.downloadPreview}>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Project</span>
                  <span className={styles.previewValue}>{project?.name}</span>
                </div>
                {project?.client_name && (
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>Client</span>
                    <span className={styles.previewValue}>{project.client_name}</span>
                  </div>
                )}
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>BOQ / Order</span>
                  <span className={styles.previewValue}>{order?.order_number}</span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Total Items</span>
                  <span className={styles.previewValue}>{items.length}</span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Section Headers</span>
                  <span className={styles.previewValue}>{headers.length}</span>
                </div>
              </div>
              <p className={styles.helpText} style={{ marginTop: '0.75rem' }}>
                Downloads a formatted HTML file you can open in any browser and print as PDF.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} onClick={() => setShowDownload(false)}>Cancel</button>
              <button className={styles.primaryAction} onClick={handleDownload}>
                <Download size={14} /> Download Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

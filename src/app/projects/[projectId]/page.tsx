"use client";

import React from 'react';
import styles from './ProjectDetail.module.css';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { projectsService, type BoqItemRecord, type DataSource, type ProjectRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { inventoryService } from '@/lib/services/inventory';

const DEFAULT_UNIT = 'Numbers';

function normalizeQty(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function ProjectBoqPage() {
  const ui = useUi();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = React.useState<ProjectRecord | null>(null);
  const [projectSource, setProjectSource] = React.useState<DataSource>('supabase');
  const [items, setItems] = React.useState<BoqItemRecord[]>([]);
  const [itemsSource, setItemsSource] = React.useState<DataSource>('supabase');
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
  const [catalogOptions, setCatalogOptions] = React.useState<Array<{ value: string; label: string; keywords?: string[] }>>([]);
  const [extraItemOptions, setExtraItemOptions] = React.useState<Array<{ value: string; label: string; keywords?: string[] }>>([]);

  const [catalogMeta, setCatalogMeta] = React.useState<Record<string, { 
    name: string; 
    manufacturer: string; 
    unit: string; 
    label: string; 
    stock: number;
    stock_data?: Array<{ warehouse_name: string; quantity: number }>;
  }>>({});
  const [selectedVariantStock, setSelectedVariantStock] = React.useState<number | null>(null);
  const [nameToMeta, setNameToMeta] = React.useState(new Map<string, { manufacturer: string; unit: string; stock: number; variantId: string; stock_data?: any[] }>());
  const [units, setUnits] = React.useState<string[]>([DEFAULT_UNIT]);
  const [warehouses, setWarehouses] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState('');

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectResult, itemsResult] = await Promise.all([
        projectsService.getProject(projectId),
        projectsService.listBoqItems(projectId),
      ]);

      setProjectSource(projectResult.source);
      setProject(projectResult.project);
      setItemsSource(itemsResult.source);
      setWarning(itemsResult.warning || '');
      setItems(itemsResult.items);
    } catch (err) {
      console.error(err);
      ui.showToast('Unable to load BOQ right now.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, ui]);

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

      const nameToMeta = new Map<string, { manufacturer: string; unit: string; stock: number; variantId: string }>();
      const meta: Record<string, { name: string; manufacturer: string; unit: string; label: string; stock: number }> = {};
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
        variant_id: selectedVariantId || undefined,
        warehouse_id: selectedWarehouseId || undefined,
        item_name: name,
        manufacturer: manufacturer.trim() || undefined,
        quantity: parsedQty,
        delivered: 0,
        unit: unit.trim() || DEFAULT_UNIT,
      });
      ui.showToast('BOQ item added.', 'success');
      setDialogOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not save BOQ item. Please contact admin if this keeps happening.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [itemName, load, manufacturer, projectId, qty, selectedVariantId, selectedVariantStock, ui, unit]);

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

        <button className={styles.primaryAction} onClick={openAdd}>
          <Plus size={16} /> Add BOQ Item
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarTitle}>Bill of Quantities</div>
          <div className={styles.subtitle}>
            {itemsSource === 'local' ? 'Local' : 'Live'} • Project {projectSource === 'local' ? 'Local' : 'Live'}
          </div>
        </div>

        {warning ? <div className={styles.empty}>{warning}</div> : null}

        {isLoading ? (
          <div className={styles.empty}>Loading BOQ...</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>No BOQ items yet. Click “Add BOQ Item” to add your first line.</div>
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
                  <th className={styles.numericCell}>Delivered</th>
                  <th className={styles.numericCell}>Balance</th>
                  <th className={styles.actionsCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
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
                      <td className={`${styles.deliveredValue} ${styles.numericCell}`}>{delivered}</td>
                      <td className={`${styles.balanceValue} ${styles.numericCell}`}>{balance}</td>
                      <td className={styles.actionsCell}>
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
                    value={selectedWarehouseId}
                    options={warehouses.map(w => ({ value: w.id, label: w.name, keywords: [w.name] }))}
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
                      <div className={styles.warehouseList}>
                        {catalogMeta[selectedVariantId].stock_data && catalogMeta[selectedVariantId].stock_data!.length > 0 ? (
                          catalogMeta[selectedVariantId].stock_data!.map((s, i) => (
                            <div key={i} className={styles.warehouseRow}>
                              <span>{s.warehouse_name}</span>
                              <strong>{s.quantity}</strong>
                            </div>
                          ))
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
    </div>
  );
}

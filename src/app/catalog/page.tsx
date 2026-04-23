"use client";

import React, { useState, useEffect } from 'react';
import styles from './Products.module.css';
import { 
  Plus, Search, Filter, ChevronRight, ChevronDown, 
  Package, Zap, Edit2, Trash2, 
  Check, X, Layers, AlertCircle,
  Tag, Info, History, ChevronLeft, LayoutGrid, List
} from 'lucide-react';
import { inventoryService } from '@/lib/services/inventory';
import { supabase } from '@/lib/supabase';
import { modulesService } from '@/lib/services/modules';
import { useUi } from '@/components/ui/AppProviders';
import SearchableSelect from '@/components/ui/SearchableSelect';

const PRESET_ATTRIBUTES = [
  { name: 'Size', values: ['S', 'M', 'L', 'XL', '2XL'] },
  { name: 'Color', values: ['Red', 'Blue', 'White', 'Black', 'Grey', 'Green', 'Yellow', 'Brown'] },
  { name: 'Capacity', values: ['500ml', '1L', '2L', '5L', '10L'] },
  { name: 'Finish', values: ['Matt', 'Glossy', 'Satin', 'Brushed', 'Polished', 'Powder Coated'] },
  { name: 'Grade', values: ['Standard', 'Premium', 'Elite'] },
  { name: 'Material', values: ['Plastic', 'Steel', 'Aluminum', 'Glass'] }
];

type Attribute = { name: string; values: string[] };

export default function ProductsPage() {
  const { showToast } = useUi();
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [, setEditingProduct] = useState<any>(null);

  // Dynamic Data & Lookups
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [manufacturersList, setManufacturersList] = useState<any[]>([]);
  const [, setAttributeTypesList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [description, setDescription] = useState('');
  
  const [attributes, setAttributes] = useState<Attribute[]>([
    { name: 'Color', values: [] },
    { name: 'Size', values: [] }
  ]);
  
  const [variants, setVariants] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extraPresets, setExtraPresets] = useState<Record<string, string[]>>({});
  const [currentStep, setCurrentStep] = useState(1);

  // New Item Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'manufacturer' | 'attribute' | 'warehouse' | 'unit'>('category');
  const [modalValue, setModalValue] = useState('');

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, productId: string | null, reason: string}>({
    isOpen: false,
    productId: null,
    reason: ''
  });

  // Custom Attribute Types
  const [userDefinedAttributes, setUserDefinedAttributes] = useState<{name: string, values: string[]}[]>([]);
  const [canCreateProducts, setCanCreateProducts] = useState(false);
  const [canEditProducts, setCanEditProducts] = useState(false);
  const [canDeleteProducts, setCanDeleteProducts] = useState(false);

  useEffect(() => {
    const initPermissions = async () => {
      fetchProducts();
      fetchLookups();
      const current = await modulesService.getCurrentUser();
      if (current) {
        setCanCreateProducts(await modulesService.hasPermission(current, 'products.create'));
        setCanEditProducts(await modulesService.hasPermission(current, 'products.edit'));
        setCanDeleteProducts(await modulesService.hasPermission(current, 'products.delete'));
      }
    };

    initPermissions();

    const onUserChange = async () => {
      const refreshed = await modulesService.getCurrentUser();
      if (refreshed) {
        setCanCreateProducts(await modulesService.hasPermission(refreshed, 'products.create'));
        setCanEditProducts(await modulesService.hasPermission(refreshed, 'products.edit'));
        setCanDeleteProducts(await modulesService.hasPermission(refreshed, 'products.delete'));
      }
    };

    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [cats, mfgs, attrs, whs, units] = await Promise.all([
        inventoryService.getCategories(),
        inventoryService.getManufacturers(),
        inventoryService.getAttributeTypes(),
        inventoryService.getWarehouses(),
        inventoryService.getUnits(),
      ]);
      setCategoriesList(cats);
      setManufacturersList(mfgs);
      setAttributeTypesList(attrs);
      setWarehousesList(whs);
      setUnitsList(units);
      if (whs.length > 0) setSelectedWarehouse(whs[0].name);
    } catch (err) {
      console.error("Failed to fetch lookups:", err);
    }
  };

  const categoryOptions = categoriesList.map((item) => ({
    value: item,
    label: item,
    keywords: [item],
  }));

  const manufacturerOptions = manufacturersList.map((item) => ({
    value: item.name,
    label: item.name,
    keywords: [item.name],
  }));

  const warehouseOptions = warehousesList.map((item) => ({
    value: item.name,
    label: item.name,
    keywords: [item.name],
  }));

  const unitOptions = unitsList.map((item) => ({
    value: item,
    label: item,
    keywords: [item],
  }));

  const createCategoryOption = async (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return '';
    setCategoriesList((prev) => Array.from(new Set([...prev, normalized])));
    return normalized;
  };

  const createManufacturerOption = async (value: string) => {
    const created = await inventoryService.createManufacturer(value.trim().toUpperCase());
    setManufacturersList((prev) => {
      const alreadyExists = prev.some((item) => item.name === created.name);
      return alreadyExists ? prev : [...prev, created];
    });
    return created.name;
  };

  const createWarehouseOption = async (value: string) => {
    const created = await inventoryService.createWarehouse(value.trim().toUpperCase());
    setWarehousesList((prev) => {
      const alreadyExists = prev.some((item) => item.name === created.name);
      return alreadyExists ? prev : [...prev, created];
    });
    return created.name;
  };

  const createUnitOption = async (value: string) => {
    const created = await inventoryService.createUnit(value.trim().toUpperCase());
    setUnitsList(await inventoryService.getUnits());
    return created;
  };

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [isEditingVariant, setIsEditingVariant] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [variantToDelete, setVariantToDelete] = useState<string | null>(null);
  const [activeProductForSingle, setActiveProductForSingle] = useState<any>(null);
  const [activeVariantForEdit, setActiveVariantForEdit] = useState<any>(null);
  const [singleVariantForm, setSingleVariantForm] = useState({
    sku: '',
    manufacturer: '',
    price: 0,
    attributes: {} as Record<string, string>,
    warehouse: '',
    unit: 'Numbers',
    quantity: 0
  });

  const handleOpenEditVariant = (product: any, variant: any) => {
    setActiveProductForSingle(product);
    setActiveVariantForEdit(variant);
    setIsEditingVariant(true);
    
    const mainStock = variant.stock_data?.[0];
    const currentWarehouse = warehousesList.find(w => w.id === mainStock?.warehouse_id)?.name || 'Main Warehouse';

    setSingleVariantForm({
      sku: variant.sku,
      manufacturer: variant.attributes.Manufacturer || '',
      price: variant.price || 0,
      attributes: variant.attributes || {},
      warehouse: currentWarehouse,
      unit: variant.unit || 'Numbers',
      quantity: mainStock?.quantity || 0
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    setVariantToDelete(variantId);
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteVariant = async () => {
    if (!deleteReason.trim()) return showToast("Please provide a reason for deletion.", 'error');
    try {
      const variant = activeProductForSingle?.variants?.find((v: any) => v.id === variantToDelete);
      const { error } = await supabase.from('variants').delete().eq('id', variantToDelete);
      if (error) throw error;
      
      // Log Audit
      await modulesService.addAudit({
        action: 'DELETE_VARIANT',
        entity_type: 'inventory',
        entity_id: variantToDelete || '',
        entity_name: variant?.sku || 'Unknown Variant',
        reason: deleteReason,
        details: `Variant ${variant?.sku} deleted from product ${activeProductForSingle?.name}`
      });

      setIsDeleteModalOpen(false);
      fetchProducts();
      showToast("Item option deleted.", 'success');
    } catch { showToast("Error deleting item option.", 'error'); }
  };

  const handleDeleteProduct = (productId: string) => {
    setDeleteConfirm({ isOpen: true, productId, reason: '' });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirm.productId || !deleteConfirm.reason) return;
    try {
      const product = products.find(p => p.id === deleteConfirm.productId);
      await inventoryService.deleteProduct(deleteConfirm.productId);
      
      // Log Audit
      await modulesService.addAudit({
        action: 'DELETE_PRODUCT',
        entity_type: 'inventory',
        entity_id: deleteConfirm.productId,
        entity_name: product?.name || 'Unknown Product',
        reason: deleteConfirm.reason,
        details: `Full product ${product?.name} and all its variants deleted.`
      });

      setDeleteConfirm({ isOpen: false, productId: null, reason: '' });
      fetchProducts();
      showToast("Product deleted.", 'success');
    } catch {
      showToast("Failed to delete product.", 'error');
    }
  };

  const [isGenerateWizardOpen, setIsGenerateWizardOpen] = useState(false);
  const [generateStep, setGenerateStep] = useState(1);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<Record<string, string[]>>({});
  const [genManufacturers, setGenManufacturers] = useState<string[]>([]);
  const [genDefaultSettings, setGenDefaultSettings] = useState({
    unit: 'Numbers',
    warehouse: '',
    minStock: 0
  });

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const handleEditProduct = (product: any) => {
    // 1. Populate Identity (Step 1)
    setProductName(product.name);
    setCategory(product.category);
    setManufacturer(product.brand);
    setDescription(product.description || '');
    const firstWh = product.variants?.[0]?.inventory?.[0]?.warehouse?.name;
    if (firstWh) setSelectedWarehouse(firstWh);
    
    // 2. Reconstruct Attributes Blueprint (Step 2)
    const existingVariants = product.variants || [];
    const attrMap: Record<string, Set<string>> = {};
    
    existingVariants.forEach((v: any) => {
      if (v.attributes) {
        Object.entries(v.attributes).forEach(([key, val]) => {
          if (!attrMap[key]) attrMap[key] = new Set();
          attrMap[key].add(val as string);
        });
      }
    });

    const reconstructedAttrs = Object.entries(attrMap).map(([name, values]) => ({
      name,
      values: Array.from(values)
    }));

    setAttributes(reconstructedAttrs.length > 0 ? reconstructedAttrs : [
      { name: 'Color', values: [] },
      { name: 'Size', values: [] }
    ]);

    // 3. Reconstruct Variant Matrix (Step 3)
    const reconstructedVariants = existingVariants.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      attributes: v.attributes,
      enabled: true // They exist in DB, so they are enabled
    }));
    setVariants(reconstructedVariants);

    setEditingProduct(product);
    setEditingProductId(product.id);
    setIsCreating(true);
    setCurrentStep(1);
  };

  const generateVariantsMatrix = () => {
    if (!productName) {
      alert("Please enter a product name first.");
      return;
    }

    const validAttrs = attributes.filter(a => a.name && a.values.length > 0);
    const mfgs = manufacturer.split(',').map(m => m.trim()).filter(m => m);
    
    if (validAttrs.length === 0) {
      alert("Please add at least one attribute with values.");
      return;
    }

    const generateCombinations = (attrs: Attribute[]): Record<string, string>[] => {
      if (attrs.length === 0) return [{}];
      const result: Record<string, string>[] = [];
      const restCombos = generateCombinations(attrs.slice(1));
      
      const currentAttr = attrs[0];
      for (const val of currentAttr.values) {
        for (const c of restCombos) {
          result.push({ [currentAttr.name]: val, ...c });
        }
      }
      return result;
    };

    const combinations = generateCombinations(validAttrs);
    const finalVariants: any[] = [];

    const mfgList = mfgs.length > 0 ? mfgs : ['DEFAULT'];
    
    for (const mfg of mfgList) {
      for (const combo of combinations) {
        const prefix = productName.substring(0, 3).toUpperCase();
        const mfgPrefix = mfg.substring(0, 3).toUpperCase();
        const attrStr = Object.values(combo).map(v => v.substring(0, 3).toUpperCase()).join('-');
        
        finalVariants.push({
          sku: `${prefix}-${attrStr}-${mfgPrefix}`.replace(/--+/g, '-').replace(/-$/, ''),
          attributes: combo,
          brand: mfg === 'DEFAULT' ? '' : mfg,
          enabled: true
        });
      }
    }
    
    setVariants(finalVariants);
  };

  const toggleVariant = (index: number) => {
    const newVars = [...variants];
    newVars[index].enabled = !newVars[index].enabled;
    setVariants(newVars);
  };

  const handleNext = () => {
    if (currentStep === 1 && !productName) {
      alert("Please enter a product name.");
      return;
    }
    if (currentStep === 2 && attributes.filter(a => a.values.length > 0).length === 0) {
      alert("Please select at least one attribute value.");
      return;
    }
    
    if (currentStep === 2) {
      generateVariantsMatrix();
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSaveDraft = async () => {
    if (isGenerating) return;

    const timeoutId = setTimeout(() => {
      if (isGenerating) {
        setIsGenerating(false);
        showToast("Draft saving is taking too long.", 'error');
      }
    }, 15000);

    try {
      setIsGenerating(true);
      showToast("Saving draft...", 'info');
      const warehouseId = warehousesList.find(w => w.name === selectedWarehouse)?.id;
      const productData = {
        name: productName,
        category,
        brand: manufacturer,
        description,
        status: 'DRAFT',
        main_warehouse_id: warehouseId
      };
      await inventoryService.createProduct(productData, []);
      showToast("Product saved as draft!", 'success');
      
      setIsGenerating(false);
      setIsCreating(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      console.error("Failed to save draft:", err);
      showToast(`Error: ${err.message || 'Check connection'}`, 'error');
    } finally {
      setIsGenerating(false);
      clearTimeout(timeoutId);
    }
  };

  const handleWizardSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const submitAddSingleVariant = async () => {
    try {
      showToast("Adding variant to stock...", 'info');
      await inventoryService.addVariant({
        product_id: activeProductForSingle.id,
        price: singleVariantForm.price,
        attributes: {
          ...singleVariantForm.attributes,
          ...(singleVariantForm.manufacturer ? { Manufacturer: singleVariantForm.manufacturer } : {}),
          ...(singleVariantForm.unit ? { Unit: singleVariantForm.unit } : {})
        },
        warehouse: singleVariantForm.warehouse,
        stock_quantity: singleVariantForm.quantity,
        sku: singleVariantForm.sku
      });
      setIsAddingSingle(false);
      showToast("Variant added to stock successfully.", 'success');
      fetchProducts();
    } catch {
      alert("Error adding variant");
    }
  };

  const handleAddSingleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitAddSingleVariant();
  };

  const submitEditVariant = async () => {
    try {
      showToast("Updating variant...", 'info');
      const { error: vError } = await supabase.from('variants').update({
        price: singleVariantForm.price,
        attributes: {
          ...singleVariantForm.attributes,
          ...(singleVariantForm.manufacturer ? { Manufacturer: singleVariantForm.manufacturer } : {}),
          ...(singleVariantForm.unit ? { Unit: singleVariantForm.unit } : {})
        }
      }).eq('id', activeVariantForEdit.id);
      if (vError) throw vError;

      const targetWarehouse = warehousesList.find(w => w.name === singleVariantForm.warehouse);
      if (targetWarehouse?.id) {
        const { data: existingInv } = await supabase.from('inventory')
          .select('id')
          .eq('variant_id', activeVariantForEdit.id)
          .eq('warehouse_id', targetWarehouse.id)
          .maybeSingle();

        if (existingInv) {
          const { error: sError } = await supabase.from('inventory')
            .update({
              quantity: singleVariantForm.quantity,
              warehouse_id: targetWarehouse.id
            })
            .eq('id', existingInv.id);
          if (sError) throw sError;
        } else {
          const { error: sError } = await supabase.from('inventory')
            .insert({
              variant_id: activeVariantForEdit.id,
              warehouse_id: targetWarehouse.id,
              quantity: singleVariantForm.quantity
            });
          if (sError) throw sError;
        }
      }

      showToast("Variant updated successfully.", 'success');
      setIsEditingVariant(false);
      fetchProducts();
    } catch {
      alert("Error updating variant data");
    }
  };

  const handleEditVariantSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitEditVariant();
  };


  const handleSaveProduct = async () => {
    if (isGenerating) return;
    
    console.log("Starting handleSaveProduct...");
    let hasTimedOut = false;
    // Safety timeout to surface unusually slow requests.
    const timeoutId = setTimeout(() => {
      hasTimedOut = true;
      console.warn("Save operation timed out after 15s. Forcing reset.");
      showToast("Save is taking longer than expected. Finishing in background...", 'info');
    }, 45000);

    try {
      setIsGenerating(true);
      showToast("Saving product...", 'info');
      
      const warehouseId = warehousesList.find(w => w.name === selectedWarehouse)?.id;
      const productData = {
        name: productName,
        category,
        brand: manufacturer,
        description,
        main_warehouse_id: warehouseId
      };

      const enabledVariants = variants
        .filter(v => v.enabled)
        .map(v => ({
          id: v.id,
          sku: v.sku,
          attributes: { 
            ...v.attributes, 
            ...(v.brand ? { Manufacturer: v.brand } : {}) 
          },
          price: v.price || 0
        }));

      console.log(`Saving ${enabledVariants.length} variants...`);

      if (enabledVariants.length === 0) {
        showToast("At least one variant must be enabled.", 'error');
        setIsGenerating(false);
        clearTimeout(timeoutId);
        return;
      }

      let result;
      const isUpdate = Boolean(editingProductId);
      const targetProductId = editingProductId;
      if (editingProductId) {
        console.log("Updating existing product:", editingProductId);
        result = await inventoryService.updateProduct(editingProductId, productData, enabledVariants);
      } else {
        console.log("Creating new product:", productName);
        result = await inventoryService.createProduct(productData, enabledVariants);
      }
      
      console.log("Save operation successful.");
      showToast(isUpdate ? "Product updated." : "Product published.", 'success');
      
      // Reset UI immediately after core save succeeds.
      setIsGenerating(false); 
      setIsCreating(false);
      setEditingProductId(null);
      setEditingProduct(null);
      resetForm();

      // Run non-critical follow-ups in background so save feels instant.
      const createdId = (result as any)?.id;
      const auditEntityId = isUpdate ? targetProductId : createdId;
      void (async () => {
        if (auditEntityId) {
          await modulesService.addAudit({
            action: isUpdate ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
            entity_type: 'inventory',
            entity_id: auditEntityId,
            entity_name: productName,
            reason: isUpdate ? 'Product updated' : 'New product added',
            details: `${isUpdate ? 'Updated' : 'Created'} ${productName} with ${enabledVariants.length} variants.`,
          }).catch((err) => console.warn("Audit log failed:", err));
        }
        await fetchProducts();
      })();
    } catch (err: any) {
      console.error("Critical error saving product:", err);
      if (!hasTimedOut) {
        showToast(`Error: ${err.message || 'Check connection'}`, 'error');
      }
      setIsGenerating(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const resetForm = () => {
    setProductName('');
    setCategory('');
    setManufacturer('');
    setDescription('');
    setAttributes([{ name: 'Color', values: [] }, { name: 'Size', values: [] }]);
    setVariants([]);
    setExtraPresets({});
    setCurrentStep(1);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {!isCreating && !isAddingSingle && !isEditingVariant && (
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Item Catalog</h1>
            <p className={styles.subtitle}>Products with options. Auto-generate item codes from combinations.</p>
          </div>
          {canCreateProducts && (
            <button className={styles.primaryAction} onClick={() => setIsCreating(true)}>
              <Plus size={18} style={{ marginRight: 8 }} />
              Add Product
            </button>
          )}
        </div>
      )}

      {!isCreating && !isAddingSingle && !isEditingVariant ? (
        <div className={styles.catalogContent}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search products, options, attributes..." 
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className={styles.iconBtn} title="Filter">
              <Filter size={18} />
            </button>
          </div>

          <div className={styles.productList}>
            {loading ? (
              <div className={styles.loadingWrapper}>
                <div className={styles.spinner}></div>
                <p className={styles.loadingText}>Loading catalog...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map(product => {
                const isExpanded = expandedProducts.has(product.id);
                return (
                  <div key={product.id} className={styles.productGroup}>
                    <div className={styles.productCard}>
                      <button className={styles.expandBtn} onClick={() => toggleExpand(product.id)}>
                        {isExpanded ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                      </button>
                      <div className={styles.productIcon}><Package size={20} /></div>
                      
                      <div className={styles.productInfo}>
                        <div className={styles.productNameWrapper}>
                          <span className={styles.productName}>{product.name}</span>
                          {product.category && <span className={styles.categoryTag}>{product.category}</span>}
                          <div className={styles.summaryAttrs}>
                             {Array.from(new Set(product.variants?.flatMap((v: any) => Object.keys(v.attributes)) || [])).map((attr: any) => (
                               <span key={attr} className={styles.attrSummaryTag}>
                                 <Tag size={10} style={{marginRight: 4}}/> {attr}
                               </span>
                             ))}
                          </div>
                        </div>
                        {product.description && <p className={styles.productDescription}>{product.description}</p>}
                      </div>

                      <div className={styles.productStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{product.variant_count}</span>
                          <span className={styles.statLabel}>Options</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{product.total_stock}</span>
                          <span className={styles.statLabel}>Stock</span>
                        </div>
                      </div>

                      <div className={styles.productActions}>
                        {canEditProducts && <button 
                          className={styles.iconBtn} 
                          title="Edit Product"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProduct(product);
                          }}
                        >
                          <Edit2 size={14} strokeWidth={1.5}/>
                        </button>}
                        {canDeleteProducts && <button 
                          className={styles.iconBtn} 
                          title="Delete Product"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product.id);
                          }}
                        >
                          <Trash2 size={16}/>
                        </button>}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.variantsExpanded}>
                        <div className={styles.variantHeader}>
                          <span>ITEM CODE</span>
                          <span>MANUFACTURER</span>
                          <span>ATTRIBUTES</span>
                          <span>WAREHOUSE</span>
                          <span>STOCK</span>
                          <span>FREE</span>
                          <span style={{ textAlign: 'right' }}>ACTIONS</span>
                        </div>
                        {product.variants?.map((v: any) => (
                          <div key={v.id} className={styles.variantRow}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{v.sku}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.attributes.Manufacturer || '-'}</div>
                              <div className={styles.variantAttrs}>
                                {Object.entries(v.attributes).map(([k, val]) => (
                                  <span key={k}>{val as string}</span>
                                ))}
                              </div>
                              <div className={styles.warehouseTag}>{v.stock_data?.[0]?.warehouse_name || '-'}</div>
                              <span className={styles.variantStockText}>{v.stock_data?.reduce((acc:any, s:any) => acc + s.quantity, 0) || 0}</span>
                              <span className={styles.variantFreeText}>{v.stock_data?.reduce((acc:any, s:any) => acc + s.quantity, 0) || 0}</span>
                              <div className={styles.variantRowActions}>
                                {canEditProducts && <button className={styles.miniBtn} title="Edit Option" onClick={() => handleOpenEditVariant(product, v)}>
                                  <Edit2 size={12}/>
                                </button>}
                                {canDeleteProducts && <button className={styles.miniBtn} title="Delete Option" style={{ color: 'var(--text-secondary)' }} onClick={() => handleDeleteVariant(v.id)}>
                                  <Trash2 size={12}/>
                                </button>}
                              </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <Package size={48} style={{ opacity: 0.2 }} />
                <h3 className={styles.emptyTitle}>No products found</h3>
                <p className={styles.emptySubtitle}>Click "Add Product" to start building your catalog.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isAddingSingle && activeProductForSingle ? (
        <div className={styles.creatorWrapper}>
          <div className={styles.wizardHeader} style={{ marginBottom: '1.5rem', borderBottom: 'none' }}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setIsAddingSingle(false)} style={{ padding: '0.4rem 0.8rem' }}>
              <ChevronLeft size={16} strokeWidth={1.5} /> Back to Catalog
            </button>
          </div>
          
          <form onSubmit={handleAddSingleSubmit} style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Single Variant Instance</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Defining a specific unit for product: <strong>{activeProductForSingle.name}</strong></p>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 600 }}>
                SKU: {singleVariantForm.sku}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div className={styles.formGroup}>
                <label style={{ fontSize: '0.7rem' }}>Manufacturer / Brand</label>
                <SearchableSelect
                  value={singleVariantForm.manufacturer}
                  options={manufacturerOptions}
                  placeholder="Select brand..."
                  searchPlaceholder="Search or add brand..."
                  addActionLabel="Add brand"
                  onChange={(value) => setSingleVariantForm((prev) => ({ ...prev, manufacturer: value }))}
                  onCreateOption={createManufacturerOption}
                />
              </div>

              <div className={styles.formGroup}>
                <label style={{ fontSize: '0.7rem' }}>Price Setting (Optional)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  style={{ padding: '0.5rem 0.75rem' }}
                  onChange={e => setSingleVariantForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
               <Filter size={14} strokeWidth={2} /> <span style={{ fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em' }}>SELECT ATTRIBUTE VALUES</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
               {Array.from(new Set((activeProductForSingle.variants?.flatMap((v: any) => Object.keys(v.attributes)) || ['Size', 'Type']) as string[])).map((attrName: string) => (
                 <div key={attrName} className={styles.formGroup}>
                   <label style={{ fontSize: '0.7rem' }}>{attrName}</label>
                   <select 
                     style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                     onChange={e => setSingleVariantForm(p => ({ 
                       ...p, 
                       attributes: { ...p.attributes, [attrName]: e.target.value } 
                     }))}
                   >
                     <option value="">Select {attrName}...</option>
                     {attributes.find(a => a.name === attrName)?.values.map(val => (
                       <option key={val} value={val}>{val}</option>
                     ))}
                   </select>
                 </div>
               ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: '2.5rem' }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Unit Type</label>
                <SearchableSelect
                  value={singleVariantForm.unit}
                  options={unitOptions}
                  placeholder="Select unit..."
                  searchPlaceholder="Search or add unit..."
                  addActionLabel="Add unit"
                  onChange={(value) => setSingleVariantForm(p => ({ ...p, unit: value }))}
                  onCreateOption={createUnitOption}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Storage Warehouse</label>
                <SearchableSelect
                  value={singleVariantForm.warehouse}
                  options={warehouseOptions}
                  placeholder="Select warehouse..."
                  searchPlaceholder="Search or add warehouse..."
                  addActionLabel="Add warehouse"
                  onChange={(value) => setSingleVariantForm((prev) => ({ ...prev, warehouse: value }))}
                  onCreateOption={createWarehouseOption}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Opening Stock / Min Level</label>
                <input 
                  type="number" 
                  style={{ padding: '0.4rem 0.6rem' }}
                  value={singleVariantForm.quantity} 
                  onChange={e => setSingleVariantForm(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className={styles.footerActions} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
              <div className={styles.leftActions}>
                 <button type="button" className={styles.wizardBackBtn} onClick={() => setIsAddingSingle(false)}>Cancel & Clear</button>
              </div>
              <div className={styles.rightActions}>
                 <button 
                  type="submit"
                  className={styles.wizardNextBtn} 
                  style={{ background: '#312e81', fontSize: '0.8rem', padding: '0.6rem 2rem' }}
                 >
                   Verify & Add to Stock
                 </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {isEditingVariant && activeProductForSingle && activeVariantForEdit ? (
        <div className={styles.creatorWrapper}>
          <div className={styles.topActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setIsEditingVariant(false)} style={{ padding: '0.5rem 1rem' }}>
              <ChevronLeft size={16} strokeWidth={1.5} /> Back to Catalog
            </button>
          </div>

          <form onSubmit={handleEditVariantSubmit} style={{ width: '100%' }}>
             <div style={{ paddingLeft: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Variant</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                  Under <strong>{activeProductForSingle.name}</strong>. Select attributes. This variant gets independent stock.
                </p>
              </div>

            <div className={styles.stockNameBar}>
               <span className={styles.stockNameLabel}>Stock name: </span>
               <span className={styles.stockNameValue}>{activeVariantForEdit.sku}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div className={styles.formGroup}>
                <label style={{ fontSize: '0.7rem' }}>Manufacturer</label>
                <SearchableSelect
                  value={singleVariantForm.manufacturer}
                  options={manufacturerOptions}
                  placeholder="Select manufacturer..."
                  searchPlaceholder="Search or add manufacturer..."
                  addActionLabel="Add manufacturer"
                  onChange={(value) => setSingleVariantForm((prev) => ({ ...prev, manufacturer: value }))}
                  onCreateOption={createManufacturerOption}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
               <Zap size={14} strokeWidth={2.5} /> <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>Variant Attributes</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2.5rem' }}>
               {Object.keys(activeVariantForEdit.attributes).map(attrName => {
                 // UNIVERSAL SCRAPER: Gather all values across ALL products for THIS attribute name
                 const globalPresets = attributes.find(a => a.name.toLowerCase() === attrName.toLowerCase())?.values || [];
                 const catalogValues = products.flatMap((p: any) => 
                  p.variants?.flatMap((v: any) => (v.attributes as any)[attrName] || []) || []
                 );
                 
                 // Merge global presets with everything found in the catalog
                 const universalValues = Array.from(new Set([
                   ...globalPresets,
                   ...catalogValues,
                   (activeVariantForEdit.attributes as any)[attrName]
                 ].filter(Boolean))).sort();

                 return (
                   <div key={attrName} className={styles.formGroup}>
                     <label style={{ fontSize: '0.7rem' }}>{attrName}</label>
                     <select 
                       className={styles.formSelectCompact}
                       value={singleVariantForm.attributes[attrName] || ''}
                       onChange={e => setSingleVariantForm(p => ({ 
                         ...p, 
                         attributes: { ...p.attributes, [attrName]: e.target.value } 
                       }))}
                     >
                       <option value="">Select {attrName}...</option>
                       {universalValues.map(val => (
                         <option key={val} value={val}>{val}</option>
                       ))}
                     </select>
                   </div>
                 );
               })}
            </div>

            <div className={styles.footerSection}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Unit</label>
                <SearchableSelect
                  value={singleVariantForm.unit}
                  options={unitOptions}
                  placeholder="Select unit..."
                  searchPlaceholder="Search or add unit..."
                  addActionLabel="Add unit"
                  onChange={(value) => setSingleVariantForm(p => ({ ...p, unit: value }))}
                  onCreateOption={createUnitOption}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Warehouse</label>
                <SearchableSelect
                  value={singleVariantForm.warehouse}
                  options={warehouseOptions}
                  placeholder="Select warehouse..."
                  searchPlaceholder="Search or add warehouse..."
                  addActionLabel="Add warehouse"
                  onChange={(value) => setSingleVariantForm((prev) => ({ ...prev, warehouse: value }))}
                  onCreateOption={createWarehouseOption}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Min Stock</label>
                <input 
                  type="number" 
                  className={styles.formInputCompact}
                  value={singleVariantForm.quantity} 
                  onChange={e => setSingleVariantForm(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className={styles.footerActions} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <div className={styles.leftActions}>
                 <button type="button" className={styles.wizardBackBtn} onClick={() => setIsEditingVariant(false)}>Cancel</button>
              </div>
              <div className={styles.rightActions}>
                 <button 
                  type="submit"
                  className={styles.wizardNextBtn} 
                  style={{ background: 'var(--accent-primary)', fontSize: '0.85rem', padding: '0.7rem 3rem' }}
                 >
                   Update
                 </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {isCreating ? (
        <div className={styles.creatorWrapper}>
          <div className={styles.topActions}>
            <button className={styles.secondaryBtn} onClick={() => setIsCreating(false)}>
              <ChevronLeft size={16} strokeWidth={1.5} /> Back to Catalog
            </button>
            <button className={styles.closeBtn} style={{ top: '2rem', right: '2rem' }} onClick={() => setIsCreating(false)} title="Close Wizard">
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>
          <form onSubmit={handleWizardSubmit} className={styles.wizardContainer}>
            {/* Professional Vertical Steps Sidebar */}
            <div className={styles.verticalSidebar}>
              <div className={`${styles.vertStep} ${currentStep >= 1 ? styles.vertActive : ''}`}>
                <div className={styles.vertIcon}>
                  {currentStep > 1 ? <Check size={14} strokeWidth={3} /> : <LayoutGrid size={18} strokeWidth={1.5} />}
                </div>
                <div className={styles.vertContent}>
                  <span className={styles.vertLabel}>STEP 01</span>
                  <span className={styles.vertTitle}>Identity</span>
                </div>
              </div>

              <div className={`${styles.vertStep} ${currentStep >= 2 ? styles.vertActive : ''}`}>
                <div className={styles.vertIcon}>
                  {currentStep > 2 ? <Check size={14} strokeWidth={3} /> : <List size={18} strokeWidth={1.5} />}
                </div>
                <div className={styles.vertContent}>
                  <span className={styles.vertLabel}>STEP 02</span>
                  <span className={styles.vertTitle}>Blueprint</span>
                </div>
              </div>

              <div className={`${styles.vertStep} ${currentStep >= 3 ? styles.vertActive : ''}`}>
                <div className={styles.vertIcon}>
                  <Zap size={18} strokeWidth={1.5} />
                </div>
                <div className={styles.vertContent}>
                  <span className={styles.vertLabel}>STEP 03</span>
                  <span className={styles.vertTitle}>Review Matrix</span>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className={styles.wizardContentArea}>
            {currentStep === 1 && (
              <div className={styles.card} style={{ border: 'none', background: 'transparent', padding: 0 }}>
                <div className={styles.formGroup}>
                  <label><Package size={18} strokeWidth={1.5} color="currentColor" /> Product Name</label>
                  <input 
                    type="text" 
                    value={productName} 
                    onChange={e => setProductName(e.target.value)} 
                    placeholder="e.g. LED POOL LIGHT" 
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label><Tag size={18} strokeWidth={1.5} color="currentColor" /> Category</label>
                    <SearchableSelect
                      value={category}
                      options={categoryOptions}
                      placeholder="Select category..."
                      searchPlaceholder="Search or add category..."
                      addActionLabel="Add category"
                      onChange={setCategory}
                      onCreateOption={createCategoryOption}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label><History size={18} strokeWidth={1.5} color="currentColor" /> Brand / Manufacturer</label>
                    <SearchableSelect
                      value={manufacturer}
                      options={manufacturerOptions}
                      placeholder="Select brand..."
                      searchPlaceholder="Search or add brand..."
                      addActionLabel="Add brand"
                      onChange={setManufacturer}
                      onCreateOption={createManufacturerOption}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label><Layers size={18} strokeWidth={1.5} color="currentColor" /> Main Warehouse</label>
                    <SearchableSelect
                      value={selectedWarehouse}
                      options={warehouseOptions}
                      placeholder="Select warehouse..."
                      searchPlaceholder="Search or add warehouse..."
                      addActionLabel="Add warehouse"
                      onChange={setSelectedWarehouse}
                      onCreateOption={createWarehouseOption}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ visibility: 'hidden' }}>
                    {/* Placeholder for grid alignment */}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label><Info size={18} strokeWidth={1.5} color="currentColor" /> Description</label>
                  <textarea 
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide a technical description..."
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className={styles.attrSection} style={{ marginTop: 0 }}>
                <div className={styles.attrSectionHeader}>
                  <Layers size={18} strokeWidth={1.5} />
                  <span>Variant Attributes</span>
                </div>
                <p className={styles.attrSectionSub}>Select dimensions that will change across different variants.</p>
                
                {[...PRESET_ATTRIBUTES]
                  .sort((a, b) => {
                    const aActive = attributes.find(attr => attr.name === a.name);
                    const bActive = attributes.find(attr => attr.name === b.name);
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;
                    return 0;
                  })
                  .map((preset) => (
                  <div key={preset.name} className={`${styles.attrCard} ${attributes.find(a => a.name === preset.name) ? styles.active : ''}`}>
                    <div 
                      className={styles.attrCardHeader}
                      onClick={() => {
                        const exists = attributes.find(a => a.name === preset.name);
                        if (exists) {
                          setAttributes(attributes.filter(a => a.name !== preset.name));
                        } else {
                          setAttributes([...attributes, { name: preset.name, values: [] }]);
                        }
                      }}
                    >
                      <div className={`${styles.checkboxPrimary} ${attributes.find(a => a.name === preset.name) ? styles.checked : ''}`}>
                        {attributes.find(a => a.name === preset.name) && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className={styles.attrHeaderInfo}>
                        <span className={styles.attrLabel}>{preset.name}</span>
                        <span className={styles.attrPresetsCount}>{preset.values.length} presets</span>
                      </div>
                    </div>

                    {attributes.find(a => a.name === preset.name) && (
                      <div className={styles.attrExpandedContent}>
                        <div className={styles.presetsGrid}>
                          {[...preset.values, ...(extraPresets[preset.name] || [])].map(val => (
                            <button 
                              key={val}
                              type="button"
                              className={`${styles.presetChip} ${attributes.find(a => a.name === preset.name)?.values.includes(val) ? styles.selected : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newAttrs = [...attributes];
                                const idx = newAttrs.findIndex(a => a.name === preset.name);
                                if (newAttrs[idx].values.includes(val)) {
                                  newAttrs[idx].values = newAttrs[idx].values.filter(v => v !== val);
                                } else {
                                  newAttrs[idx].values = [...newAttrs[idx].values, val];
                                }
                                setAttributes(newAttrs);
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                        <div className={styles.customValueWrapper}>
                          <input 
                            id={`custom-input-${preset.name}`}
                            type="text" 
                            placeholder={`New ${preset.name.toLowerCase()}...`}
                            className={styles.customInput}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val) {
                                  setExtraPresets(prev => ({
                                    ...prev,
                                    [preset.name]: [...(prev[preset.name] || []), val]
                                  }));
                                  const newAttrs = [...attributes];
                                  const idx = newAttrs.findIndex(a => a.name === preset.name);
                                  if (!newAttrs[idx].values.includes(val)) {
                                    newAttrs[idx].values = [...newAttrs[idx].values, val];
                                    setAttributes(newAttrs);
                                  }
                                  e.currentTarget.value = '';
                                }
                              }
                            }}
                          />
                          <button 
                            type="button" 
                            className={styles.addBtn} 
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.getElementById(`custom-input-${preset.name}`) as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) {
                                setExtraPresets(prev => ({
                                  ...prev,
                                  [preset.name]: [...(prev[preset.name] || []), val]
                                }));
                                const newAttrs = [...attributes];
                                const idx = newAttrs.findIndex(a => a.name === preset.name);
                                if (!newAttrs[idx].values.includes(val)) {
                                  newAttrs[idx].values = [...newAttrs[idx].values, val];
                                  setAttributes(newAttrs);
                                }
                                input.value = '';
                              }
                            }}
                          >
                            <Plus size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Custom User-Defined Attributes */}
                {userDefinedAttributes.map((preset) => (
                  <div key={preset.name} className={`${styles.attrCard} ${attributes.find(a => a.name === preset.name) ? styles.active : ''}`}>
                    <div 
                      className={styles.attrCardHeader}
                      onClick={() => {
                        const exists = attributes.find(a => a.name === preset.name);
                        if (exists) {
                          setAttributes(attributes.filter(a => a.name !== preset.name));
                        } else {
                          setAttributes([...attributes, { name: preset.name, values: [] }]);
                        }
                      }}
                    >
                      <div className={`${styles.checkboxPrimary} ${attributes.find(a => a.name === preset.name) ? styles.checked : ''}`}>
                        {attributes.find(a => a.name === preset.name) && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className={styles.attrHeaderInfo}>
                        <span className={styles.attrLabel}>{preset.name}</span>
                        <span className={styles.attrPresetsCount}>Custom</span>
                      </div>
                    </div>

                    {attributes.find(a => a.name === preset.name) && (
                      <div className={styles.attrExpandedContent}>
                        <div className={styles.presetsGrid}>
                          {preset.values.map(val => (
                            <button 
                              key={val}
                              type="button"
                              className={`${styles.presetChip} ${attributes.find(a => a.name === preset.name)?.values.includes(val) ? styles.selected : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newAttrs = [...attributes];
                                const idx = newAttrs.findIndex(a => a.name === preset.name);
                                if (newAttrs[idx].values.includes(val)) {
                                  newAttrs[idx].values = newAttrs[idx].values.filter(v => v !== val);
                                } else {
                                  newAttrs[idx].values = [...newAttrs[idx].values, val];
                                }
                                setAttributes(newAttrs);
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                        <div className={styles.customValueWrapper}>
                          <input 
                            id={`custom-input-${preset.name}`}
                            type="text" 
                            placeholder={`New ${preset.name.toLowerCase()} value...`}
                            className={styles.customInput}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val) {
                                  const newPresets = [...userDefinedAttributes];
                                  const pIdx = newPresets.findIndex(p => p.name === preset.name);
                                  newPresets[pIdx].values = [...new Set([...newPresets[pIdx].values, val])];
                                  setUserDefinedAttributes(newPresets);

                                  const newAttrs = [...attributes];
                                  const idx = newAttrs.findIndex(a => a.name === preset.name);
                                  if (!newAttrs[idx].values.includes(val)) {
                                    newAttrs[idx].values = [...newAttrs[idx].values, val];
                                    setAttributes(newAttrs);
                                  }
                                  e.currentTarget.value = '';
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button 
                  type="button"
                  className={styles.generateBtn} 
                  style={{ background: 'white', borderStyle: 'dashed', color: 'var(--text-secondary)' }}
                  onClick={() => {
                    setModalType('attribute');
                    setModalValue('');
                    setIsModalOpen(true);
                  }}
                >
                  <Plus size={16} style={{ marginRight: 8 }} /> Add Custom Attribute Type
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className={styles.matrixReview}>
                 <div className={styles.card} style={{ border: 'none', background: 'transparent', padding: 0 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                      Review generated SKUs. Click highlit items to disable them.
                    </p>
                    <div className={styles.variantsList}>
                      {variants.map((v, idx) => (
                        <div key={idx} className={`${styles.variantItem} ${!v.enabled ? styles.disabled : ''}`}>
                          <div 
                            className={`${styles.checkbox} ${v.enabled ? styles.checked : ''}`}
                            style={{ borderRadius: 0 }}
                            onClick={() => toggleVariant(idx)}
                          >
                            {v.enabled && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div className={styles.variantDetails}>
                            <div className={styles.variantSku}>{v.sku}</div>
                            <div className={styles.variantAttrs}>
                              <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{v.attributes.Manufacturer || 'No Brand'}</span>
                              {Object.entries(v.attributes).map(([k, val]) => (
                                <span key={k}>{val as string}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className={styles.footerActions}>
            <div className={styles.leftActions}>
               <button type="button" className={styles.wizardBackBtn} onClick={currentStep === 1 ? () => setIsCreating(false) : handleBack}>
                 {currentStep === 1 ? 'Cancel' : 'Back'}
               </button>
            </div>
            <div className={styles.rightActions}>
               <button type="button" className={styles.draftBtn} onClick={handleSaveDraft} disabled={isGenerating}>
                 Save as Draft
               </button>
               {currentStep < 3 ? (
                 <button type="button" className={styles.wizardNextBtn} onClick={handleNext}>
                   {currentStep === 1 ? 'Configure Variants' : 'Generate Matrix'} <ChevronRight size={18} />
                 </button>
               ) : (
                <button type="button" className={styles.wizardNextBtn} disabled={isGenerating} onClick={handleSaveProduct}>
                   {isGenerating ? 'Saving...' : 'Publish to Catalog'}
                 </button>
               )}
            </div>
          </div>
        </form>
        </div>
      ) : null}
      
      {/* Delete Reason Modal - Audit compliant */}
      {isDeleteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.deleteVariantModal}>
            <div className={styles.deleteModalHeader}>
              <div className={styles.deleteModalIcon}>
                <Trash2 size={20} strokeWidth={1.5} />
              </div>
              <div className={styles.deleteModalHeaderText}>
                <h2 className={styles.deleteModalTitle}>Delete Variant</h2>
                <p className={styles.deleteModalSub}>Permanent · Audit-tracked</p>
              </div>
              <button className={styles.deleteModalClose} onClick={() => setIsDeleteModalOpen(false)}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className={styles.deleteModalBody}>
              <div className={styles.deleteModalAlert}>
                <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span>Provide a reason for deletion. This entry is recorded in the audit log and cannot be reversed.</span>
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.65rem', color: '#b91c1c', letterSpacing: '0.08em' }}>
                  REASON FOR DELETION <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  placeholder="e.g. Discontinued, Accidental Creation, Damaged Stock..."
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  className={styles.deleteReasonArea}
                  rows={3}
                />
              </div>
            </div>

            <div className={styles.deleteModalFooter}>
              <button className={styles.wizardBackBtn} onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={confirmDeleteVariant}
                disabled={!deleteReason.trim()}
              >
                <Trash2 size={13} strokeWidth={2} />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.minimalModal}>
            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            <h3 className={styles.modalTitle}>
              Add New {modalType === 'category' ? 'Category' : modalType === 'manufacturer' ? 'Brand' : modalType === 'warehouse' ? 'Warehouse' : modalType === 'unit' ? 'Unit' : 'Attribute Type'}
            </h3>
            <p className={styles.modalSubtitle}>
              {modalType === 'attribute' 
                ? 'Create a new dimension (e.g. VOLTAGE, PATTERN) for your variants.' 
                : modalType === 'warehouse'
                ? 'Add a new location to your inventory network.'
                : modalType === 'unit'
                ? 'Add a new unit so it is immediately available across inventory screens.'
                : 'This will be available in the dropdown immediately.'}
            </p>
            <div className={styles.formGroup} style={{ marginBottom: '2rem' }}>
              <input 
                autoFocus
                type="text" 
                value={modalValue} 
                onChange={e => setModalValue(e.target.value.toUpperCase())}
                placeholder={modalType === 'attribute' ? 'e.g. FITTING TYPE' : modalType === 'warehouse' ? 'e.g. MAIN STORE A' : modalType === 'unit' ? 'e.g. BOXES' : `Enter new ${modalType}...`}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.wizardBackBtn} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button 
                className={styles.wizardNextBtn} 
                onClick={async () => {
                  if (!modalValue) return;
                  try {
                    if (modalType === 'category') {
                      const newCategory = await createCategoryOption(modalValue);
                      setCategory(newCategory);
                    } else if (modalType === 'manufacturer') {
                      const newMfg = await createManufacturerOption(modalValue);
                      setManufacturer(newMfg);
                    } else if (modalType === 'warehouse') {
                      const newWh = await createWarehouseOption(modalValue);
                      setSelectedWarehouse(newWh);
                    } else if (modalType === 'unit') {
                      const newUnit = await createUnitOption(modalValue);
                      setSingleVariantForm(prev => ({ ...prev, unit: newUnit }));
                      setGenDefaultSettings(prev => ({ ...prev, unit: newUnit }));
                    } else if (modalType === 'attribute') {
                      setUserDefinedAttributes(prev => [...prev, { name: modalValue, values: [] }]);
                      setAttributes(prev => [...prev, { name: modalValue, values: [] }]);
                    }
                    setIsModalOpen(false);
                  } catch (err: any) {
                    console.error("Failed to add new item:", err);
                    alert(`Save Failed: ${err.message || "Unknown error"}`);
                  }
                }}
              >
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.minimalModal} ${styles.dangerModal}`}>
            <button className={styles.closeBtn} onClick={() => setDeleteConfirm({ isOpen: false, productId: null, reason: '' })}>
              <X size={18} />
            </button>
            <h3 className={styles.modalTitle} style={{ background: '#fef2f2', color: '#dc2626' }}>
              Confirm Deletion
            </h3>
            <div style={{ padding: '0 ' }}>
              <p className={styles.modalSubtitle} style={{ marginTop: '1.5rem' }}>
                Are you sure you want to delete this product? This action is tracked and requires a valid reason.
              </p>
              
              <div className={styles.formGroup} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.7rem', color: '#dc2626' }}>REASON FOR DELETION (MANDATORY)</label>
                <textarea 
                  autoFocus
                  rows={3}
                  value={deleteConfirm.reason}
                  onChange={e => setDeleteConfirm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Product Discontinued, Stock Error..."
                  style={{ border: '1px solid #fee2e2', background: '#fffafa' }}
                />
              </div>

              <div className={styles.modalActions}>
                <button 
                  className={styles.wizardBackBtn} 
                  onClick={() => setDeleteConfirm({ isOpen: false, productId: null, reason: '' })}
                >
                  Keep
                </button>
                <button 
                  className={styles.wizardNextBtn} 
                  style={{ background: '#dc2626', opacity: deleteConfirm.reason ? 1 : 0.5 }}
                  onClick={confirmDeleteAction}
                  disabled={!deleteConfirm.reason}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4-Step Advanced Generator Modal */}
      {isGenerateWizardOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.minimalModal} style={{ maxWidth: '1000px', width: '95%' }}>
            <button className={styles.closeBtn} onClick={() => setIsGenerateWizardOpen(false)}>
              <X size={18} strokeWidth={1.5} />
            </button>
            
            <div className={styles.genHeader}>
              <h3 className={styles.genTitle}>
                <Zap size={20} color="var(--accent-primary)" strokeWidth={1.5} /> 
                Generate Variants: {activeProductForSingle?.name}
              </h3>
              <p className={styles.genSubtitle}>Select attributes, add manufacturers, preview the matrix, and create variants in bulk.</p>
              
              <div className={styles.genSteps}>
                <div className={`${styles.genStep} ${generateStep >= 1 ? styles.genStepActive : ''}`}>
                  <span className={styles.genStepNum}>1</span> Attributes
                </div>
                <div className={styles.genStepLine}>-</div>
                <div className={`${styles.genStep} ${generateStep >= 2 ? styles.genStepActive : ''}`}>
                  <span className={styles.genStepNum}>2</span> Manufacturers
                </div>
                <div className={styles.genStepLine}>-</div>
                <div className={`${styles.genStep} ${generateStep >= 3 ? styles.genStepActive : ''}`}>
                  <span className={styles.genStepNum}>3</span> Preview Matrix
                </div>
                <div className={styles.genStepLine}>-</div>
                <div className={`${styles.genStep} ${generateStep >= 4 ? styles.genStepActive : ''}`}>
                  <span className={styles.genStepNum}>4</span> Complete
                </div>
              </div>
            </div>

            <div className={styles.genBody}>
              {generateStep === 1 && (
                <div className={styles.genInner}>
                  <p className={styles.genBodyInfo}>Select attribute values for variant generation. You can add custom values inline.</p>
                  <div className={styles.genAttrGrid}>
                    {attributes.map(attr => (
                      <div key={attr.name} className={styles.genAttrField}>
                        <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{attr.name}</label>
                        <div className={styles.genTagArea}>
                          {attr.values.map(val => (
                            <button 
                              key={val} 
                              className={`${styles.genTag} ${selectedAttributeValues[attr.name]?.includes(val) ? styles.genTagSelected : ''}`}
                              onClick={() => {
                                const current = selectedAttributeValues[attr.name] || [];
                                if (current.includes(val)) {
                                  setSelectedAttributeValues(prev => ({ ...prev, [attr.name]: current.filter(v => v !== val) }));
                                } else {
                                  setSelectedAttributeValues(prev => ({ ...prev, [attr.name]: [...current, val] }));
                                }
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                        <div className={styles.genInputGroup}>
                           <input placeholder={`Add custom ${attr.name.toLowerCase()}...`} onKeyDown={(e: any) => {
                             if (e.key === 'Enter' && e.target.value) {
                               const newVal = e.target.value.toUpperCase();
                               setAttributes(prev => prev.map(a => a.name === attr.name ? { ...a, values: [...new Set([...a.values, newVal])] } : a));
                               const current = selectedAttributeValues[attr.name] || [];
                               setSelectedAttributeValues(prev => ({ ...prev, [attr.name]: [...new Set([...current, newVal])] }));
                               e.target.value = '';
                             }
                           }} />
                           <button className={styles.genAddBtn}><Plus size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generateStep === 2 && (
                <div className={styles.genInner}>
                  <p className={styles.genBodyInfo}>Add manufacturers. You can add multiple brands to multiply the generated combinations.</p>
                  <div style={{ maxWidth: '600px', margin: '1.25rem auto' }}>
                    <SearchableSelect
                      value=""
                      options={manufacturerOptions}
                      placeholder="Select manufacturer to add..."
                      searchPlaceholder="Search or add manufacturer..."
                      addActionLabel="Add manufacturer"
                      onChange={(value) => {
                        setGenManufacturers((prev) => [...new Set([...prev, value])]);
                      }}
                      onCreateOption={createManufacturerOption}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                    {genManufacturers.map(m => (
                      <div key={m} className={styles.genMfrTag}>
                        {m} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setGenManufacturers(prev => prev.filter(v => v !== m))} />
                      </div>
                    ))}
                    {genManufacturers.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center', width: '100%' }}>No manufacturers added. (Optional)</p>}
                  </div>
                </div>
              )}

              {generateStep === 3 && (
                <div className={styles.genInner}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Review generated combinations</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.secondaryBtn} style={{ padding: '0.4rem 0.8rem' }}>Select All</button>
                      <button className={styles.secondaryBtn} style={{ padding: '0.4rem 0.8rem' }}>Deselect All</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div className={styles.formGroup}>
                      <label>DEFAULT UNIT</label>
                      <SearchableSelect
                        value={genDefaultSettings.unit}
                        options={unitOptions}
                        placeholder="Select unit..."
                        searchPlaceholder="Search or add unit..."
                        addActionLabel="Add unit"
                        onChange={(value) => setGenDefaultSettings(p => ({ ...p, unit: value }))}
                        onCreateOption={createUnitOption}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>DEFAULT WAREHOUSE</label>
                      <SearchableSelect
                        value={genDefaultSettings.warehouse}
                        options={warehouseOptions}
                        placeholder="Select warehouse..."
                        searchPlaceholder="Search or add warehouse..."
                        addActionLabel="Add warehouse"
                        onChange={(value) => setGenDefaultSettings((prev) => ({ ...prev, warehouse: value }))}
                        onCreateOption={createWarehouseOption}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>MIN STOCK LEVEL</label>
                      <input type="number" value={genDefaultSettings.minStock} onChange={e => setGenDefaultSettings(p => ({ ...p, minStock: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f1f5f9', background: 'white' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '1rem' }}><Check size={14} /></th>
                          <th style={{ padding: '1rem' }}>Stock Name</th>
                          <th style={{ padding: '1rem' }}>Manufacturer</th>
                          {Object.keys(selectedAttributeValues).map(k => <th key={k} style={{ padding: '1rem' }}>{k}</th>)}
                          <th style={{ padding: '1rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const combinations: any[] = [];
                          const attrNames = Object.keys(selectedAttributeValues).filter(k => selectedAttributeValues[k].length > 0);
                          
                          const generate = (index: number, current: any) => {
                            if (index === attrNames.length) {
                              if (genManufacturers.length > 0) {
                                genManufacturers.forEach(mfr => {
                                  combinations.push({ attributes: { ...current }, manufacturer: mfr });
                                });
                              } else {
                                combinations.push({ attributes: { ...current }, manufacturer: '-' });
                              }
                              return;
                            }
                            const name = attrNames[index];
                            selectedAttributeValues[name].forEach(val => {
                              generate(index + 1, { ...current, [name]: val });
                            });
                          };

                          if (attrNames.length > 0) generate(0, {});

                          return combinations.map((c, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '1rem' }}>
                                <div className={styles.checkbox + ' ' + styles.checked}><Check size={10} strokeWidth={3} /></div>
                              </td>
                              <td style={{ padding: '1rem', fontWeight: 600 }}>
                                {activeProductForSingle?.name} - {Object.values(c.attributes).join(' ')} {c.manufacturer !== '-' ? `(${c.manufacturer})` : ''}
                              </td>
                              <td style={{ padding: '1rem' }}>{c.manufacturer}</td>
                              {attrNames.map(name => <td key={name} style={{ padding: '1rem' }}>{c.attributes[name]}</td>)}
                              <td style={{ padding: '1rem', color: '#10b981' }}><Check size={14} /> Create</td>
                            </tr>
                          ));
                        })()}
                        {Object.keys(selectedAttributeValues).every(k => selectedAttributeValues[k].length === 0) && (
                          <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>No attributes selected. Go back to Step 1.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {generateStep === 4 && (
                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                   <div style={{ width: '64px', height: '64px', background: '#ecfdf5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                      <Check size={32} strokeWidth={3} />
                   </div>
                   <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Variants Created Successfully</h2>
                   <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>All selected variants are now in stock with independent tracking per warehouse.</p>
                   <button className={styles.wizardNextBtn} style={{ float: 'none', padding: '1rem 3rem' }} onClick={() => setIsGenerateWizardOpen(false)}>Done</button>
                </div>
              )}
            </div>

            <div className={styles.genFooter}>
              {generateStep < 4 && (
                <div className={styles.modalActions} style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <button className={styles.wizardBackBtn} onClick={generateStep === 1 ? () => setIsGenerateWizardOpen(false) : () => setGenerateStep(generateStep - 1)}>
                    {generateStep === 1 ? 'Cancel' : 'Back'}
                  </button>
                  <button 
                    className={styles.wizardNextBtn} 
                    style={{ background: generateStep === 3 ? '#4f46e5' : '#a855f7' }}
                    onClick={async () => {
                      if (generateStep < 3) setGenerateStep(generateStep + 1);
                      else {
                        // Final Creation Step
                        try {
                          const attrNames = Object.keys(selectedAttributeValues).filter(k => selectedAttributeValues[k].length > 0);
                          const combinations: any[] = [];
                          
                          const generate = (index: number, current: any) => {
                            if (index === attrNames.length) {
                              if (genManufacturers.length > 0) {
                                genManufacturers.forEach(mfr => {
                                  combinations.push({ attributes: { ...current }, brand: mfr });
                                });
                              } else {
                                combinations.push({ attributes: { ...current }, brand: '-' });
                              }
                              return;
                            }
                            const name = attrNames[index];
                            selectedAttributeValues[name].forEach(val => {
                              generate(index + 1, { ...current, [name]: val });
                            });
                          };
                          generate(0, {});

                          const variantsToCreate = combinations.map(c => ({
                            sku: `${activeProductForSingle?.name.substring(0,3).toUpperCase()}-${Object.values(c.attributes).join('-').toUpperCase()}-${c.brand.substring(0,3).toUpperCase()}`.replace(/--+/g,'-'),
                            attributes: {
                              ...c.attributes,
                              ...(c.brand !== '-' ? { Manufacturer: c.brand } : {}),
                              ...(genDefaultSettings.unit ? { Unit: genDefaultSettings.unit } : {}),
                            },
                            brand: c.brand === '-' ? '' : c.brand,
                            price: 0
                          }));

                          // Use the service to add variants to the existing product
                          // Since we don't have a bulk 'addVariantsToProduct', we'll loop or use the existing createProduct logic if it was designed for updates
                          // For now, let's use a batch insert via supabase directly for speed
                          const { data: vData, error: vError } = await supabase
                            .from('variants')
                            .insert(variantsToCreate.map(v => ({ ...v, product_id: activeProductForSingle?.id })))
                            .select();

                          if (vError) throw vError;

                          // Initial Stock
                          if (vData && genDefaultSettings.warehouse) {
                            const whId = warehousesList.find(wh => wh.name === genDefaultSettings.warehouse)?.id;
                            if (whId) {
                               await supabase.from('inventory').insert(vData.map(v => ({
                                 variant_id: v.id,
                                 warehouse_id: whId,
                                 quantity: genDefaultSettings.minStock
                               })));
                            }
                          }

                          setGenerateStep(4);
                          fetchProducts();
                        } catch { alert("Generation Failed"); }
                      }
                    }}
                  >
                    {generateStep === 1 ? 'Next: Manufacturers' : generateStep === 2 ? 'Next: Preview Matrix' : `Create Variants`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

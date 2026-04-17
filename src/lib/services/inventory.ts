import { supabase } from '../supabase';
import { Product, Variant } from '../../types/inventory';

const UNITS_KEY = 'ims_units_v1';
const DEFAULT_UNITS = [
  'Numbers',
  'Pcs',
  'Pieces',
  'Sets',
  'Boxes',
  'Bags',
  'Kilograms',
  'Liters',
  'Meters',
  'Square Feet',
  'Square Meter',
  'Tons',
];
const REASONS_KEY = 'ims_reason_options_v1';
const DEFAULT_REASONS = [
  'Cycle Count',
  'Stock Correction',
  'Damaged Goods',
  'Supplier Return',
  'Customer Allocation',
  'Warehouse Reallocation',
  'Data Cleanup',
  'Obsolete Item',
  'Goods Received',
  'Goods Issued',
  'Warehouse Transfer',
];

function readLocalList(key: string, fallback: string[]) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalList(key: string, value: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isMissingStockMovementsEndpoint(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    status?: number;
  };

  const combinedMessage = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();

  return (
    candidate.status === 404 ||
    candidate.code === 'PGRST205' ||
    candidate.code === '42P01' ||
    combinedMessage.includes('stock_movements') ||
    combinedMessage.includes('could not find') ||
    combinedMessage.includes('relation') ||
    combinedMessage.includes('not found')
  );
}

export const inventoryService = {
  async getProducts(): Promise<any[]> {
    try {
      // Base query
      let query = supabase
        .from('products')
        .select(`
          id, name, category, brand, description, created_at, updated_at,
          variants:variants(
            id, sku, price, attributes,
            inventory:inventory(
              id,
              quantity,
              warehouse:warehouses(id, name)
            )
          )
        `);

      // Try to add deleted_at filter, but catch if it fails
      const { data, error } = await query
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback for missing deleted_at column
        if (error.code === '42703') {
           const { data: fallbackData, error: fallbackError } = await supabase
            .from('products')
            .select(`
              id, name, category, brand, description, created_at, updated_at,
              variants:variants(
                id, sku, price, attributes,
                inventory:inventory(
                  id,
                  quantity,
                  warehouse:warehouses(id, name)
                )
              )
            `)
            .order('created_at', { ascending: false });
           
           if (fallbackError) throw fallbackError;
           return this.processProducts(fallbackData);
        }
        throw error;
      }

      return this.processProducts(data);
    } catch (err) {
      console.error("Critical error in getProducts:", err);
      return [];
    }
  },

  processProducts(data: any[]) {
    return (data || []).map(product => {
      const variants = (product.variants || []).map((v: any) => {
        const stockData = v.inventory || [];
        const totalStock = stockData.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        return {
          ...v,
          stock_data: stockData.map((item: any) => ({
            inventory_id: item.id || '',
            warehouse_id: item.warehouse?.id || '',
            warehouse_name: item.warehouse?.name || '-',
            quantity: item.quantity || 0
          })),
          total_stock: totalStock
        };
      });

      const totalProductStock = variants.reduce((sum: number, v: any) => sum + v.total_stock, 0);

      return {
        ...product,
        variant_count: variants.length,
        total_stock: totalProductStock,
        variants
      };
    });
  },

  async deleteProduct(productId: string) {
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', productId);

    if (error) {
      console.error("Error soft-deleting product:", error);
      throw error;
    }
  },

  async updateVariantDetails(input: {
    variantId: string;
    attributes: Record<string, string>;
    warehouseId: string;
    quantity: number;
    inventoryId?: string;
  }) {
    const { error: variantError } = await supabase
      .from('variants')
      .update({
        attributes: input.attributes,
      })
      .eq('id', input.variantId);

    if (variantError) throw variantError;

    if (input.inventoryId) {
      const { error: inventoryUpdateError } = await supabase
        .from('inventory')
        .update({
          warehouse_id: input.warehouseId,
          quantity: input.quantity,
        })
        .eq('id', input.inventoryId);

      if (inventoryUpdateError) throw inventoryUpdateError;
      return true;
    }

    const { data: existingInventoryRows, error: existingInventoryError } = await supabase
      .from('inventory')
      .select('id')
      .eq('variant_id', input.variantId)
      .eq('warehouse_id', input.warehouseId)
      .limit(1);

    if (existingInventoryError) throw existingInventoryError;

    const existingInventory = existingInventoryRows?.[0];

    if (existingInventory?.id) {
      const { error: inventoryUpdateError } = await supabase
        .from('inventory')
        .update({
          quantity: input.quantity,
        })
        .eq('id', existingInventory.id);

      if (inventoryUpdateError) throw inventoryUpdateError;
      return true;
    }

    const { error: inventoryInsertError } = await supabase
      .from('inventory')
      .insert({
        variant_id: input.variantId,
        warehouse_id: input.warehouseId,
        quantity: input.quantity,
      });

    if (inventoryInsertError) throw inventoryInsertError;
    return true;
  },

  async deleteVariant(variantId: string) {
    const { error: inventoryDeleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('variant_id', variantId);

    if (inventoryDeleteError) throw inventoryDeleteError;

    const { error: variantDeleteError } = await supabase
      .from('variants')
      .delete()
      .eq('id', variantId);

    if (variantDeleteError) throw variantDeleteError;
    return true;
  },

  async getManufacturers() {
    const { data, error } = await supabase.from('manufacturers').select('*').order('name');
    if (error) return [];
    return data;
  },

  async getAttributeTypes() {
    const { data, error } = await supabase.from('attribute_types').select('*').order('name');
    if (error) return [];
    return data;
  },

  async getCategories() {
    const { data, error } = await supabase.from('products').select('category');
    if (error) return [];
    return Array.from(new Set(data.map(p => p.category).filter(Boolean)));
  },

  async addVariant(data: any) {
    // 1. Create Variant
    const { data: vData, error: vError } = await supabase
      .from('variants')
      .insert({
        product_id: data.product_id,
        sku: data.sku,
        attributes: data.attributes,
        price: data.price || 0
      })
      .select()
      .single();

    if (vError) throw vError;

    // 2. Create Initial Stock if provided
    if (data.warehouse && vData) {
      const { data: wh } = await supabase.from('warehouses').select('id').eq('name', data.warehouse).single();
      if (wh) {
        await supabase.from('inventory').insert({
          variant_id: vData.id,
          warehouse_id: wh.id,
          quantity: data.stock_quantity || 0
        });
      }
    }
    return vData;
  },

  async createProduct(
// ...
    product: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
    variants: Omit<Variant, 'id' | 'product_id' | 'created_at' | 'updated_at'>[]
  ) {
    try {
      // 1. Create Product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (productError) {
         console.error("Supabase Error (Product):", productError);
         throw new Error(`Failed to create product: ${productError.message}`);
      }

      // 2. Create Variants
      if (variants.length > 0) {
        const variantsToInsert = variants.map(v => ({
          product_id: productData.id,
          sku: v.sku,
          attributes: v.attributes,
          price: (v as any).price || 0
        }));

        const { data: variantsData, error: variantsError } = await supabase
          .from('variants')
          .insert(variantsToInsert)
          .select();

        if (variantsError) {
           console.error("Supabase Error (Variants):", JSON.stringify(variantsError, null, 2));
           throw new Error(`Failed to create variants: ${variantsError.message || JSON.stringify(variantsError)}`);
        }

        // 3. Create Initial Inventory Records if warehouse provided
        if (variantsData && (product as any).main_warehouse_id) {
          const inventoryToInsert = variantsData.map(v => ({
            variant_id: v.id,
            warehouse_id: (product as any).main_warehouse_id,
            quantity: 0
          }));

          const { error: invError } = await supabase
            .from('inventory')
            .insert(inventoryToInsert);

          if (invError) {
            console.error("Supabase Error (Initial Inventory):", invError);
            // Non-blocking for product creation
          }
        }
      }

      return productData;
    } catch (err: any) {
      console.error("InventoryService.createProduct failed:", err);
      throw err;
    }
  },

  async updateProduct(
    productId: string,
    product: any,
    variants: any[]
  ) {
    try {
      // 1. Update Product identity
      const { error: productError } = await supabase
        .from('products')
        .update(product)
        .eq('id', productId);

      if (productError) throw productError;

      // 2. Synchronize Variants
      if (variants.length > 0) {
        const variantsToUpsert = variants.map(v => ({
          product_id: productId,
          sku: v.sku,
          attributes: v.attributes,
          price: v.price || 0
        }));

        const { data: variantsData, error: varError } = await supabase
          .from('variants')
          .upsert(variantsToUpsert, { onConflict: 'sku' })
          .select();
        
        if (varError) throw varError;

        // 3. Ensure new or existing variants have inventory tracking records
        if (variantsData && product.main_warehouse_id) {
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('variant_id')
            .in('variant_id', variantsData.map(v => v.id));
            
          const existingVarIds = new Set(existingInv?.map(i => i.variant_id) || []);
          
          const missingInv = variantsData
            .filter(v => !existingVarIds.has(v.id))
            .map(v => ({
              variant_id: v.id,
              warehouse_id: product.main_warehouse_id,
              quantity: 0
            }));

          if (missingInv.length > 0) {
            const { error: invError } = await supabase.from('inventory').insert(missingInv);
            if (invError) console.error("Initial edit inventory insert failed:", invError);
          }
        }
      }

      return true;
    } catch (err: any) {
      console.error("InventoryService.updateProduct failed:", err);
      throw err;
    }
  },

  async getWarehouses() {
    const { data, error } = await supabase.from('warehouses').select('*').order('name');
    if (error) return [];
    return data;
  },

  async getUnits() {
    const products = await this.getProducts();
    const catalogUnits = products.flatMap((product: any) =>
      (product.variants || [])
        .map((variant: any) => variant.attributes?.Unit)
        .filter(Boolean),
    );

    const savedUnits = readLocalList(UNITS_KEY, DEFAULT_UNITS);
    return Array.from(new Set([...DEFAULT_UNITS, ...savedUnits, ...catalogUnits])).sort((a, b) => a.localeCompare(b));
  },

  async createUnit(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('Unit name is required.');
    }

    const currentUnits = readLocalList(UNITS_KEY, DEFAULT_UNITS);
    const nextUnits = Array.from(new Set([...currentUnits, normalized]));
    writeLocalList(UNITS_KEY, nextUnits);
    return normalized;
  },

  async getReasons() {
    const savedReasons = readLocalList(REASONS_KEY, DEFAULT_REASONS);
    return Array.from(new Set([...DEFAULT_REASONS, ...savedReasons])).sort((a, b) => a.localeCompare(b));
  },

  async createReason(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('Reason is required.');
    }

    const currentReasons = readLocalList(REASONS_KEY, DEFAULT_REASONS);
    const nextReasons = Array.from(new Set([...currentReasons, normalized]));
    writeLocalList(REASONS_KEY, nextReasons);
    return normalized;
  },

  async recordMovement(movement: {
    variant_id: string;
    warehouse_id: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
    quantity: number;
    reference_id?: string;
    notes?: string;
  }) {
    try {
      // 1. Create Stock Movement record
      const { error: moveError } = await supabase
        .from('stock_movements')
        .insert(movement);

      if (moveError && !isMissingStockMovementsEndpoint(moveError)) {
        throw moveError;
      }

      if (moveError && isMissingStockMovementsEndpoint(moveError)) {
        console.warn('stock_movements endpoint missing; continuing with inventory update only.');
      }

      // 2. Update Inventory balance
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('variant_id', movement.variant_id)
        .eq('warehouse_id', movement.warehouse_id);

      if (inventoryError) throw inventoryError;

      const change = movement.type === 'OUT' ? -movement.quantity : movement.quantity;
      const primaryRow = inventoryRows?.[0];
      const duplicateRowIds = (inventoryRows || []).slice(1).map((row) => row.id);

      if (primaryRow) {
        const nextQuantity = (inventoryRows || []).reduce((sum, row) => sum + (row.quantity || 0), 0) + change;
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: nextQuantity })
          .eq('id', primaryRow.id);
        if (updateError) throw updateError;

        if (duplicateRowIds.length > 0) {
          const { error: deleteDuplicatesError } = await supabase
            .from('inventory')
            .delete()
            .in('id', duplicateRowIds);
          if (deleteDuplicatesError) throw deleteDuplicatesError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('inventory')
          .insert({
            variant_id: movement.variant_id,
            warehouse_id: movement.warehouse_id,
            quantity: change
          });
        if (insertError) throw insertError;
      }

      return true;
    } catch (err) {
      console.error("recordMovement failed:", err);
      throw err;
    }
  },

  async getProductDetails(productId: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:variants(*)
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data;
  },

  async createManufacturer(name: string) {
    const { data, error } = await supabase.from('manufacturers').insert({ name }).select().single();
    if (error) throw error;
    return data;
  },

  async createWarehouse(name: string) {
    const { data, error } = await supabase.from('warehouses').insert({ name }).select().single();
    if (error) throw error;
    return data;
  },
};

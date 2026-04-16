import { supabase } from '../supabase';
import { Product, Variant, ProductSummary } from '../../types/inventory';

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
        price: data.price || 0,
        brand: data.brand || ''
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
          price: (v as any).price || 0,
          brand: (v as any).brand || ''
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
          brand: v.brand || product.brand || '',
          price: v.price || 0
        }));

        const { error: varError } = await supabase
          .from('variants')
          .upsert(variantsToUpsert, { onConflict: 'sku' });
        
        if (varError) throw varError;
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

      if (moveError) throw moveError;

      // 2. Update Inventory balance
      // Check if record exists
      const { data: inv, error: invFetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('variant_id', movement.variant_id)
        .eq('warehouse_id', movement.warehouse_id)
        .single();

      const change = movement.type === 'OUT' ? -movement.quantity : movement.quantity;

      if (inv) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: (inv.quantity || 0) + change })
          .eq('id', inv.id);
        if (updateError) throw updateError;
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

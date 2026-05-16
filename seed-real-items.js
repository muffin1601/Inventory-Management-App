const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadDotEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (e) {}
}

loadDotEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedStructuredData() {
  console.log('🚀 STARTING STRUCTURED PRODUCTION DATA SEEDING...');

  // 1. Clear existing data
  console.log('Step 1: Clearing existing data...');
  const tablesToClear = [
    'stock_movements',
    'inventory',
    'purchase_order_items',
    'challan_items',
    'delivery_receipt_items',
    'boq_items',
    'project_orders',
    'variants',
    'products'
  ];

  for (const table of tablesToClear) {
    try {
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log(`✓ Cleared ${table}`);
    } catch (e) {
      console.warn(`! Error clearing ${table}:`, e.message);
    }
  }

  // 2. Load Structured Data
  const structuredPath = path.join(process.cwd(), 'scratch', 'structured_items.json');
  if (!fs.existsSync(structuredPath)) {
    console.error('✗ Error: scratch/structured_items.json not found!');
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(structuredPath, 'utf8'));

  // 3. Ensure Warehouse
  const { data: whs } = await supabase.from('warehouses').select('id').limit(1);
  const warehouseId = whs?.[0]?.id;
  if (!warehouseId) {
    console.error('✗ Error: No warehouse found. Run setup scripts first.');
    process.exit(1);
  }

  // 4. Group by Product Name
  const productGroups = {};
  items.forEach(item => {
    if (!productGroups[item.productName]) {
      productGroups[item.productName] = {
        name: item.productName,
        category: 'General',
        brand: item.manufacturer, // Using first variant's brand as product brand
        description: item.description,
        variants: []
      };
    }
    productGroups[item.productName].variants.push(item);
  });

  const products = Object.values(productGroups);
  console.log(`✓ Grouped into ${products.length} unique products with multiple variants.`);

  // 5. Insert Products and Variants
  let productCount = 0;
  let variantCount = 0;

  for (const p of products) {
    try {
      // Insert Product
      const { data: product, error: pError } = await supabase
        .from('products')
        .insert({
          name: p.name,
          category: p.category,
          brand: p.brand,
          description: p.description,
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (pError) {
        console.error(`✗ Error inserting product "${p.name}": ${pError.message}`);
        continue;
      }
      productCount++;

      // Insert Variants
      for (const v of p.variants) {
        const finalSku = v.sku || `SKU-${v.originalName.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
        
        const { data: variant, error: vError } = await supabase
          .from('variants')
          .insert({
            product_id: product.id,
            sku: finalSku,
            attributes: { 
              ...v.attributes, 
              Manufacturer: v.manufacturer,
              Unit: v.unit,
              FullName: v.originalName
            },
            price: 0
          })
          .select()
          .single();

        if (vError) {
          console.error(`  ✗ Error inserting variant "${finalSku}": ${vError.message}`);
          continue;
        }
        variantCount++;

        // Add Random Stock
        const randomStock = Math.floor(Math.random() * 141) + 10;
        await supabase.from('inventory').insert({
          variant_id: variant.id,
          warehouse_id: warehouseId,
          quantity: randomStock
        });

        await supabase.from('stock_movements').insert({
          variant_id: variant.id,
          warehouse_id: warehouseId,
          type: 'IN',
          quantity: randomStock,
          notes: 'Structured production seeding'
        });
      }

      if (productCount % 20 === 0) {
        console.log(`- Processed ${productCount} products...`);
      }
    } catch (e) {
      console.error(`✗ Unexpected error processing product "${p.name}":`, e.message);
    }
  }

  console.log('\n✨ STRUCTURED SEEDING COMPLETED ✨');
  console.log(`- Products Created: ${productCount}`);
  console.log(`- Variants Created: ${variantCount}`);
  console.log('- All items organized with manufacturer and attributes extracted from names.');
}

seedStructuredData().catch(err => {
  console.error('!!! Fatal error:', err);
  process.exit(1);
});

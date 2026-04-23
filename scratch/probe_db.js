
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
  const tables = [
    'orders', 'purchase_orders', 'challans', 'delivery_receipts', 'receipts', 
    'payment_slips', 'payments', 'stock_movements', 'inventory', 'warehouses',
    'vendors', 'projects', 'boq_items', 'user_profiles', 'roles', 'audit_trail'
  ];

  console.log('Probing tables...');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    if (!error) {
      console.log(`[OK] ${table}`);
    } else {
      console.log(`[FAIL] ${table}: ${error.message}${error.hint ? ' (Hint: ' + error.hint + ')' : ''}`);
    }
  }
}

probe();

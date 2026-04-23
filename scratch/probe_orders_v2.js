const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function probe() {
  console.log('Testing insert with po_number...');
  const { error } = await supabase.from('purchase_orders').insert({ po_number: 'TEST-001' });
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Insert successful!');
    const { data } = await supabase.from('purchase_orders').select('*').limit(1);
    console.log('Columns:', Object.keys(data[0]));
    // Cleanup
    await supabase.from('purchase_orders').delete().eq('po_number', 'TEST-001');
  }
}
probe();

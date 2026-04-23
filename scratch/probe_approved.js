const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function probe() {
  console.log('Testing "approved" status...');
  const { error } = await supabase.from('purchase_orders').insert({ po_number: 'ENUM-TEST-2', status: 'approved' });
  if (error) {
    console.log('Error for "approved":', error.message);
    console.log('Testing "APPROVED" status...');
    const { error: error2 } = await supabase.from('purchase_orders').insert({ po_number: 'ENUM-TEST-3', status: 'APPROVED' });
    console.log('Error for "APPROVED":', error2.message);
  } else {
    console.log('"approved" worked!');
    await supabase.from('purchase_orders').delete().eq('po_number', 'ENUM-TEST-2');
  }
}
probe();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function probe() {
  console.log('Inserting with default status...');
  const { data, error } = await supabase.from('purchase_orders').insert({ po_number: 'DEFAULT-TEST' }).select('status').single();
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Default status:', data.status);
    // Cleanup
    await supabase.from('purchase_orders').delete().eq('po_number', 'DEFAULT-TEST');
  }
}
probe();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function probe() {
  console.log('Querying po_status enum values...');
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'po_status' });
  
  if (error) {
    console.log('RPC failed, trying raw query via pg_enum...');
    // If RPC is not available, we can try to trigger an error that lists the values
    const { error: insError } = await supabase.from('purchase_orders').insert({ po_number: 'ENUM-TEST', status: 'INVALID' });
    console.log('Insert error hints:', insError?.message);
  } else {
    console.log('Enum values:', data);
  }
}
probe();

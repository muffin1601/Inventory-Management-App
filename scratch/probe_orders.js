const { createClient } = require('@supabase/supabase-js');
// Hardcoded from previous view of .env.local or similar if possible, 
// but I'll just try to use a script that reads the file.
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function probe() {
  console.log('Probing purchase_orders columns...');
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('Table is empty, trying to get schema info via rpc if available, or just guessing.');
    // Try to insert a blank record to see what fails
    const { error: insError } = await supabase.from('purchase_orders').insert({}).select();
    console.log('Insert error hints:', insError?.message);
  }
}

probe();

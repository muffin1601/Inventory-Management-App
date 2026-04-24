const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function getEnv() {
  const content = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
  });
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkInventory() {
  const { data, error } = await supabase.from('inventory').select('*').limit(5);
  if (error) {
    console.log('Error fetching inventory:', error.message);
  } else {
    console.log('Inventory sample:', JSON.stringify(data, null, 2));
  }
}

checkInventory();

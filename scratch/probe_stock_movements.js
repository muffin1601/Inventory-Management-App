const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe() {
  console.log('Probing stock_movements table...');
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error probing stock_movements:', error.message, error.code);
  } else {
    console.log('stock_movements table exists and is accessible.');
    console.log('Data sample:', data);
  }
}

probe();

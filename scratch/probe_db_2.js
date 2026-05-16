
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

async function getColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'products' });
  if (error) {
    // If RPC doesn't exist, try direct SQL if we have a way, but we don't.
    // Let's try a different approach: insert a dummy and see what fails.
    console.error('RPC Error:', error);
    
    console.log('Trying dummy insert...');
    const { error: iError } = await supabase.from('products').insert({ name: 'test' }).select();
    if (iError) console.error('Insert error:', iError);
    else console.log('Insert success!');
  } else {
    console.log('Columns:', data);
  }
}

getColumns();

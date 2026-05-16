
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

async function probe() {
  // First insert a product to link a variant to
  const { data: p } = await supabase.from('products').insert({ name: 'test_p' }).select().single();
  
  const { data: v, error: vError } = await supabase.from('variants').insert({ product_id: p.id, sku: 'TEST-SKU' }).select().single();
  if (vError) {
    console.error('Variant Error:', vError);
  } else {
    console.log('Sample variant:', v);
    console.log('Columns:', Object.keys(v));
  }
}

probe();

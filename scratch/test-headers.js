
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

async function testInsert() {
  console.log("Testing manual insert into boq_headers...");
  
  // Get a valid project ID
  const { data: projects } = await supabase.from('projects').select('id').limit(1);
  if (!projects || projects.length === 0) {
    console.log("No projects found to test with.");
    return;
  }
  const projectId = projects[0].id;
  console.log("Using Project ID:", projectId);

  const payload = {
    project_id: projectId,
    order_id: null,
    after_index: 0,
    text: "TEST HEADER " + new Date().toISOString()
  };

  const { data, error } = await supabase.from('boq_headers').insert(payload).select('*').single();
  
  if (error) {
    console.error('Insert Error:', error.code, error.message, error.details);
  } else {
    console.log('Insert Success:', data);
    
    // Clean up
    await supabase.from('boq_headers').delete().eq('id', data.id);
    console.log("Cleanup done.");
  }
}

testInsert();

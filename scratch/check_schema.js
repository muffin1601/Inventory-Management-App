
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Try to find .env file
const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');
let envData = '';
if (fs.existsSync(envLocalPath)) envData = fs.readFileSync(envLocalPath, 'utf8');
else if (fs.existsSync(envPath)) envData = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envData.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : process.env[key];
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const tables = ['project_orders', 'client_orders', 'orders', 'purchase_orders'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`Table ${table}: NOT FOUND or ERROR: ${error.message}`);
        } else {
            console.log(`Table ${table}: FOUND`);
        }
    }
    
    // Check columns in boq_items
    const { data, error } = await supabase.from('boq_items').select('*').limit(1);
    if (!error && data && data.length > 0) {
        console.log('Columns in boq_items:', Object.keys(data[0]));
    }
}

checkTables();

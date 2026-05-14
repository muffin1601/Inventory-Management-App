
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://wsxjbbpmzclaoxdckgov.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzeGpiYnBtemNsYW94ZGNrZ292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDU3MzgsImV4cCI6MjA5MTgyMTczOH0.AiAI-7nf-hJEChH_wVAdVQv2N7CX0NLXmUU8TmXMTSc';

console.log('Testing connection to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const { data, error } = await supabase.from('projects').select('id').limit(1);
    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log('Success! Data:', data);
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

test();

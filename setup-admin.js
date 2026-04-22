#!/usr/bin/env node
/**
 * Initial Setup Script - Create Admin User and Setup Database
 * 
 * Usage: node setup-admin.js
 * 
 * This script:
 * 1. Creates the initial Super Admin auth user in Supabase
 * 2. Creates the corresponding row in public.user_profiles
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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
  } catch {
    // ignore
  }
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n===========================================');
  console.log('Watcon Inventory Management System');
  console.log('Initial Admin User Setup');
  console.log('===========================================\n');

  loadDotEnvLocal();

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing environment variables');
    console.error('   Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('📋 Instructions:');
  console.log('   1. Enter your admin email address');
  console.log('   2. Enter a strong password (min 8 characters, mix of letters/numbers/symbols)');
  console.log('   3. Confirm the password');
  console.log('\n');

  try {
    const adminEmail = await question('Enter admin email: ');
    const adminPassword = await question('Enter admin password: ');
    const confirmPassword = await question('Confirm password: ');
    const fullName = await question('Enter admin full name: ');

    // Validation
    if (!adminEmail || !adminPassword || !fullName) {
      console.error('❌ All fields are required');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    if (adminPassword !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    if (!/[A-Z]/.test(adminPassword) || !/[0-9]/.test(adminPassword) || !/[!@#$%^&*]/.test(adminPassword)) {
      console.error('❌ Password must contain uppercase letters, numbers, and special characters');
      process.exit(1);
    }

    console.log('\n⏳ Setting up admin user...\n');

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authData.user) {
      console.error(`❌ Error: ${authError?.message || 'Failed to create auth user'}`);
      process.exit(1);
    }

    // Create profile (Super Admin role r1)
    const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      email: adminEmail.trim().toLowerCase(),
      role_id: 'r1',
      status: 'ACTIVE',
      is_admin: true,
      requires_password_change: false,
      password_changed_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    });

    if (profileError) {
      // Best-effort cleanup to avoid dangling auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error(`❌ Error: Failed to create user profile: ${profileError.message}`);
      process.exit(1);
    }

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Email:', adminEmail);
    console.log('🔐 Password: (as entered)\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Visit: http://localhost:3000/login');
    console.log('  3. Login with your admin credentials\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);

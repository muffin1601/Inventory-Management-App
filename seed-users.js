#!/usr/bin/env node
/**
 * Seed users for all default roles (Supabase Auth + public.user_profiles).
 *
 * Usage:
 *   node seed-users.js
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   SEED_PASSWORD (default password for all seeded users)
 *   SEED_EMAIL_DOMAIN (default: example.com)
 *   SEED_FORCE_PASSWORD=1 (reset password even if user already exists)
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
      // remove surrounding quotes
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function randomPassword() {
  // 14 chars, includes upper/lower/number/symbol
  const base = crypto.randomBytes(18).toString('base64url').slice(0, 14);
  return `A1!${base}`;
}

async function findUserIdByEmail(supabaseAdmin, email) {
  // Try profile first (fast + indexed)
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (!error && Array.isArray(rows) && rows[0]?.id) return rows[0].id;
  } catch (e) {
    // Some PostgREST errors can throw (e.g., network/proxy issues).
    // We'll fall back to listing auth users instead of failing the entire seed.
  }

  // Fallback: search auth users (best-effort)
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (listError || !data?.users?.length) return null;
    const match = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUserForRole(supabaseAdmin, input) {
  let { email, password, full_name, role_id, is_admin, requires_password_change } = input;

  const existingId = await findUserIdByEmail(supabaseAdmin, email);
  let userId = existingId;
  let created = false;

  const forcePassword = String(process.env.SEED_FORCE_PASSWORD || '').trim() === '1';

  if (!userId) {
    const tryCreate = async (targetEmail) => {
      return await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
    };

    let authData;
    let authError;
    ({ data: authData, error: authError } = await tryCreate(email));

    // If Supabase auth fails to check a specific email, retry with a safe alternative.
    // This commonly happens when an old/broken auth row exists for that email.
    if ((authError?.message || '').toLowerCase().includes('database error checking email')) {
      const [local, domain] = String(email).split('@');
      const fallbackEmail = `${local}1@${domain || 'example.com'}`;
      ({ data: authData, error: authError } = await tryCreate(fallbackEmail));
      if (!authError && authData?.user?.id) {
        console.warn(`⚠️  Could not create ${email}. Using ${fallbackEmail} instead.`);
        email = fallbackEmail;
      }
    }

    // If user already exists, try to resolve id via profile and continue.
    if (authError?.code === 'email_exists' || (authError?.message || '').toLowerCase().includes('already been registered')) {
      const resolvedId = await findUserIdByEmail(supabaseAdmin, email);
      if (resolvedId) {
        userId = resolvedId;
        created = false;
      } else {
        // If auth user exists but we cannot resolve a profile row, create a safe alternative email.
        const [local, domain] = String(email).split('@');
        const fallbackEmail = `${local}1@${domain || 'example.com'}`;
        const retry = await tryCreate(fallbackEmail);
        if (!retry.error && retry.data?.user?.id) {
          console.warn(`⚠️  ${email} already exists in auth. Using ${fallbackEmail} instead.`);
          email = fallbackEmail;
          authData = retry.data;
          authError = null;
        }
      }
    }

    if (authError || !authData?.user?.id) {
      if (userId) {
        // We resolved the user id above; proceed as existing user.
      } else {
      const details = authError
        ? ` | authError=${JSON.stringify({
            message: authError.message,
            status: authError.status,
            name: authError.name,
            code: authError.code,
          })}`
        : '';
      throw new Error((authError?.message || 'Failed to create auth user') + details);
      }
    }

    if (!userId) {
      userId = authData.user.id;
      created = true;
    }
  } else if (forcePassword) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name },
    });
    if (updateError) {
      throw new Error(updateError.message || 'Failed to reset password for existing user');
    }
  }

  const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert({
    id: userId,
    full_name,
    email,
    role_id,
    status: 'ACTIVE',
    is_admin: Boolean(is_admin),
    requires_password_change: Boolean(requires_password_change),
    last_active_at: new Date().toISOString(),
  });

  if (profileError) {
    throw new Error(profileError.message || 'Failed to upsert user_profiles');
  }

  return { id: userId, created, email };
}

async function main() {
  console.log('\n===========================================');
  console.log('Watcon Inventory Management System');
  console.log('Seed Users (Auth + Profiles)');
  console.log('===========================================\n');

  loadDotEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const domain = (process.env.SEED_EMAIL_DOMAIN || 'example.com').trim();
  let seedPassword = process.env.SEED_PASSWORD;

  if (!seedPassword) {
    const answer = await question('Enter a default password for seeded users (leave blank to auto-generate): ');
    seedPassword = answer?.trim() || '';
  }

  const useGenerated = !seedPassword;
  if (useGenerated) seedPassword = randomPassword();

  const users = [
    { role_id: 'r1', label: 'Super Admin', email: `superadmin@${domain}`, full_name: 'Super Admin', is_admin: true, requires_password_change: false },
    // Note: some projects can have a "stuck" auth entry for admin@domain that breaks creation.
    // We default to admin1@domain to make seeding reliable.
    { role_id: 'r2', label: 'Admin', email: `admin1@${domain}`, full_name: 'Admin User', is_admin: true, requires_password_change: false },
    { role_id: 'r3', label: 'Purchase Manager', email: `purchase@${domain}`, full_name: 'Purchase Manager', is_admin: false, requires_password_change: true },
    { role_id: 'r4', label: 'Store Manager', email: `store@${domain}`, full_name: 'Store Manager', is_admin: false, requires_password_change: true },
    { role_id: 'r5', label: 'Accounts', email: `accounts@${domain}`, full_name: 'Accounts User', is_admin: false, requires_password_change: true },
    { role_id: 'r6', label: 'Viewer', email: `viewer@${domain}`, full_name: 'Viewer User', is_admin: false, requires_password_change: true },
  ];

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\nSeeding users into domain: ${domain}`);
  console.log(`Password: ${useGenerated ? '(generated below)' : '(your provided password)'}\n`);

  const results = [];
  for (const u of users) {
    const password = useGenerated ? randomPassword() : seedPassword;
    console.log(`\n→ Seeding ${u.label}: ${u.email}`);
    let seeded;
    try {
      seeded = await ensureUserForRole(supabaseAdmin, {
        email: u.email,
        password,
        full_name: u.full_name,
        role_id: u.role_id,
        is_admin: u.is_admin,
        requires_password_change: u.requires_password_change,
      });
    } catch (e) {
      throw new Error(`Seed failed for ${u.label} (${u.email}): ${e?.message || e}`);
    }
    const { id, created, email } = seeded;

    results.push({ ...u, id, created, password, email });
    console.log(`${created ? '✅ Created' : '↻ Updated'}: ${u.label}  (${email})`);
  }

  console.log('\n--- LOGIN CREDENTIALS (store securely) ---');
  for (const r of results) {
    console.log(`${r.label}: ${r.email}  |  ${r.password}`);
  }

  console.log('\nNext steps:');
  console.log('  1) npm run dev');
  console.log('  2) Login at http://localhost:3000/login');
  console.log('  3) Non-admin roles will be forced to change password on first login\n');

  process.exit(0);
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err?.message || err);
    process.exit(1);
  })
  .finally(() => rl.close());


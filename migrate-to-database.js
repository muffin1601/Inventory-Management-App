// Migration script to move from localStorage to Supabase database
// Run this in browser console after setting up the database schema

async function migrateToDatabase() {
  console.log('🚀 Starting migration from localStorage to Supabase database...');

  try {
    // Check if Supabase is available
    if (typeof window.supabase === 'undefined') {
      console.error('❌ Supabase client not found. Make sure the app is loaded.');
      return;
    }

    const supabase = window.supabase;

    // 1. Get current localStorage data
    console.log('📖 Reading localStorage data...');

    const usersData = localStorage.getItem('ims_users_v1');
    const rolesData = localStorage.getItem('ims_roles_v1');
    const auditData = localStorage.getItem('ims_audit_trail_v1');

    if (!usersData) {
      console.log('ℹ️ No users data found in localStorage');
      return;
    }

    const users = JSON.parse(usersData);
    const roles = rolesData ? JSON.parse(rolesData) : [];
    const auditTrail = auditData ? JSON.parse(auditData) : [];

    console.log(`📊 Found ${users.length} users, ${roles.length} roles, ${auditTrail.length} audit entries`);

    // 2. Migrate roles first
    console.log('🔄 Migrating roles...');
    for (const role of roles) {
      const { error } = await supabase
        .from('roles')
        .upsert({
          id: role.id,
          name: role.name,
          permission_keys: role.permission_keys || []
        });

      if (error) {
        console.error(`❌ Error migrating role ${role.name}:`, error);
      } else {
        console.log(`✅ Migrated role: ${role.name}`);
      }
    }

    // 3. Migrate users (this requires manual user creation in Supabase Auth first)
    console.log('👥 Migrating users...');
    console.log('⚠️ IMPORTANT: You need to create users in Supabase Auth first!');
    console.log('📝 User creation commands for Supabase:');

    users.forEach(user => {
      console.log(`
// Create user: ${user.email}
supabase.auth.admin.createUser({
  email: '${user.email}',
  password: '${user.temporary_password}',
  email_confirm: true,
  user_metadata: {
    full_name: '${user.full_name}'
  }
}).then(async (result) => {
  if (result.data.user) {
    // Create profile
    await supabase.from('user_profiles').insert({
      id: result.data.user.id,
      full_name: '${user.full_name}',
      email: '${user.email}',
      role_id: '${user.role_id}',
      status: '${user.status}',
      custom_permission_keys: ${JSON.stringify(user.custom_permission_keys || [])},
      revoked_permission_keys: ${JSON.stringify(user.revoked_permission_keys || [])},
      temporary_password: '${user.temporary_password}',
      last_active_at: '${user.last_active_at}'
    });
  }
});
      `);
    });

    // 4. Migrate audit trail
    console.log('📋 Migrating audit trail...');
    for (const entry of auditTrail) {
      const { error } = await supabase
        .from('audit_trail')
        .insert({
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          entity_name: entry.entity_name,
          reason: entry.reason,
          performed_by: entry.performed_by,
          details: entry.details,
          created_at: entry.created_at
        });

      if (error) {
        console.error('❌ Error migrating audit entry:', error);
      }
    }

    console.log('✅ Migration completed!');
    console.log('🔄 Next steps:');
    console.log('1. Create users in Supabase Auth using the commands above');
    console.log('2. Update the application code to use database instead of localStorage');
    console.log('3. Test authentication and authorization');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Make it available globally
window.migrateToDatabase = migrateToDatabase;

console.log('🔧 Migration function loaded. Run migrateToDatabase() to start migration.');
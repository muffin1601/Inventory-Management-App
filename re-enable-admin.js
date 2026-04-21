// Script to re-enable the admin user
// Run this in browser console or as a bookmarklet

(function() {
  try {
    // Get current users from localStorage
    const usersKey = 'ims_users_v1';
    const usersData = localStorage.getItem(usersKey);

    if (!usersData) {
      console.log('No users data found in localStorage');
      return;
    }

    const users = JSON.parse(usersData);
    console.log('Current users:', users);

    // Find and enable the admin user
    const adminUser = users.find(user => user.email === 'admin@nexusims.com');

    if (!adminUser) {
      console.log('Admin user not found');
      return;
    }

    console.log('Found admin user:', adminUser);

    if (adminUser.status === 'ACTIVE') {
      console.log('Admin user is already active');
      return;
    }

    // Update admin user status to ACTIVE
    adminUser.status = 'ACTIVE';
    adminUser.last_active_at = new Date().toISOString();

    // Save back to localStorage
    localStorage.setItem(usersKey, JSON.stringify(users));

    // Also set as authenticated user
    localStorage.setItem('ims_authenticated_user_id_v1', adminUser.id);
    localStorage.setItem('ims_current_user_id_v1', adminUser.id);

    console.log('✅ Admin user re-enabled successfully!');
    console.log('Updated admin user:', adminUser);

    // Reload the page to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('Error re-enabling admin user:', error);
  }
})();

# 🚀 Getting Started - Step by Step

## Prerequisites
- Node.js 18+ installed
- Supabase project created
- `.env.local` configured with Supabase credentials

## ⚡ Quick Setup (5 minutes)

### Step 1: Setup Database Tables
```bash
# 1. Go to: https://app.supabase.com/projects
# 2. Select your project > SQL Editor
# 3. Click "New Query"
# 4. Copy all content from: database-schema.sql
# 5. Paste it into the editor
# 6. Click "Run"
# 7. Wait for completion (you should see green checkmarks)
```

**Verify tables created:**
```bash
# In Supabase SQL Editor, run:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

# You should see:
# - user_profiles
# - roles
# - permissions
# - user_sessions
# - user_activity_log
# - audit_trail
```

---

### Step 2: Create Admin User
```bash
# In project root directory, run:
node setup-admin.js

# You'll be prompted for:
# 1. Admin email (e.g., admin@yourcompany.com)
# 2. Admin password (min 8 chars: uppercase, numbers, symbols)
# 3. Admin full name (e.g., Admin User)

# Example:
# Email: admin@example.com
# Password: AdminPass123!@
# Name: System Administrator
```

**Output should show:**
```
✅ Admin user created successfully!

📧 Email: admin@example.com
🔐 Password: (as entered)

Next steps:
  1. Run: npm run dev
  2. Visit: http://localhost:3000/login
  3. Login with your admin credentials
```

---

### Step 3: Verify Server is Running
```bash
# If not already running:
npm run dev

# Visit: http://localhost:3000/login
# You should see the enhanced login page
```

---

### Step 4: Login as Admin
```
1. Go to: http://localhost:3000/login
2. Enter your admin email
3. Enter your admin password
4. Click "Sign In"
5. You should be redirected to: http://localhost:3000/dashboard
```

---

### Step 5: Create Additional Users
```
1. On dashboard, go to: Users (sidebar)
2. Click: "+ Add User"
3. Fill in:
   - Full Name: (e.g., John Doe)
   - Email: (e.g., john@example.com)
   - Role: (select from dropdown)
   - Temporary Password: (e.g., TempPass123!)
4. Click: "Create User"
5. New user receives login with temporary password
6. They must change password on first login
```

---

## 📚 Documentation Files

After setup, review these files based on your needs:

### For Admins
1. **QUICK_REFERENCE.md** - Common commands and SQL queries
2. **USER_MANAGEMENT_SETUP.md** - Complete admin guide
3. Read: "Step 6: Available Roles" for role permissions

### For Developers  
1. **IMPLEMENTATION_SUMMARY.md** - What was built and how
2. **API documentation** in USER_MANAGEMENT_SETUP.md
3. Review: API route files in `src/app/api/auth/`

### For Deployment
1. **PRODUCTION_DEPLOYMENT.md** - Deployment checklist
2. **QUICK_REFERENCE.md** - Production commands

---

## 🔒 Available Roles & Permissions

| Role ID | Role Name | Best For | Key Permissions |
|---------|-----------|----------|-----------------|
| r1 | Super Admin | System admins | ✅ All permissions |
| r2 | Admin | Team leads | ✅ All except system-level |
| r3 | Purchase Manager | Procurement team | Orders, vendors, deliveries |
| r4 | Store Manager | Warehouse staff | Stock, inventory management |
| r5 | Accounts | Finance team | Payments, invoicing, reports |
| r6 | Viewer | Analysts/Observers | Read-only access |

---

## 🧪 Test the System

### Test 1: Login with Admin
```
✓ Go to http://localhost:3000/login
✓ Enter admin email and password
✓ Should see dashboard
✓ Should see Users menu item
```

### Test 2: Create a User
```
✓ Click "Users" in sidebar
✓ Click "+ Add User"
✓ Create a test user with role "Viewer"
✓ Go to http://localhost:3000/login
✓ Login with new user credentials
✓ Should see dashboard with limited access
```

### Test 3: Verify Permissions
```
✓ Login as "Viewer" user
✓ Should see: Dashboard, Reports, Catalog, Stock, etc.
✓ Should NOT see: Users, Settings, Admin features
✓ This confirms role-based access is working
```

### Test 4: Disable User
```
✓ As admin, go to Users
✓ Click on test user
✓ Change status to "DISABLED"
✓ Try to login with that user
✓ Should fail with "Account disabled" message
```

---

## 🐛 Common Issues & Solutions

### Issue: "supabaseKey is required"
**Cause**: Missing SUPABASE_ANON_KEY
**Fix**: 
```bash
# Add to .env.local:
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here
# Restart: npm run dev
```

### Issue: "Admin operations not available"
**Cause**: Missing SUPABASE_SERVICE_ROLE_KEY
**Fix**:
```bash
# Add to .env.local:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
# Restart: npm run dev
```

### Issue: "User doesn't exist" during login
**Cause**: User profile not created
**Fix**:
```bash
# Check in Supabase SQL Editor:
SELECT * FROM user_profiles WHERE email = 'user@example.com';
# If empty, user was not created properly. Try again.
```

### Issue: Password doesn't work
**Cause**: Wrong password or user status not ACTIVE
**Fix**:
```bash
# Check in Supabase SQL Editor:
SELECT email, status FROM user_profiles WHERE email = 'user@example.com';
# Status should be 'ACTIVE'
```

---

## 🔐 Security Checklist

Before going to production:

- [ ] Changed default admin password
- [ ] Verified RLS policies are enabled
- [ ] Tested user can't access other users' data
- [ ] Set up HTTPS (production only)
- [ ] Configured backup schedule
- [ ] Reviewed audit trails
- [ ] Set up monitoring/alerts
- [ ] Documented user creation process
- [ ] Trained team on password policies
- [ ] Tested disaster recovery

---

## 📖 What Each File Does

### API Routes
- **`/api/auth/create-user`** - Admin creates new users
- **`/api/auth/users/[userId]`** - Admin updates/deletes users  
- **`/api/auth/change-password`** - User changes their password

### Pages
- **`/login`** - Enhanced login page with error handling
- **`/dashboard`** - Main dashboard
- **`/users`** - User management interface (admin only)

### Database Tables
- **`user_profiles`** - User accounts
- **`roles`** - Role definitions
- **`permissions`** - Permission definitions
- **`user_sessions`** - Active sessions
- **`audit_trail`** - All system changes logged

---

## 📞 Getting Help

If something doesn't work:

1. **Check logs:**
   ```bash
   # Check terminal output
   # Look for error messages
   ```

2. **Check database:**
   ```bash
   # In Supabase SQL Editor:
   SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 20;
   ```

3. **Review documentation:**
   - Check "Troubleshooting" section in USER_MANAGEMENT_SETUP.md
   - Check QUICK_REFERENCE.md for common issues
   - Check IMPLEMENTATION_SUMMARY.md for overview

4. **Check environment:**
   ```bash
   # Verify .env.local has all required keys:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

---

## 🎯 Next Steps After Setup

### Short Term (This Week)
1. ✅ Create admin user (you just did this)
2. Create 2-3 test users with different roles
3. Test login and permissions work correctly
4. Review audit trail to see logging works

### Medium Term (This Month)
1. Train your team on the system
2. Create all real user accounts
3. Set up email notifications
4. Configure password policies
5. Set up monitoring and alerts

### Long Term (Before Production)
1. Complete all security checklist items
2. Perform penetration testing
3. Set up backup and recovery procedures
4. Configure monitoring dashboards
5. Document all admin procedures

---

## 💡 Tips & Tricks

### View All Active Users
```bash
# In Supabase SQL Editor:
SELECT email, role_id, status, last_login_at 
FROM user_profiles 
WHERE status = 'ACTIVE'
ORDER BY last_login_at DESC;
```

### Find Failed Logins
```bash
# In Supabase SQL Editor:
SELECT performed_by, created_at, details
FROM audit_trail 
WHERE action LIKE '%LOGIN%FAIL%'
ORDER BY created_at DESC
LIMIT 20;
```

### Reset User Password
```bash
# Go to Supabase > Authentication > Users
# Find user > Reset Password
# Send them reset link
```

### Export User List
```bash
# In Supabase SQL Editor:
COPY (
  SELECT u.email, u.full_name, r.name as role, u.status
  FROM user_profiles u
  LEFT JOIN roles r ON u.role_id = r.id
) TO STDOUT CSV HEADER;
```

---

## 🎓 Learn More

- Read: USER_MANAGEMENT_SETUP.md for complete guide
- Read: QUICK_REFERENCE.md for admin commands
- Read: PRODUCTION_DEPLOYMENT.md before going live
- Read: IMPLEMENTATION_SUMMARY.md for technical details

---

**Status**: ✅ Ready to Use  
**Version**: 1.0.0  
**Created**: April 22, 2026

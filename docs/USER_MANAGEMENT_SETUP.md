# Production-Ready User Management Setup Guide

## Overview

This document provides complete instructions for setting up production-ready user management in the Watcon Inventory Management System using Supabase.

## Prerequisites

1. Supabase Project created
2. Node.js 18+ installed
3. Environment variables configured (`.env.local`)

## Step 1: Set Up Database Tables

### Run the Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `database-schema.sql`
5. Click **Run**

This will create:
- `user_profiles` - Stores user profile information
- `roles` - Role definitions with permission sets
- `permissions` - Individual permission definitions
- `user_sessions` - Track active user sessions
- `user_activity_log` - Log user activities
- `audit_trail` - Audit log for all system changes

### Verify Tables Created

In Supabase SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

You should see: `user_profiles`, `roles`, `permissions`, `user_sessions`, `user_activity_log`, `audit_trail`

## Step 2: Create Initial Admin User

### Option A: Via API (Recommended)

```bash
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local first
node setup-admin.js
```

Follow the prompts to:
1. Enter admin email
2. Enter strong password (min 8 chars, uppercase, numbers, special chars)
3. Enter admin full name

### Option B: Manual via Supabase

1. Go to **Authentication** > **Users**
2. Click **Add User**
3. Create user with email and temporary password
4. Go to **SQL Editor** and run:

```sql
INSERT INTO public.user_profiles (
  id, full_name, email, role_id, status, is_admin
)
SELECT 
  id, 
  'Admin Name' as full_name, 
  email, 
  'r1' as role_id, 
  'ACTIVE' as status,
  true as is_admin
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (id) DO NOTHING;
```

## Step 3: Configure Environment Variables

Add these to your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: For enhanced security
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-for-tokens
```

## Step 4: Enable Row Level Security (RLS)

1. Go to **Authentication** > **Policies** in Supabase
2. For each table, set policies:

```sql
-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "admins_view_all" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Admins can update all profiles
CREATE POLICY "admins_update_all" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );
```

## Step 5: User Management API Endpoints

### Create User (Admin Only)

```bash
POST /api/auth/create-user

Headers:
  Authorization: Bearer {admin_token}
  Content-Type: application/json

Body:
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "temporary_password": "TempPass123!",
  "role_id": "r2"
}

Response (201):
{
  "success": true,
  "user": {
    "id": "uuid",
    "full_name": "John Doe",
    "email": "john@example.com",
    "role_id": "r2",
    "status": "ACTIVE"
  }
}
```

### Update User (Admin Only)

```bash
PUT /api/auth/users/{userId}

Headers:
  Authorization: Bearer {admin_token}
  Content-Type: application/json

Body:
{
  "full_name": "John Updated",
  "role_id": "r3",
  "status": "ACTIVE",
  "custom_permission_keys": ["dashboard.view"]
}
```

### Delete User (Super Admin Only)

```bash
DELETE /api/auth/users/{userId}

Headers:
  Authorization: Bearer {admin_token}
```

### Change Password (Authenticated Users)

```bash
POST /api/auth/change-password

Headers:
  Authorization: Bearer {user_token}
  Content-Type: application/json

Body:
{
  "old_password": "currentPassword123!",
  "new_password": "newPassword456!"
}
```

## Step 6: Available Roles

| Role | Permissions | Best For |
|------|-------------|----------|
| **r1** | Super Admin | All permissions, system administration |
| **r2** | Admin | Full access except system-level configs |
| **r3** | Purchase Manager | Purchase orders, vendors, deliveries |
| **r4** | Store Manager | Stock management, warehouse operations |
| **r5** | Accounts | Payments, invoicing, financial reports |
| **r6** | Viewer | Read-only access to most modules |

## Step 7: First Login

1. Start the dev server:
```bash
npm run dev
```

2. Go to `http://localhost:3000/login`

3. Login with your admin credentials:
   - Email: (admin email you set up)
   - Password: (password you set up)

4. You'll be redirected to the dashboard

## Step 8: Create Additional Users

1. Go to **Users** page (requires users.invite permission)
2. Click **Add User**
3. Fill in:
   - Full Name
   - Email
   - Select Role
   - Enter temporary password
4. Click **Create User**

The new user will:
- Receive a login invitation (in production)
- Need to change password on first login
- Have access based on their assigned role

## Security Best Practices

✅ **DO:**
- Use strong passwords (minimum 12 characters in production)
- Enable 2FA for admin accounts
- Regularly audit the audit_trail table
- Use JWT tokens with short expiration times
- Implement rate limiting on auth endpoints
- Use HTTPS in production
- Rotate service role keys regularly

❌ **DON'T:**
- Share SUPABASE_SERVICE_ROLE_KEY in public repos
- Store plain text passwords
- Use same password for multiple users
- Disable RLS policies
- Give all users admin access

## Troubleshooting

### "supabaseKey is required" Error
- Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in `.env.local`
- Restart dev server: `npm run dev`

### Can't Create Users via API
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check that requesting user has admin role (`is_admin = true`)
- Ensure auth token is valid and not expired

### User Can't Login
- Check `user_profiles` table - user must exist
- Verify `status` is 'ACTIVE'
- Confirm auth user exists in `auth.users`
- Check password is correct (case-sensitive)

### Permission Denied Errors
- User role doesn't have required permission
- Assign correct role or add custom permissions
- Check `roles` table for permission_keys

## Database Maintenance

### Regular Backups
```bash
# Daily backups (Supabase automatically does this)
# For manual backup, export from Supabase dashboard
```

### Clean Up Sessions
```sql
-- Remove expired sessions
DELETE FROM public.user_sessions 
WHERE expires_at < NOW();
```

### Archive Old Audit Logs
```sql
-- Archive logs older than 90 days
DELETE FROM public.audit_trail 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Production Deployment

Before deploying to production:

1. ✅ Verify all environment variables are set
2. ✅ Enable HTTPS
3. ✅ Set up CORS properly
4. ✅ Configure JWT secrets
5. ✅ Set up monitoring and logging
6. ✅ Enable database backups
7. ✅ Set up password reset flow
8. ✅ Configure email service for notifications
9. ✅ Test complete user lifecycle (create, login, update, delete)
10. ✅ Set up audit trail monitoring

## Support

For issues or questions:
1. Check Supabase documentation: https://supabase.com/docs
2. Review audit_trail for error logs
3. Check browser console for client-side errors
4. Enable debug mode in Next.js: `DEBUG=* npm run dev`

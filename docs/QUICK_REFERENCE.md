# Production User Management - Quick Reference

## Admin Quick Commands

### Create New User
```bash
# Via API
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "temporary_password": "TempPass123!",
    "role_id": "r2"
  }'
```

### Update User Status
```bash
# Via API
curl -X PUT http://localhost:3000/api/auth/users/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DISABLED"
  }'
```

### Change Password
```bash
# Via API
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "OldPassword123!",
    "new_password": "NewPassword456!"
  }'
```

## Database Queries

### Find User by Email
```sql
SELECT * FROM user_profiles WHERE email = 'user@example.com';
```

### Get All Active Admins
```sql
SELECT u.*, r.name as role_name 
FROM user_profiles u
JOIN roles r ON u.role_id = r.id
WHERE u.is_admin = true AND u.status = 'ACTIVE';
```

### View Recent Audit Trail
```sql
SELECT action, entity_name, performed_by, created_at 
FROM audit_trail 
ORDER BY created_at DESC 
LIMIT 50;
```

### Check Failed Login Attempts (Last 24 Hours)
```sql
SELECT user_id, action, COUNT(*) as attempts
FROM audit_trail
WHERE action = 'LOGIN_FAILED' 
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, action;
```

### List All Users with Roles
```sql
SELECT 
  u.id, 
  u.full_name, 
  u.email, 
  r.name as role,
  u.status,
  u.last_login_at
FROM user_profiles u
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY u.created_at DESC;
```

### Disable Inactive Users (> 90 days)
```sql
UPDATE user_profiles
SET status = 'DISABLED'
WHERE last_active_at < NOW() - INTERVAL '90 days'
AND status = 'ACTIVE';
```

## User Roles & Permissions

### Role IDs
- `r1` - Super Admin (all permissions)
- `r2` - Admin (most permissions)
- `r3` - Purchase Manager
- `r4` - Store Manager
- `r5` - Accounts
- `r6` - Viewer (read-only)

### Grant Custom Permission to User
```sql
UPDATE user_profiles
SET custom_permission_keys = array_append(custom_permission_keys, 'audit.view')
WHERE id = 'USER_ID';
```

### Revoke Permission from User
```sql
UPDATE user_profiles
SET revoked_permission_keys = array_append(revoked_permission_keys, 'dashboard.view')
WHERE id = 'USER_ID';
```

### View User Permissions
```sql
SELECT 
  u.full_name,
  r.permission_keys as role_permissions,
  u.custom_permission_keys,
  u.revoked_permission_keys
FROM user_profiles u
JOIN roles r ON u.role_id = r.id
WHERE u.id = 'USER_ID';
```

## Session Management

### View Active Sessions
```sql
SELECT 
  user_id,
  ip_address,
  user_agent,
  created_at,
  last_activity_at
FROM user_sessions
WHERE expires_at > NOW();
```

### Force Logout User (Invalidate Sessions)
```sql
UPDATE user_sessions
SET expires_at = NOW()
WHERE user_id = 'USER_ID';
```

### Clean Up Expired Sessions
```sql
DELETE FROM user_sessions
WHERE expires_at < NOW();
```

## Security Commands

### Force Password Change for All Users
```sql
UPDATE user_profiles
SET requires_password_change = true
WHERE status = 'ACTIVE';
```

### Reset Failed Login Counter
```sql
UPDATE user_profiles
SET failed_login_attempts = 0
WHERE id = 'USER_ID';
```

### Lock User Account
```sql
UPDATE user_profiles
SET status = 'DISABLED'
WHERE id = 'USER_ID';
```

### Enable 2FA for User
```sql
UPDATE user_profiles
SET two_factor_enabled = true,
    two_factor_secret = 'SECRET_HERE'
WHERE id = 'USER_ID';
```

## Monitoring Commands

### Check System Health
```bash
curl -s http://localhost:3000/api/health | jq
```

### View Recent Errors
```bash
# Check application logs
tail -f .next/dev/logs/next-development.log

# Or in Supabase, view function logs
```

### Monitor User Activity
```sql
SELECT 
  user_id,
  action,
  resource_type,
  COUNT(*) as count,
  MAX(created_at) as last_activity
FROM user_activity_log
GROUP BY user_id, action, resource_type
ORDER BY last_activity DESC;
```

## Backup & Recovery

### Create Manual Backup
```bash
# Backup via Supabase CLI
supabase db push --db-url "postgresql://..."
```

### Export User Data
```sql
COPY (
  SELECT u.*, r.name as role_name
  FROM user_profiles u
  LEFT JOIN roles r ON u.role_id = r.id
) TO STDOUT CSV HEADER;
```

### Import User Data
```sql
COPY user_profiles (id, full_name, email, role_id, status)
FROM STDIN CSV HEADER;
```

## Environment Setup

### Development
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Production
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NODE_ENV=production
```

## Troubleshooting

### Reset Admin User Password
```bash
# Via Supabase Admin API
curl -X POST https://your-project.supabase.co/auth/v1/admin/users/USER_ID/verify \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY"
```

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

### Verify User Can Access Table
```sql
SELECT * FROM user_profiles
WHERE auth.uid() = id
LIMIT 1;
```

### Check Auth User Status
```bash
# In Supabase console:
SELECT id, email, email_confirmed_at, last_sign_in_at
FROM auth.users
WHERE email = 'user@example.com';
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| User can't login | Check status='ACTIVE' and user exists in auth.users |
| Permission denied | Verify role has permission, check RLS policies |
| Password reset not working | Check email service config |
| Session expires too fast | Check JWT expiration time |
| User locked out | Reset failed_login_attempts to 0 |

## Important Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/create-user` | POST | Admin | Create new user |
| `/api/auth/users/:id` | PUT | Admin | Update user |
| `/api/auth/users/:id` | DELETE | Super Admin | Delete user |
| `/api/auth/change-password` | POST | User | Change own password |
| `/login` | GET | None | Login page |
| `/dashboard` | GET | User | Main dashboard |
| `/users` | GET | Admin | User management page |

## Performance Tips

1. **Indexes**: Already created on email, role_id, status, user_id
2. **Query optimization**: Use SELECT specific columns, not *
3. **Pagination**: Use LIMIT/OFFSET for large datasets
4. **Caching**: Cache user roles and permissions
5. **Connection pooling**: Supabase handles this automatically

## Security Reminders

🔒 ALWAYS:
- Use HTTPS in production
- Validate input on server side
- Use parameterized queries
- Check user permissions before operations
- Log security-relevant actions
- Rotate keys regularly
- Monitor audit trails

🚫 NEVER:
- Expose service role key publicly
- Log passwords or sensitive data
- Trust client-side validation alone
- Disable RLS policies
- Use weak passwords
- Share credentials via email

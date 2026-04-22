# Production Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in all Supabase credentials
- [ ] Set `NEXT_PUBLIC_APP_URL` for production domain
- [ ] Generate and set `JWT_SECRET` for token signing
- [ ] Set strong `SUPABASE_SERVICE_ROLE_KEY` access controls

### 2. Database Setup
- [ ] Run `database-schema.sql` in Supabase SQL Editor
- [ ] Verify all tables created: user_profiles, roles, audit_trail, etc.
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create at least one Super Admin user
- [ ] Verify RLS policies are in place
- [ ] Test user can't access other users' data

### 3. Authentication Setup
- [ ] Create admin user via `node setup-admin.js`
- [ ] Test admin login works
- [ ] Verify password change flow
- [ ] Test logout and session handling
- [ ] Verify token refresh works correctly

### 4. Security Hardening
- [ ] Enable HTTPS enforcement in production
- [ ] Configure CORS properly for your domain
- [ ] Set secure Cookie flags (SameSite, Secure, HttpOnly)
- [ ] Enable rate limiting on auth endpoints
- [ ] Set up IP whitelisting if applicable
- [ ] Configure password complexity requirements
- [ ] Enable 2FA for admin accounts
- [ ] Review and update RLS policies

### 5. User Management
- [ ] Create all necessary user accounts
- [ ] Assign correct roles to each user
- [ ] Test permission system with different roles
- [ ] Verify audit trails are being created
- [ ] Set up email notifications for user creation
- [ ] Configure password reset email template

### 6. Monitoring & Logging
- [ ] Enable application error logging
- [ ] Set up database monitoring in Supabase
- [ ] Configure audit trail monitoring
- [ ] Set up email alerts for failed logins
- [ ] Monitor failed password attempts
- [ ] Track suspicious activity patterns

### 7. Backup & Recovery
- [ ] Enable automated backups in Supabase
- [ ] Test backup restoration process
- [ ] Document disaster recovery procedure
- [ ] Set backup retention policy
- [ ] Document recovery time objectives (RTO)

### 8. Performance Optimization
- [ ] Test database query performance
- [ ] Verify indexes are created on all key tables
- [ ] Monitor API response times
- [ ] Configure caching strategy
- [ ] Test with realistic user load

### 9. Testing
- [ ] Test complete user lifecycle (create, login, logout, delete)
- [ ] Test permission system with all roles
- [ ] Test concurrent login sessions
- [ ] Test password change flow
- [ ] Test user status changes (active/disabled)
- [ ] Test audit trail logging
- [ ] Perform security penetration testing
- [ ] Test error handling and edge cases

### 10. Documentation
- [ ] Document all admin procedures
- [ ] Create user onboarding guide
- [ ] Document troubleshooting steps
- [ ] Create disaster recovery runbook
- [ ] Document change log and version history
- [ ] Create API documentation for integrations

## Deployment Steps

### 1. Prepare Production Environment
```bash
# Set up production Supabase project
# Copy credentials to secure location
# Run database migrations
```

### 2. Build & Test
```bash
# Install dependencies
npm install

# Run all tests
npm run test

# Build production bundle
npm run build

# Test production build locally
npm run start
```

### 3. Deploy Application
```bash
# Deploy to your hosting provider (Vercel, AWS, etc.)
# Verify deployment is healthy
# Run smoke tests on production
# Monitor error logs for issues
```

### 4. Post-Deployment Verification
```bash
# Test login flow
# Verify all pages load correctly
# Check database connectivity
# Verify audit trails are being created
# Test email notifications
# Check performance metrics
```

## Production Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-32-chars-min

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
```

## Security Best Practices

### ✅ DO
- Use strong, unique passwords (minimum 12 characters)
- Enable 2FA for all admin accounts
- Regularly rotate service keys
- Monitor audit trails for suspicious activity
- Keep dependencies updated
- Use HTTPS everywhere
- Implement rate limiting
- Regular security audits
- Store secrets in environment variables
- Use parameterized queries to prevent SQL injection

### ❌ DON'T
- Commit secrets to version control
- Use weak passwords
- Disable RLS policies
- Grant unnecessary permissions
- Log sensitive data
- Use outdated dependencies
- Trust client-side validation alone
- Ignore security warnings
- Share credentials via email
- Disable HTTPS

## Monitoring Checklist

### Daily
- [ ] Check error logs for critical errors
- [ ] Monitor failed login attempts
- [ ] Verify database backups completed
- [ ] Check application uptime

### Weekly
- [ ] Review audit trail for unusual activity
- [ ] Check API performance metrics
- [ ] Verify all users have correct permissions
- [ ] Test backup restoration

### Monthly
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Analyze usage patterns
- [ ] Review and optimize slow queries
- [ ] Test disaster recovery plan

## Troubleshooting Production Issues

### Issue: Users Can't Login
1. Check user exists in `user_profiles` table
2. Verify `status` is 'ACTIVE'
3. Check auth user exists in `auth.users`
4. Review failed login audit logs
5. Check service status

### Issue: Permission Denied Errors
1. Verify user role has permission
2. Check role permissions in `roles` table
3. Review custom permissions assigned
4. Check RLS policies are correct

### Issue: Database Connection Errors
1. Verify Supabase credentials
2. Check network connectivity
3. Verify SSL certificates
4. Review Supabase logs

### Issue: High Response Times
1. Check database query performance
2. Review indexes on frequently accessed tables
3. Check for N+1 queries
4. Optimize pagination if needed
5. Consider caching strategy

## Incident Response

### For Security Breach
1. [ ] Rotate all credentials immediately
2. [ ] Review audit logs for affected users
3. [ ] Notify affected users
4. [ ] Force password reset for all users
5. [ ] Review and update security policies
6. [ ] Post-incident analysis

### For Data Corruption
1. [ ] Stop application immediately
2. [ ] Enable read-only mode
3. [ ] Restore from latest backup
4. [ ] Verify data integrity
5. [ ] Investigate root cause
6. [ ] Implement preventive measures

## Rollback Procedure

If a deployment causes critical issues:

```bash
# 1. Identify last working version
# 2. Revert to previous deployment
# 3. Test thoroughly
# 4. Monitor error logs
# 5. Investigate issue on separate environment
# 6. Fix and re-deploy
```

## Support & Escalation

For production issues:
1. Check application logs
2. Check Supabase status page
3. Review recent deployments
4. Check infrastructure alerts
5. Contact Supabase support if needed

## Handover Checklist

When handing over to ops team:
- [ ] All credentials securely shared
- [ ] Documentation complete and accessible
- [ ] Team trained on procedures
- [ ] Monitoring alerts configured
- [ ] On-call schedule established
- [ ] Emergency contact list prepared
- [ ] Runbooks created for common issues

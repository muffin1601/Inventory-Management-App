# Production Setup Guide

This guide will help you migrate your inventory management system from localStorage to a production-ready Supabase database setup.

## Prerequisites

- Supabase account and project
- Node.js and npm installed
- Your application code

## Step 1: Set up Supabase Database

1. Create a new Supabase project at https://supabase.com
2. Go to your project's SQL Editor
3. Copy and run the entire `database-schema.sql` file
4. Verify that all tables and policies were created successfully

## Step 2: Configure Environment Variables

Update your `.env.local` file with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

You can find these values in your Supabase project settings under "API".

## Step 3: Migrate Existing Data (Optional)

If you have existing localStorage data that you want to migrate:

1. Open your application in a browser
2. Open the browser console (F12 → Console)
3. Copy and paste the contents of `migrate-to-database.js`
4. Run `migrateToDatabase()` in the console
5. Follow the prompts to create users in Supabase Auth

**Important:** The migration script will provide specific commands to create users in Supabase Auth. You must run these commands manually.

## Step 4: Update Application Code

The application has been updated to use the database service. The main changes are:

- `src/lib/services/modules.ts` now uses the database service
- `src/lib/services/modules-database.ts` contains the database implementation
- `src/lib/supabase.ts` includes both client and admin Supabase clients

## Step 5: Test the Application

1. Start your development server: `npm run dev`
2. Test user authentication and authorization
3. Verify that all features work with the database
4. Check the audit trail functionality

## Step 6: Deploy to Production

1. Deploy your application to your hosting platform (Vercel, Netlify, etc.)
2. Ensure all environment variables are set in your production environment
3. Test the production deployment thoroughly

## Database Schema Overview

The production setup includes:

- **user_profiles**: Extended user information with roles and permissions
- **roles**: Predefined roles with permission sets
- **audit_trail**: Complete audit logging for all user actions
- **Row Level Security (RLS)**: Automatic data protection policies
- **Indexes**: Optimized database performance

## Security Features

- Row Level Security on all tables
- Admin-only operations require service role key
- Audit trail for all user management actions
- Automatic session management
- Permission-based access control

## Troubleshooting

### Common Issues

1. **"relation does not exist" errors**: Make sure you ran the database schema
2. **Authentication errors**: Check your Supabase keys and RLS policies
3. **Permission denied**: Verify user roles and permissions are set correctly

### Debug Commands

Use these commands in the browser console for debugging:

```javascript
// Check current database state
modulesService._debugShowState()

// View current user
modulesService.getCurrentUser()

// Check permissions
modulesService.hasPermission(user, 'dashboard.view')
```

## Migration Checklist

- [ ] Supabase project created
- [ ] Database schema applied
- [ ] Environment variables configured
- [ ] Existing data migrated (if applicable)
- [ ] Application tested locally
- [ ] Production deployment successful
- [ ] User authentication working
- [ ] Permissions and roles functioning
- [ ] Audit trail operational

## Support

If you encounter issues during setup, check:

1. Supabase project logs
2. Browser console for errors
3. Network tab for API calls
4. Database table contents via Supabase dashboard

The application now supports multi-user production environments with proper authentication, authorization, and audit trails.
# Database Schema Fixes - Complete Guide

## Current Issue
Vendor queries are returning **400 Bad Request** errors because the **`address`** column doesn't exist in your `vendors` table:
```
GET https://wsxjbbpmzclaoxdckgov.supabase.co/rest/v1/vendors?select=id%2Cname%2Caddress%2Cpayment_terms
→ 400 (Bad Request)
```

## Root Cause
Your Supabase `vendors` table is missing these columns:
- ❌ `address` - REQUIRED by purchase orders page
- ❌ `city` - Used as fallback by some queries  
- ❌ `delivery_address` - Used for order fulfillment
- ❌ `status` - For vendor status tracking

## Solution: Run These Migrations in Order

### Step 1: Add Missing Columns to Vendors Table
**File:** `sql/create-missing-tables.sql`

Go to Supabase Dashboard:
1. Click **SQL Editor** → **New Query**
2. Copy and paste the contents of `sql/create-missing-tables.sql`
3. Click **Run** (the play button)

This will add all missing columns to the vendors table.

### Step 2: Verify Columns Were Added
**File:** `sql/verify-vendors-schema.sql`

After Step 1, verify the fix:
1. Click **SQL Editor** → **New Query**
2. Copy and paste the contents of `sql/verify-vendors-schema.sql`
3. Click **Run**

You should see these columns in the result:
```
✓ id (uuid)
✓ name (text)
✓ contact_person (text)
✓ email (text)
✓ phone (text)
✓ address (text)           ← SHOULD NOW EXIST
✓ gst_number (text)
✓ payment_terms (text)
✓ is_active (boolean)
✓ city (text)              ← SHOULD NOW EXIST
✓ delivery_address (text)  ← SHOULD NOW EXIST
✓ status (text)            ← SHOULD NOW EXIST
✓ created_at (timestamptz)
✓ updated_at (timestamptz)
```

### Step 3: Seed App Options (Optional but Recommended)
**File:** `sql/seed-app-options.sql`

Populate the `app_options` table with standard values:
1. Click **SQL Editor** → **New Query**
2. Copy and paste the contents of `sql/seed-app-options.sql`
3. Click **Run**

This adds predefined values for:
- UNIT (KG, METER, PIECE, BOX, etc.)
- REASON (STOCK_IN, STOCK_OUT, DAMAGE, etc.)
- STATUS (ACTIVE, INACTIVE, PENDING, etc.)
- PAYMENT_METHOD (BANK_TRANSFER, CASH, CHEQUE, UPI, etc.)
- DELIVERY_TYPE (SITE_DELIVERY, STORE_DELIVERY)
- CONDITION (GOOD, DAMAGED, SHORTAGE)

### Step 4: Clear Browser Cache & Restart
After running the migrations:
1. Hard refresh your browser: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. Or: **Dev Tools** → **Application** → **Clear Site Data**
3. Close and reopen the application
4. Navigate to Purchase Orders page

## Expected Results After Fix

### ✅ These 400 Errors Should Disappear:
```
❌ BEFORE: GET /rest/v1/vendors?select=id%2Cname%2Caddress%2Cpayment_terms → 400
✅ AFTER:  GET /rest/v1/vendors?select=id%2Cname%2Caddress%2Cpayment_terms → 200
```

### ✅ Vendor Dropdowns Should Work
- Purchase orders page can now load vendors
- Vendor details (address, payment terms) display correctly
- Vendor selection populates automatically

## Files Modified

### SQL Migrations (to run in Supabase)
- ✅ `sql/create-missing-tables.sql` - **REQUIRED** - Creates missing tables and columns
- ✅ `sql/verify-vendors-schema.sql` - Verification query
- ✅ `sql/seed-app-options.sql` - Optional seed data

### Application Code (already fixed)
- ✅ `src/app/orders/page.tsx` - Uses correct column names
- ✅ `src/app/reports/page.tsx` - Uses correct column names

## Troubleshooting

### Q: Still getting 400 errors after running migration?
**A:** 
1. Verify migration ran without errors (check for "ERROR" in output)
2. Run verification query: `sql/verify-vendors-schema.sql`
3. Hard refresh browser cache (Ctrl+Shift+R)
4. Restart your Next.js development server

### Q: How do I check if the migration ran successfully?
**A:** Run this query in Supabase SQL Editor:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vendors' AND column_name = 'address';
```
Should return 1 row with `address`.

### Q: Can I run the migration multiple times?
**A:** Yes! The migration uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times.

### Q: What if I see "permission denied" error?
**A:** You need admin/superuser access to run DDL (CREATE/ALTER) commands. Check your Supabase user role.

## Next Steps

1. ✅ Run `sql/create-missing-tables.sql` 
2. ✅ Run `sql/verify-vendors-schema.sql` to confirm
3. ✅ Clear browser cache
4. ✅ Test Purchase Orders page
5. ✅ Commit changes to Git

---

**Key File:** `sql/create-missing-tables.sql`
**Status:** Ready to apply ✓
**Priority:** HIGH - Blocks Purchase Orders functionality

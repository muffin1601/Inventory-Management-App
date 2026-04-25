# BOQ Reserved Stock Feature - Implementation Complete ✅

## Summary
I've implemented the feature to **automatically reserve inventory when BOQ items are created** and **display updated free stock**. 

## What Was Changed

### 1. **Database Migration** (`add-reserved-stock.sql`)
- Added `reserved` column to the `inventory` table
- Stores the quantity of stock that is promised/reserved for BOQ items
- Includes constraints to prevent negative values

### 2. **Backend Service** (`src/lib/services/projects.ts`)
Enhanced BOQ management with reserved stock tracking:

**New Helper Method:**
- `updateReservedStock()` - Manages reserved stock updates when BOQ items are added or deleted

**Modified `addBoqItem()`:**
- Calculates reserve quantity: `quantity - delivered`
- Automatically updates inventory's reserved field
- Works with both specific warehouse allocation and global allocation

**Modified `deleteBoqItem()`:**
- Fetches BOQ item before deletion
- Automatically frees up reserved stock
- Proportionally removes from multiple warehouses if needed

### 3. **Inventory Service** (`src/lib/services/inventory.ts`)
- Updated product queries to include the `reserved` column
- `reserved` value now included in stock data for each warehouse-variant combination

### 4. **Stock Display** (`src/app/stock/page.tsx`)
- Added **Reserved** column to stock table (between Stock and Promised)
- Updated free stock calculation to: `Free = Stock - (Reserved + Promised)`
- FlatStockRow type now includes `reserved` field

## How It Works

### Stock Calculation Flow
```
Total Stock (in inventory table)
    ↓
├─ Reserved Stock (via BOQ items)  ← NEW: Updated when BOQ is created/deleted
├─ Promised (from Orders + BOQ)
│  ├─ Pending Approval Orders
│  └─ BOQ Remaining Items
└─ FREE STOCK = Total - (Reserved + Promised)
```

### When You Create a BOQ Item:
1. ✅ BOQ item is created/saved
2. ✅ System finds matching inventory variant
3. ✅ Calculates remaining quantity: `qty - already_delivered`
4. ✅ Updates inventory's `reserved` field
5. ✅ Stock page automatically shows updated free stock

### Example:
- **Total Stock:** 100 units
- **BOQ Item Created:** 50 units needed
- **Reserved:** 50 units (automatic)
- **Free Stock:** 50 units (100 - 50)

## Installation Steps

### Step 1: Run the Database Migration
Execute this SQL on your database:

```sql
-- Option A: Using Supabase CLI
supabase db execute add-reserved-stock.sql

-- Option B: Using psql directly
psql -U your_user -h your_host -d your_database -f add-reserved-stock.sql

-- Option C: Manual execution
-- Connect to your database and run:
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS reserved DECIMAL(15,3) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_inventory_reserved ON public.inventory(reserved);
```

### Step 2: Deploy the Code
The following files have been updated:
- ✅ `src/lib/services/projects.ts` - BOQ item management
- ✅ `src/lib/services/inventory.ts` - Stock data queries
- ✅ `src/app/stock/page.tsx` - Stock display with reserved column

Deploy these files to your production environment.

### Step 3: Verify Installation
1. Open the Stock page
2. You should see a new **"Reserved"** column
3. Create a new BOQ item
4. Check the Stock page - Reserved should show the BOQ quantity
5. Free stock should decrease accordingly

## Testing Checklist

- [ ] Run SQL migration successfully
- [ ] Deploy code changes
- [ ] Navigate to Stock page - see Reserved column
- [ ] Create BOQ item with variant_id and quantity
- [ ] Check Stock page - verify Reserved = BOQ quantity
- [ ] Verify Free = Stock - Reserved - Promised
- [ ] Delete BOQ item - verify Reserved goes back to 0
- [ ] Test with multiple warehouses
- [ ] Test partial delivery (quantity > delivered)

## Key Features

✅ **Automatic**: Reserved stock updates automatically when BOQ is created/deleted  
✅ **Smart Allocation**: Handles both specific warehouse and global allocation  
✅ **Backward Compatible**: Works alongside existing order promises  
✅ **Real-time Display**: Stock page shows updated free stock immediately  
✅ **Non-blocking**: If reserved stock update fails, BOQ creation still succeeds  

## Stock Table Columns Explained

| Column | What It Means | Example |
|--------|---------------|---------|
| **Stock** | Total inventory in warehouse | 100 units |
| **Reserved** | Amount promised to BOQ items | 50 units |
| **Promised** | Amount promised to orders + BOQ | 70 units |
| **Free** | Actually available for new orders | 30 units |

**Formula:** `Free = Stock - Reserved - (Promised - Reserved)`

## Important Notes

⚠️ **Variant ID Required**: BOQ items should have `variant_id` set for proper stock tracking  
⚠️ **Database Backup**: Backup your database before running the migration  
⚠️ **Test First**: Test in a development environment first  

## Support & Troubleshooting

### Reserved stock not updating?
- Check if `variant_id` is set on BOQ item
- Verify SQL migration ran successfully
- Check browser console for errors

### See current reserved stock:
```sql
SELECT 
  v.sku,
  w.name as warehouse,
  i.quantity,
  i.reserved,
  (i.quantity - i.reserved) as available
FROM inventory i
JOIN variants v ON i.variant_id = v.id
JOIN warehouses w ON i.warehouse_id = w.id
ORDER BY v.sku, w.name;
```

### Reset reserved stock (if needed):
```sql
-- Set all to 0
UPDATE inventory SET reserved = 0;

-- Or specific variant
UPDATE inventory 
SET reserved = 0 
WHERE variant_id = 'your-variant-id';
```

## Files Modified

1. ✅ `add-reserved-stock.sql` - Database migration
2. ✅ `src/lib/services/projects.ts` - BOQ with reserved stock
3. ✅ `src/lib/services/inventory.ts` - Stock queries
4. ✅ `src/app/stock/page.tsx` - Display reserved column
5. ✅ `docs/BOQ_RESERVED_STOCK_IMPLEMENTATION.md` - Full documentation

## Next Steps

1. Run the SQL migration
2. Deploy the code
3. Test with sample BOQ items
4. Monitor the Stock page for correct calculations
5. Update user documentation if needed

---

**Implementation Status:** ✅ COMPLETE  
**Date:** April 25, 2026  
**Impact:** Better inventory management with automatic BOQ reservations

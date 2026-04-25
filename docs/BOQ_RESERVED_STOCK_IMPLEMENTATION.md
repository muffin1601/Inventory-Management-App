# BOQ Reserved Stock Implementation

## Overview
This implementation adds a "reserved" stock feature that automatically reserves inventory when BOQ (Bill of Quantities) items are created. The free stock is then calculated as: **Free Stock = Total Stock - Reserved Stock - Promised (Orders)**

## Changes Made

### 1. Database Schema Update
**File:** `add-reserved-stock.sql`

Added a new `reserved` column to the `inventory` table:
- Column type: `DECIMAL(15,3)` (same as quantity)
- Default value: `0`
- Includes non-negative constraint
- Includes index for performance

### 2. Backend Service Updates

#### Projects Service (`src/lib/services/projects.ts`)
Enhanced the `addBoqItem` and `deleteBoqItem` functions to manage reserved stock:

**When adding a BOQ item:**
- Calculates the reserve quantity as: `quantity - delivered`
- Automatically finds matching inventory records by variant_id and warehouse_id
- Updates the `reserved` field in the inventory table
- If no warehouse_id specified, distributes reserved stock across all warehouses

**When deleting a BOQ item:**
- Fetches the BOQ item details before deletion
- Decreases the reserved stock accordingly
- If no warehouse_id specified, removes reserved stock proportionally across warehouses

#### Inventory Service (`src/lib/services/inventory.ts`)
Updated queries to include the `reserved` field:
- Modified `getProducts()` to fetch the `reserved` column from inventory
- Updated `processProducts()` to include `reserved` in the stock_data

### 3. Frontend Updates

#### Stock Page (`src/app/stock/page.tsx`)
1. **Updated FlatStockRow type**: Added `reserved: number` field
2. **Updated stock calculation**: 
   - Now includes reserved stock in the promised calculation
   - Formula: `totalPromised = orderPromised + storedReserved + boqReserved + overflow`
   - Free stock: `free = stock - totalPromised`
3. **Added Reserved column** to the stock table display
   - Shows between Stock and Promised columns
   - Uses right-aligned numeric styling

## Installation Instructions

### Step 1: Run the Migration
Execute the SQL migration to add the reserved column:

```bash
# Using psql
psql -U [user] -h [host] -d [database] -f add-reserved-stock.sql

# Or using Supabase CLI
supabase db execute add-reserved-stock.sql
```

### Step 2: Deploy the Code
1. Deploy the updated `src/lib/services/projects.ts`
2. Deploy the updated `src/lib/services/inventory.ts`
3. Deploy the updated `src/app/stock/page.tsx`

### Step 3: Test the Feature

1. **Test Adding BOQ Items:**
   - Navigate to a project
   - Add a new BOQ item with quantity > 0
   - Check the Stock page - verify that "Reserved" column shows the BOQ quantity
   - Free stock should decrease accordingly

2. **Test Multiple Warehouses:**
   - Add a BOQ item with warehouse specified
   - Verify reserved stock is allocated to that warehouse only
   - Add a BOQ item without warehouse specified
   - Verify reserved stock is allocated to first available warehouse

3. **Test Partial Delivery:**
   - Add a BOQ item with quantity=100, delivered=30
   - Verify reserved stock shows 70 (100-30)

4. **Test Deletion:**
   - Delete a BOQ item
   - Verify reserved stock is freed up

## Stock Calculation Flow

```
Total Stock (inventory.quantity)
├── Reserved Stock (inventory.reserved)  ← Updated when BOQ items are added/deleted
├── Promised (from Orders + BOQ)
│   ├── Order Promises (pending_approval SALE orders)
│   └── BOQ Reserves (not yet removed, for backward compatibility)
│       ├── Explicit warehouse BOQ items
│       └── Global BOQ allocation (waterfall)
└── Free Stock = Total - (Reserved + Promised)
```

## Backwards Compatibility

- Existing BOQ items calculated dynamically are still considered in promised stock
- The new reserved column works alongside the existing BOQ calculation
- No breaking changes to the API or database schema

## API Endpoints Using This Feature

### Creating BOQ Items
```typescript
const result = await projectsService.addBoqItem({
  projectId: 'project-id',
  item_name: 'Material Name',
  quantity: 100,
  delivered: 0,
  unit: 'Pcs',
  variant_id: 'variant-id',  // Optional, but recommended for better matching
  warehouse_id: 'warehouse-id'  // Optional, auto-allocates if not specified
});
// Reserved stock will automatically be updated
```

### Deleting BOQ Items
```typescript
const result = await projectsService.deleteBoqItem('project-id', 'boq-item-id');
// Reserved stock will automatically be freed
```

## Monitoring & Troubleshooting

### Check Reserved Stock Status
```sql
-- View current reserved stock by variant
SELECT 
  v.sku,
  w.name as warehouse,
  i.quantity,
  i.reserved,
  (i.quantity - i.reserved) as available
FROM inventory i
JOIN variants v ON i.variant_id = v.id
JOIN warehouses w ON i.warehouse_id = w.id
WHERE i.reserved > 0
ORDER BY v.sku, w.name;
```

### Reset Reserved Stock (if needed)
```sql
-- Set all reserved stock to 0 (for testing/debugging)
UPDATE inventory SET reserved = 0;
```

## Future Enhancements

1. **Automatic Release on Delivery**: When BOQ items are marked as fully delivered, automatically reduce reserved stock
2. **BOQ-to-Order Conversion**: When orders are created from BOQ, transfer reserved stock to order promises
3. **Real-time Notifications**: Alert users when free stock drops below minimum threshold
4. **Reserved Stock History**: Track when items were reserved and for which project

## Performance Considerations

- The reserved column is indexed for quick lookups
- Stock calculations remain O(n) where n is the number of warehouse-variant combinations
- No additional database queries required beyond existing inventory fetch

## Related Documentation

- See `docs/PURCHASE_ORDERS_ANALYSIS.md` for how orders affect promised stock
- See `docs/QUICK_REFERENCE.md` for stock management overview

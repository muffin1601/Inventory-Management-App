# Purchase Orders Module - Complete Analysis

## Executive Summary

The purchase orders module at `src/app/orders/` has **10 identified issues**, including 4 critical bugs that will cause database constraint violations and runtime failures. The module contains 3+ inconsistent confirmation modal implementations that should be consolidated.

---

## 1. File Structure & Component Relationships

### Core Files

| File | Lines | Purpose |
|------|-------|---------|
| [src/app/orders/page.tsx](src/app/orders/page.tsx) | 1500+ | Main page: Order listing, creation form, all modals |
| [src/app/orders/Orders.module.css](src/app/orders/Orders.module.css) | 800+ | Styling for orders module (contains duplicates) |
| [src/app/api/audit/route.ts](src/app/api/audit/route.ts) | 40 | Audit trail logging endpoint |
| [src/lib/services/modules.ts](src/lib/services/modules.ts) | 70 | Wrapper service (delegates to modules-database) |
| [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L967-L1120) | 150 | DB service: getOrders, createOrder, updateOrderStatus |

### Data Flow

```
User Action in Orders Page
    ↓
modulesService (wrapper)
    ↓
modulesService (modules-database)
    ↓
Supabase (purchase_orders, purchase_order_items)
    ↓
Audit API (/api/audit)
```

---

## 2. Database Schema

### purchase_orders Table

```sql
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES vendors(id),
  project_id UUID REFERENCES projects(id),
  warehouse_id UUID,
  status TEXT DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'APPROVED', 'CANCELLED')),  -- Only 3 values!
  delivery_address TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### purchase_order_items Table

```sql
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES purchase_orders(id),
  variant_id UUID NOT NULL,
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2),
  gst_rate DECIMAL(5,2) DEFAULT 18,
  gst_amount DECIMAL(15,2),
  total_price DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Constraints:**
- `status` enum: ONLY 'PENDING', 'APPROVED', 'CANCELLED'
- `order_number` is unique text identifier
- Items linked via `order_id` foreign key

---

## 3. Critical Bugs 🔴

### Bug #1: Status Enum Mismatch - DATABASE CONSTRAINT VIOLATION

**Severity:** 🔴 CRITICAL - Will crash when saving to database

**Location:** 
- Code: [src/lib/services/modules-database.ts:1107-1112](src/lib/services/modules-database.ts#L1107-L1112)
- UI options: [src/app/orders/page.tsx:415-425](src/app/orders/page.tsx#L415-L425)

**The Problem:**

Database schema only allows 3 statuses:
```
PENDING, APPROVED, CANCELLED
```

But code tries to use 8 statuses:
```
PENDING ✅ (maps to DB PENDING)
APPROVED ✅ (matches DB)
CANCELLED ✅ (matches DB)
SENT ❌ (not in DB)
ACKNOWLEDGED ❌ (not in DB)
PARTIALLY_RECEIVED ❌ (not in DB)
COMPLETED ❌ (not in DB)
CLOSED ❌ (not in DB)
```

**Code:**
```typescript
// modules-database.ts line 1107-1112
async updateOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    let dbStatus = status.toLowerCase();
    if (dbStatus === 'pending') dbStatus = 'pending_approval';  // ❌ Not in DB!
    
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: dbStatus })
      .eq('id', orderId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}
```

**Impact:** Any status change will fail with CHECK constraint violation

**Fix Required:** Validate status against allowed values before database operation

---

### Bug #2: Invalid Column Name in Order Creation

**Severity:** 🔴 CRITICAL - Will fail on INSERT

**Location:** [src/lib/services/modules-database.ts:1049](src/lib/services/modules-database.ts#L1049)

**The Problem:**

Database schema column: `order_number`
Code creates with: `po_number`

```typescript
// Line 1049 - WRONG
const orderToInsert: any = {
  po_number: orderNumber,  // ❌ Column doesn't exist!
  vendor_id: validOrderData.vendor_id,
  status: 'pending_approval',  // ❌ Invalid status too!
  ...
};
```

**Error:**
```
column "po_number" of relation "purchase_orders" does not exist
```

**Fix:** Change `po_number` to `order_number`

---

### Bug #3: Delivery Address Deletion - LOSES DATA

**Severity:** 🔴 CRITICAL - Data loss

**Location:** [src/lib/services/modules-database.ts:1052](src/lib/services/modules-database.ts#L1052)

**The Problem:**

```typescript
// Line 1052 - Delete from object
delete (validOrderData as Record<string, unknown>).delivery_address;

// Line 1058 - Try to use it
delivery_address: validOrderData.delivery_address || ''
// ❌ Already deleted - always undefined!
```

**Impact:** Delivery address always saved as empty string

**Fix:** Don't delete it before using it

---

### Bug #4: Missing Order Items Data

**Severity:** 🔴 CRITICAL - Incomplete data storage

**Location:** [src/lib/services/modules-database.ts:1079-1084](src/lib/services/modules-database.ts#L1079-L1084)

**The Problem:**

Only storing `quantity` and `unit_price`, but missing GST data:

```typescript
const itemsToInsert = items.map((item: any) => ({
  order_id: orderId,
  variant_id: item.variant_id,
  quantity: item.quantity || 1,
  unit_price: item.unit_price || 0,
  // ❌ Missing: gst_rate, gst_amount, total_price
}));
```

**Database expects:**
```
gst_rate DECIMAL(5,2) DEFAULT 18
gst_amount DECIMAL(15,2)
total_price DECIMAL(15,2)
```

**Impact:** GST calculations lost; totals not stored

---

## 4. High Priority Issues 🟡

### Issue #5: Multiple Inconsistent Confirmation Modals

**Severity:** 🟡 HIGH - Code duplication, inconsistent UX

**Problem:** Three different patterns for requesting user confirmation + reason:

#### Pattern 1: Using confirmAction() - APPROVE
```typescript
// page.tsx:350-365
const confirmation = await confirmAction({
  title: 'Approve this order?',
  message: 'This will apply stock changes immediately.',
  confirmText: 'Approve',
  requireReason: true,
  reasonLabel: 'Approval reason',
  reasonPlaceholder: 'Why are you approving this order?',
});
```
✅ Clean, centralized, consistent

#### Pattern 2: Using confirmAction() - REJECT
```typescript
// page.tsx:476-485
const confirmation = await confirmAction({
  title: 'Reject this order?',
  message: 'Select a status and provide rejection reason.',
  confirmText: 'Reject Order',
  requireReason: true,
  reasonLabel: 'Rejection reason',
  reasonPlaceholder: 'Why are you rejecting this order?',
});
```
✅ Consistent with approve

#### Pattern 3: Custom Modal State - STATUS CHANGE
```typescript
// page.tsx:415-475 and 1247-1310
const [statusChangeModal, setStatusChangeModal] = useState<{ order: OrderRow; newStatus: string } | null>(null);

// Then in render:
{statusChangeModal && (
  <div className={styles.bulkModalOverlay}>
    <textarea id="statusChangeReason" ... />
    // Manual validation:
    const reason = (document.getElementById('statusChangeReason') as HTMLTextAreaElement)?.value || '';
    if (!reason.trim()) {
      showToast('Please provide a reason for the status change.', 'error');
    }
  </div>
)}
```
❌ DOM manipulation, inconsistent error handling

**Result:** 
- Same workflow, 3 different implementations
- statusChangeModal doesn't follow app patterns
- Risk of validation bugs

---

### Issue #6: Warehouse Validation Doesn't Prevent Approval

**Severity:** 🟡 HIGH - Incomplete workflow

**Location:** [src/app/orders/page.tsx:375-395](src/app/orders/page.tsx#L375-L395)

**The Problem:**

```typescript
if (recordWarehouseId && recordWarehouseId !== 'unknown' && recordWarehouseId.length > 0) {
  // Record inventory movement
  try {
    await inventoryService.recordMovement({...});
  } catch (error) {
    console.error('Failed to record inventory movement:', error);
    inventoryErrors = true;
  }
} else {
  console.warn('Skipping inventory movement: warehouse assignment needed for item', item.sku);
  inventoryErrors = true;
}

// But approval continues anyway!
try {
  await modulesService.updateOrderStatus(order.id, 'APPROVED');
  await refreshOrders();
  
  if (inventoryErrors) {
    showToast('Order approved. Note: Some items lack warehouse assignment...', 'info');
  }
}
```

**Issue:** Order is approved even without warehouse assignment

**Result:** 
- Inventory not properly tracked
- Stock movement may fail
- Inconsistent data state

---

### Issue #7: Inefficient Vendor Loading

**Severity:** 🟡 MEDIUM - Performance issue

**Location:** [src/app/orders/page.tsx:125-160](src/app/orders/page.tsx#L125-L160)

**The Problem:**

8 sequential database queries attempting different column combinations:

```typescript
const vendorSelects = [
  { select: 'id, name, delivery_address, payment_terms', order: 'name' },
  { select: 'id, name, city, payment_terms', order: 'name' },
  { select: 'id, name, delivery_address', order: 'name' },
  { select: 'id, name, city', order: 'name' },
  { select: 'id, name, payment_terms', order: 'name' },
  { select: 'id, name', order: 'name' },
  { select: '*', order: 'name' },
  { select: '*', order: 'id' },
];

for (const { select, order } of vendorSelects) {
  const response = await supabase.from('vendors').select(select).order(order);
  if (!response.error) {
    vendorItems = ((response.data || []) as unknown as VendorRow[]).map(normalizeVendorRow);
    break;
  }
  if (!isMissingColumnError(response.error)) {
    lastError = response.error;
    break;
  }
}
```

**Impact:**
- 7+ database round trips on page load
- Only needed if schema changed unexpectedly
- Slow initial load

---

### Issue #8: Duplicate Return Statement

**Severity:** 🟡 LOW - Dead code

**Location:** [src/lib/services/modules-database.ts:1035-1036](src/lib/services/modules-database.ts#L1035-L1036)

```typescript
return ordersWithItems;

return ordersWithItems;  // ❌ Unreachable
```

---

## 5. Status Workflow Analysis

### Database Schema Constraint
```
status CHECK (status IN ('PENDING', 'APPROVED', 'CANCELLED'))
```

### UI Status Options (page.tsx:415-425)
```
PENDING ✅ Maps to DB
APPROVED ✅ Exists in DB  
CANCELLED ✅ Exists in DB
SENT ❌ Not in DB → Will fail
ACKNOWLEDGED ❌ Not in DB → Will fail
PARTIALLY_RECEIVED ❌ Not in DB → Will fail
COMPLETED ❌ Not in DB → Will fail
CLOSED ❌ Not in DB → Will fail
```

### Status Mapping Issue

Code tries to map on [line 1108](src/lib/services/modules-database.ts#L1108):
```typescript
if (dbStatus === 'pending') dbStatus = 'pending_approval';
```

But database only accepts 'PENDING' (uppercase).

**Result:** Status changes will always fail with constraint violations.

---

## 6. Confirmation & Reason Modal Implementations

### Modal #1: Create Purchase Order
**Type:** Inline form (not modal overlay)
**Location:** [page.tsx:900-1070](src/app/orders/page.tsx#L900-L1070)

**Components:**
- Vendor selector
- Project selector (optional)
- Delivery address textarea
- Payment terms textarea
- Line items editor table
- Bulk item selector (separate modal)
- Summary with totals

**CSS:** `.createCard`, `.createGrid`, `.lineTable`, `.orderSummary`

**Confirmation:** Uses standard `confirmAction()` dialog before creating

---

### Modal #2: Bulk Item Selector
**Type:** Overlay modal
**Location:** [page.tsx:1072-1135](src/app/orders/page.tsx#L1072-L1135)

**Features:**
- Search by product name or SKU
- Grid of checkboxes
- Shows: SKU, stock, unit, warehouse
- "Add N Items" button

**CSS:** `.bulkModalOverlay`, `.bulkModalContent`, `.bulkItemsList`, `.bulkItemCard`

---

### Modal #3: PO Details Viewer
**Type:** Overlay modal (read-only)
**Location:** [page.tsx:1137-1245](src/app/orders/page.tsx#L1137-L1245)

**Features:**
- Order header (vendor, status, date, total)
- Items table (product, qty, rate, GST%, amount)
- Summary (subtotal, GST, transport, grand total)
- Download PDF button

**CSS:** `.bulkModalContent`, `.poModalContent`

---

### Modal #4: Status Change ⚠️ INCONSISTENT
**Type:** Overlay modal (custom implementation)
**Location:** [page.tsx:1247-1310](src/app/orders/page.tsx#L1247-L1310)

**Problems:**
- ❌ Uses separate state: `statusChangeModal`
- ❌ Manual DOM query for reason: `document.getElementById('statusChangeReason')`
- ❌ Doesn't use `confirmAction()` pattern
- ❌ Inline form, not dialog-based
- ❌ Manual validation required

**Code:**
```typescript
// Separate state tracking
const [statusChangeModal, setStatusChangeModal] = useState<{ order: OrderRow; newStatus: string } | null>(null);

// Then manual DOM manipulation:
const reason = (document.getElementById('statusChangeReason') as HTMLTextAreaElement)?.value || '';
if (!reason.trim()) {
  showToast('Please provide a reason for the status change.', 'error');
  return;
}
```

**CSS:** `.bulkModalOverlay`, `.bulkModalContent`

---

### Modal #5: Quick Approve/Reject Buttons
**Type:** Inline row buttons
**Location:** [page.tsx:1335-1345](src/app/orders/page.tsx#L1335-L1345)

**Features:**
- ✅ Quick approve button (green)
- ❌ Quick reject button (gray)
- Triggers confirmation dialog

**CSS:** `.miniApprove`, `.miniReject`, `.inlineActions`

---

## 7. Styling CSS Analysis

### File: Orders.module.css (800+ lines)

#### Duplicate Classes Found:
1. `.statusPending` - Defined twice
   - [Line 551](src/app/orders/Orders.module.css#L551): `background: rgba(245, 158, 11, 0.15)`
   - [Line 580](src/app/orders/Orders.module.css#L580): `background: rgba(245, 158, 11, 0.1)` ← Different!

2. `.statusCancelled` - Defined twice
   - [Line 558](src/app/orders/Orders.module.css#L558): `background: rgba(239, 68, 68, 0.15)`
   - [Line 587](src/app/orders/Orders.module.css#L587): `background: rgba(239, 68, 68, 0.1)` ← Different!

#### Border Radius Inconsistency:
- Some elements: `border-radius: 0` (square)
- Some elements: `border-radius: var(--radius-md)`
- Some elements: `border-radius: var(--radius-lg)`

#### Input Padding Inconsistency:
| Element | Padding | Line |
|---------|---------|------|
| `.searchInput` | 6px 8px | 488 |
| `.vendorDetailInput` | 0.5rem | 195 |
| `.lineTable input` | 0.35rem | 230 |

Result: Vertical alignment issues

#### Color Usage Mix:
- Uses CSS variables: `var(--accent-primary)`
- Also uses hardcoded: `rgba(59, 130, 246, 0.05)`
- Should standardize on variables

### CSS Classes by Category:

**Layout:**
- `.container`, `.card`, `.header`, `.toolbar`, `.createCard`, `.createGrid`

**Modals:**
- `.bulkModalOverlay`, `.bulkModalContent`, `.bulkModalHeader`, `.bulkModalBody`, `.bulkModalFooter`

**Forms:**
- `.fieldLabel`, `.select`, `.searchInput`, `.vendorDetailInput`, `.lineTable`, `.lineTableWrapper`

**Status Badges:**
- `.statusBadge`, `.statusPending`, `.statusApproved`, `.statusCancelled`, `.statusCreated`

**Buttons:**
- `.primaryAction`, `.actionBtn`, `.miniBtn`, `.miniApprove`, `.miniReject`, `.submitBtn`, `.bulkConfirmBtn`, `.bulkCancelBtn`

**Tables:**
- `.table`, `.lineTable`, `.inlineActions`

---

## 8. API Error Handling

### Audit Endpoint: /api/audit/route.ts

**Implementation:**
```typescript
export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server audit client is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, entity_type, entity_id, entity_name, reason, ... } = body;

    const { data, error } = await supabaseAdmin
      .from('audit_trail')
      .insert({...})
      .select()
      .single();

    if (error) {
      console.error('Audit API Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Audit API Catch:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Issues:**
- ❌ Returns generic error messages
- ❌ No input validation
- ❌ No differentiation of error types
- ✅ Uses `.single()` correctly (after INSERT)

### Order Operations Error Handling

**Pattern:**
```typescript
try {
  // Operation
} catch (error) {
  console.error('Error message:', error);
  showToast('Failed message. Please try again.', 'error');
}
```

**Issues:**
- ❌ Generic toast messages
- ❌ No error classification
- ❌ Inventory failures don't stop approval
- ❌ No rollback on partial failures

---

## 9. Data Flow Issues

### Create Order Flow
```
1. User fills form (vendor, project, items)
2. Page.tsx: createPurchaseOrder()
3. modulesService.createOrder(input)
4. modules-database.ts: createOrder()
   ❌ BUG: Creates with po_number instead of order_number
   ❌ BUG: Deletes delivery_address then tries to use it
   ❌ BUG: Sets status to 'pending_approval' (not in DB)
   ❌ BUG: Missing GST data in items
5. Supabase INSERT
   → WILL FAIL with constraint violation
6. Audit trail logged (if order created)
```

### Approve Order Flow
```
1. User clicks approve button
2. confirmAction() dialog requests reason
3. Page.tsx: approveOrder()
4. inventoryService.recordMovement()
   → May fail silently
5. modulesService.addMovement()
6. modulesService.addAudit()
7. modulesService.updateOrderStatus()
   ❌ BUG: Maps 'APPROVED' to 'pending_approval'
   → UPDATE fails with constraint violation
8. Shows success toast regardless
```

### Status Change Flow
```
1. User clicks status menu button
2. setStatusChangeModal() opens custom modal
3. Manual reason input validation
4. changeOrderStatus() called
5. modulesService.updateOrderStatus()
   ❌ BUG: Status values don't match DB
   → UPDATE fails
```

---

## 10. Module Comparison - Styling Consistency

Checking against other modules for consistency:

**Query needed:** Compare CSS patterns in:
- [src/app/challans/Challans.module.css](src/app/challans/Challans.module.css)
- [src/app/inventory/Inventory.module.css](src/app/inventory/Inventory.module.css)
- [src/app/catalog/Products.module.css](src/app/catalog/Products.module.css)

**Status Badge Pattern:**
- Orders uses: `.statusBadge` with hardcoded colors
- Should standardize with other modules

---

## 11. Summary Table

| # | Issue | Severity | Type | Location | Impact |
|---|-------|----------|------|----------|--------|
| 1 | Status enum mismatch | 🔴 CRITICAL | Bug | [modules-database.ts:1107](src/lib/services/modules-database.ts#L1107) | DB constraint violation |
| 2 | Wrong column name (po_number) | 🔴 CRITICAL | Bug | [modules-database.ts:1049](src/lib/services/modules-database.ts#L1049) | INSERT fails |
| 3 | Delivery address deletion | 🔴 CRITICAL | Bug | [modules-database.ts:1052](src/lib/services/modules-database.ts#L1052) | Data loss |
| 4 | Missing order items data | 🔴 CRITICAL | Bug | [modules-database.ts:1079](src/lib/services/modules-database.ts#L1079) | Incomplete records |
| 5 | Inconsistent modals | 🟡 HIGH | Design | [page.tsx:350-1310](src/app/orders/page.tsx#L350-L1310) | Code duplication |
| 6 | Warehouse validation weak | 🟡 HIGH | Logic | [page.tsx:375](src/app/orders/page.tsx#L375) | Incomplete workflow |
| 7 | Vendor loading inefficient | 🟡 MEDIUM | Performance | [page.tsx:125](src/app/orders/page.tsx#L125) | Slow page load |
| 8 | Duplicate return | 🟡 LOW | Code | [modules-database.ts:1035](src/lib/services/modules-database.ts#L1035) | Dead code |
| 9 | Duplicate CSS classes | 🟡 MEDIUM | Styling | [Orders.module.css:551,580,558,587](src/app/orders/Orders.module.css#L551) | Maintenance issue |
| 10 | Inconsistent padding | 🟡 MEDIUM | Styling | [Orders.module.css](src/app/orders/Orders.module.css) | Visual inconsistency |

---

## 12. Recommended Fixes Priority

### Phase 1 (Critical - Day 1):
1. Fix status enum mapping
2. Fix column name (po_number → order_number)  
3. Fix delivery address deletion
4. Fix missing items data

### Phase 2 (High - Week 1):
5. Consolidate confirmation modals
6. Add proper warehouse validation
7. Improve error handling

### Phase 3 (Medium - Week 2):
8. Remove duplicate CSS
9. Standardize input styling
10. Optimize vendor loading

---

**Document Version:** 1.0
**Generated:** 2026-04-23
**Analysis Depth:** File-level with line numbers

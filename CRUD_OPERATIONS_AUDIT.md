# CRUD Operations Audit - Inventory Management System

## 1. VENDORS MODULE

### Create Vendor
- **Function Name**: `saveVendor` (handles both create and update)
- **Location**: [src/app/vendors/page.tsx](src/app/vendors/page.tsx#L277)
- **Component Type**: React page component
- **Parameters**:
  - `form: VendorFormState` - Form state object containing:
    - `name: string` - Vendor name (required)
    - `contact_person: string` - Contact person name
    - `phone: string` - Phone number
    - `email: string` - Email address
    - `address: string` - Delivery address
    - `gstin: string` - GST number
    - `payment_terms: string` - Payment terms
    - `status: VendorStatus` - 'ACTIVE' or 'INACTIVE'
- **Returns**: Promise (success toast shown)
- **Database Operation**: Supabase `.insert(payload).select('id')`
- **Fallback Support**: Yes (handles schema variations with fallback inserts)

### Edit/Update Vendor
- **Function Name**: `saveVendor` (same function, checks `editingVendor` state)
- **Location**: [src/app/vendors/page.tsx](src/app/vendors/page.tsx#L277)
- **Component Type**: React page component
- **Parameters**: Same as Create (form object)
- **Returns**: Promise (success toast shown)
- **Database Operation**: Supabase `.update(payload).eq('id', editingVendor.id)`
- **Fallback Support**: Yes (handles schema variations)
- **Local Storage**: Saves extended vendor details to `ims_vendor_details_v1` key

### Delete Vendor
- **Function Name**: `deleteVendor`
- **Location**: [src/app/vendors/page.tsx](src/app/vendors/page.tsx#L319)
- **Component Type**: React page component
- **Parameters**:
  - `vendor: VendorRecord` - Vendor object to delete containing id, name, etc.
- **Returns**: Promise (success/error toast)
- **Database Operation**: Supabase `.delete().eq('id', vendor.id)`
- **Audit Trail**: Logs 'Vendor Deleted' action with reason and performer email
- **Requires**: Confirmation dialog with reason input

### Change Vendor Status
- **Function Name**: `toggleVendorStatus`
- **Location**: [src/app/vendors/page.tsx](src/app/vendors/page.tsx#L305)
- **Component Type**: React page component
- **Parameters**:
  - `vendor: VendorRecord` - Vendor object
- **Returns**: Promise (updates local state)
- **Status Values**: 'ACTIVE' ↔ 'INACTIVE'
- **Audit Trail**: Logs 'Vendor Status Changed' action with reason

### Retrieve Vendors
- **Function Name**: `getVendors`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1983)
- **Service File**: Database service
- **Returns**: `Promise<any[]>` - Array of vendor records
- **Database Operation**: Supabase `.select('*').order('name')`

---

## 2. PAYMENTS MODULE

### Create Payment Slip
- **Function Name**: `createPaymentSlip`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1769)
- **Service File**: Database service
- **Parameters**:
  - `slip: Partial<PaymentSlipRow>` - Payment slip object with:
    - `slip_no?: string` - Slip number (auto-generated if not provided)
    - `date: string` - Payment date
    - `due_date?: string` - Due date
    - `vendor_name: string` - Vendor name (required)
    - `po_ref?: string` - Purchase order reference
    - `amount: number` - Payment amount
    - `payment_method: string` - 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI'
    - `ref_no?: string` - Reference number
    - `status?: string` - 'ISSUED', 'DUE', 'PAID'
    - `remarks?: string` - Remarks
  - `userId: string` - User ID of creator
- **Returns**: `Promise<{ id: string; slip_no: string }>`
- **Database Operations**: 
  - Primary: Supabase insert to `payment_slips` table
  - Fallback: Insert to legacy `payments` table if schema issue
- **Validation**: 
  - Vendor name required
  - Amount must be > 0
- **Fallback Support**: Yes (handles schema variations)

### Update Payment Status
- **Function Name**: `updatePaymentSlip`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1838)
- **Service File**: Database service
- **Parameters**:
  - `slipId: string` - ID of payment slip
  - `input: Partial<PaymentSlipRow>` - Fields to update:
    - `date?: string`
    - `due_date?: string`
    - `vendor_name?: string`
    - `po_ref?: string`
    - `amount?: number`
    - `payment_method?: string`
    - `ref_no?: string`
    - `status?: string` - 'ISSUED', 'DUE', 'PAID'
    - `remarks?: string`
- **Returns**: `Promise<PaymentSlipRow>`
- **UI Component**: [src/app/site-records/page.tsx](src/app/site-records/page.tsx#L217) - `updateSlipStatus` function
- **UI Function Call**: Called from site-records page with status parameter

### Delete Payment Slip
- **Function Name**: `deletePaymentSlip`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1856)
- **Service File**: Database service
- **Parameters**:
  - `slipId: string` - ID of payment slip to delete
  - `_userId: string` - User ID (parameter unused but logged)
- **Returns**: `Promise<void>`
- **Database Operation**: Supabase `.delete().eq('id', slipId)`

### Create Payment (UI)
- **Function Name**: `handleCreatePayment`
- **Location**: [src/app/site-records/page.tsx](src/app/site-records/page.tsx#L239)
- **Component Type**: React page component
- **Parameters**: Form submission event
- **State Used**: `newPayment` object
- **Calls Service**: `modulesService.createPaymentSlip()`
- **Audit Trail**: Logs 'PAYMENT_CREATED' action

### Record Payment (Legacy)
- **Location**: [src/app/site-records/page.tsx](src/app/site-records/page.tsx#L328)
- **Component Type**: React page component
- **Description**: UI tab for "Payment Slips" with create/edit capabilities

### Retrieve Payment Slips
- **Function Name**: `getPaymentSlips`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1740)
- **Returns**: `Promise<PaymentSlipRow[]>`
- **Database Operation**: Attempts multiple table names for schema compatibility

---

## 3. DELIVERIES MODULE

### Create Delivery Receipt
- **Function Name**: `createDeliveryReceipt`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1561)
- **Service File**: Database service
- **Parameters**:
  - `receipt: Partial<DeliveryReceiptRow>` - Receipt object with:
    - `receipt_no?: string` - Receipt number (auto-generated if not provided)
    - `type: string` - 'SITE_DELIVERY' or 'STORE_DELIVERY'
    - `date: string` - Receipt date
    - `project_name: string` - Project name
    - `vendor_name?: string` - Vendor name
    - `receiver_name?: string` - Receiver name
    - `contact?: string` - Contact number
    - `linked_po?: string` - Linked purchase order
    - `status?: string` - 'VERIFIED', 'PENDING', 'DAMAGED'
    - `remarks?: string` - Remarks
  - `items: Array<{ name, quantity, unit, variant_id?, condition? }>` - Receipt items
  - `userId: string` - User ID of creator
- **Returns**: `Promise<{ id: string; receipt_no: string }>`
- **Database Operations**:
  - Primary: Inserts to `delivery_receipts` table
  - Items: Inserts to `delivery_receipt_items` table
  - Fallback: Inserts to legacy `receipts` table if schema issue
  - BOQ Sync: Updates BOQ item's `delivered` quantity
- **Validation**: 
  - Project name required
  - At least one item required
- **Audit Trail**: Logs 'RECEIPT_CREATED' action

### Complete/Mark Delivery as Received
- **Function Name**: `updateDeliveryReceipt` (implicit via `createDeliveryReceipt` with status update)
- **Location**: [src/app/site-records/page.tsx](src/app/site-records/page.tsx#L120)
- **Component Type**: React page component
- **Method**: Creates new receipt with final status
- **Status Values**: 'VERIFIED', 'PENDING', 'DAMAGED'

### Delete Delivery Receipt
- **Function Name**: `deleteDeliveryReceipt`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1689)
- **Service File**: Database service
- **Parameters**:
  - `receiptId: string` - ID of receipt to delete
  - `userId: string` - User ID performing deletion
- **Returns**: `Promise<void>`
- **Database Operations**:
  - Fetches receipt and items
  - Reverts BOQ delivered quantities
  - Deletes items from `delivery_receipt_items`
  - Deletes receipt from `delivery_receipts` or `receipts`
- **Cleanup**: Handles BOQ sync reversal

### Record Delivery (UI)
- **Function Name**: `handleCreateReceipt`
- **Location**: [src/app/site-records/page.tsx](src/app/site-records/page.tsx#L120)
- **Component Type**: React page component
- **Calls**: `modulesService.createDeliveryReceipt()`
- **Confirmation**: Requires confirmation dialog
- **Audit Trail**: Logs receipt creation

### Retrieve Delivery Receipts
- **Function Name**: `getDeliveryReceipts`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1518)
- **Returns**: `Promise<DeliveryReceiptRow[]>`
- **Robustness**: Tries multiple table names for compatibility

---

## 4. CHALLANS MODULE

### Create Challan
- **Function Name**: `createChallan`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1332)
- **Service File**: Database service
- **Parameters**:
  - `challanNo: string` - Challan number (e.g., 'CH-2024-04-0001-ABC')
  - `poNo: string` - Purchase order number reference
  - `projectName: string` - Project name (required)
  - `vendorName: string` - Vendor name
  - `dispatchDate: string` - Dispatch date in ISO format
  - `items: Array<{ name, quantity, unit, variant_id? }>` - Items to dispatch
  - `userId: string` - User ID creating challan (required)
  - `projectId?: string` - Optional project UUID
  - `vendorId?: string` - Optional vendor UUID
- **Returns**: `Promise<{ id: string; challan_no: string }>`
- **Database Operations**:
  - Inserts to `challans` table
  - Inserts items to `challan_items` table
  - Updates BOQ items with delivered quantity
- **Validation**: All required parameters must be provided
- **Initial Status**: 'ISSUED'
- **BOQ Sync**: Updates BOQ items' delivered quantities

### Update Challan Status
- **Function Name**: `updateChallanStatus`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1416)
- **Service File**: Database service
- **Parameters**:
  - `challanId: string` - ID of challan to update
  - `newStatus: 'ISSUED' | 'DISPATCHED' | 'DELIVERED'` - New status
  - `userId: string` - User ID performing update
- **Returns**: `Promise<void>`
- **Status Transitions**:
  - 'ISSUED' → 'DISPATCHED', 'CANCELLED'
  - 'DISPATCHED' → 'DELIVERED'
  - 'DELIVERED' → (no transitions, final state)
- **Validation**: Enforces valid state transitions
- **UI Call**: From [src/app/challans/page.tsx](src/app/challans/page.tsx#L226) - `updateStatus` function

### Delete Challan
- **Function Name**: `deleteChallan`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1449)
- **Service File**: Database service
- **Parameters**:
  - `challanId: string` - ID of challan to delete
  - `userId: string` - User ID performing deletion
- **Returns**: `Promise<void>`
- **Database Operation**: Supabase `.delete().eq('id', challanId)`
- **Cleanup**: Deletes associated items from `challan_items`

### Dispatch Challan (UI)
- **Function Name**: `createChallan` (from page component)
- **Location**: [src/app/challans/page.tsx](src/app/challans/page.tsx#L140)
- **Component Type**: React page component
- **Generates**: Challan number using date-based prefix
- **Calls Service**: `modulesService.createChallan()`
- **Confirmation**: Requires confirmation dialog
- **Audit Trail**: Implicit via service layer

### Retrieve Challans
- **Function Name**: `getChallans`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L1256)
- **Returns**: `Promise<ChallanRow[]>`
- **Features**: Fetches challans with associated items grouped by challan ID

---

## 5. USERS MODULE

### Create User
- **Function Name**: `createUser`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L803)
- **Also**: API endpoint at [src/app/api/auth/create-user/route.ts](src/app/api/auth/create-user/route.ts)
- **Service File**: Database service (calls API endpoint)
- **Parameters**:
  - `input` object:
    - `full_name: string` - User full name (required)
    - `email: string` - Email address (required, must be unique)
    - `temporary_password: string` - Initial password (required)
    - `role_id: string` - Role ID to assign (required)
- **Returns**: `Promise<UserAccessRow>`
- **API Method**: POST `/api/auth/create-user`
- **Authorization**: Admin-only (verified via `is_admin` flag or role_id 'r1'/'r2')
- **Operations**:
  1. Creates Supabase auth user
  2. Creates user_profiles record
  3. Sets initial status to 'ACTIVE'
  4. Sets requires_password_change to true
  5. Logs to audit_trail with 'USER_CREATED' action
- **Returns**: User profile object with new user details
- **UI Component**: [src/app/users/page.tsx](src/app/users/page.tsx#L202) - `createUser` function

### Disable/Enable User
- **Function Name**: `toggleUserStatus`
- **Location**: [src/app/users/page.tsx](src/app/users/page.tsx#L261)
- **Component Type**: React page component
- **Parameters**:
  - `userId: string` - ID of user to toggle
- **Returns**: Promise (updates local state)
- **Status Values**: 'ACTIVE' ↔ 'DISABLED'
- **Constraints**: Super Admin (role_id 'r1') cannot be disabled
- **Calls Service**: `modulesService.saveUser()` with updated status

### Update User Role
- **Function Name**: `handleEditUser`
- **Location**: [src/app/users/page.tsx](src/app/users/page.tsx#L222)
- **Component Type**: React page component
- **Parameters**: Updated user form with new role_id
- **Calls Service**: `modulesService.updateUserDetails()`
- **Updates**: full_name, email, and role_id

### Update User Details
- **Function Name**: `updateUserDetails`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L721)
- **Service File**: Database service
- **Parameters**:
  - `userId: string` - User ID
  - `details: { full_name, email, role_id }` - Fields to update
- **Returns**: `Promise<void>`

### Change User Password
- **Function Name**: `handleChangePassword`
- **Location**: [src/app/users/page.tsx](src/app/users/page.tsx#L228)
- **Component Type**: React page component
- **Calls Service**: `modulesService.changeUserPassword()`
- **Validation**: Password confirmation required

### Retrieve Users
- **Function Name**: `getUsers`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L665)
- **Returns**: `Promise<UserAccessRow[]>`
- **Database Operation**: Fetches from `user_profiles` with role information

### Create Role
- **Function Name**: `createRole`
- **Location**: [src/app/users/page.tsx](src/app/users/page.tsx#L297)
- **Component Type**: React page component
- **Parameters**:
  - `input: { name: string; permission_keys?: string[] }`
- **Calls Service**: `modulesService.createRole()`
- **Returns**: Promise (success toast)

### Update Role Permissions
- **Function Name**: `saveRoleChanges`
- **Location**: [src/app/users/page.tsx](src/app/users/page.tsx#L281)
- **Component Type**: React page component
- **Parameters**:
  - `roleId: string`
  - `name: string`
  - `permission_keys: string[]`
- **Calls Service**: `modulesService.updateRole()`

### Retrieve Roles
- **Function Name**: `getRoles`
- **Location**: [src/lib/services/modules-database.ts](src/lib/services/modules-database.ts#L865)
- **Returns**: `Promise<RoleRow[]>`
- **Database Operation**: Fetches from `roles` table with permission_keys

---

## Summary Table

| Module | Operation | Function Name | Location | Type | Service |
|--------|-----------|---------------|----------|------|---------|
| **Vendors** | Create | saveVendor | vendors/page.tsx | UI | Supabase Direct |
| **Vendors** | Update | saveVendor | vendors/page.tsx | UI | Supabase Direct |
| **Vendors** | Delete | deleteVendor | vendors/page.tsx | UI | Supabase Direct |
| **Vendors** | Status Change | toggleVendorStatus | vendors/page.tsx | UI | Supabase Direct |
| **Vendors** | Retrieve | getVendors | modules-database.ts | Service | Supabase |
| **Payments** | Create | createPaymentSlip | modules-database.ts | Service | Supabase |
| **Payments** | Update Status | updatePaymentSlip | modules-database.ts | Service | Supabase |
| **Payments** | Delete | deletePaymentSlip | modules-database.ts | Service | Supabase |
| **Payments** | Retrieve | getPaymentSlips | modules-database.ts | Service | Supabase |
| **Deliveries** | Create Receipt | createDeliveryReceipt | modules-database.ts | Service | Supabase |
| **Deliveries** | Delete Receipt | deleteDeliveryReceipt | modules-database.ts | Service | Supabase |
| **Deliveries** | Retrieve | getDeliveryReceipts | modules-database.ts | Service | Supabase |
| **Challans** | Create | createChallan | modules-database.ts | Service | Supabase |
| **Challans** | Update Status | updateChallanStatus | modules-database.ts | Service | Supabase |
| **Challans** | Delete | deleteChallan | modules-database.ts | Service | Supabase |
| **Challans** | Retrieve | getChallans | modules-database.ts | Service | Supabase |
| **Users** | Create | createUser | modules-database.ts + API | Service+API | Supabase Auth |
| **Users** | Disable/Enable | toggleUserStatus | users/page.tsx | UI | Service |
| **Users** | Update Role | handleEditUser | users/page.tsx | UI | Service |
| **Users** | Change Password | handleChangePassword | users/page.tsx | UI | Service |
| **Users** | Retrieve | getUsers | modules-database.ts | Service | Supabase |
| **Users** | Create Role | createRole | users/page.tsx | UI | Service |
| **Users** | Update Role Perms | updateRole | modules-database.ts | Service | Supabase |
| **Users** | Retrieve Roles | getRoles | modules-database.ts | Service | Supabase |

---

## Key Architecture Notes

1. **Direct vs Service Layer**:
   - Vendors: Mostly direct Supabase calls from UI component
   - Payments, Deliveries, Challans, Users: Database service layer wrapper

2. **Fallback Patterns**:
   - Payment Slips: Falls back to `payments` table if schema issue
   - Delivery Receipts: Falls back to `receipts` table if schema issue
   - Challans: No fallback (single table)

3. **Audit Trail**:
   - Vendors: Logged on status change and deletion
   - Users: Logged on creation
   - Payments: Logged on creation
   - Deliveries: Logged on creation and deletion
   - Challans: Implicit via service layer

4. **Local Storage Cache**:
   - Vendors: Extended vendor details stored in `ims_vendor_details_v1` key
   - Vendors: Used as fallback when DB schema has issues

5. **BOQ Synchronization**:
   - Challans: Updates BOQ items' delivered quantity on creation
   - Deliveries: Updates BOQ items' delivered quantity on creation/deletion
   - Reversal: Deletion operations decrement delivered quantities

6. **Status Transitions**:
   - Vendors: ACTIVE ↔ INACTIVE
   - Payment Slips: ISSUED → DUE → PAID (auto-calculated based on due_date)
   - Challans: ISSUED → DISPATCHED → DELIVERED (strict state machine)
   - Users: ACTIVE ↔ DISABLED (with protection for Super Admin)

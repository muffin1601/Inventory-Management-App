// Production-ready modules service using Supabase database
// This replaces the localStorage-based user management

import { supabase } from '@/lib/supabase';
import type {
  UserAccessRow,
  RoleRow,
  AuditTrailRow,
  PermissionRow,
  OrderRow,
  ChallanRow,
  DeliveryReceiptRow,
  PaymentSlipRow,
  InventorySnapshotRow,
  StockMovementRow,
  LoginErrorCode,
} from '@/types/modules';

// Helper to determine if an error is due to a missing table or column
function isSchemaError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = (error.message || '').toLowerCase();
  return (
    code === 'PGRST204' || // Table not found
    code === 'PGRST205' || // Schema not found
    code === '42P01' ||    // Undefined table
    code === '42703' ||    // Undefined column
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('relation')
  );
}

function isAuthLockRaceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: string };
  const message = (candidate.message || '').toLowerCase();
  return message.includes('auth-token') && message.includes('another request stole it');
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

async function findVendorIdByName(name: string): Promise<string | null> {
  const normalized = name.trim();
  if (!normalized) return null;
  const { data, error } = await supabase.from('vendors').select('id').ilike('name', normalized).limit(1);
  if (error) {
    if (isSchemaError(error)) return null;
    throw error;
  }
  return data && data.length > 0 ? data[0].id : null;
}

async function ensureVendor(name: string): Promise<string | null> {
  const existingId = await findVendorIdByName(name);
  if (existingId) return existingId;
  const { data, error } = await supabase.from('vendors').insert({ name: name.trim() }).select('id').single();
  if (error) {
    if (isSchemaError(error)) return null;
    throw error;
  }
  return data?.id || null;
}

async function findProjectIdByName(name: string): Promise<string | null> {
  const normalized = name.trim();
  if (!normalized) return null;
  const { data, error } = await supabase.from('projects').select('id').ilike('name', normalized).limit(1);
  if (error) {
    if (isSchemaError(error)) return null;
    throw error;
  }
  return data && data.length > 0 ? data[0].id : null;
}

async function loadVariantNames(variantIds: string[]) {
  if (variantIds.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from('variants')
    .select('id, sku, product:products(name)')
    .in('id', variantIds);
  const map = new Map<string, string>();
  if (!error && data) {
    data.forEach((row: any) => {
      const name = row.product?.name || row.sku || '';
      map.set(row.id, name);
    });
  }
  return map;
}

const CHALLANS_KEY = 'ims_challans_v1';
const DELIVERY_RECEIPTS_KEY = 'ims_delivery_receipts_v1';
const PAYMENT_SLIPS_KEY = 'ims_payment_slips_v1';

function readLocalData<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalData<T>(key: string, rows: T[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(rows));
}

// Permission definitions
const PERMISSIONS: PermissionRow[] = [
  { id: 'p1', key: 'dashboard.view', label: 'View Dashboard', module: 'Dashboard', description: 'Open the live dashboard and business summary.' },
  { id: 'p2', key: 'products.view', label: 'View Item Catalog', module: 'Catalog', description: 'Open item catalog and see product details.' },
  { id: 'p3', key: 'products.create', label: 'Create Items', module: 'Catalog', description: 'Add new products and variants.' },
  { id: 'p4', key: 'products.edit', label: 'Edit Items', module: 'Catalog', description: 'Edit existing product and variant details.' },
  { id: 'p5', key: 'products.delete', label: 'Delete Items', module: 'Catalog', description: 'Remove products or variants from active use.', admin_only: true },
  { id: 'p6', key: 'stock.view', label: 'View Stock Management', module: 'Stock', description: 'See stock rows, promised stock, and free stock.' },
  { id: 'p7', key: 'inventory.view', label: 'View Inventory Flow', module: 'Inventory', description: 'Open stock movement and warehouse flow screens.' },
  { id: 'p8', key: 'inventory.adjust', label: 'Adjust Stock', module: 'Inventory', description: 'Receive, issue, or edit stock quantities.' },
  { id: 'p9', key: 'inventory.transfer', label: 'Transfer Stock', module: 'Inventory', description: 'Move stock between warehouses.' },
  { id: 'p10', key: 'projects.view', label: 'View Projects & BOQ', module: 'Projects', description: 'Open project list and BOQ details.' },
  { id: 'p11', key: 'projects.create', label: 'Create Projects', module: 'Projects', description: 'Create new projects.' },
  { id: 'p12', key: 'projects.edit', label: 'Edit Projects', module: 'Projects', description: 'Edit project information.' },
  { id: 'p13', key: 'projects.delete', label: 'Delete Projects', module: 'Projects', description: 'Delete or archive projects.', admin_only: true },
  { id: 'p14', key: 'boq.view', label: 'View BOQ', module: 'Projects', description: 'See bill of quantities and progress.' },
  { id: 'p15', key: 'boq.create', label: 'Create BOQ Items', module: 'Projects', description: 'Add new BOQ lines.' },
  { id: 'p16', key: 'boq.edit', label: 'Edit BOQ Items', module: 'Projects', description: 'Update BOQ lines and delivered quantity.' },
  { id: 'p17', key: 'boq.delete', label: 'Delete BOQ Items', module: 'Projects', description: 'Remove BOQ lines.', admin_only: true },
  { id: 'p18', key: 'vendors.view', label: 'View Vendors', module: 'Vendors', description: 'Open supplier records.' },
  { id: 'p19', key: 'vendors.create', label: 'Create Vendors', module: 'Vendors', description: 'Add vendor records.' },
  { id: 'p20', key: 'vendors.edit', label: 'Edit Vendors', module: 'Vendors', description: 'Update supplier details and status.' },
  { id: 'p21', key: 'vendors.delete', label: 'Delete Vendors', module: 'Vendors', description: 'Delete supplier records.', admin_only: true },
  { id: 'p22', key: 'orders.view', label: 'View Purchase Orders', module: 'Orders', description: 'Open purchase orders and order history.' },
  { id: 'p23', key: 'orders.create', label: 'Create Purchase Orders', module: 'Orders', description: 'Create new purchase orders.' },
  { id: 'p24', key: 'orders.approve', label: 'Approve Purchase Orders', module: 'Orders', description: 'Approve pending orders and post stock impact.' },
  { id: 'p25', key: 'orders.cancel', label: 'Cancel Purchase Orders', module: 'Orders', description: 'Reject or cancel orders.' },
  { id: 'p26', key: 'challans.view', label: 'View Challans', module: 'Challans', description: 'Open dispatch challans and shipment tracking.' },
  { id: 'p27', key: 'challans.create', label: 'Create Challans', module: 'Challans', description: 'Create delivery challans.' },
  { id: 'p28', key: 'challans.update_status', label: 'Update Challan Status', module: 'Challans', description: 'Generate gate pass and mark delivery completion.' },
  { id: 'p29', key: 'challans.delete', label: 'Delete Challans', module: 'Challans', description: 'Delete challans.', admin_only: true },
  { id: 'p30', key: 'deliveries.view', label: 'View Delivery Records', module: 'Deliveries', description: 'Open receipt and delivery records.' },
  { id: 'p31', key: 'deliveries.create', label: 'Create Delivery Records', module: 'Deliveries', description: 'Record material receipts.' },
  { id: 'p32', key: 'deliveries.delete', label: 'Delete Delivery Records', module: 'Deliveries', description: 'Delete receipt records.', admin_only: true },
  { id: 'p33', key: 'payments.view', label: 'View Payment Slips', module: 'Payments', description: 'Open payment and due tracking.' },
  { id: 'p34', key: 'payments.create', label: 'Create Payment Slips', module: 'Payments', description: 'Create payment records.' },
  { id: 'p35', key: 'payments.edit', label: 'Edit Payment Status', module: 'Payments', description: 'Mark payment slips due or paid.' },
  { id: 'p36', key: 'payments.delete', label: 'Delete Payment Slips', module: 'Payments', description: 'Delete payment records.', admin_only: true },
  { id: 'p37', key: 'payments.financial_view', label: 'View Financial Data', module: 'Payments', description: 'See financial amounts and due values.' },
  { id: 'p38', key: 'rate_inquiry.view', label: 'View Rate Inquiry', module: 'Rate Inquiry', description: 'Open rate inquiry and comparison flows.' },
  { id: 'p39', key: 'rate_inquiry.create', label: 'Create Rate Inquiry', module: 'Rate Inquiry', description: 'Create rate inquiry or comparison records.' },
  { id: 'p40', key: 'reports.view', label: 'View Reports', module: 'Reports', description: 'Open reports and export workspace.' },
  { id: 'p41', key: 'reports.export', label: 'Export Reports', module: 'Reports', description: 'Download CSV and export files.' },
  { id: 'p42', key: 'audit.view', label: 'View Audit Trail', module: 'Audit', description: 'Open audit activity and trace changes.' },
  { id: 'p43', key: 'users.view', label: 'View Users', module: 'Users', description: 'Open user and role management.' },
  { id: 'p44', key: 'users.invite', label: 'Create Users', module: 'Users', description: 'Invite and create new users.' },
  { id: 'p45', key: 'users.edit', label: 'Edit Users', module: 'Users', description: 'Change user role and profile.' },
  { id: 'p46', key: 'users.disable', label: 'Enable or Disable Users', module: 'Users', description: 'Control whether a user can sign in.', admin_only: true },
  { id: 'p47', key: 'roles.manage', label: 'Manage Roles & Permissions', module: 'Users', description: 'Create roles and assign permission sets.', admin_only: true },
];

const ROUTE_PERMISSION_MAP: Array<{ pattern: RegExp; permission: string }> = [
  { pattern: /^\/$/, permission: 'dashboard.view' },
  { pattern: /^\/dashboard$/, permission: 'dashboard.view' },
  { pattern: /^\/catalog$/, permission: 'products.view' },
  { pattern: /^\/stock$/, permission: 'stock.view' },
  { pattern: /^\/inventory$/, permission: 'inventory.view' },
  { pattern: /^\/projects(\/.*)?$/, permission: 'projects.view' },
  { pattern: /^\/vendors$/, permission: 'vendors.view' },
  { pattern: /^\/orders$/, permission: 'orders.view' },
  { pattern: /^\/rate-inquiry$/, permission: 'rate_inquiry.view' },
  { pattern: /^\/challans$/, permission: 'challans.view' },
  { pattern: /^\/site-records$/, permission: 'deliveries.view' },
  { pattern: /^\/payments$/, permission: 'payments.view' },
  { pattern: /^\/reports$/, permission: 'reports.view' },
  { pattern: /^\/audit$/, permission: 'audit.view' },
  { pattern: /^\/users$/, permission: 'users.view' },
];

const FALLBACK_ROLES: RoleRow[] = [
  { id: 'r1', name: 'Super Admin', permission_keys: PERMISSIONS.map(p => p.key) },
  { id: 'r2', name: 'Admin', permission_keys: PERMISSIONS.filter(p => !p.admin_only).map(p => p.key) },
  { id: 'r3', name: 'Purchase Manager', permission_keys: ['dashboard.view', 'products.view', 'projects.view', 'vendors.view', 'orders.view'] },
  { id: 'r4', name: 'Store Manager', permission_keys: ['dashboard.view', 'products.view', 'stock.view', 'inventory.view', 'challans.view'] },
  { id: 'r5', name: 'Accounts', permission_keys: ['dashboard.view', 'payments.view', 'reports.view'] },
  { id: 'r6', name: 'Viewer', permission_keys: ['dashboard.view', 'products.view', 'projects.view'] },
];

function resolveRoleName(roleId: string, roleFromQuery?: any): string {
  if (roleFromQuery?.name) return roleFromQuery.name;
  const fallback = FALLBACK_ROLES.find(r => r.id === roleId);
  if (fallback) return fallback.name;
  if (roleId === 'r1') return 'Super Admin';
  if (roleId === 'r2') return 'Admin';
  return 'Unknown';
}

// Database-based modules service
export const modulesService = {
  _roles: [] as RoleRow[],
  _initialized: false,
  _currentUserPromise: null as Promise<UserAccessRow | null> | null,
  _currentUserCache: null as UserAccessRow | null,
  _currentUserCacheAt: 0,
  _refreshRolesPromise: null as Promise<void> | null,

  async refreshRoles() {
    if (this._initialized && this._roles.length > 0) return;
    if (this._refreshRolesPromise) return this._refreshRolesPromise;

    this._refreshRolesPromise = (async () => {
      // 1. LocalStorage cache check for faster startup
      if (typeof window !== 'undefined' && !this._initialized) {
        const saved = localStorage.getItem('ims_roles_cache_v1');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this._roles = parsed;
              this._initialized = true;
            }
          } catch (e) {
            localStorage.removeItem('ims_roles_cache_v1');
          }
        }
      }

      // If still not initialized, fetch from database
      try {
        const rolesPromise = supabase.from('roles').select('*');
        const timeoutPromise = new Promise<{ data: RoleRow[] | null; error: any }>((resolve) => {
          setTimeout(() => resolve({ data: null, error: new Error('Role fetch timed out') }), 5000);
        });

        const { data, error } = await Promise.race([rolesPromise, timeoutPromise]) as {
          data: RoleRow[] | null;
          error: any;
        };
        if (error) {
          console.warn('Role refresh timed out or failed, falling back to cached/default roles:', error);
        }

        if (data && data.length > 0) {
          this._roles = data.map(r => ({
            id: r.id,
            name: r.name,
            permission_keys: r.permission_keys || []
          }));
          this._initialized = true;

          // Update LocalStorage cache
          if (typeof window !== 'undefined') {
            localStorage.setItem('ims_roles_cache_v1', JSON.stringify(this._roles));
          }
        } else if (!this._initialized) {
          // Seed initial roles if none exist and not already initialized from cache
          console.log('Roles table empty, seeding initial roles...');
          await supabase.from('roles').insert(FALLBACK_ROLES);
          this._roles = FALLBACK_ROLES;
          this._initialized = true;
        }
      } catch (e) {
        console.error('Error refreshing roles:', e);
      } finally {
        this._refreshRolesPromise = null;
      }
    })();

    return this._refreshRolesPromise;
  },

  // Authentication methods
  async signIn(email: string, password: string) {
    this._currentUserPromise = null;
    this._currentUserCache = null;
    this._currentUserCacheAt = 0;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      // Return detailed error information
      const errorCode = this.mapAuthError(error);
      return {
        user: null,
        error: {
          code: errorCode,
          message: this.getErrorMessage(errorCode),
        },
      };
    }

    if (data.user) {
      // Update last active time
      await supabase
        .from('user_profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', data.user.id);

      // Get user profile - use limit(1) to avoid PGRST116
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          roles:role_id (
            id,
            name,
            permission_keys
          )
        `)
        .eq('id', data.user.id)
        .limit(1);

      if (profileError || !profiles || profiles.length === 0) {
        console.error('Profile fetch error:', profileError || 'Profile not found');
        return {
          user: null,
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'Your user profile could not be found. Contact administrator.',
          },
        };
      }

      const profile = profiles[0];

      // Check if user is active
      if (profile.status === 'DISABLED') {
        await supabase.auth.signOut();
        return {
          user: null,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Your account has been disabled. Contact administrator.',
          },
        };
      }

      if (profile.status === 'PENDING') {
        await supabase.auth.signOut();
        return {
          user: null,
          error: {
            code: 'ACCOUNT_PENDING',
            message: 'Your account is pending approval. Please try again later.',
          },
        };
      }

      const userProfile = {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: resolveRoleName(profile.role_id, profile.roles),
        status: profile.status,
        custom_permission_keys: profile.custom_permission_keys || [],
        revoked_permission_keys: profile.revoked_permission_keys || [],
        temporary_password: profile.temporary_password,
        last_active_at: profile.last_active_at,
      } as UserAccessRow;

      this._currentUserCache = userProfile;
      this._currentUserCacheAt = Date.now();

      return {
        user: userProfile,
        error: null,
      };
    }

    return {
      user: null,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    };
  },

  // Helper methods for error handling
  mapAuthError(error: any): LoginErrorCode {
    const message = (error.message || '').toLowerCase();
    const status = error.status;

    if (message.includes('invalid login credentials')) {
      return 'INVALID_CREDENTIALS';
    }
    if (message.includes('user not found') || status === 404) {
      return 'USER_NOT_FOUND';
    }
    if (message.includes('database')) {
      return 'DATABASE_ERROR';
    }

    return 'UNKNOWN_ERROR';
  },

  getErrorMessage(code: LoginErrorCode): string {
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Incorrect email or password. Please try again.';
      case 'USER_NOT_FOUND':
        return 'No account found with this email address.';
      case 'ACCOUNT_DISABLED':
        return 'Your account has been disabled. Contact administrator.';
      case 'ACCOUNT_PENDING':
        return 'Your account is pending approval. Please try again later.';
      case 'PROFILE_NOT_FOUND':
        return 'Your user profile could not be found. Contact administrator.';
      case 'DATABASE_ERROR':
        return 'Database error. Please try again or contact support.';
      case 'UNKNOWN_ERROR':
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    this._currentUserCache = null;
    this._currentUserCacheAt = 0;
    this._currentUserPromise = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ims_user_cache_v1');
    }
  },

  async getCurrentUser(): Promise<UserAccessRow | null> {
    const now = Date.now();
    // 1. Memory Cache (Increased to 30s for better stability)
    if (this._currentUserCache && now - this._currentUserCacheAt < 30000) {
      return this._currentUserCache;
    }

    // 2. Promise Deduplication
    if (this._currentUserPromise) {
      return this._currentUserPromise;
    }

    // 3. LocalStorage Cache (Prevents redirect flicker on refresh)
    if (typeof window !== 'undefined' && !this._currentUserCache) {
      const saved = localStorage.getItem('ims_user_cache_v1');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (now - parsed._cachedAt < 3600000)) { // 1 hour cache
            this._currentUserCache = parsed;
            this._currentUserCacheAt = parsed._cachedAt;
          }
        } catch (e) {
          localStorage.removeItem('ims_user_cache_v1');
        }
      }
    }

    // 3. LocalStorage Cache (Prevents redirect flicker and timeouts on refresh)
    if (typeof window !== 'undefined' && !this._currentUserCache) {
      const saved = localStorage.getItem('ims_user_cache_v1');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (now - parsed._cachedAt < 86400000)) { // 24 hour cache for UI responsiveness
            this._currentUserCache = parsed;
            this._currentUserCacheAt = parsed._cachedAt;
            
            // Still trigger a background refresh if it's older than 5 mins
            if (now - parsed._cachedAt > 300000) {
               this._currentUserPromise = (async () => {
                 try {
                   const fresh = await this._fetchFreshUser();
                   return fresh;
                 } finally {
                   this._currentUserPromise = null;
                 }
               })();
            }
            
            return this._currentUserCache;
          }
        } catch (e) {
          localStorage.removeItem('ims_user_cache_v1');
        }
      }
    }

    this._currentUserPromise = this._fetchFreshUser();
    return this._currentUserPromise;
  },

  async _fetchFreshUser(): Promise<UserAccessRow | null> {
    const fetchWithLockMitigation = async () => {
      try {
        // Use getSession first as it's faster than getUser
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        let user = session?.user || null;
        
        if (!user && !sessionError) {
          // If no session, try getUser just in case
          const { data: { user: authUser } } = await supabase.auth.getUser();
          user = authUser;
        }
        return user;
      } catch (e: any) {
        if (e?.message?.includes('Lock')) {
          console.warn('[Auth] Lock contention detected, retrying in 100ms...');
          await new Promise(r => setTimeout(r, 100));
          return null; // Force retry via the loop below
        }
        throw e;
      }
    };

    try {
      let user = null;
      let retries = 3;
      
      while (retries > 0) {
        user = await fetchWithLockMitigation();
        if (user) break;
        retries--;
      }

      if (!user) {
        this._currentUserCache = null;
        this._currentUserCacheAt = Date.now();
        if (typeof window !== 'undefined') localStorage.removeItem('ims_user_cache_v1');
        return null;
      }

        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select(`
            *,
            roles:role_id (
              id,
              name,
              permission_keys
            )
          `)
          .eq('id', user.id)
          .limit(1);

        if (profileError || !profiles || profiles.length === 0) {
          if (profileError) console.error('Profile fetch error:', profileError);
          this._currentUserCache = null;
          this._currentUserCacheAt = Date.now();
          return null;
        }

        const profile = profiles[0];
        const currentUser = {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role_id: profile.role_id,
          role_name: resolveRoleName(profile.role_id, profile.roles),
          status: profile.status,
          custom_permission_keys: profile.custom_permission_keys || [],
          revoked_permission_keys: profile.revoked_permission_keys || [],
          temporary_password: profile.temporary_password,
          last_active_at: profile.last_active_at,
        } as UserAccessRow;

        this._currentUserCache = currentUser;
        this._currentUserCacheAt = Date.now();

        // Update LocalStorage cache
        if (typeof window !== 'undefined') {
          localStorage.setItem('ims_user_cache_v1', JSON.stringify({
            ...currentUser,
            _cachedAt: this._currentUserCacheAt
          }));
        }

        return currentUser;
      } catch (error) {
        if (!isAuthLockRaceError(error)) {
          console.error('Error getting current user:', error);
        }
        this._currentUserCache = null;
        this._currentUserCacheAt = Date.now();
        return null;
      } finally {
        this._currentUserPromise = null;
      }
  },

  hasActiveSession(): boolean {
    if (typeof window === 'undefined') return false;
    return !!Object.keys(localStorage).find(key => key.includes('-auth-token'));
  },

  // User management methods
  async getUsers(): Promise<UserAccessRow[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          roles:role_id (
            id,
            name,
            permission_keys
          )
        `)
        .order('full_name');

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      return (data || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: resolveRoleName(profile.role_id, profile.roles),
        status: profile.status,
        custom_permission_keys: profile.custom_permission_keys || [],
        revoked_permission_keys: profile.revoked_permission_keys || [],
        temporary_password: profile.temporary_password,
        last_active_at: profile.last_active_at,
      })) as UserAccessRow[];
    } catch (error) {
      console.error('Error in getUsers:', error);
      return [];
    }
  },

  async _getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { 'Authorization': `Bearer ${session.access_token}` };
  },

  async saveUser(user: UserAccessRow): Promise<UserAccessRow> {
    try {
      const authHeader = await this._getAuthHeader();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };
      const response = await fetch(`/api/auth/users/${user.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          full_name: user.full_name,
          role_id: user.role_id,
          status: user.status,
          custom_permission_keys: user.custom_permission_keys,
          revoked_permission_keys: user.revoked_permission_keys,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMessage);
      }

      return user;
    } catch (error) {
      console.error('Error in saveUser:', error);
      throw error;
    }
  },

  async updateUserDetails(userId: string, details: { full_name: string; email: string; role_id: string }): Promise<void> {
    try {
      const authHeader = await this._getAuthHeader();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error updating user details:', error);
      throw error;
    }
  },

  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const authHeader = await this._getAuthHeader();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error changing user password:', error);
      throw error;
    }
  },

  async createUser(input: {
    full_name: string;
    email: string;
    temporary_password: string;
    role_id: string;
  }): Promise<UserAccessRow> {
    try {
      const authHeader = await this._getAuthHeader();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };
      const response = await fetch(`/api/auth/create-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const data = await response.json();
      return data.user as UserAccessRow;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Role management methods
  async getRoles(): Promise<RoleRow[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching roles:', error);
      }

      if (data && data.length > 0) {
        return data as RoleRow[];
      }

      return FALLBACK_ROLES;
    } catch (error) {
      console.error('Error in getRoles:', error);
      return [];
    }
  },

  async saveRolePermissions(roleId: string, permissionKeys: string[]): Promise<RoleRow[]> {
    try {
      const { error } = await supabase
        .from('roles')
        .update({ permission_keys: permissionKeys })
        .eq('id', roleId);

      if (error) {
        console.error('Error updating role permissions:', error);
        throw error;
      }

      return this.getRoles();
    } catch (error) {
      console.error('Error in saveRolePermissions:', error);
      throw error;
    }
  },

  async createRole(input: { name: string; permission_keys?: string[] }): Promise<RoleRow> {
    try {
      const roleId = `r_${Date.now()}`;
      const { data, error } = await supabase
        .from('roles')
        .insert({
          id: roleId,
          name: input.name,
          permission_keys: input.permission_keys || []
        })
        .select()
        .limit(1);

      if (error || !data) {
        console.error('Error creating role:', error);
        throw error || new Error('Failed to create role');
      }

      return data[0] as RoleRow;
    } catch (error) {
      console.error('Error in createRole:', error);
      throw error;
    }
  },

  async updateRole(input: { roleId: string; name: string; permission_keys: string[] }): Promise<RoleRow | null> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .update({
          name: input.name,
          permission_keys: input.permission_keys
        })
        .eq('id', input.roleId)
        .select()
        .limit(1);

      if (error || !data) {
        console.error('Error updating role:', error);
        throw error || new Error('Failed to update role');
      }

      return data[0] as RoleRow;
    } catch (error) {
      console.error('Error in updateRole:', error);
      throw error;
    }
  },

  // Permission methods
  getPermissions(): PermissionRow[] {
    return PERMISSIONS;
  },

  getPermissionByKey(permissionKey: string): PermissionRow | null {
    return PERMISSIONS.find(permission => permission.key === permissionKey) || null;
  },

  getRoutePermission(pathname: string): string | null {
    const match = ROUTE_PERMISSION_MAP.find(item => item.pattern.test(pathname));
    return match?.permission || null;
  },

  async hasPermission(user: UserAccessRow, permissionKey: string): Promise<boolean> {
    // Super Admin Bypass
    if (user.role_id === 'r1' || user.role_name === 'Super Admin') {
      return true;
    }

    if (!this._initialized) {
      await this.refreshRoles();
    }

    const role = this._roles.find(r => r.id === user.role_id);
    const rolePermissions = role ? role.permission_keys : [];

    if ((user.revoked_permission_keys || []).includes(permissionKey)) {
      return false;
    }

    return rolePermissions.includes(permissionKey) || (user.custom_permission_keys || []).includes(permissionKey);
  },

  async canAccessRoute(user: UserAccessRow, pathname: string): Promise<boolean> {
    const requiredPermission = this.getRoutePermission(pathname);
    if (!requiredPermission) return true;
    return await this.hasPermission(user, requiredPermission);
  },

  async getPermissionCountForUser(user: UserAccessRow): Promise<number> {
    // Super Admin Bypass
    if (user.role_id === 'r1' || user.role_name === 'Super Admin') {
      return PERMISSIONS.length;
    }

    if (!this._initialized) {
      await this.refreshRoles();
    }
    const role = this._roles.find(r => r.id === user.role_id);
    const rolePermissions = role ? role.permission_keys : [];
    const effective = new Set([...rolePermissions, ...(user.custom_permission_keys || [])]);
    (user.revoked_permission_keys || []).forEach(key => effective.delete(key));
    return effective.size;
  },

  // Audit trail methods
  async getAuditTrail(): Promise<AuditTrailRow[]> {
    /* Temporarily disabled until table is created
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select(`
          *,
          user_profiles:performed_by (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching audit trail:', error);
        return [];
      }

      // Transform the data to include performed_by_name
      return (data || []).map(row => ({
        id: row.id,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        reason: row.reason,
        performed_by: row.performed_by,
        performed_by_name: row.user_profiles?.full_name || row.user_profiles?.email || 'System',
        old_values: row.old_values,
        new_values: row.new_values,
        details: row.details,
        ip_address: row.ip_address,
        created_at: row.created_at,
      })) as AuditTrailRow[];
    } catch (error) {
      console.error('Error in getAuditTrail:', error);
      return [];
    }
    */
    return [];
  },

  async addAudit(input: Omit<AuditTrailRow, 'id' | 'created_at'>): Promise<AuditTrailRow> {
    // Audit Trail is temporarily disabled for future implementation
    /*
    try {
      let performedBy = input.performed_by;
      let performedByName = input.performed_by_name || 'System';
      
      // Auto-fill performedBy if not provided
      if (!performedBy) {
        const user = await this.getCurrentUser();
        if (user) {
          performedBy = user.id;
          performedByName = user.full_name || user.email;
        }
      }

      const payload = {
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_name: input.entity_name,
        reason: input.reason || 'No reason provided',
        performed_by: performedBy,
        performed_by_name: performedByName,
        details: input.details,
        old_values: (input as any).old_values,
        new_values: (input as any).new_values,
      };

      // Use the API route to bypass RLS
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Audit API fallback failed, error:', errorData.error);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      return result.data as AuditTrailRow;
    } catch (error) {
      console.warn('Non-critical: Audit log could not be recorded:', error);
      // We don't re-throw here to prevent crashing the main business flow
      // but we return a mock object to satisfy the return type
      return { id: 'error', created_at: new Date().toISOString(), ...input } as AuditTrailRow;
    }
    */
    return { id: 'disabled', created_at: new Date().toISOString(), ...input } as AuditTrailRow;
  },

  async getAuthenticatedUser(): Promise<UserAccessRow | null> {
    return this.getCurrentUser();
  },

  // Legacy synchronous methods
  getAuthenticatedUserSync(): UserAccessRow | null {
    return null;
  },

  async saveUsers(users: UserAccessRow[]): Promise<void> {
    void users;
    console.warn('saveUsers: Not implemented for database service');
  },

  async setCurrentUser(userId: string): Promise<void> {
    void userId;
    console.warn('setCurrentUser: Not implemented for database service');
  },

  async login(email: string, password: string): Promise<any> {
    return this.signIn(email, password);
  },

  async logout(): Promise<void> {
    return this.signOut();
  },

  // Business Data Methods
  async getOrders(): Promise<OrderRow[]> {
    try {
      // Get purchase orders with vendor and project info
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          order_number:po_number,
          vendor_id,
          vendor:vendors(id, name),
          project_id,
          project:projects(id, name),
          status,
          created_at,
          created_by,
          warehouse_id,
          delivery_address,
          payment_terms,
          total_amount
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) return [];
        throw error;
      }

      if (!orders) return [];

      // For each order, fetch its items with variant details
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const { data: items } = await supabase
            .from('purchase_order_items')
            .select(`
              id,
              variant_id,
              quantity,
              unit_price,
              variant:variants(
                id,
                sku,
                product:products(name)
              )
            `)
            .eq('order_id', order.id);

          return {
            ...order,
            type: 'PURCHASE' as const,
            vendor_name: order.vendor?.name || 'Unknown',
            project_name: order.project?.name || undefined,
            items: (items || []).map((item: any) => ({
              ...item,
              sku: item.variant?.sku || '',
              product_name: item.variant?.product?.name || 'Unknown Item',
              price: item.unit_price,
              total_price: (item.unit_price || 0) * (item.quantity || 0)
            })),
          } as OrderRow;
        })
      );

      return ordersWithItems;

      return ordersWithItems;
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  },

  async createOrder(input: any): Promise<OrderRow> {
    try {
      const orderNumber = `PO-${Date.now().toString().slice(-6)}`;

      // Extract valid purchase_orders columns only
      // Items are stored separately in purchase_order_items table
      const { items, ...validOrderData } = input;
      void items;

      // Only include fields that exist in purchase_orders table based on actual schema
      const orderToInsert: any = {
        po_number: orderNumber, // Database column is po_number
        vendor_id: validOrderData.vendor_id,
        status: 'pending_approval', // Use lowercase to match database enum
        payment_terms: validOrderData.payment_terms,
        notes: validOrderData.notes,
        delivery_address: validOrderData.delivery_address || '',
        created_at: new Date().toISOString(),
      };

      if (validOrderData.approved_by) orderToInsert.approved_by = validOrderData.approved_by;
      if (validOrderData.project_id) orderToInsert.project_id = validOrderData.project_id;
      if (validOrderData.warehouse_id) orderToInsert.warehouse_id = validOrderData.warehouse_id;
      if (validOrderData.created_by) orderToInsert.created_by = validOrderData.created_by;

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert(orderToInsert)
        .select()
        .limit(1);

      if (error || !data) throw error || new Error('Failed to create order');

      // If items were provided, insert them into purchase_order_items table
      if (items && items.length > 0 && data[0]) {
        const orderId = data[0].id;
        const itemsToInsert = items.map((item: any) => ({
          order_id: orderId,
          variant_id: item.variant_id,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error adding order items:', itemsError);
          // Don't throw - order was created, items failed
        }
      }

      return data[0] as OrderRow;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      // Map frontend status to database enum - use lowercase as per database schema
      let dbStatus = status.toLowerCase();
      // Support both formats for backward compatibility
      if (dbStatus === 'pending') dbStatus = 'pending_approval';
      
      // Validate status is one of allowed values
      if (!['pending_approval', 'approved', 'cancelled'].includes(dbStatus)) {
        throw new Error(`Invalid purchase order status: ${status}`);
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: dbStatus })
        .eq('id', orderId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  },

  async getChallans(): Promise<ChallanRow[]> {
    try {
      const { data, error } = await supabase
        .from('challans')
        .select('*')
        .order('dispatch_date', { ascending: false });

      if (error) {
        if (isSchemaError(error)) return readLocalData<ChallanRow>(CHALLANS_KEY);
        console.error('Error fetching challans:', error);
        return readLocalData<ChallanRow>(CHALLANS_KEY);
      }

      return (data as ChallanRow[]) || [];
    } catch (error) {
      console.error('Error fetching challans:', error);
      return readLocalData<ChallanRow>(CHALLANS_KEY);
    }
  },

  async saveChallans(challans: ChallanRow[]): Promise<void> {
    writeLocalData<ChallanRow>(CHALLANS_KEY, challans);
  },

  async getDeliveryReceipts(): Promise<DeliveryReceiptRow[]> {
    try {
      // Robust fetching: try multiple table names and handle schema variations
      const tables = ['delivery_receipts', 'receipts', 'challans'];
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(100);

        if (!error && data && data.length > 0) {
          return data.map(row => ({
            id: row.id,
            receipt_no: row.receipt_no || row.challan_no || row.id,
            date: row.date || row.dispatch_date || row.created_at?.split('T')[0] || '',
            type: row.type || 'SITE_DELIVERY',
            project_name: row.project_name || '',
            vendor_name: row.vendor_name || '',
            receiver_name: row.receiver_name || '',
            contact: row.contact || '',
            linked_po: row.linked_po || row.po_ref || row.purchase_order_id || '',
            status: row.status || 'VERIFIED',
            items: row.items || []
          }));
        }

        if (error && isSchemaError(error)) {
          return readLocalData<DeliveryReceiptRow>(DELIVERY_RECEIPTS_KEY);
        }
      }
      return readLocalData<DeliveryReceiptRow>(DELIVERY_RECEIPTS_KEY);
    } catch (error) {
      console.error('Error fetching delivery receipts:', error);
      return readLocalData<DeliveryReceiptRow>(DELIVERY_RECEIPTS_KEY);
    }
  },

  async saveDeliveryReceipts(receipts: DeliveryReceiptRow[]): Promise<void> {
    writeLocalData<DeliveryReceiptRow>(DELIVERY_RECEIPTS_KEY, receipts);
  },

  async getPaymentSlips(): Promise<PaymentSlipRow[]> {
    try {
      // Robust fetching: handle missing columns like 'date'
      const tables = ['payment_slips', 'payments'];
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(100);

        if (!error && data) {
          return data.map(row => ({
            id: row.id,
            slip_no: row.slip_no || row.payment_no || row.id,
            date: row.date || row.payment_date || row.created_at?.split('T')[0] || '',
            due_date: row.due_date || row.date || row.payment_date || '',
            vendor_name: row.vendor_name || row.payee || '',
            po_ref: row.po_ref || '',
            amount: row.amount || 0,
            payment_method: row.payment_method || 'BANK_TRANSFER',
            ref_no: row.ref_no || '',
            prepared_by: row.prepared_by || '',
            status: row.status || 'ISSUED'
          }));
        }

        if (error && isSchemaError(error)) {
          return readLocalData<PaymentSlipRow>(PAYMENT_SLIPS_KEY);
        }
      }
      return readLocalData<PaymentSlipRow>(PAYMENT_SLIPS_KEY);
    } catch (error) {
      console.error('Error fetching payment slips:', error);
      return readLocalData<PaymentSlipRow>(PAYMENT_SLIPS_KEY);
    }
  },

  async savePaymentSlips(slips: PaymentSlipRow[]): Promise<void> {
    writeLocalData<PaymentSlipRow>(PAYMENT_SLIPS_KEY, slips);
  },

  async getInventorySnapshot(): Promise<InventorySnapshotRow[]> {
    try {
      const { data: invRows, error: invError } = await supabase
        .from('inventory')
        .select('quantity, variant_id, warehouse_id');
      
      if (invError || !invRows) return [];

      const variantIds = Array.from(new Set(invRows.map((r: any) => r.variant_id).filter(Boolean)));
      const warehouseIds = Array.from(new Set(invRows.map((r: any) => r.warehouse_id).filter(Boolean)));

      const [variantsRes, warehousesRes] = await Promise.all([
        variantIds.length > 0
          ? supabase.from('variants').select('id, sku, product_id, attributes').in('id', variantIds)
          : Promise.resolve({ data: [] }),
        warehouseIds.length > 0
          ? supabase.from('warehouses').select('id, name').in('id', warehouseIds)
          : Promise.resolve({ data: [] }),
      ]);

      const productIds = Array.from(new Set((variantsRes.data || []).map((v: any) => v.product_id).filter(Boolean)));
      const productsRes = productIds.length > 0
        ? await supabase.from('products').select('id, name').in('id', productIds)
        : { data: [] };

      const variantById = new Map((variantsRes.data || []).map((v: any) => [v.id, v]));
      const warehouseById = new Map((warehousesRes.data || []).map((w: any) => [w.id, w]));
      const productById = new Map((productsRes.data || []).map((p: any) => [p.id, p]));

      return invRows.map((item: any) => {
        const variant = variantById.get(item.variant_id);
        const product = variant ? productById.get(variant.product_id) : undefined;
        const warehouse = warehouseById.get(item.warehouse_id);
        return {
          variant_id: item.variant_id,
          sku: variant?.sku || '',
          product_name: product?.name || '',
          attributes: (variant?.attributes || {}) as Record<string, string>,
          warehouse_id: item.warehouse_id,
          warehouse_name: warehouse?.name || '',
          quantity: item.quantity,
        };
      });
    } catch (error) {
      console.error('Error getting inventory snapshot:', error);
      return [];
    }
  },

  async getMovements(): Promise<StockMovementRow[]> {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) return [];
        throw error;
      }
      return data as StockMovementRow[];
    } catch (error) {
      console.error('Error fetching movements:', error);
      return [];
    }
  },

  async addMovement(input: Omit<StockMovementRow, 'id' | 'created_at'>): Promise<StockMovementRow> {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .insert(input)
        .select()
        .limit(1);

      if (error || !data) {
        if (isSchemaError(error)) {
           return { id: 'schema_missing', created_at: new Date().toISOString(), ...input } as StockMovementRow;
        }
        throw error || new Error('Failed to add movement');
      }
      return data[0] as StockMovementRow;
    } catch (error) {
      console.error('Error adding movement:', error);
      throw error;
    }
  },
};
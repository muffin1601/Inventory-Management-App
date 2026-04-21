// Production-ready modules service using Supabase database
// This replaces the localStorage-based user management

import { supabase, supabaseAdmin } from '@/lib/supabase';
import type {
  UserAccessRow,
  RoleRow,
  AuditTrailRow,
  PermissionRow,
} from '@/types/modules';

// Permission definitions (same as before)
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

// Database-based modules service
export const modulesService = {
  // Authentication methods
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return null;
    }

    if (data.user) {
      // Update last active time
      await supabase
        .from('user_profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', data.user.id);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
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
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return null;
      }

      // Check if user is active
      if (profile.status !== 'ACTIVE') {
        await supabase.auth.signOut();
        return null;
      }

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: profile.roles?.name || 'Unknown',
        status: profile.status,
        custom_permission_keys: profile.custom_permission_keys || [],
        revoked_permission_keys: profile.revoked_permission_keys || [],
        temporary_password: profile.temporary_password,
        last_active_at: profile.last_active_at,
      } as UserAccessRow;
    }

    return null;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
  },

  async getCurrentUser(): Promise<UserAccessRow | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
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
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return null;
      }

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: profile.roles?.name || 'Unknown',
        status: profile.status,
        custom_permission_keys: profile.custom_permission_keys || [],
        revoked_permission_keys: profile.revoked_permission_keys || [],
        temporary_password: profile.temporary_password,
        last_active_at: profile.last_active_at,
      } as UserAccessRow;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  hasActiveSession(): boolean {
    return !!supabase.auth.getUser();
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

      return data.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: profile.roles?.name || 'Unknown',
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

  async saveUser(user: UserAccessRow): Promise<UserAccessRow> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role_id: user.role_id,
          status: user.status,
          custom_permission_keys: user.custom_permission_keys,
          revoked_permission_keys: user.revoked_permission_keys,
          temporary_password: user.temporary_password,
          last_active_at: user.last_active_at,
        });

      if (error) {
        console.error('Error saving user:', error);
        throw error;
      }

      return user;
    } catch (error) {
      console.error('Error in saveUser:', error);
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
      // First create the auth user using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.temporary_password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name
        }
      });

      if (authError || !authData.user) {
        throw authError || new Error('Failed to create auth user');
      }

      // Get role name
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .eq('id', input.role_id)
        .single();

      // Create profile
      const user: UserAccessRow = {
        id: authData.user.id,
        full_name: input.full_name,
        email: input.email,
        role_id: input.role_id,
        role_name: roleData?.name || 'Unknown',
        status: 'ACTIVE',
        custom_permission_keys: [],
        revoked_permission_keys: [],
        temporary_password: input.temporary_password,
        last_active_at: new Date().toISOString(),
      };

      await this.saveUser(user);
      return user;
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
        return [];
      }

      return data as RoleRow[];
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
        .single();

      if (error) {
        console.error('Error creating role:', error);
        throw error;
      }

      return data as RoleRow;
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
        .single();

      if (error) {
        console.error('Error updating role:', error);
        throw error;
      }

      return data as RoleRow;
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

  hasPermission(user: UserAccessRow, permissionKey: string): boolean {
    // Get role permissions
    const rolePermissions = user.role_name ? this.getRolePermissions(user.role_id) : [];

    // Check if revoked
    if (user.revoked_permission_keys?.includes(permissionKey)) {
      return false;
    }

    // Check role permissions or custom permissions
    return rolePermissions.includes(permissionKey) || user.custom_permission_keys.includes(permissionKey);
  },

  canAccessRoute(user: UserAccessRow, pathname: string): boolean {
    const requiredPermission = this.getRoutePermission(pathname);
    if (!requiredPermission) return true;
    return this.hasPermission(user, requiredPermission);
  },

  getPermissionCountForUser(user: UserAccessRow): number {
    const rolePermissions = user.role_name ? this.getRolePermissions(user.role_id) : [];
    const effective = new Set([...rolePermissions, ...user.custom_permission_keys]);
    (user.revoked_permission_keys || []).forEach(key => effective.delete(key));
    return effective.size;
  },

  // Helper method to get role permissions (cached)
  getRolePermissions(roleId: string): string[] {
    // This would ideally be cached or fetched from database
    // For now, return empty array - roles should be fetched separately
    return [];
  },

  // Audit trail methods
  async getAuditTrail(): Promise<AuditTrailRow[]> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching audit trail:', error);
        return [];
      }

      return data as AuditTrailRow[];
    } catch (error) {
      console.error('Error in getAuditTrail:', error);
      return [];
    }
  },

  async addAudit(input: Omit<AuditTrailRow, 'id' | 'created_at'>): Promise<AuditTrailRow> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .insert({
          action: input.action,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          entity_name: input.entity_name,
          reason: input.reason,
          performed_by: input.performed_by,
          details: input.details,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding audit entry:', error);
        throw error;
      }

      return data as AuditTrailRow;
    } catch (error) {
      console.error('Error in addAudit:', error);
      throw error;
    }
  },

  async getAuthenticatedUser(): Promise<UserAccessRow | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
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
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return null;
      }

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role_id: profile.role_id,
        role_name: profile.roles?.name || 'Unknown',
        status: profile.status,
        custom_permission_keys: profile.custom_permission_keys || [],
        revoked_permission_keys: profile.revoked_permission_keys || [],
        temporary_password: profile.temporary_password,
        last_active_at: profile.last_active_at,
      } as UserAccessRow;
    } catch (error) {
      console.error('Error getting authenticated user:', error);
      return null;
    }
  },

  // Legacy synchronous methods for backward compatibility
  getAuthenticatedUserSync(): UserAccessRow | null {
    // This is a synchronous version that tries to get from localStorage
    // Used during migration period
    try {
      const users = JSON.parse(localStorage.getItem('ims_users_v1') || '[]');
      const authenticatedUserId = localStorage.getItem('ims_authenticated_user_id_v1');
      if (!authenticatedUserId) return null;
      return users.find((u: UserAccessRow) => u.id === authenticatedUserId && u.status === 'ACTIVE') || null;
    } catch {
      return null;
    }
  },

  async saveUsers(users: UserAccessRow[]): Promise<void> {
    // This method is not applicable to database - users are saved individually
    console.warn('saveUsers: Not implemented for database service');
  },

  async setCurrentUser(userId: string): Promise<void> {
    // This method is not applicable to database - current user is managed by auth
    console.warn('setCurrentUser: Not implemented for database service');
  },

  async login(email: string, password: string): Promise<UserAccessRow | null> {
    return this.signIn(email, password);
  },

  async logout(): Promise<void> {
    return this.signOut();
  },
};
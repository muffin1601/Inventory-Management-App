"use client";

import React from 'react';
import styles from './Users.module.css';
import {
  Check,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import type { PermissionRow, RoleRow, UserAccessRow } from '@/types/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

const PAGE_SIZE_OPTIONS = [5, 10, 20];

type UserFormState = {
  full_name: string;
  email: string;
  temporary_password: string;
  role_id: string;
};

type RoleFormState = {
  name: string;
  permission_keys: string[];
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function formatDate(value?: string) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getRoleById(roles: RoleRow[], roleId: string) {
  return roles.find((role) => role.id === roleId) || null;
}

function groupPermissions(permissions: PermissionRow[]) {
  return permissions.reduce<Record<string, PermissionRow[]>>((acc, permission) => {
    if (!acc[permission.module]) acc[permission.module] = [];
    acc[permission.module].push(permission);
    return acc;
  }, {});
}

export default function UsersPage() {
  const { showToast, confirmAction } = useUi();
  const [activeTab, setActiveTab] = React.useState<'users' | 'roles'>('users');
  const [users, setUsers] = React.useState<UserAccessRow[]>([]);
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | UserAccessRow['status']>('ALL');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [createUserOpen, setCreateUserOpen] = React.useState(false);
  const [userPermissionEditor, setUserPermissionEditor] = React.useState<UserAccessRow | null>(null);
  const [newRoleOpen, setNewRoleOpen] = React.useState(false);

  const [userForm, setUserForm] = React.useState<UserFormState>({
    full_name: '',
    email: '',
    temporary_password: '',
    role_id: '',
  });
  const [roleForm, setRoleForm] = React.useState<RoleFormState>({ name: '', permission_keys: [] });

  const permissions = React.useMemo(() => modulesService.getPermissions(), []);
  const permissionGroups = React.useMemo(() => groupPermissions(permissions), [permissions]);

  const syncData = React.useCallback(async () => {
    const nextRoles = await modulesService.getRoles();
    const nextUsers = await modulesService.getUsers();
    setRoles(nextRoles);
    setUsers(nextUsers);
    setSelectedRoleId((current) => current || nextRoles[0]?.id || '');
    setUserForm((current) => ({
      ...current,
      role_id: current.role_id || nextRoles.find((role) => role.name === 'Viewer')?.id || nextRoles[0]?.id || '',
    }));
  }, []);

  React.useEffect(() => {
    const init = async () => {
      await syncData();
    };
    init();
    window.addEventListener('ims-current-user-changed', syncData);
    window.addEventListener('ims-users-changed', syncData);
    return () => {
      window.removeEventListener('ims-current-user-changed', syncData);
      window.removeEventListener('ims-users-changed', syncData);
    };
  }, [syncData]);

  const [canInvite, setCanInvite] = React.useState(false);
  const [canEditUsers, setCanEditUsers] = React.useState(false);
  const [canDisableUsers, setCanDisableUsers] = React.useState(false);
  const [canManageRoles, setCanManageRoles] = React.useState(false);

  const selectedRole = React.useMemo(() => roles.find((role) => role.id === selectedRoleId) || null, [roles, selectedRoleId]);

  React.useEffect(() => {
    const loadPermissions = async () => {
      const currentUser = await modulesService.getCurrentUser();
      setCanInvite(currentUser ? modulesService.hasPermission(currentUser, 'users.invite') : false);
      setCanEditUsers(currentUser ? modulesService.hasPermission(currentUser, 'users.edit') : false);
      setCanDisableUsers(currentUser ? modulesService.hasPermission(currentUser, 'users.disable') : false);
      setCanManageRoles(currentUser ? modulesService.hasPermission(currentUser, 'roles.manage') : false);
    };
    loadPermissions();
  }, []);

  React.useEffect(() => {
    if (selectedRole) {
      setRoleForm({
        name: selectedRole.name,
        permission_keys: [...selectedRole.permission_keys],
      });
    }
  }, [selectedRole]);

  const filteredUsers = React.useMemo(() => {
    const q = normalizeText(search);
    return users.filter((user) => {
      const matchesQuery =
        !q ||
        user.full_name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role_name.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || user.role_id === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const paginatedUsers = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [activeTab, pageSize, roleFilter, search, statusFilter, users.length]);

  const stats = React.useMemo(() => {
    const activeUsers = users.filter((user) => user.status === 'ACTIVE').length;
    const disabledUsers = users.filter((user) => user.status === 'DISABLED').length;
    const customOverrides = users.filter((user) => (user.custom_permission_keys.length > 0) || ((user.revoked_permission_keys || []).length > 0)).length;
    return {
      totalUsers: users.length,
      activeUsers,
      disabledUsers,
      roles: roles.length,
      customOverrides,
    };
  }, [roles.length, users]);

  async function createUser() {
    if (!userForm.full_name.trim() || !userForm.email.trim() || !userForm.temporary_password.trim() || !userForm.role_id) {
      showToast('Please complete name, email, temporary password, and role.', 'error');
      return;
    }

    if (userForm.temporary_password.trim().length < 6) {
      showToast('Temporary password should be at least 6 characters.', 'error');
      return;
    }

    const email = userForm.email.trim().toLowerCase();
    if (users.some((user) => user.email.toLowerCase() === email)) {
      showToast('A user with this email already exists.', 'error');
      return;
    }

    const role = getRoleById(roles, userForm.role_id);
    if (!role) return;

    const newUser: UserAccessRow = {
      id: makeId('user'),
      full_name: userForm.full_name.trim(),
      email,
      role_id: role.id,
      role_name: role.name,
      status: 'ACTIVE',
      custom_permission_keys: [],
      revoked_permission_keys: [],
      temporary_password: userForm.temporary_password.trim(),
      last_active_at: '',
    };

    const currentUser = await modulesService.getCurrentUser();
    modulesService.saveUser(newUser);
    await modulesService.addAudit({
      action: 'User Created',
      entity_type: 'user',
      entity_id: newUser.id,
      entity_name: newUser.full_name,
      reason: `Created with role ${role.name}`,
      performed_by: currentUser?.email || 'Unknown',
      details: newUser.email,
    });
    syncData();
    setCreateUserOpen(false);
    setUserForm({
      full_name: '',
      email: '',
      temporary_password: '',
      role_id: roles.find((item) => item.name === 'Viewer')?.id || roles[0]?.id || '',
    });
    showToast('User created successfully.', 'success');
  }

  async function updateUserRole(userId: string, roleId: string) {
    const role = getRoleById(roles, roleId);
    const user = users.find((item) => item.id === userId);
    if (!role || !user) return;

    const nextUser: UserAccessRow = {
      ...user,
      role_id: role.id,
      role_name: role.name,
    };
    const currentUser = await modulesService.getCurrentUser();
    modulesService.saveUser(nextUser);
    await modulesService.addAudit({
      action: 'User Role Changed',
      entity_type: 'user',
      entity_id: user.id,
      entity_name: user.full_name,
      reason: `Role changed to ${role.name}`,
      performed_by: currentUser?.email || 'Unknown',
      details: `${user.role_name} -> ${role.name}`,
    });
    syncData();
    showToast('User role updated.', 'success');
  }

  async function toggleUserStatus(userId: string) {
    const user = users.find((item) => item.id === userId);
    if (!user) return;

    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const actionText = nextStatus === 'DISABLED' ? 'disable' : 'enable';
    
    // Special handling for admin users
    if (user.email === 'admin@nexusims.com' && nextStatus === 'DISABLED') {
      showToast('Admin user cannot be disabled.', 'error');
      return;
    }

    const confirmed = await confirmAction({
      title: `Confirm ${actionText} user`,
      message: `Are you sure you want to ${actionText} ${user.full_name}? ${nextStatus === 'DISABLED' ? 'They will lose access to the system.' : 'They will regain access to the system.'}`,
      confirmText: actionText.charAt(0).toUpperCase() + actionText.slice(1),
      cancelText: 'Cancel',
      requireReason: true,
      reasonLabel: 'Reason for status change',
      reasonPlaceholder: `Why are you ${actionText === 'disable' ? 'disabling' : 'enabling'} this user?`,
    });

    if (!confirmed.confirmed) return;

    const nextUser: UserAccessRow = {
      ...user,
      status: nextStatus,
    };
    const currentUser = await modulesService.getCurrentUser();
    const allUsers = await modulesService.getUsers();
    modulesService.saveUser(nextUser);
    if (currentUser?.id === userId && nextStatus === 'DISABLED') {
      const firstActiveOtherUser = allUsers.find((item) => item.id !== userId && item.status === 'ACTIVE');
      if (firstActiveOtherUser) {
        modulesService.setCurrentUser(firstActiveOtherUser.id);
      }
    }
    await modulesService.addAudit({
      action: 'User Status Changed',
      entity_type: 'user',
      entity_id: user.id,
      entity_name: user.full_name,
      reason: confirmed.reason,
      performed_by: currentUser?.email || 'Unknown',
      details: user.email,
    });
    syncData();
    showToast('User status updated.', 'success');
  }

  function toggleRoleFormPermission(permissionKey: string) {
    setRoleForm((current) => ({
      ...current,
      permission_keys: current.permission_keys.includes(permissionKey)
        ? current.permission_keys.filter((item) => item !== permissionKey)
        : [...current.permission_keys, permissionKey],
    }));
  }

  async function saveRoleChanges() {
    if (!selectedRole) return;
    if (!roleForm.name.trim()) {
      showToast('Role name is required.', 'error');
      return;
    }

    const currentUser = await modulesService.getCurrentUser();
    modulesService.updateRole({
      roleId: selectedRole.id,
      name: roleForm.name.trim(),
      permission_keys: roleForm.permission_keys,
    });
    await modulesService.addAudit({
      action: 'Role Updated',
      entity_type: 'user',
      entity_id: selectedRole.id,
      entity_name: roleForm.name.trim(),
      reason: 'Role permissions updated',
      performed_by: currentUser?.email || 'Unknown',
      details: `${roleForm.permission_keys.length} permissions saved`,
    });
    syncData();
    showToast('Role permissions saved.', 'success');
  }

  async function createRole() {
    if (!roleForm.name.trim()) {
      showToast('Role name is required.', 'error');
      return;
    }

    if (roles.some((role) => role.name.toLowerCase() === roleForm.name.trim().toLowerCase())) {
      showToast('A role with this name already exists.', 'error');
      return;
    }

    const currentUser = await modulesService.getCurrentUser();
    const newRole = await modulesService.createRole({
      name: roleForm.name.trim(),
      permission_keys: roleForm.permission_keys,
    });
    await modulesService.addAudit({
      action: 'Role Created',
      entity_type: 'user',
      entity_id: newRole.id,
      entity_name: newRole.name,
      reason: 'New role created',
      performed_by: currentUser?.email || 'Unknown',
      details: `${newRole.permission_keys.length} permissions assigned`,
    });
    syncData();
    setSelectedRoleId(newRole.id);
    setNewRoleOpen(false);
    showToast('Role created successfully.', 'success');
  }

  function getUserPermissionState(user: UserAccessRow, permissionKey: string) {
    const role = getRoleById(roles, user.role_id);
    const inherited = role?.permission_keys.includes(permissionKey) || false;
    const granted = user.custom_permission_keys.includes(permissionKey);
    const revoked = user.revoked_permission_keys?.includes(permissionKey) || false;
    const effective = !revoked && (inherited || granted);
    return { inherited, granted, revoked, effective };
  }

  async function toggleUserPermission(user: UserAccessRow, permissionKey: string) {
    const permissionState = getUserPermissionState(user, permissionKey);
    let nextCustom = [...user.custom_permission_keys];
    let nextRevoked = [...(user.revoked_permission_keys || [])];

    if (permissionState.inherited) {
      if (permissionState.revoked) {
        nextRevoked = nextRevoked.filter((item) => item !== permissionKey);
      } else {
        nextRevoked = Array.from(new Set([...nextRevoked, permissionKey]));
        nextCustom = nextCustom.filter((item) => item !== permissionKey);
      }
    } else if (permissionState.granted) {
      nextCustom = nextCustom.filter((item) => item !== permissionKey);
    } else {
      nextCustom = Array.from(new Set([...nextCustom, permissionKey]));
      nextRevoked = nextRevoked.filter((item) => item !== permissionKey);
    }

    const nextUser: UserAccessRow = {
      ...user,
      custom_permission_keys: nextCustom,
      revoked_permission_keys: nextRevoked,
    };

    const currentUser = await modulesService.getCurrentUser();
    modulesService.saveUser(nextUser);
    await modulesService.addAudit({
      action: 'User Permission Updated',
      entity_type: 'user',
      entity_id: user.id,
      entity_name: user.full_name,
      reason: `Permission ${permissionKey} changed`,
      performed_by: currentUser?.email || 'Unknown',
      details: `Custom grants: ${nextCustom.length} | Revoked: ${nextRevoked.length}`,
    });
    syncData();
    setUserPermissionEditor(nextUser);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>Create users, assign roles, and control access clearly for non-technical admins.</p>
        </div>
        {canInvite ? (
          <button type="button" className={styles.primaryAction} onClick={() => setCreateUserOpen(true)}>
            <UserPlus size={16} />
            Create User
          </button>
        ) : null}
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Users</span>
          <strong className={styles.statValue}>{users.length}</strong>
          <span className={styles.statMeta}>{stats.activeUsers} active right now</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Disabled Users</span>
          <strong className={styles.statValue}>{stats.disabledUsers}</strong>
          <span className={styles.statMeta}>Access is blocked for these accounts</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Roles</span>
          <strong className={styles.statValue}>{stats.roles}</strong>
          <span className={styles.statMeta}>Reusable permission templates</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Custom Overrides</span>
          <strong className={styles.statValue}>{stats.customOverrides}</strong>
          <span className={styles.statMeta}>Users with permission exceptions</span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('users')}
        >
          People & Access
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'roles' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles & Permissions
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search user, email, or role..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <select className={styles.select} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="ALL">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <select
                className={styles.select}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'ALL' | UserAccessRow['status'])}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>No users match the current search.</td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{user.full_name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className={styles.userName}>{user.full_name}</div>
                          <div className={styles.userMeta}>
                            {(user.custom_permission_keys.length > 0 || (user.revoked_permission_keys || []).length > 0) ? 'Has custom overrides' : 'Role-only access'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {canEditUsers ? (
                        <select
                          className={styles.inlineSelect}
                          value={user.role_id}
                          onChange={(event) => updateUserRole(user.id, event.target.value)}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.roleBadge}>{user.role_name}</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.permissionCount}>{modulesService.getPermissionCountForUser(user)} permissions</div>
                      <div className={styles.userMeta}>
                        +{user.custom_permission_keys.length} custom / -{(user.revoked_permission_keys || []).length} removed
                      </div>
                    </td>
                    <td>
                      <span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusDisabled}>{user.status}</span>
                    </td>
                    <td>{formatDate(user.last_active_at)}</td>
                    <td>
                      <div className={styles.actionGroup}>
                        {canEditUsers ? (
                          <button type="button" className={styles.iconAction} title="Edit permissions" onClick={() => setUserPermissionEditor(user)}>
                            <ShieldCheck size={15} />
                          </button>
                        ) : null}
                        {canDisableUsers ? (
                          <button type="button" className={styles.iconAction} title="Enable or disable" onClick={() => toggleUserStatus(user.id)}>
                            {user.status === 'ACTIVE' ? <Lock size={15} /> : <Check size={15} />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredUsers.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemLabel="users"
          />
        </div>
      ) : (
        <div className={styles.rolesLayout}>
          <div className={styles.rolesSidebar}>
            <div className={styles.sidebarHeader}>
              <div>
                <h2 className={styles.sidebarTitle}>Roles</h2>
                <p className={styles.sidebarSubtitle}>Reusable permission sets for teams.</p>
              </div>
              {canManageRoles ? (
                <button type="button" className={styles.secondaryAction} onClick={() => {
                  setRoleForm({ name: '', permission_keys: [] });
                  setNewRoleOpen(true);
                }}>
                  <Plus size={15} />
                  New Role
                </button>
              ) : null}
            </div>
            <div className={styles.roleList}>
              {roles.map((role) => (
                <button
                  type="button"
                  key={role.id}
                  className={`${styles.roleCard} ${selectedRoleId === role.id ? styles.roleCardActive : ''}`}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <div className={styles.roleCardTitle}>{role.name}</div>
                  <div className={styles.roleCardMeta}>{role.permission_keys.length} permissions</div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.permissionsPanel}>
            {selectedRole ? (
              <>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>{selectedRole.name}</h2>
                    <p className={styles.panelSubtitle}>Choose what this role can open and do across the system.</p>
                  </div>
                  {canManageRoles ? (
                    <button type="button" className={styles.primaryAction} onClick={saveRoleChanges}>
                      Save Role Permissions
                    </button>
                  ) : null}
                </div>

                <div className={styles.roleNameBox}>
                  <label className={styles.fieldLabel}>Role Name</label>
                  <input
                    className={styles.textInput}
                    value={roleForm.name}
                    onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canManageRoles}
                  />
                </div>

                <div className={styles.permissionGrid}>
                  {Object.entries(permissionGroups).map(([moduleName, groupPermissions]) => (
                    <div key={moduleName} className={styles.permissionCard}>
                      <div className={styles.permissionCardTitle}>{moduleName}</div>
                      <div className={styles.permissionList}>
                        {groupPermissions.map((permission) => (
                          <label key={permission.key} className={styles.permissionItem}>
                            <input
                              type="checkbox"
                              checked={roleForm.permission_keys.includes(permission.key)}
                              disabled={!canManageRoles}
                              onChange={() => toggleRoleFormPermission(permission.key)}
                            />
                            <div>
                              <div className={styles.permissionLabel}>
                                {permission.label}
                                {permission.admin_only ? <span className={styles.permissionTag}>Admin only</span> : null}
                              </div>
                              <div className={styles.permissionHint}>{permission.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {createUserOpen ? (
        <div className={styles.overlay} onClick={() => setCreateUserOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Create New User</h2>
                <p className={styles.modalSubtitle}>Add a team member, assign a default role, and hand over a temporary password.</p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setCreateUserOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Full Name</label>
                  <input className={styles.textInput} value={userForm.full_name} onChange={(event) => setUserForm((current) => ({ ...current, full_name: event.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Email</label>
                  <input className={styles.textInput} value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Temporary Password</label>
                  <input className={styles.textInput} type="password" value={userForm.temporary_password} onChange={(event) => setUserForm((current) => ({ ...current, temporary_password: event.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Role</label>
                  <select className={styles.select} value={userForm.role_id} onChange={(event) => setUserForm((current) => ({ ...current, role_id: event.target.value }))}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setCreateUserOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={createUser}>
                <UserPlus size={15} />
                Create User
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newRoleOpen ? (
        <div className={styles.overlay} onClick={() => setNewRoleOpen(false)}>
          <div className={styles.modalWide} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Create New Role</h2>
                <p className={styles.modalSubtitle}>Start with a name, then choose which permissions belong to this role template.</p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setNewRoleOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.roleNameBox}>
                <label className={styles.fieldLabel}>Role Name</label>
                <input className={styles.textInput} value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className={styles.permissionGrid}>
                {Object.entries(permissionGroups).map(([moduleName, groupPermissions]) => (
                  <div key={moduleName} className={styles.permissionCard}>
                    <div className={styles.permissionCardTitle}>{moduleName}</div>
                    <div className={styles.permissionList}>
                      {groupPermissions.map((permission) => (
                        <label key={permission.key} className={styles.permissionItem}>
                          <input
                            type="checkbox"
                            checked={roleForm.permission_keys.includes(permission.key)}
                            onChange={() => toggleRoleFormPermission(permission.key)}
                          />
                          <div>
                            <div className={styles.permissionLabel}>
                              {permission.label}
                              {permission.admin_only ? <span className={styles.permissionTag}>Admin only</span> : null}
                            </div>
                            <div className={styles.permissionHint}>{permission.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setNewRoleOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={createRole}>
                <Plus size={15} />
                Create Role
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {userPermissionEditor ? (
        <div className={styles.overlay} onClick={() => setUserPermissionEditor(null)}>
          <div className={styles.modalWide} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Permissions: {userPermissionEditor.full_name}</h2>
                <p className={styles.modalSubtitle}>
                  Role: {userPermissionEditor.role_name}. Turn permissions on or off for this one user without changing the whole role.
                </p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setUserPermissionEditor(null)}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.permissionSummaryBar}>
              <div className={styles.summaryPill}>
                <Shield size={14} />
                {modulesService.getPermissionCountForUser(userPermissionEditor)} effective permissions
              </div>
              <div className={styles.summaryPill}>
                <UserCog size={14} />
                {userPermissionEditor.custom_permission_keys.length} custom grants
              </div>
              <div className={styles.summaryPill}>
                <Lock size={14} />
                {(userPermissionEditor.revoked_permission_keys || []).length} revoked from role
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.permissionGrid}>
                {Object.entries(permissionGroups).map(([moduleName, groupPermissions]) => (
                  <div key={moduleName} className={styles.permissionCard}>
                    <div className={styles.permissionCardTitle}>{moduleName}</div>
                    <div className={styles.permissionList}>
                      {groupPermissions.map((permission) => {
                        const state = getUserPermissionState(userPermissionEditor, permission.key);
                        return (
                          <label key={permission.key} className={styles.permissionItem}>
                            <input
                              type="checkbox"
                              checked={state.effective}
                              disabled={!canEditUsers}
                              onChange={() => toggleUserPermission(userPermissionEditor, permission.key)}
                            />
                            <div>
                              <div className={styles.permissionLabel}>
                                {permission.label}
                                {state.granted ? <span className={styles.permissionTag}>Custom grant</span> : null}
                                {state.revoked ? <span className={styles.permissionTagMuted}>Revoked</span> : null}
                                {state.inherited && !state.revoked && !state.granted ? <span className={styles.permissionTagNeutral}>From role</span> : null}
                              </div>
                              <div className={styles.permissionHint}>{permission.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setUserPermissionEditor(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

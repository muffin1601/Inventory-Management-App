"use client";

import React from 'react';
import styles from './Users.module.css';
import {
  Check,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Settings,
  X,
  Key,
  Eye,
  EyeOff,
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

function getEffectivePermissionCountForUser(user: UserAccessRow, roles: RoleRow[]) {
  // Super Admin check
  if (user.role_id === 'r1' || user.role_name === 'Super Admin') {
    return modulesService.getPermissions().length;
  }
  const role = getRoleById(roles, user.role_id);
  const inherited = role?.permission_keys ?? [];
  const effective = new Set([...inherited, ...(user.custom_permission_keys || [])]);
  (user.revoked_permission_keys || []).forEach((key) => effective.delete(key));
  return effective.size;
}

function groupPermissions(permissions: PermissionRow[]) {
  return permissions.reduce<Record<string, PermissionRow[]>>((acc, permission) => {
    if (!acc[permission.module]) acc[permission.module] = [];
    acc[permission.module].push(permission);
    return acc;
  }, {});
}

export default function UsersPage() {
  const { showToast } = useUi();
  const [activeTab, setActiveTab] = React.useState<'users' | 'roles'>('users');
  const [users, setUsers] = React.useState<UserAccessRow[]>([]);
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('ALL');
  const [statusFilter] = React.useState<'ALL' | UserAccessRow['status']>('ALL');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [createUserOpen, setCreateUserOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [editUserModal, setEditUserModal] = React.useState<UserAccessRow | null>(null);
  const [passwordModal, setPasswordModal] = React.useState<UserAccessRow | null>(null);
  const [userPermissionEditor, setUserPermissionEditor] = React.useState<UserAccessRow | null>(null);
  const [, setNewRoleOpen] = React.useState(false);

  const [userForm, setUserForm] = React.useState<UserFormState>({
    full_name: '',
    email: '',
    temporary_password: '',
    role_id: '',
  });
  
  const [editForm, setEditForm] = React.useState({
    full_name: '',
    email: '',
    role_id: ''
  });

  const [passwordForm, setPasswordForm] = React.useState({
    password: '',
    confirmPassword: ''
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
    syncData();
  }, [syncData]);

  const [canInvite, setCanInvite] = React.useState(false);
  const [canEditUsers, setCanEditUsers] = React.useState(false);
  const [canDisableUsers, setCanDisableUsers] = React.useState(false);
  const [canManageRoles, setCanManageRoles] = React.useState(false);

  React.useEffect(() => {
    const loadPermissions = async () => {
      const currentUser = await modulesService.getCurrentUser();
      if (!currentUser) return;
      
      const [invite, edit, disable, manage] = await Promise.all([
        modulesService.hasPermission(currentUser, 'users.invite'),
        modulesService.hasPermission(currentUser, 'users.edit'),
        modulesService.hasPermission(currentUser, 'users.disable'),
        modulesService.hasPermission(currentUser, 'roles.manage'),
      ]);
      
      setCanInvite(invite);
      setCanEditUsers(edit);
      setCanDisableUsers(disable);
      setCanManageRoles(manage);
    };
    loadPermissions();
  }, []);

  const selectedRole = React.useMemo(() => roles.find((role) => role.id === selectedRoleId) || null, [roles, selectedRoleId]);

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
      showToast('Please complete all fields.', 'error');
      return;
    }

    try {
      await modulesService.createUser({
        full_name: userForm.full_name.trim(),
        email: userForm.email.trim().toLowerCase(),
        temporary_password: userForm.temporary_password.trim(),
        role_id: userForm.role_id,
      });
      await syncData();
      setCreateUserOpen(false);
      showToast('User created successfully.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to create user.', 'error');
    }
  }

  async function handleEditUser() {
    if (!editUserModal) return;
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      showToast('Name and Email are required.', 'error');
      return;
    }

    try {
      await modulesService.updateUserDetails(editUserModal.id, editForm);
      await syncData();
      setEditUserModal(null);
      showToast('User details updated.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update user.', 'error');
    }
  }

  async function handleChangePassword() {
    if (!passwordModal) return;
    if (passwordForm.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    try {
      await modulesService.changeUserPassword(passwordModal.id, passwordForm.password);
      showToast('Password changed successfully.', 'success');
      setPasswordModal(null);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (error: any) {
      showToast(error.message || 'Failed to change password.', 'error');
    }
  }

  async function toggleUserStatus(userId: string) {
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    
    // Prevent disabling Super Admin
    if (user.role_id === 'r1' && user.status === 'ACTIVE') {
      showToast('Super Admin cannot be disabled.', 'error');
      return;
    }

    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await modulesService.saveUser({ ...user, status: nextStatus });
      await syncData();
      showToast(`User ${nextStatus === 'ACTIVE' ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      showToast('Failed to change status.', 'error');
    }
  }

  async function saveRoleChanges() {
    if (!selectedRole) return;
    try {
      await modulesService.updateRole({
        roleId: selectedRole.id,
        name: roleForm.name,
        permission_keys: roleForm.permission_keys,
      });
      await syncData();
      showToast('Role permissions updated.', 'success');
    } catch {
      showToast('Failed to update role.', 'error');
    }
  }

  function getUserPermissionState(user: UserAccessRow, permissionKey: string) {
    // Super Admin check
    if (user.role_id === 'r1' || user.role_name === 'Super Admin') {
      return { inherited: true, granted: false, revoked: false, effective: true };
    }
    const role = getRoleById(roles, user.role_id);
    const inherited = role?.permission_keys.includes(permissionKey) || false;
    const granted = user.custom_permission_keys.includes(permissionKey);
    const revoked = user.revoked_permission_keys?.includes(permissionKey) || false;
    
    // Only show as "granted/custom" if it's NOT already inherited
    const showCustom = granted && !inherited;
    const effective = !revoked && (inherited || granted);
    
    return { inherited, granted: showCustom, revoked, effective };
  }

  async function toggleUserPermission(user: UserAccessRow, permissionKey: string) {
    const state = getUserPermissionState(user, permissionKey);
    let nextCustom = [...user.custom_permission_keys];
    let nextRevoked = [...(user.revoked_permission_keys || [])];

    if (state.inherited) {
      if (state.revoked) {
        // Un-revoke (Grant back via inheritance)
        nextRevoked = nextRevoked.filter(k => k !== permissionKey);
      } else {
        // Revoke inherited permission
        nextRevoked.push(permissionKey);
      }
      // Always remove from custom if it exists in role to prevent redundancy
      nextCustom = nextCustom.filter(k => k !== permissionKey);
    } else {
      if (state.granted || user.custom_permission_keys.includes(permissionKey)) {
        // Remove custom grant
        nextCustom = nextCustom.filter(k => k !== permissionKey);
      } else {
        // Add custom grant
        nextCustom.push(permissionKey);
      }
      // Ensure it's not in revoked if we are manually granting it
      nextRevoked = nextRevoked.filter(k => k !== permissionKey);
    }

    try {
      const nextUser = { ...user, custom_permission_keys: nextCustom, revoked_permission_keys: nextRevoked };
      await modulesService.saveUser(nextUser);
      await syncData();
      setUserPermissionEditor(nextUser);
      showToast('User permission updated.', 'success');
    } catch {
      showToast('Failed to update permission.', 'error');
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>Control access, manage roles, and customize permissions for your organization.</p>
        </div>
        {canInvite && (
          <button className={styles.primaryAction} onClick={() => setCreateUserOpen(true)}>
            <UserPlus size={16} /> Create User
          </button>
        )}
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Users</span>
          <strong className={styles.statValue}>{users.length}</strong>
          <span className={styles.statMeta}>{stats.activeUsers} active</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Disabled</span>
          <strong className={styles.statValue}>{stats.disabledUsers}</strong>
          <span className={styles.statMeta}>Access blocked</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Roles</span>
          <strong className={styles.statValue}>{stats.roles}</strong>
          <span className={styles.statMeta}>Permission sets</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Overrides</span>
          <strong className={styles.statValue}>{stats.customOverrides}</strong>
          <span className={styles.statMeta}>Individual access</span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`} onClick={() => setActiveTab('users')}>People & Access</button>
        <button className={`${styles.tab} ${activeTab === 'roles' ? styles.activeTab : ''}`} onClick={() => setActiveTab('roles')}>Roles & Permissions</button>
      </div>

      {activeTab === 'users' ? (
        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input type="text" className={styles.searchInput} placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className={styles.filterGroup}>
              <select className={styles.select} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="ALL">All Roles</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{user.full_name.charAt(0)}</div>
                      <div>
                        <div className={styles.userName}>{user.full_name}</div>
                        <div className={styles.userMeta}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={styles.roleBadge}>{user.role_name}</span></td>
                  <td>
                    <div className={styles.permissionCount}>{getEffectivePermissionCountForUser(user, roles)}</div>
                    <div className={styles.userMeta}>{user.custom_permission_keys.length} custom</div>
                  </td>
                  <td><span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusDisabled}>{user.status}</span></td>
                  <td>{formatDate(user.last_active_at)}</td>
                  <td>
                    <div className={styles.actionGroup}>
                      {canEditUsers && (
                        <>
                          <button className={styles.iconAction} title="Edit User" onClick={() => { setEditUserModal(user); setEditForm({ full_name: user.full_name, email: user.email, role_id: user.role_id }); }}><Settings size={15} /></button>
                          <button className={styles.iconAction} title="Permissions" onClick={() => setUserPermissionEditor(user)}><ShieldCheck size={15} /></button>
                          <button className={styles.iconAction} title="Password" onClick={() => setPasswordModal(user)}><Key size={15} /></button>
                        </>
                      )}
                      {canDisableUsers && (
                        <button className={styles.iconAction} onClick={() => toggleUserStatus(user.id)}>
                          {user.status === 'ACTIVE' ? <Lock size={15} /> : <Check size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <TablePagination page={page} pageSize={pageSize} totalItems={filteredUsers.length} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} itemLabel="users" />
        </div>
      ) : (
        <div className={styles.rolesLayout}>
          <div className={styles.rolesSidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>Roles</h2>
              {canManageRoles && <button className={styles.secondaryAction} onClick={() => { setRoleForm({ name: '', permission_keys: [] }); setNewRoleOpen(true); }}><Plus size={14} /></button>}
            </div>
            <div className={styles.roleList}>
              {roles.map(r => (
                <button key={r.id} className={`${styles.roleCard} ${selectedRoleId === r.id ? styles.roleCardActive : ''}`} onClick={() => setSelectedRoleId(r.id)}>
                  <div className={styles.roleCardTitle}>{r.name}</div>
                  <div className={styles.roleCardMeta}>{r.permission_keys.length} permissions</div>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.permissionsPanel}>
            {selectedRole && (
              <>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>{selectedRole.name}</h2>
                  {canManageRoles && <button className={styles.primaryAction} onClick={saveRoleChanges}>Save Changes</button>}
                </div>
                <div className={styles.roleNameBox}>
                   <label className={styles.fieldLabel}>Role Name</label>
                   <input className={styles.textInput} value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} disabled={!canManageRoles || selectedRole.id === 'r1'} />
                </div>
                <div className={styles.permissionGrid}>
                  {Object.entries(permissionGroups).map(([module, group]) => (
                    <div key={module} className={styles.permissionCard}>
                      <div className={styles.permissionCardTitle}>{module}</div>
                      <div className={styles.permissionList}>
                        {group.map(p => (
                          <label key={p.key} className={styles.permissionItem}>
                            <input type="checkbox" checked={roleForm.permission_keys.includes(p.key)} onChange={() => {
                              const keys = roleForm.permission_keys.includes(p.key) ? roleForm.permission_keys.filter(k => k !== p.key) : [...roleForm.permission_keys, p.key];
                              setRoleForm({ ...roleForm, permission_keys: keys });
                            }} disabled={!canManageRoles || selectedRole.id === 'r1'} />
                            <div>
                              <div className={styles.permissionLabel}>{p.label}</div>
                              <div className={styles.permissionHint}>{p.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {createUserOpen && (
        <div className={styles.overlay} onClick={() => setCreateUserOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2 className={styles.modalTitle}>Create User</h2></div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}><label className={styles.fieldLabel}>Full Name</label><input className={styles.textInput} value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} /></div>
                <div className={styles.field}><label className={styles.fieldLabel}>Email</label><input className={styles.textInput} value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Temp Password</label>
                  <div className={styles.inputWrapper}>
                    <input className={styles.textInput} type={showPassword ? 'text' : 'password'} value={userForm.temporary_password} onChange={e => setUserForm({...userForm, temporary_password: e.target.value})} />
                    <button className={styles.inputIcon} onClick={() => setShowPassword(!showPassword)} type="button">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className={styles.field}><label className={styles.fieldLabel}>Role</label><select className={styles.select} value={userForm.role_id} onChange={e => setUserForm({...userForm, role_id: e.target.value})}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              </div>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryAction} onClick={() => setCreateUserOpen(false)}>Cancel</button><button className={styles.primaryAction} onClick={createUser}>Create</button></div>
          </div>
        </div>
      )}

      {editUserModal && (
        <div className={styles.overlay} onClick={() => setEditUserModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2 className={styles.modalTitle}>Edit User</h2></div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}><label className={styles.fieldLabel}>Full Name</label><input className={styles.textInput} value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} /></div>
                <div className={styles.field}><label className={styles.fieldLabel}>Email</label><input className={styles.textInput} value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                <div className={styles.field}><label className={styles.fieldLabel}>Role</label><select className={styles.select} value={editForm.role_id} onChange={e => setEditForm({...editForm, role_id: e.target.value})} disabled={editUserModal.id === 'r1'}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              </div>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryAction} onClick={() => setEditUserModal(null)}>Cancel</button><button className={styles.primaryAction} onClick={handleEditUser}>Save</button></div>
          </div>
        </div>
      )}

      {passwordModal && (
        <div className={styles.overlay} onClick={() => setPasswordModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2 className={styles.modalTitle}>Change Password: {passwordModal.full_name}</h2></div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>New Password</label>
                  <div className={styles.inputWrapper}>
                    <input className={styles.textInput} type={showPassword ? 'text' : 'password'} value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} />
                    <button className={styles.inputIcon} onClick={() => setShowPassword(!showPassword)} type="button">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Confirm Password</label>
                  <div className={styles.inputWrapper}>
                    <input className={styles.textInput} type={showPassword ? 'text' : 'password'} value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryAction} onClick={() => setPasswordModal(null)}>Cancel</button><button className={styles.primaryAction} onClick={handleChangePassword}>Update Password</button></div>
          </div>
        </div>
      )}

      {userPermissionEditor && (
        <div className={styles.overlay} onClick={() => setUserPermissionEditor(null)}>
          <div className={styles.modalWide} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2 className={styles.modalTitle}>Permissions: {userPermissionEditor.full_name}</h2><button onClick={() => setUserPermissionEditor(null)}><X size={18} /></button></div>
            <div className={styles.modalBody}>
              <div className={styles.permissionGrid}>
                {Object.entries(permissionGroups).map(([module, group]) => (
                  <div key={module} className={styles.permissionCard}>
                    <div className={styles.permissionCardTitle}>{module}</div>
                    <div className={styles.permissionList}>
                      {group.map(p => {
                        const state = getUserPermissionState(userPermissionEditor, p.key);
                        return (
                          <label key={p.key} className={styles.permissionItem}>
                            <input type="checkbox" checked={state.effective} onChange={() => toggleUserPermission(userPermissionEditor, p.key)} disabled={userPermissionEditor.role_id === 'r1'} />
                            <div>
                              <div className={styles.permissionLabel}>{p.label} {state.granted && <span className={styles.permissionTag}>Custom</span>} {state.revoked && <span className={styles.permissionTagMuted}>Revoked</span>}</div>
                              <div className={styles.permissionHint}>{p.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

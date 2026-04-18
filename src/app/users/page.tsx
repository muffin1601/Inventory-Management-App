"use client";

import React, { useMemo, useState } from 'react';
import styles from './Users.module.css';
import { Shield, Search, UserPlus, Edit2, AlertTriangle } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import type { RoleRow, UserAccessRow } from '@/types/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function UsersPage() {
  const { showToast, confirmAction } = useUi();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserAccessRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [search, setSearch] = useState('');
  const [invite, setInvite] = useState({ full_name: '', email: '', role_id: '' });
  const [canInvite, setCanInvite] = useState(false);
  const [canEditUsers, setCanEditUsers] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    const existingUsers = modulesService.getUsers();
    const existingRoles = modulesService.getRoles();
    setUsers(existingUsers);
    setRoles(existingRoles);
    setSelectedRoleId(existingRoles[0]?.id || '');
    setInvite((prev) => ({ ...prev, role_id: existingRoles[1]?.id || existingRoles[0]?.id || '' }));
    const current = modulesService.getCurrentUser();
    setCanInvite(modulesService.hasPermission(current, 'users.invite'));
    setCanEditUsers(modulesService.hasPermission(current, 'users.edit'));
  }, []);

  const permissions = modulesService.getPermissions();

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId), [roles, selectedRoleId]);

  const rolePermissions = selectedRole?.permission_keys || [];

  const moduleMap = useMemo(() => {
    return permissions.reduce<Record<string, typeof permissions>>((acc, permission) => {
      if (!acc[permission.module]) acc[permission.module] = [];
      acc[permission.module].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return user.full_name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
  });

  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [activeTab, pageSize, search, users.length]);

  function saveUsers(nextUsers: UserAccessRow[]) {
    setUsers(nextUsers);
    modulesService.saveUsers(nextUsers);
  }

  function inviteUser() {
    if (!invite.full_name || !invite.email || !invite.role_id) {
      showToast('Please provide name, email and role.', 'error');
      return;
    }
    const role = roles.find((item) => item.id === invite.role_id);
    if (!role) return;
    const next: UserAccessRow = {
      id: `u_${Date.now()}`,
      full_name: invite.full_name,
      email: invite.email,
      role_id: role.id,
      role_name: role.name,
      status: 'ACTIVE',
      custom_permission_keys: [],
    };
    saveUsers([next, ...users]);
    setInvite({ full_name: '', email: '', role_id: role.id });
    showToast('User invited successfully.', 'success');
  }

  async function toggleUserStatus(userId: string) {
    const confirmation = await confirmAction({
      title: 'Change user status?',
      message: 'This will enable or disable access to the system.',
      confirmText: 'Yes, Update',
      requireReason: true,
      reasonLabel: 'Change reason',
      reasonPlaceholder: 'Why are you changing this user status?',
    });
    if (!confirmation.confirmed) return;
    const next: UserAccessRow[] = users.map((user) =>
      user.id === userId ? { ...user, status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } : user,
    );
    const changedUser = users.find((user) => user.id === userId);
    saveUsers(next);
    if (changedUser) {
      await modulesService.addAudit({
        action: 'User Status Changed',
        entity_type: 'user',
        entity_id: changedUser.id,
        entity_name: changedUser.full_name,
        reason: confirmation.reason,
        performed_by: modulesService.getCurrentUser().email,
        details: `Changed to ${changedUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'}`,
      });
    }
    showToast('User status updated.', 'info');
  }

  function toggleRolePermission(permissionKey: string) {
    if (!selectedRole) return;
    const exists = rolePermissions.includes(permissionKey);
    const nextPermissions = exists ? rolePermissions.filter((item) => item !== permissionKey) : [...rolePermissions, permissionKey];
    modulesService.saveRolePermissions(selectedRole.id, nextPermissions);
    const nextRoles = roles.map((role) => (role.id === selectedRole.id ? { ...role, permission_keys: nextPermissions } : role));
    setRoles(nextRoles);
    showToast('Role permissions updated.', 'success');
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team & Access</h1>
          <p className={styles.subtitle}>Manage people, roles, and who can see or do what.</p>
        </div>
        {canInvite && <button className={styles.primaryAction} onClick={inviteUser}>
          <UserPlus size={18} style={{ marginRight: 8 }} />
          Invite User
        </button>}
      </div>

      <div className={styles.card} style={{ padding: '1.5rem' }}>
        <div className={styles.filters} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input className={styles.searchInput} style={{ maxWidth: 220 }} placeholder="Full name" value={invite.full_name} onChange={(e) => setInvite((prev) => ({ ...prev, full_name: e.target.value }))} />
          <input className={styles.searchInput} style={{ maxWidth: 260 }} placeholder="Email" value={invite.email} onChange={(e) => setInvite((prev) => ({ ...prev, email: e.target.value }))} />
          <select className={styles.searchInput} style={{ maxWidth: 180 }} value={invite.role_id} onChange={(e) => setInvite((prev) => ({ ...prev, role_id: e.target.value }))}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
        <p className={styles.subtitle} style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
          Helper: invite a user by name and email, then assign a role. Permissions apply automatically.
        </p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Staff & Users
        </button>
        <button 
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
              <input type="text" placeholder="Search team members..." className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                    No users found. Invite your first team member above.
                  </td>
                </tr>
              ) : paginatedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userInfo}>
                      <div className={styles.avatar}>{user.full_name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.userName}>{user.full_name}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={user.role_name === 'Super Admin' ? styles.roleBadgeAdmin : styles.roleBadge}>{user.role_name}</span></td>
                  <td>-</td>
                  <td><span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusDisabled}>{user.status}</span></td>
                  <td>{canEditUsers && <button className={styles.actionBtn} onClick={() => toggleUserStatus(user.id)}><Edit2 size={16}/></button>}</td>
                </tr>
              ))}
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
        <div className={styles.rolesGrid}>
          <div className={styles.rolesSidebar}>
            {roles.map((role) => (
              <div key={role.id} className={`${styles.roleItem} ${selectedRoleId === role.id ? styles.roleActive : ''}`} onClick={() => setSelectedRoleId(role.id)}>
                <Shield size={16}/> {role.name}
              </div>
            ))}
            <button className={styles.addRoleBtn}>+ Create New Role</button>
          </div>
          
          <div className={styles.permissionsPanel}>
            <h2 className={styles.panelTitle}>{selectedRole?.name} Permissions</h2>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} color="var(--warning)" />
              <span>Feature-level permissions are editable here. Users can also receive custom permission overrides.</span>
            </div>

            {Object.entries(moduleMap).map(([moduleName, modulePermissions]) => (
              <div key={moduleName} className={styles.permGroup}>
                <h3>{moduleName} Module</h3>
                {modulePermissions.map((permission) => (
                  <div key={permission.key} className={styles.permRow}>
                    <span>{permission.label}</span>
                    <input type="checkbox" checked={rolePermissions.includes(permission.key)} onChange={() => toggleRolePermission(permission.key)} />
                  </div>
                ))}
              </div>
            ))}

            <button className={styles.saveBtn}>Saved Automatically</button>
          </div>
        </div>
      )}
    </div>
  );
}

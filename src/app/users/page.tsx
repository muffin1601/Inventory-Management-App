"use client";

import React, { useState } from 'react';
import styles from './Users.module.css';
import { Shield, Search, UserPlus, Edit2, AlertTriangle } from 'lucide-react';

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users & Access Control</h1>
          <p className={styles.subtitle}>Manage team members, roles, and granular permissions.</p>
        </div>
        <button className={styles.primaryAction}>
          <UserPlus size={18} style={{ marginRight: 8 }} />
          Invite User
        </button>
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
              <input type="text" placeholder="Search users by name or email..." className={styles.searchInput} />
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
              <tr>
                <td>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>A</div>
                    <div>
                      <div className={styles.userName}>Admin User</div>
                      <div className={styles.userEmail}>admin@nexusims.com</div>
                    </div>
                  </div>
                </td>
                <td><span className={styles.roleBadgeAdmin}>Super Admin</span></td>
                <td>Just now</td>
                <td><span className={styles.statusActive}>Active</span></td>
                <td><button className={styles.actionBtn}><Edit2 size={16}/></button></td>
              </tr>
              <tr>
                <td>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar} style={{ background: 'var(--success)' }}>J</div>
                    <div>
                      <div className={styles.userName}>John Manager</div>
                      <div className={styles.userEmail}>john@nexusims.com</div>
                    </div>
                  </div>
                </td>
                <td><span className={styles.roleBadge}>Manager</span></td>
                <td>2 hours ago</td>
                <td><span className={styles.statusActive}>Active</span></td>
                <td><button className={styles.actionBtn}><Edit2 size={16}/></button></td>
              </tr>
              <tr>
                <td>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar} style={{ background: 'var(--text-secondary)' }}>S</div>
                    <div>
                      <div className={styles.userName}>Sarah Staff</div>
                      <div className={styles.userEmail}>sarah@nexusims.com</div>
                    </div>
                  </div>
                </td>
                <td><span className={styles.roleBadge}>Warehouse Staff</span></td>
                <td>1 day ago</td>
                <td><span className={styles.statusDisabled}>Disabled</span></td>
                <td><button className={styles.actionBtn}><Edit2 size={16}/></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.rolesGrid}>
          <div className={styles.rolesSidebar}>
            <div className={styles.roleItem + ' ' + styles.roleActive}>
              <Shield size={16}/> Super Admin
            </div>
            <div className={styles.roleItem}>
              <Shield size={16}/> Manager
            </div>
            <div className={styles.roleItem}>
              <Shield size={16}/> Warehouse Staff
            </div>
            <button className={styles.addRoleBtn}>+ Create New Role</button>
          </div>
          
          <div className={styles.permissionsPanel}>
            <h2 className={styles.panelTitle}>Manager Permissions</h2>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} color="var(--warning)" />
              <span>Managers have broad access but cannot modify system settings or delete databases.</span>
            </div>
            
            <div className={styles.permGroup}>
              <h3>Products Module</h3>
              <div className={styles.permRow}><span>View Products</span> <input type="checkbox" checked readOnly/></div>
              <div className={styles.permRow}><span>Create/Edit Products</span> <input type="checkbox" checked readOnly/></div>
              <div className={styles.permRow}><span>Delete Products</span> <input type="checkbox" readOnly/></div>
            </div>
            
            <div className={styles.permGroup}>
              <h3>Inventory Module</h3>
              <div className={styles.permRow}><span>View Stock</span> <input type="checkbox" checked readOnly/></div>
              <div className={styles.permRow}><span>Adjust Stock Manually</span> <input type="checkbox" checked readOnly/></div>
              <div className={styles.permRow}><span>Transfer Stock</span> <input type="checkbox" checked readOnly/></div>
            </div>
            
            <button className={styles.saveBtn}>Save Permissions</button>
          </div>
        </div>
      )}
    </div>
  );
}

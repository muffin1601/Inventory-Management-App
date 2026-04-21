"use client";

import React, { useState, useEffect } from 'react';
import styles from './Challans.module.css';
import { 
  Search, Filter, Truck, CheckCircle2, Clock,
  Eye, Trash2, FileText, Printer
} from 'lucide-react';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';
import { projectsService, type ProjectRecord } from '@/lib/services/projects';
import { modulesService } from '@/lib/services/modules';
import type { ChallanRow as Challan } from '@/types/modules';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function ChallansPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewingChallan, setViewingChallan] = useState<Challan | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [dispatchItems, setDispatchItems] = useState<any[]>([]);
  const [loadingBoq, setLoadingBoq] = useState(false);
  const [newChallan, setNewChallan] = useState<Partial<Challan>>({
    status: 'ISSUED',
    items: []
  });
  const { showToast } = useUi();

  // Load projects and inventory
  useEffect(() => {
    const loadData = async () => {
      const projRes = await projectsService.listProjects();
      setProjects(projRes.projects);
    };
    loadData();

    const saved = modulesService.getChallans();
    if (saved.length > 0) {
      setChallans(saved);
    } else {
      // Mock data for first load
      const mock: Challan[] = [
        {
          id: '1',
          challan_no: 'CH-2024-001',
          po_no: 'PO-WAT-881',
          project_name: 'DLF Cyber Park',
          vendor_name: 'Delta Valve House',
          dispatch_date: '2024-03-15',
          status: 'DELIVERED',
          items: [
            { id: '1', name: 'Gate Valve 150mm', quantity: 15, unit: 'Nos' },
            { id: '2', name: 'Check Valve 100mm', quantity: 5, unit: 'Nos' }
          ]
        },
        {
          id: '2',
          challan_no: 'CH-2024-002',
          po_no: 'PO-WAT-892',
          project_name: 'Oberoi Realty',
          vendor_name: 'Clearline Pumps',
          dispatch_date: '2024-03-20',
          status: 'DISPATCHED',
          items: [
            { id: '3', name: 'Vertical Multistage Pump', quantity: 2, unit: 'Sets' }
          ]
        }
      ];
      setChallans(mock);
      modulesService.saveChallans(mock);
    }
  }, []);

  const saveChallans = (updated: Challan[]) => {
    setChallans(updated);
    modulesService.saveChallans(updated);
  };

  const handleProjectSelect = async (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    setNewChallan({ ...newChallan, project_name: projectName, items: [] });
    setLoadingBoq(true);
    try {
      const boqRes = await projectsService.listBoqItems(project.id);
      const items = boqRes.items;
      
      // Calculate already delivered for each item from existing challans
      const processedItems = items.map(boq => {
        const delivered = challans
          .filter(c => c.project_name === projectName)
          .reduce((acc, c) => acc + (c.items.find(i => i.name === boq.item_name)?.quantity || 0), 0);
        
        // Robust matching including trim
        return {
          ...boq,
          name: boq.item_name,
          delivered,
          balance: boq.quantity - delivered,
          dispatchQty: 0
        };
      });
      setDispatchItems(processedItems);
    } finally {
      setLoadingBoq(false);
    }
  };

  const updateDispatchQty = (index: number, val: string) => {
    const qty = parseFloat(val) || 0;
    const item = dispatchItems[index];
    
    if (qty > item.balance) {
      showToast(`Cannot exceed BOQ balance of ${item.balance}`, 'error');
      return;
    }

    const updated = [...dispatchItems];
    updated[index].dispatchQty = qty;
    setDispatchItems(updated);
  };

  const createChallan = async () => {
    const itemsToDispatch = dispatchItems
      .filter(i => i.dispatchQty > 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.dispatchQty,
        unit: i.unit
      }));

    if (itemsToDispatch.length === 0) {
      showToast('Select at least one item to dispatch', 'error');
      return;
    }

    if (!newChallan.project_name) {
      showToast('Please select a project', 'error');
      return;
    }

    const challan: Challan = {
      id: Math.random().toString(36).substr(2, 9),
      challan_no: `CH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      dispatch_date: new Date().toISOString().split('T')[0],
      po_no: newChallan.po_no || 'N/A',
      project_name: newChallan.project_name || '',
      vendor_name: newChallan.vendor_name || 'Project Site',
      status: 'ISSUED',
      items: itemsToDispatch
    };

    saveChallans([challan, ...challans]);
    setCreateOpen(false);
    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Challan Created',
        entity_type: 'challan',
        entity_id: challan.id,
        entity_name: challan.challan_no,
        reason: `Dispatch created for ${challan.project_name}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${challan.items.length} items | Vendor: ${challan.vendor_name}`,
      });
    } catch (error) {
      console.error('Failed to add challan audit:', error);
    }
    showToast('Delivery Challan Created!', 'success');
  };

  const deleteChallan = async (id: string) => {
    if (confirm('Are you sure you want to delete this challan?')) {
      const existing = challans.find(c => c.id === id);
      saveChallans(challans.filter(c => c.id !== id));
      if (existing) {
        try {
          const currentUser = await modulesService.getCurrentUser();
          await modulesService.addAudit({
            action: 'Challan Deleted',
            entity_type: 'challan',
            entity_id: existing.id,
            entity_name: existing.challan_no,
            reason: `Dispatch deleted for ${existing.project_name}`,
            performed_by: currentUser?.email || 'Unknown',
            details: `Vendor: ${existing.vendor_name}`,
          });
        } catch (error) {
          console.error('Failed to add challan deletion audit:', error);
        }
      }
      showToast('Challan deleted', 'info');
    }
  };

  const updateStatus = async (id: string, status: Challan['status']) => {
    if (status === 'DISPATCHED') {
      if (!confirm('Generate Gate Pass? Stock will be deducted and dispatch initiated.')) {
        return;
      }
      showToast('Gate Pass Generated successfully', 'success');
    }
    
    const updated = challans.map(c => c.id === id ? { ...c, status } : c);
    saveChallans(updated);
    const updatedChallan = updated.find(c => c.id === id);
    if (updatedChallan) {
      try {
        const currentUser = await modulesService.getCurrentUser();
        await modulesService.addAudit({
          action: 'Challan Status Updated',
          entity_type: 'challan',
          entity_id: updatedChallan.id,
          entity_name: updatedChallan.challan_no,
          reason: `Status changed to ${status}`,
          performed_by: currentUser?.email || 'Unknown',
          details: `${updatedChallan.project_name} | ${updatedChallan.vendor_name}`,
        });
      } catch (error) {
        console.error('Failed to add challan status audit:', error);
      }
    }
    if (viewingChallan?.id === id) {
      setViewingChallan({ ...viewingChallan, status });
    }
  };

  const filteredChallans = challans.filter(c => {
    const matchesSearch = 
      c.challan_no.toLowerCase().includes(search.toLowerCase()) ||
      c.project_name.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const paginatedChallans = filteredChallans.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Challans & Dispatch</h1>
          <p className={styles.subtitle}>Manage material dispatches and delivery tracking</p>
        </div>
        <button className={styles.primaryAction} onClick={() => setCreateOpen(true)}>
          <Truck size={18} />
          <span>New Dispatch</span>
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Shipments</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-amber)' }}>
            {challans.filter(c => c.status === 'DISPATCHED').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Delivered</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-green)' }}>
            {challans.filter(c => c.status === 'DELIVERED').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Dispatches</div>
          <div className={styles.statValue} style={{ color: 'var(--text-muted)' }}>
            {challans.filter(c => c.status === 'ISSUED').length}
          </div>
        </div>
      </div>

      <div className={styles.mainCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by Challan, Project or Vendor..." 
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filters}>
            <select 
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="ISSUED">Issued</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <button className={styles.actionBtn}>
              <Filter size={18} />
            </button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Challan No</th>
              <th>Project & PO</th>
              <th>Dispatch Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedChallans.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No dispatch records found.
                </td>
              </tr>
            ) : (
              paginatedChallans.map((challan, index) => (
                <tr key={challan.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{(page - 1) * pageSize + index + 1}</td>
                  <td>
                    <div style={{ fontWeight: 800 }}>{challan.challan_no}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{challan.vendor_name}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{challan.project_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>{challan.po_no}</div>
                  </td>
                  <td>{challan.dispatch_date}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${
                      challan.status === 'DELIVERED' ? styles.statusDelivered : 
                      challan.status === 'DISPATCHED' ? styles.statusTransit : styles.statusPending
                    }`}>
                      {challan.status === 'DELIVERED' ? <CheckCircle2 size={12} /> : 
                       challan.status === 'DISPATCHED' ? <Truck size={12} /> : <Clock size={12} />}
                      {challan.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {challan.status === 'ISSUED' && (
                        <button 
                          className={styles.primaryAction} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
                          onClick={() => updateStatus(challan.id, 'DISPATCHED')}
                        >
                          <Truck size={12} /> Gate Pass
                        </button>
                      )}
                      {challan.status === 'DISPATCHED' && (
                        <button 
                          className={styles.primaryAction} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', whiteSpace: 'nowrap', background: 'var(--accent-green)' }}
                          onClick={() => updateStatus(challan.id, 'DELIVERED')}
                        >
                          <CheckCircle2 size={12} /> Mark Delivered
                        </button>
                      )}
                      
                      <button className={styles.actionBtn} title="View Details" onClick={() => setViewingChallan(challan)}>
                        <Eye size={16} />
                      </button>
                      
                      <button className={styles.actionBtn} title="Download / Print" onClick={() => {
                        setViewingChallan(challan);
                        setTimeout(() => window.print(), 100);
                      }}>
                        <Printer size={16} />
                      </button>
                      
                      <button 
                        className={styles.actionBtn} 
                        style={{ color: 'var(--text-secondary)' }} 
                        title="Delete"
                        onClick={() => {
                          if(confirm('Delete this record?')) deleteChallan(challan.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
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
          totalItems={filteredChallans.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="challans"
        />
      </div>

      {/* Create Challan Modal */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Create Delivery Challan</h2>
              <button className={styles.actionBtn} onClick={() => setCreateOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.fieldGroup} style={{ marginBottom: '1.5rem' }}>
                <label className={styles.fieldLabel}>Select Project *</label>
                <select 
                  className={styles.select}
                  style={{ width: '100%' }}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                >
                  <option value="">Choose Project...</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              {loadingBoq && <div style={{ textAlign: 'center', padding: '1rem' }}>Loading BOQ Items...</div>}

              {dispatchItems.length > 0 && (
                <div className={styles.itemSelection} style={{ border: 'none' }}>
                  <div className={styles.fieldLabel} style={{ marginBottom: '0.5rem' }}>Dispatch Items</div>
                  <div className={styles.itemHeader} style={{ gridTemplateColumns: '40px 2fr 80px 80px 80px 100px' }}>
                    <span>#</span>
                    <span>Item</span>
                    <span style={{ textAlign: 'center' }}>BOQ</span>
                    <span style={{ textAlign: 'center' }}>Deliv.</span>
                    <span style={{ textAlign: 'center' }}>Bal.</span>
                    <span style={{ textAlign: 'right' }}>Dispatch</span>
                  </div>
                  {dispatchItems.map((item, idx) => (
                    <div key={item.id} className={styles.itemRow} style={{ gridTemplateColumns: '40px 2fr 80px 80px 80px 100px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ textAlign: 'center' }}>{item.quantity}</span>
                      <span style={{ textAlign: 'center', color: 'var(--accent-green)' }}>{item.delivered}</span>
                      <span 
                        style={{ 
                          textAlign: 'center', 
                          color: 'var(--accent-amber)', 
                          fontWeight: 700, 
                          cursor: 'pointer',
                          textDecoration: 'underline dotted' 
                        }}
                        title="Click to dispatch entire balance"
                        onClick={() => updateDispatchQty(idx, item.balance.toString())}
                      >
                        {item.balance}
                      </span>
                      <input 
                        className={styles.input} 
                        style={{ 
                          padding: '0.25rem', 
                          textAlign: 'right', 
                          fontWeight: 800,
                          backgroundColor: '#f1f5f9'
                        }} 
                        type="number" 
                        value={item.dispatchQty}
                        max={item.balance}
                        onChange={(e) => updateDispatchQty(idx, e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionBtn} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className={styles.primaryAction} onClick={createChallan}>
                Generate Challan & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Challan Modal */}
      {viewingChallan && (
        <div className={styles.modalOverlay} onClick={() => setViewingChallan(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0 }}>{viewingChallan.challan_no}</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{viewingChallan.dispatch_date}</p>
              </div>
              <button className={styles.actionBtn} onClick={() => setViewingChallan(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div className={styles.fieldLabel}>Project</div>
                  <div style={{ fontWeight: 700 }}>{viewingChallan.project_name}</div>
                </div>
                <div>
                  <div className={styles.fieldLabel}>PO Ref</div>
                  <div style={{ fontWeight: 700 }}>{viewingChallan.po_no}</div>
                </div>
              </div>

              <div className={styles.fieldLabel}>Dispatched Items</div>
              <div className={styles.itemSelection} style={{ marginTop: '0.5rem' }}>
                <div className={styles.itemHeader} style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <span>Item Name</span>
                  <span style={{ textAlign: 'right' }}>Qty Dispatched</span>
                </div>
                {viewingChallan.items.map(item => (
                  <div key={item.id} className={styles.itemRow} style={{ gridTemplateColumns: '2fr 1fr' }}>
                    <span>{item.name}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '2rem' }}>
                <div className={styles.fieldLabel}>Update Status</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {(['ISSUED', 'DISPATCHED', 'DELIVERED'] as const).map(s => (
                    <button 
                      key={s} 
                      className={styles.primaryAction} 
                      style={{ 
                        flex: 1, 
                        background: viewingChallan.status === s ? 'var(--accent-blue)' : '#f1f5f9',
                        color: viewingChallan.status === s ? 'white' : '#475569',
                        fontSize: '0.65rem'
                      }}
                      onClick={() => updateStatus(viewingChallan.id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.primaryAction} 
                onClick={() => {
                  const originalTitle = document.title;
                  document.title = `Delivery_Challan_${viewingChallan.challan_no}`;
                  window.print();
                  document.title = originalTitle;
                }}
              >
                <FileText size={16} /> Download PDF / Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

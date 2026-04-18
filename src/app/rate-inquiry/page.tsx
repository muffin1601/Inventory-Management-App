"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './RateInquiry.module.css';
import { Plus, Eye, Trash2, Search, Filter } from 'lucide-react';
import { projectsService, type ProjectRecord, type BoqItemRecord } from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

const RATE_INQUIRY_KEY = 'ims_rate_inquiries_v1';
const PAGE_SIZE_OPTIONS = [5, 10, 20];

interface RateInquiryRecord {
  id: string;
  inquiry_number: string;
  project_ids: string[];
  project_names: string[];
  item_count: number;
  status: 'DRAFT' | 'SENT' | 'RECEIVED';
  created_at: string;
  updated_at: string;
  notes?: string;
}

interface RateInquiryState {
  inquiries: RateInquiryRecord[];
}

function readLocalInquiries(): RateInquiryRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(RATE_INQUIRY_KEY);
  if (!raw) return [];
  try {
    const state = JSON.parse(raw) as RateInquiryState;
    return Array.isArray(state.inquiries) ? state.inquiries : [];
  } catch {
    return [];
  }
}

function writeLocalInquiries(inquiries: RateInquiryRecord[]) {
  if (typeof window === 'undefined') return;
  const state: RateInquiryState = { inquiries };
  window.localStorage.setItem(RATE_INQUIRY_KEY, JSON.stringify(state));
}

function makeId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

function generateInquiryNumber(): string {
  const now = new Date();
  const timestamp = now.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RI-${now.getFullYear()}-${timestamp}${random}`;
}

function downloadExcel(items: BoqItemRecord[], projectName: string) {
  const csvData = [
    ['Rate Inquiry BOQ Export', `Project: ${projectName}`, `Date: ${new Date().toLocaleDateString()}`],
    [],
    ['Sr.No.', 'Item Name', 'Manufacturer', 'Unit', 'Quantity', 'Stock Status', 'Required', 'GST %', 'Transport Cost', 'Expected Delivery'],
    ...items.map((item, idx) => [
      (idx + 1).toString(),
      item.item_name,
      item.manufacturer || '',
      item.unit,
      item.quantity.toString(),
      item.delivered >= item.quantity ? 'In Stock' : 'Not in Stock',
      (item.quantity - item.delivered).toString(),
      '0',
      '0',
      '',
    ]),
  ];

  const csv = csvData
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `BOQ-${projectName}-${new Date().getTime()}.csv`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

export default function RateInquiryPage() {
  const { showToast } = useUi();
  const [inquiries, setInquiries] = useState<RateInquiryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RateInquiryRecord['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingInquiry, setViewingInquiry] = useState<RateInquiryRecord | null>(null);
  const [boqItems, setBoqItems] = useState<BoqItemRecord[]>([]);
  const [projectsMap, setProjectsMap] = useState<Map<string, ProjectRecord>>(new Map());

  // Load inquiries on mount
  useEffect(() => {
    const loadInquiries = async () => {
      const local = readLocalInquiries();
      setInquiries(local);
    };
    loadInquiries();
  }, []);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const result = await projectsService.listProjects();
        setProjects(result.projects);
        const map = new Map(result.projects.map((p) => [p.id, p]));
        setProjectsMap(map);
      } catch {
        showToast('Unable to load projects', 'error');
      }
    };
    loadProjects();
  }, [showToast]);

  // Load BOQ items when viewing inquiry
  useEffect(() => {
    if (!viewingInquiry) return;
    const loadBoq = async () => {
      try {
        const items: BoqItemRecord[] = [];
        for (const projectId of viewingInquiry.project_ids) {
          const result = await projectsService.listBoqItems(projectId);
          items.push(...result.items);
        }
        setBoqItems(items);
      } catch {
        showToast('Unable to load BOQ items', 'error');
      }
    };
    loadBoq();
  }, [viewingInquiry, showToast]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inquiry) => {
      const matchesSearch = search === '' || inquiry.inquiry_number.toLowerCase().includes(search.toLowerCase()) || inquiry.project_names.some((name) => name.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || inquiry.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [inquiries, search, statusFilter]);

  const paginatedInquiries = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredInquiries.slice(startIndex, startIndex + pageSize);
  }, [filteredInquiries, page, pageSize]);

  const totalPages = useMemo(() => Math.ceil(filteredInquiries.length / pageSize), [filteredInquiries.length, pageSize]);

  const createInquiry = () => {
    if (selectedProjects.size === 0) {
      showToast('Please select at least one project', 'error');
      return;
    }

    const projectIds = Array.from(selectedProjects);
    const projectNames = projectIds.map((id) => projectsMap.get(id)?.name || '').filter(Boolean);

    const inquiry: RateInquiryRecord = {
      id: makeId('ri'),
      inquiry_number: generateInquiryNumber(),
      project_ids: projectIds,
      project_names: projectNames,
      item_count: 0,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: '',
    };

    const updated = [inquiry, ...inquiries];
    setInquiries(updated);
    writeLocalInquiries(updated);
    setSelectedProjects(new Set());
    setCreateOpen(false);
    showToast('Rate inquiry created successfully', 'success');
  };

  const deleteInquiry = (inquiryId: string) => {
    if (!confirm('Are you sure you want to delete this inquiry?')) return;
    const updated = inquiries.filter((i) => i.id !== inquiryId);
    setInquiries(updated);
    writeLocalInquiries(updated);
    showToast('Rate inquiry deleted', 'success');
  };

  const updateStatus = (inquiryId: string, newStatus: RateInquiryRecord['status']) => {
    const updated = inquiries.map((i) => (i.id === inquiryId ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i));
    setInquiries(updated);
    writeLocalInquiries(updated);
    showToast(`Status updated to ${newStatus}`, 'success');
  };

  const handleExportBoq = () => {
    if (!viewingInquiry || boqItems.length === 0) {
      showToast('No BOQ items to export', 'warning');
      return;
    }

    const projectName = viewingInquiry.project_names[0] || 'BOQ';
    downloadExcel(boqItems, projectName);
    showToast('BOQ exported successfully', 'success');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rate Inquiry</h1>
          <p className={styles.subtitle}>Create and manage rate inquiries from your project bill of quantities</p>
        </div>
        <button className={styles.primaryAction} onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          <span>New Inquiry</span>
        </button>
      </div>

      {createOpen && (
        <div className={styles.bulkModalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div>
                <h2 className={styles.title} style={{ fontSize: '1.25rem', margin: 0 }}>Create Rate Inquiry</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Select projects for this inquiry
                </p>
              </div>
              <button className={styles.actionBtn} onClick={() => setCreateOpen(false)} style={{ fontSize: '1.5rem', padding: '0' }} title="Close">
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody}>
              <label className={styles.fieldLabel}>Select Projects</label>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                Choose one or multiple projects
              </p>
              <div className={styles.projectCheckbox}>
                {projects.map((project) => (
                  <div key={project.id} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      id={`project-${project.id}`}
                      checked={selectedProjects.has(project.id)}
                      onChange={(e) => {
                        const next = new Set(selectedProjects);
                        if (e.target.checked) {
                          next.add(project.id);
                        } else {
                          next.delete(project.id);
                        }
                        setSelectedProjects(next);
                      }}
                    />
                    <label htmlFor={`project-${project.id}`} className={styles.checkboxLabel}>
                      <span className={styles.checkboxLabelText}>{project.name}</span>
                      <span className={styles.checkboxLabelMeta}>{project.client_name || 'No client'}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button className={styles.submitBtn} onClick={createInquiry} disabled={selectedProjects.size === 0}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingInquiry && (
        <div className={styles.bulkModalOverlay} onClick={() => setViewingInquiry(null)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div>
                <h2 className={styles.title} style={{ fontSize: '1.25rem', margin: 0 }}>Inquiry Details</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{viewingInquiry.inquiry_number}</p>
              </div>
              <button className={styles.actionBtn} onClick={() => setViewingInquiry(null)} style={{ fontSize: '1.5rem', padding: '0' }} title="Close">
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className={styles.fieldLabel}>Projects</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {viewingInquiry.project_names.map((name, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'var(--accent-primary)',
                        color: 'white',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className={styles.fieldLabel}>Status</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {(['DRAFT', 'SENT', 'RECEIVED'] as const).map((status) => (
                    <button
                      key={status}
                      className={styles.submitBtn}
                      onClick={() => {
                        updateStatus(viewingInquiry.id, status);
                        setViewingInquiry({ ...viewingInquiry, status });
                      }}
                      style={{ 
                        opacity: viewingInquiry.status === status ? 1 : 0.5,
                        flex: '1 1 auto',
                        minWidth: '80px'
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem', maxHeight: '250px', overflowY: 'auto' }}>
                <label className={styles.fieldLabel}>BOQ Items ({boqItems.length})</label>
                {boqItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No BOQ items in selected projects</p>
                ) : (
                  <table className={styles.table} style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.5rem' }}>Item</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boqItems.map((item) => (
                        <tr key={item.id}>
                          <td style={{ padding: '0.5rem' }}>
                            <strong style={{ fontSize: '0.85rem' }}>{item.item_name}</strong>
                            {item.manufacturer && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.manufacturer}</div>}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.delivered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setViewingInquiry(null)}>
                Close
              </button>
              <button className={styles.submitBtn} onClick={handleExportBoq} disabled={boqItems.length === 0}>
                Export to Excel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Find inquiry number or project..." 
              className={styles.searchInput} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | RateInquiryRecord['status'])}>
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft (Editing)</option>
              <option value="SENT">Sent (Waiting for quotes)</option>
              <option value="RECEIVED">Received (Quotes received)</option>
            </select>
            <button className={styles.iconButton}>
              <Filter size={18} />
            </button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Projects</th>
              <th>Items</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInquiries.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  {inquiries.length === 0 
                    ? 'No inquiries yet. Create one to get started.' 
                    : 'No inquiries match your filters.'}
                </td>
              </tr>
            ) : (
              paginatedInquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td>
                    <strong>{inquiry.inquiry_number}</strong>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {inquiry.project_names.map((name, idx) => (
                        <span key={idx} style={{ display: 'block' }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong>{inquiry.item_count}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        inquiry.status === 'DRAFT'
                          ? styles.statusDraft
                          : inquiry.status === 'SENT'
                            ? styles.statusSent
                            : styles.statusReceived
                      }
                    >
                      {inquiry.status.toLowerCase()}
                    </span>
                  </td>
                  <td>{new Date(inquiry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button className={styles.actionBtn} title="View details" onClick={() => setViewingInquiry(inquiry)}>
                        <Eye size={16} />
                      </button>
                      <button className={styles.actionBtn} title="Delete" onClick={() => deleteInquiry(inquiry.id)}>
                        <Trash2 size={16} color="#ef4444" />
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
          totalItems={filteredInquiries.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="inquiries"
        />
      </div>
    </div>
  );
}


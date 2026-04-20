"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './RateInquiry.module.css';
import { Plus, Eye, Trash2, Search, Filter, FileText, Upload, Download, CheckCircle2, TrendingDown, Clock, ShieldCheck, ArrowRight, Building2 } from 'lucide-react';
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
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'PO_CREATED';
  created_at: string;
  updated_at: string;
  notes?: string;
  selected_vendor_id?: string;
  selected_vendor_name?: string;
  po_id?: string;
}

interface VendorOption {
  id: string;
  name: string;
  payment_terms?: string;
  gstin?: string;
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
    ['Sr.No.', 'Item Name', 'Manufacturer', 'Unit', 'Quantity', 'Stock Status', 'Required', 'Unit Rate (Excl GST)', 'GST %', 'Transport Cost', 'Expected Delivery'],
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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RateInquiryContent />
    </Suspense>
  );
}

function RateInquiryContent() {
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'list' | 'compare'>((tabParam === 'compare' ? 'compare' : 'list') as 'list' | 'compare');
  const [vendorsList, setVendorsList] = useState<VendorOption[]>([]);
  const [selectedVendor1, setSelectedVendor1] = useState('');
  const [selectedVendor2, setSelectedVendor2] = useState('');
  const [compareFocus, setCompareFocus] = useState<'rates' | 'delivery' | 'transport' | 'landed'>('landed');
  
  const currentInquiryId = searchParams.get('id');

  // Sync state with URL
  useEffect(() => {
    if (tabParam === 'compare') setActiveTab('compare');
    else setActiveTab('list');
  }, [tabParam]);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase.from('vendors').select('id, name').order('name');
        
        // Read local storage fallback exactly like the Vendors page
        let savedDetails: any = {};
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('ims_vendor_details_v1');
          if (raw) savedDetails = JSON.parse(raw);
        }

        if (error) {
          console.error('Fetch vendors error:', error);
          // Fallback samples
          setVendorsList([
            { id: 'v1', name: 'Vendor A (Sample)', payment_terms: '30 Days', gstin: '27AAAAA0000A1Z5' },
            { id: 'v2', name: 'Vendor B (Sample)', payment_terms: 'Immediate', gstin: '27BBBBB1111B2Z6' }
          ]);
          return;
        }

        if (data && data.length > 0) {
          const formatted = data.map(v => ({
            id: v.id,
            name: v.name,
            payment_terms: v.payment_terms || savedDetails[v.id]?.payment_terms || '30 Days',
            gstin: v.gstin || savedDetails[v.id]?.gstin || 'N/A'
          }));
          setVendorsList(formatted);
        } else {
          setVendorsList([
            { id: 'v1', name: 'Vendor A (Sample)', payment_terms: '30 Days', gstin: '27AAAAA0000A1Z5' },
            { id: 'v2', name: 'Vendor B (Sample)', payment_terms: 'Immediate', gstin: '27BBBBB1111B2Z6' }
          ]);
        }
      } catch (err) {
        console.error('Vendor catch error:', err);
      }
    };
    fetchVendors();
  }, []);

  const handleTabChange = (tab: 'list' | 'compare', inquiryId?: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === 'compare') {
      params.set('tab', 'compare');
      if (inquiryId) params.set('id', inquiryId);
    } else {
      params.delete('tab');
      params.delete('id');
    }
    router.push(`/rate-inquiry?${params.toString()}`);
  };

  // Rate Comparison State
  const [csv1, setCsv1] = useState<{ name: string; vendorName: string; details: string; data: any[]; vendorId?: string } | null>(null);
  const [csv2, setCsv2] = useState<{ name: string; vendorName: string; details: string; data: any[]; vendorId?: string } | null>(null);
  const [compResults, setCompResults] = useState<any[]>([]);
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

  const createInquiry = async () => {
    if (selectedProjects.size === 0) {
      showToast('Please select at least one project', 'error');
      return;
    }

      const projectIds = Array.from(selectedProjects);
      const projectNames = projectIds.map((id) => projectsMap.get(id)?.name || '').filter(Boolean);
      
      // Calculate total item count across all selected projects
      let itemCount = 0;
      try {
        for (const pid of projectIds) {
          const res = await projectsService.listBoqItems(pid);
          itemCount += res.items.length;
        }
      } catch (e) {
        console.error("Failed to count items", e);
      }

      const inquiry: RateInquiryRecord = {
        id: makeId('ri'),
        inquiry_number: generateInquiryNumber(),
        project_ids: projectIds,
        project_names: projectNames,
        item_count: itemCount,
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
      showToast('No BOQ items to export', 'info');
      return;
    }

    const projectName = viewingInquiry.project_names[0] || 'BOQ';
    downloadExcel(boqItems, projectName);
    showToast('BOQ exported successfully', 'success');
  };

  // --- Rate Comparison Helpers ---
  const parseCSV = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('item name')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) headerIdx = 0;

    const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$|^'|'$/g, ''));
    const rows = lines.slice(headerIdx + 1).map(line => {
      // Handle commas inside quotes properly
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim());
      
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = parts[i] || '';
      });
      return obj;
    });
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setCsv: (val: any) => void, vendorId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      
      const vendor = vendorsList.find(v => v.id === vendorId);
      const vendorName = vendor?.name || file.name.split('.')[0] || 'Unknown Vendor';
      
      setCsv({ 
        name: file.name, 
        vendorName, 
        vendorId,
        details: vendor ? `Verified | GST: ${vendor.gstin || 'N/A'} | Terms: ${vendor.payment_terms || '30 Days'}` : 'External Quote',
        data 
      });
      showToast(`${vendorName} quote uploaded`, 'success');
    };
    reader.readAsText(file);
  };

  const findHeader = (data: any[], candidates: string[]) => {
    if (data.length === 0) return null;
    const item = data[0];
    const keys = Object.keys(item);
    for (const cand of candidates) {
      const match = keys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
      if (match) return match;
    }
    return null;
  };

  const compareRates = () => {
    if (!csv1 || !csv2) return;

    const findH = (data: any[], cands: string[]) => findHeader(data, cands);

    const nh1 = findH(csv1.data, ['item name', 'description', 'item']);
    const rh1 = findH(csv1.data, ['unit rate', 'rate', 'price', 'unit cost']);
    const gh1 = findH(csv1.data, ['gst', 'tax']);
    const th1 = findH(csv1.data, ['transport', 'freight']);
    const dh1 = findH(csv1.data, ['delivery', 'days', 'lead time']);

    const nh2 = findH(csv2.data, ['item name', 'description', 'item']);
    const rh2 = findH(csv2.data, ['unit rate', 'rate', 'price', 'unit cost']);
    const gh2 = findH(csv2.data, ['gst', 'tax']);
    const th2 = findH(csv2.data, ['transport', 'freight']);
    const dh2 = findH(csv2.data, ['delivery', 'days', 'lead time']);

    if (!nh1 || !rh1 || !nh2 || !rh2) {
      showToast('Required columns (Item Name, Unit Rate) not found', 'error');
      return;
    }

    const results: any[] = [];
    let total1 = 0;
    let total2 = 0;

    csv1.data.forEach((item1) => {
      const name = item1[nh1];
      if (!name) return;

      const item2 = csv2.data.find(i => (i[nh2] || '').toLowerCase().trim() === name.toLowerCase().trim());
      
      const parseVal = (v: any) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
      const parseDays = (v: any) => parseInt(String(v).replace(/[^0-9]/g, '')) || 0;

      const r1 = parseVal(item1[rh1]);
      const g1 = parseVal(item1[gh1 || '']);
      const t1 = parseVal(item1[th1 || '']);
      const d1 = parseDays(item1[dh1 || '']);
      const l1 = r1 * (1 + g1/100) + t1;

      const r2 = item2 ? parseVal(item2[rh2]) : null;
      const g2 = item2 ? parseVal(item2[gh2 || '']) : 0;
      const t2 = item2 ? parseVal(item2[th2 || '']) : 0;
      const d2 = item2 ? parseDays(item2[dh2 || '']) : 0;
      const l2 = r2 !== null ? r2 * (1 + g2/100) + t2 : null;

      total1 += l1;
      if (l2 !== null) total2 += l2;

      results.push({
        name,
        v1: { rate: r1, gst: g1, transport: t1, landed: l1, delivery: d1, deliveryText: item1[dh1 || ''] },
        v2: { rate: r2, gst: g2, transport: t2, landed: l2, delivery: d2, deliveryText: item2 ? item2[dh2 || ''] : null },
      });
    });

    setCompResults(results);
    showToast('Comparison updated', 'success');
  };

  const downloadComparisonCSV = () => {
    if (compResults.length === 0) return;

    const v1Name = csv1?.vendorName || 'Vendor 1';
    const v2Name = csv2?.vendorName || 'Vendor 2';

    const headers = [
      'Item Description',
      `${v1Name} - Unit Rate`,
      `${v1Name} - Freight`,
      `${v1Name} - Lead Time`,
      `${v1Name} - Landed Total`,
      `${v2Name} - Unit Rate`,
      `${v2Name} - Freight`,
      `${v2Name} - Lead Time`,
      `${v2Name} - Landed Total`,
      'Price Difference',
      'Percentage %'
    ];

    const rows = compResults.map(res => {
      const diff = res.v2.landed !== null ? res.v2.landed - res.v1.landed : 0;
      const pct = (res.v1.landed > 0) ? (diff / res.v1.landed) * 100 : 0;

      return [
        res.name,
        res.v1.rate,
        res.v1.transport,
        res.v1.deliveryText || 'N/A',
        res.v1.landed,
        res.v2.rate || 0,
        res.v2.transport || 0,
        res.v2.deliveryText || 'N/A',
        res.v2.landed || 0,
        diff,
        `${pct.toFixed(2)}%`
      ];
    });

    const csvContent = [
      ['Comparative Analysis Report', `Date: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows
    ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Comparison_${v1Name}_vs_${v2Name}_${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreatePoFromComparison = (vendorIdx: 1 | 2) => {
    const csv = vendorIdx === 1 ? csv1 : csv2;
    if (!csv) return;
    
    if (currentInquiryId) {
      const local = readLocalInquiries();
      const updated = local.map(iq => {
        if (iq.id === currentInquiryId) {
          return {
            ...iq,
            selected_vendor_id: csv.vendorId,
            selected_vendor_name: csv.vendorName,
            status: 'PO_CREATED' as const,
            updated_at: new Date().toISOString(),
            po_id: `PO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
          };
        }
        return iq;
      });
      writeLocalInquiries(updated);
      setInquiries(updated);
    }

    showToast(`PO Created for ${csv.vendorName}. Redirecting...`, 'success');
    
    setTimeout(() => {
      router.push('/orders?new=true'); // Redirecting to PO module
    }, 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rate Inquiry</h1>
          <p className={styles.subtitle}>Create enquiries and compare vendor quotes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className={styles.primaryAction} onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            <span>New Inquiry</span>
          </button>
        </div>
      </div>

      <div className={styles.tabContainer}>
        <button 
          className={`${styles.tab} ${activeTab === 'list' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('list')}
        >
          Enquiry List
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'compare' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('compare')}
        >
          Compare Quotes
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
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
                            background: '#111111',
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
                    <Download size={16} />
                    <span>Export to Excel</span>
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
                  <option value="SENT">Sent (Wait quotes)</option>
                  <option value="RECEIVED">Received</option>
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
                  <th>Status</th>
                  <th>Selection</th>
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
                              {name}{idx < inquiry.project_names.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={
                          inquiry.status === 'PO_CREATED' ? styles.statusReceived :
                          inquiry.status === 'RECEIVED' ? styles.statusReceived : 
                          inquiry.status === 'SENT' ? styles.statusSent : 
                          styles.statusDraft
                        }>
                          {inquiry.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {inquiry.selected_vendor_name ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{inquiry.selected_vendor_name}</div>
                            {inquiry.po_id && <div style={{ fontSize: '0.7rem', color: '#111111' }}>{inquiry.po_id}</div>}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Pending Selection</span>
                        )}
                      </td>
                      <td>{new Date(inquiry.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button 
                            className={styles.compareBtn} 
                            onClick={() => handleTabChange('compare', inquiry.id)}
                          >
                            Compare
                          </button>
                          <button className={styles.actionBtn} title="View details" onClick={() => setViewingInquiry(inquiry)}>
                            <Eye size={16} />
                          </button>
                          <button className={styles.actionBtn} title="Delete" onClick={() => deleteInquiry(inquiry.id)}>
                            <Trash2 size={16} color="currentColor" />
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {currentInquiryId && (
            <div style={{ 
              background: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              padding: '1rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase' }}>Comparing for Enquiry:</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111111' }}>
                  {inquiries.find(i => i.id === currentInquiryId)?.inquiry_number || 'Loading...'}
                </div>
              </div>
              <button className={styles.secondaryAction} onClick={() => handleTabChange('list')}>
                Cancel & Close
              </button>
            </div>
          )}

          <div className={styles.card} style={{ padding: '1.5rem' }}>
            <div className={styles.compareGrid}>
            {[1, 2].map((num) => {
              const csv = num === 1 ? csv1 : csv2;
              const selectedVendorId = num === 1 ? selectedVendor1 : selectedVendor2;
              const setSelectedVendorId = num === 1 ? setSelectedVendor1 : setSelectedVendor2;
              const setCsv = num === 1 ? setCsv1 : setCsv2;

              return (
                <div key={num} className={styles.uploadBox} style={{ borderStyle: csv ? 'solid' : 'dashed', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <Building2 size={20} color="currentColor" />
                    </div>
                    
                    <label className={styles.fieldLabel} style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>1. Select Vendor from Library</label>
                    <select 
                      className={styles.select} 
                      style={{ width: '100%', marginBottom: '1.25rem', border: '1px solid #d1d5db' }}
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                    >
                      <option value="">-- Choose Vendor First --</option>
                      {vendorsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>

                    <label className={styles.fieldLabel} style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>2. Upload Quote File</label>
                    {csv ? (
                      <div className={styles.fileName} style={{ width: '100%', justifyContent: 'space-between', borderRadius: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={16} color="currentColor" /> 
                          <span style={{ fontSize: '0.85rem' }}>{csv.name}</span>
                        </div>
                        <button className={styles.actionBtn} onClick={() => setCsv(null)}>
                          <Trash2 size={14} color="currentColor" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => handleFileUpload(e, setCsv, selectedVendorId)}
                          style={{ display: 'none' }}
                          id={`csv-upload-${num}`}
                        />
                        <button 
                          className={styles.primaryAction} 
                          onClick={() => document.getElementById(`csv-upload-${num}`)?.click()}
                          style={{ 
                            width: '100%', 
                            background: selectedVendorId ? '#111111' : '#f5f5f5',
                            color: selectedVendorId ? 'white' : 'var(--text-secondary)',
                            border: selectedVendorId ? 'none' : '1px solid #d1d5db',
                            cursor: selectedVendorId ? 'pointer' : 'not-allowed'
                          }}
                          disabled={!selectedVendorId}
                        >
                          <Upload size={16} /> {selectedVendorId ? 'Select CSV File' : 'Pick Vendor First'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {csv1 && csv2 && (
            <div style={{ background: '#f5f5f5', border: '1px solid #d1d5db', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#111111' }}>Comparison Focus</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select priority to highlight the best performing vendor</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px' }}>
                  {(['rates', 'delivery', 'transport', 'landed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setCompareFocus(f)}
                      style={{ 
                        padding: '6px 16px', 
                        background: compareFocus === f ? '#111111' : 'transparent',
                        color: compareFocus === f ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        borderRadius: 0
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <button 
                  className={styles.primaryAction} 
                  onClick={compareRates}
                  style={{ padding: '12px 60px', fontSize: '1rem', background: '#111111' }}
                >
                  Generate Comparative Analysis
                </button>
              </div>
            </div>
          )}

          {compResults.length > 0 && (
            <div className={styles.compareDashboard}>
              <div className={styles.vendorSummaryGrid}>
                {[csv1, csv2].map((csv, idx) => {
                  const vIdx = idx + 1;
                  const totalLanded = compResults.reduce((acc, r) => acc + (vIdx === 1 ? r.v1.landed : (r.v2.landed || 0)), 0);
                  const totalTransport = compResults.reduce((acc, r) => acc + (vIdx === 1 ? r.v1.transport : (r.v2.transport || 0)), 0);
                  const maxDelivery = Math.max(...compResults.map(r => vIdx === 1 ? r.v1.delivery : (r.v2.delivery || 0)));
                  
                  const isLowest = idx === 0 
                    ? totalLanded < compResults.reduce((acc, r) => acc + (r.v2.landed || Infinity), 0)
                    : totalLanded < compResults.reduce((acc, r) => acc + r.v1.landed, 0);

                  const otherMaxDelivery = Math.max(...compResults.map(r => vIdx === 1 ? (r.v2.delivery || Infinity) : r.v1.delivery));
                  const isFastest = maxDelivery < otherMaxDelivery;

                  return (
                    <div key={idx} className={`${styles.vendorCard} ${isLowest ? styles.vendorCardActive : ''}`}>
                      <div className={styles.vendorHeader}>
                        <div className={styles.vendorInfo}>
                          <div className={styles.vendorAvatar}>{(csv?.vendorName || 'V').charAt(0).toUpperCase()}</div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b' }}>{csv?.vendorName}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{csv?.details}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {isLowest && (
                            <span className={`${styles.badge} ${styles.badgeLowest}`}>
                              <TrendingDown size={12} /> Lowest Price
                            </span>
                          )}
                          {isFastest && (
                            <span className={`${styles.badge} ${styles.badgeFastest}`}>
                              <Clock size={12} /> Fastest
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.vendorStats}>
                        <div className={styles.statRow}>
                          <span style={{ color: '#64748b' }}>Total Transport Cost</span>
                          <span className={styles.statValue}>₹{totalTransport.toLocaleString()}</span>
                        </div>
                        <div className={styles.statRow}>
                          <span style={{ color: '#64748b' }}>Delivery Timeline</span>
                          <span className={styles.statValue} style={{ color: 'inherit' }}>
                            {maxDelivery > 0 ? `${maxDelivery} Days (Max)` : 'Ready Stock'}
                          </span>
                        </div>
                        <div className={styles.statRow} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '2px solid #f1f5f9' }}>
                          <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>Landed Total</span>
                          <span className={styles.statValue} style={{ fontSize: '1.4rem', color: '#1e1b4b', letterSpacing: '-0.5px' }}>
                            ₹{totalLanded.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button className={styles.selectPoBtn} onClick={() => handleCreatePoFromComparison(vIdx as 1|2)}>
                        Select & Create PO <ArrowRight size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className={styles.comparisonTableWrapper}>
                <div className={styles.comparisonTableHeader}>
                  <h3 style={{ margin: 0 }}>Item-by-Item Analysis</h3>
                  <button className={styles.actionBtn} onClick={downloadComparisonCSV}>
                    <Download size={16} /> Download Report
                  </button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item Description</th>
                    <th>{csv1?.vendorName || 'Vendor 1'}</th>
                    <th>{csv2?.vendorName || 'Vendor 2'}</th>
                      <th>Landed Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compResults.map((res, i) => {
                      const diff = res.v2.landed !== null ? res.v2.landed - res.v1.landed : null;
                      const pct = (diff !== null && res.v1.landed > 0) ? (diff / res.v1.landed) * 100 : null;

                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{res.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unit Rate Comparison</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>₹{res.v1.rate.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Freight: ₹{res.v1.transport} | Lead: {res.v1.deliveryText || '-'}
                            </div>
                            <div className={styles.landedCost}>Landed: ₹{res.v1.landed.toLocaleString()}</div>
                          </td>
                          <td>
                            {res.v2.landed !== null ? (
                              <>
                                <div style={{ fontWeight: 600 }}>₹{(res.v2.rate || 0).toLocaleString()}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Freight: ₹{res.v2.transport} | Lead: {res.v2.deliveryText || '-'}
                                </div>
                                <div className={styles.landedCost}>Landed: ₹{res.v2.landed.toLocaleString()}</div>
                              </>
                            ) : '-'}
                          </td>
                          <td>
                            {diff !== null ? (
                              <div className={`${styles.priceChange} ${diff < 0 ? styles.better : diff > 0 ? styles.worse : styles.neutral}`}>
                                {diff > 0 ? '+' : ''}₹{diff.toLocaleString()}
                                <div className={styles.itemDiff}>({pct?.toFixed(1)}%)</div>
                              </div>
                            ) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


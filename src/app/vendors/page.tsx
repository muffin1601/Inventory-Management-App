"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Vendors.module.css';
import { Search, Plus, Pencil, Building2, Mail, Phone, MapPin, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { modulesService } from '@/lib/services/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

type VendorStatus = 'ACTIVE' | 'INACTIVE';

type VendorRecord = {
  id: string;
  name: string;
  status: VendorStatus;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  delivery_address?: string | null;
  gstin?: string | null;
  payment_terms?: string | null;
  created_at?: string | null;
};

type VendorFormState = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  payment_terms: string;
  status: VendorStatus;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];
const VENDOR_DETAILS_KEY = 'ims_vendor_details_v1';

const EMPTY_FORM: VendorFormState = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  payment_terms: 'Immediate',
  status: 'ACTIVE',
};

function normalizeVendor(row: Record<string, unknown>): VendorRecord {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    status: String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    contact_person: typeof row.contact_person === 'string' ? row.contact_person : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    email: typeof row.email === 'string' ? row.email : '',
    delivery_address:
      typeof row.delivery_address === 'string'
        ? row.delivery_address
        : typeof row.address === 'string'
        ? row.address
        : typeof row.city === 'string'
        ? row.city
        : '',
    gstin: typeof row.gstin === 'string' ? row.gstin : '',
    payment_terms: typeof row.payment_terms === 'string' ? row.payment_terms : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

function readVendorDetails(): Record<string, Partial<VendorRecord>> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(VENDOR_DETAILS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Partial<VendorRecord>>;
  } catch {
    return {};
  }
}

function writeVendorDetails(details: Record<string, Partial<VendorRecord>>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VENDOR_DETAILS_KEY, JSON.stringify(details));
}

function buildVendorPayload(form: VendorFormState) {
  return {
    name: form.name.trim(),
    status: form.status,
    contact_person: form.contact_person.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    delivery_address: form.address.trim(),
    gstin: form.gstin.trim(),
    payment_terms: form.payment_terms.trim(),
  };
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return candidate.code === '42703' || candidate.code === 'PGRST204' || message.includes('column');
}

export default function VendorsPage() {
  const { showToast, confirmAction } = useUi();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VendorStatus>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);

  const loadVendors = useCallback(async () => {
    const { data, error } = await supabase.from('vendors').select('*').order('name');
    if (error) {
      console.error('Failed to load vendors:', error);
      showToast('Could not load vendors right now.', 'error');
      return;
    }
    const savedDetails = readVendorDetails();
    setVendors(
      (data || []).map((row) => {
        const normalized = normalizeVendor(row as Record<string, unknown>);
        return {
          ...normalized,
          ...(savedDetails[normalized.id] || {}),
          id: normalized.id,
          name: normalized.name,
          status: normalized.status,
        };
      }),
    );
  }, [showToast]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const filteredVendors = useMemo(() => {
    const query = search.toLowerCase();
    return vendors.filter((vendor) => {
      const matchesSearch =
        vendor.name.toLowerCase().includes(query) ||
        (vendor.contact_person || '').toLowerCase().includes(query) ||
        (vendor.email || '').toLowerCase().includes(query) ||
        (vendor.phone || '').toLowerCase().includes(query) ||
        (vendor.delivery_address || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || vendor.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, vendors]);

  const paginatedVendors = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredVendors.slice(startIndex, startIndex + pageSize);
  }, [filteredVendors, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize, vendors.length]);

  function openCreateModal() {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(vendor: VendorRecord) {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name || '',
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.delivery_address || '',
      gstin: vendor.gstin || '',
      payment_terms: vendor.payment_terms || 'Immediate',
      status: vendor.status,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingVendor(null);
    setForm(EMPTY_FORM);
  }

  async function saveVendor() {
    if (!form.name.trim()) {
      showToast('Vendor name is required.', 'error');
      return;
    }

    const payload = buildVendorPayload(form);
    setIsSubmitting(true);

    try {
      if (editingVendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', editingVendor.id);
        if (error && isMissingColumnError(error)) {
          const { error: fallbackError } = await supabase
            .from('vendors')
            .update({ name: payload.name, status: payload.status })
            .eq('id', editingVendor.id);
          if (fallbackError) throw fallbackError;
        } else if (error) {
          throw error;
        }
        const savedDetails = readVendorDetails();
        writeVendorDetails({
          ...savedDetails,
          [editingVendor.id]: {
            contact_person: payload.contact_person,
            phone: payload.phone,
            email: payload.email,
            delivery_address: payload.delivery_address,
            gstin: payload.gstin,
            payment_terms: payload.payment_terms,
          },
        });
        showToast('Vendor updated successfully.', 'success');
      } else {
        const { data: insertedRows, error } = await supabase.from('vendors').insert(payload).select('id');
        if (error && isMissingColumnError(error)) {
          const { data: fallbackRows, error: fallbackError } = await supabase
            .from('vendors')
            .insert({ name: payload.name, status: payload.status })
            .select('id');
          if (fallbackError) throw fallbackError;
          const insertedId = fallbackRows?.[0]?.id;
          if (insertedId) {
            const savedDetails = readVendorDetails();
            writeVendorDetails({
              ...savedDetails,
              [insertedId]: {
                contact_person: payload.contact_person,
                phone: payload.phone,
                email: payload.email,
                delivery_address: payload.delivery_address,
                gstin: payload.gstin,
                payment_terms: payload.payment_terms,
              },
            });
          }
        } else if (error) {
          throw error;
        } else {
          const insertedId = insertedRows?.[0]?.id;
          if (insertedId) {
            const savedDetails = readVendorDetails();
            writeVendorDetails({
              ...savedDetails,
              [insertedId]: {
                contact_person: payload.contact_person,
                phone: payload.phone,
                email: payload.email,
                delivery_address: payload.delivery_address,
                gstin: payload.gstin,
                payment_terms: payload.payment_terms,
              },
            });
          }
        }
        showToast('Vendor added successfully.', 'success');
      }

      closeModal();
      await loadVendors();
    } catch (error) {
      console.error('Failed to save vendor:', error);
      showToast('Could not save this vendor.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleVendorStatus(vendor: VendorRecord) {
    const nextStatus: VendorStatus = vendor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmation = await confirmAction({
      title: `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} vendor?`,
      message: `This will mark ${vendor.name} as ${nextStatus.toLowerCase()}.`,
      confirmText: nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate',
      requireReason: true,
      reasonLabel: 'Status change reason',
      reasonPlaceholder: 'Why are you changing this vendor status?',
    });
    if (!confirmation.confirmed) return;

    try {
      const { error } = await supabase.from('vendors').update({ status: nextStatus }).eq('id', vendor.id);
      if (error) throw error;
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Vendor Status Changed',
        entity_type: 'vendor',
        entity_id: vendor.id,
        entity_name: vendor.name,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: `Changed to ${nextStatus}`,
      });
      await loadVendors();
      showToast(`Vendor ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`, 'success');
    } catch (error) {
      console.error('Failed to update vendor status:', error);
      showToast('Could not update vendor status.', 'error');
    }
  }

  async function deleteVendor(vendor: VendorRecord) {
    const confirmation = await confirmAction({
      title: 'Delete vendor?',
      message: `This will remove ${vendor.name} from the vendor list.`,
      confirmText: 'Delete',
      requireReason: true,
      reasonLabel: 'Deletion reason',
      reasonPlaceholder: 'Why are you deleting this vendor?',
    });
    if (!confirmation.confirmed) return;

    try {
      const { error } = await supabase.from('vendors').delete().eq('id', vendor.id);
      if (error) throw error;
      const savedDetails = readVendorDetails();
      delete savedDetails[vendor.id];
      writeVendorDetails(savedDetails);
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Vendor Deleted',
        entity_type: 'vendor',
        entity_id: vendor.id,
        entity_name: vendor.name,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: 'Removed from vendor list',
      });
      await loadVendors();
      showToast('Vendor deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      showToast('Could not delete this vendor.', 'error');
    }
  }

  const activeCount = vendors.filter((vendor) => vendor.status === 'ACTIVE').length;
  const inactiveCount = vendors.filter((vendor) => vendor.status === 'INACTIVE').length;
  const withEmailCount = vendors.filter((vendor) => (vendor.email || '').trim().length > 0).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendors</h1>
          <p className={styles.subtitle}>Manage supplier records, contact details, and readiness for purchasing in one place.</p>
        </div>
        <button type="button" className={styles.primaryAction} onClick={openCreateModal}>
          <Plus size={15} />
          Add Vendor
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Vendors</span>
          <strong className={styles.statValue}>{vendors.length}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active</span>
          <strong className={styles.statValue}>{activeCount}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Inactive</span>
          <strong className={styles.statValue}>{inactiveCount}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>With Email</span>
          <strong className={styles.statValue}>{withEmailCount}</strong>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search vendor, contact, phone, or address..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | VendorStatus)}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Terms</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>No vendors found. Add your first supplier to get started.</td>
              </tr>
            ) : paginatedVendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>
                  <div className={styles.vendorName}>
                    <Building2 size={15} />
                    <span>{vendor.name}</span>
                  </div>
                  {vendor.gstin ? <div className={styles.metaText}>GSTIN: {vendor.gstin}</div> : null}
                </td>
                <td>
                  <div className={styles.infoStack}>
                    <span>{vendor.contact_person || 'No contact person'}</span>
                    {vendor.email ? <span className={styles.metaLine}><Mail size={13} /> {vendor.email}</span> : null}
                    {vendor.phone ? <span className={styles.metaLine}><Phone size={13} /> {vendor.phone}</span> : null}
                  </div>
                </td>
                <td>
                  {vendor.delivery_address ? (
                    <span className={styles.metaLine}><MapPin size={13} /> {vendor.delivery_address}</span>
                  ) : (
                    <span className={styles.metaText}>Not set</span>
                  )}
                </td>
                <td>{vendor.payment_terms || 'Not set'}</td>
                <td>
                  <span className={vendor.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
                    {vendor.status}
                  </span>
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.iconButton} title="Edit vendor" onClick={() => openEditModal(vendor)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className={styles.textButton} onClick={() => toggleVendorStatus(vendor)}>
                      {vendor.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className={`${styles.iconButton} ${styles.deleteButton}`} title="Delete vendor" onClick={() => deleteVendor(vendor)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredVendors.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="vendors"
        />
      </div>

      {isModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button type="button" className={styles.modalClose} onClick={closeModal}>
              <X size={16} />
            </button>
            <h2 className={styles.modalTitle}>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
            <p className={styles.modalSubtitle}>Keep supplier details clean so purchase and inquiry teams can work faster with fewer follow-ups.</p>

            <div className={styles.modalGrid}>
              <div className={styles.formGroup}>
                <label>Vendor Name</label>
                <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Vendor name" />
              </div>
              <div className={styles.formGroup}>
                <label>Contact Person</label>
                <input value={form.contact_person} onChange={(event) => setForm((prev) => ({ ...prev, contact_person: event.target.value }))} placeholder="Primary contact" />
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email address" />
              </div>
              <div className={styles.formGroup}>
                <label>Phone</label>
                <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone number" />
              </div>
              <div className={styles.formGroup}>
                <label>Address</label>
                <input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Address" />
              </div>
              <div className={styles.formGroup}>
                <label>GSTIN / Tax ID</label>
                <input value={form.gstin} onChange={(event) => setForm((prev) => ({ ...prev, gstin: event.target.value.toUpperCase() }))} placeholder="Tax identifier" />
              </div>
              <div className={styles.formGroup}>
                <label>Payment Terms</label>
                <select value={form.payment_terms} onChange={(event) => setForm((prev) => ({ ...prev, payment_terms: event.target.value }))}>
                  <option value="Immediate">Immediate</option>
                  <option value="7 Days">7 Days</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="Advance Payment">Advance Payment</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Status</label>
                <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as VendorStatus }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={closeModal}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={saveVendor} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import styles from './SiteRecords.module.css';
import { 
  Plus, Search, CheckCircle2,
  Download, Eye, Trash2, Printer,
  RotateCcw
} from 'lucide-react';
import { useUi } from '@/components/ui/AppProviders';
import { projectsService, type ProjectRecord } from '@/lib/services/projects';
import { modulesService } from '@/lib/services/modules';
import { inventoryService } from '@/lib/services/inventory';
import type { DeliveryReceiptRow, OrderRow, PaymentSlipRow } from '@/types/modules';
import SearchableSelect from '@/components/ui/SearchableSelect';

type Tab = 'RECEIPTS' | 'PAYMENTS';

function makeClientId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function makeDocumentNumber(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
}

export default function SiteRecordsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('RECEIPTS');
  const [receipts, setReceipts] = useState<DeliveryReceiptRow[]>([]);
  const [slips, setSlips] = useState<PaymentSlipRow[]>([]);
  const [search, setSearch] = useState('');
  
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  
  const [createReceiptOpen, setCreateReceiptOpen] = useState(false);
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<DeliveryReceiptRow | null>(null);
  const [viewingSlip, setViewingSlip] = useState<PaymentSlipRow | null>(null);
  
  const { showToast, confirmAction } = useUi();
  
  // Permission States
  const [canViewReceipts, setCanViewReceipts] = useState(false);
  const [canViewPayments, setCanViewPayments] = useState(false);
  const [canCreateReceipt, setCanCreateReceipt] = useState(false);
  const [canCreatePayment, setCanCreatePayment] = useState(false);
  const [canDeleteReceipt, setCanDeleteReceipt] = useState(false);
  const [canDeletePayment, setCanDeletePayment] = useState(false);
  const [canEditPayment, setCanEditPayment] = useState(false);

  // Modal States
  const [newReceipt, setNewReceipt] = useState<Partial<DeliveryReceiptRow>>({
    type: 'SITE_DELIVERY', status: 'VERIFIED', items: []
  });

  const [newPayment, setNewPayment] = useState<Partial<PaymentSlipRow>>({
    date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    payment_method: 'BANK_TRANSFER',
    status: 'ISSUED'
  });

  useEffect(() => {
    const loadData = async () => {
      const [projRes, orderRes, prodRes, receiptRows, slipRows, currentUser, vendorRes] = await Promise.all([
        projectsService.listProjects(),
        modulesService.getOrders(),
        inventoryService.getProducts(),
        modulesService.getDeliveryReceipts(),
        modulesService.getPaymentSlips(),
        modulesService.getCurrentUser(),
        modulesService.getVendors(),
      ]);

      if (currentUser) {
        const vr = await modulesService.hasPermission(currentUser, 'deliveries.view');
        const vp = await modulesService.hasPermission(currentUser, 'payments.view');
        const cr = await modulesService.hasPermission(currentUser, 'deliveries.create');
        const cp = await modulesService.hasPermission(currentUser, 'payments.create');
        const dr = await modulesService.hasPermission(currentUser, 'deliveries.delete');
        const dp = await modulesService.hasPermission(currentUser, 'payments.delete');
        const ep = await modulesService.hasPermission(currentUser, 'payments.edit');

        setCanViewReceipts(vr);
        setCanViewPayments(vp);
        setCanCreateReceipt(cr);
        setCanCreatePayment(cp);
        setCanDeleteReceipt(dr);
        setCanDeletePayment(dp);
        setCanEditPayment(ep);

        // Auto-switch tab if only one is allowed
        if (vp && !vr) {
          setActiveTab('PAYMENTS');
        }
      }

      setProjects(projRes);
      setOrders(orderRes.filter(o => o.type === 'PURCHASE'));
      setCatalogItems(prodRes);
      setReceipts(receiptRows);
      setSlips(slipRows);
      setVendors(vendorRes);
    };
    loadData();

  }, []);

  const saveSlips = (data: PaymentSlipRow[]) => {
    setSlips(data);
    modulesService.savePaymentSlips(data);
  };
  const handleCreateReceipt = async () => {
    if (!newReceipt.project_name || (newReceipt.items?.length || 0) === 0) {
      showToast('Fill required fields', 'error');
      return;
    }
    const receipt: DeliveryReceiptRow = {
      ...(newReceipt as DeliveryReceiptRow),
      id: makeClientId('receipt'),
      receipt_no: makeDocumentNumber('DR'),
      date: new Date().toISOString().split('T')[0]
    };
    const confirmed = await confirmAction({
      title: 'Record Material Receipt',
      message: `Are you sure you want to record this ${newReceipt.type?.replace('_', ' ')} for ${newReceipt.project_name}?`,
      confirmText: 'Record Receipt',
      cancelText: 'Cancel',
    });

    if (!confirmed.confirmed) return;

    try {
      const currentUser = await modulesService.getCurrentUser();
      const result = await modulesService.createDeliveryReceipt(
        receipt,
        receipt.items,
        currentUser?.id || 'anonymous'
      );

      const finalReceipt = { ...receipt, id: result.id, receipt_no: result.receipt_no };
      setReceipts([finalReceipt, ...receipts]);
      setCreateReceiptOpen(false);
      setNewReceipt({ type: 'SITE_DELIVERY', status: 'VERIFIED', items: [] });
      
      await modulesService.addAudit({
        action: 'RECEIPT_CREATED',
        entity_type: 'receipt',
        entity_id: result.id,
        entity_name: result.receipt_no,
        reason: `Material receipt recorded for ${receipt.project_name}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${receipt.type} | ${receipt.items.length} items | Vendor: ${receipt.vendor_name}`,
        new_values: {
          project_name: receipt.project_name,
          vendor_name: receipt.vendor_name,
          type: receipt.type,
          items_count: receipt.items.length,
          status: receipt.status
        }
      });
      showToast('Receipt Created', 'success');
    } catch (error) {
      console.error('Failed to create receipt:', error);
      showToast('Could not save receipt to database', 'error');
    }
  };

  const getSlipStatus = (slip: PaymentSlipRow) => {
    if (slip.status === 'PAID') return 'PAID';
    const today = new Date().toISOString().split('T')[0];
    if (slip.due_date < today) return 'DUE';
    return slip.status;
  };

  const updateSlipStatus = async (id: string, status: 'ISSUED' | 'DUE' | 'PAID') => {
    const slip = slips.find(s => s.id === id);
    if (!slip) return;

    const confirmed = await confirmAction({
      title: 'Update Payment Status',
      message: `Are you sure you want to change the status of slip ${slip.slip_no} to ${status}?`,
      confirmText: 'Update Status',
      cancelText: 'Cancel',
      requireReason: status === 'PAID',
      reasonLabel: 'Payment Reference',
    });

    if (!confirmed.confirmed) return;

    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.updatePaymentSlip(id, {
        status,
        ref_no: status === 'PAID' ? (confirmed.reason || slip.ref_no) : slip.ref_no,
      });
      const refreshed = await modulesService.getPaymentSlips();
      setSlips(refreshed);

      await modulesService.addAudit({
        action: 'PAYMENT_STATUS_UPDATED',
        entity_type: 'payment',
        entity_id: slip.id,
        entity_name: slip.slip_no,
        reason: confirmed.reason || `Status changed to ${status}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${slip.vendor_name} | ${slip.po_ref || 'Manual Entry'} | Status: ${status}`,
        old_values: { status: slip.status },
        new_values: { status }
      });
      showToast(`Status updated to ${status}`, 'success');
    } catch (error) {
      console.error('Failed to update payment status:', error);
      showToast('Could not update payment status in database', 'error');
    }
  };

  const updateSlipDueDate = async (id: string, date: string) => {
    const slip = slips.find((entry) => entry.id === id);
    if (!slip) return;

    try {
      await modulesService.updatePaymentSlip(id, { due_date: date });
      setSlips((current) => current.map((entry) => (entry.id === id ? { ...entry, due_date: date } : entry)));
    } catch (error) {
      console.error('Failed to update payment due date:', error);
      showToast(`Could not update due date for ${slip.slip_no}`, 'error');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.vendor_name || !newPayment.amount) {
      showToast('Please fill required fields', 'error');
      return;
    }
    const slip: PaymentSlipRow = {
      id: makeClientId('payment'),
      slip_no: makeDocumentNumber('PS'),
      date: newPayment.date || new Date().toISOString().split('T')[0],
      due_date: newPayment.due_date || '',
      vendor_name: newPayment.vendor_name || '',
      po_ref: newPayment.po_ref || '',
      amount: Number(newPayment.amount),
      payment_method: newPayment.payment_method as any || 'BANK_TRANSFER',
      ref_no: newPayment.ref_no || '',
      prepared_by: 'Admin',
      status: 'ISSUED'
    };
    const confirmed = await confirmAction({
      title: 'Record Payment Voucher',
      message: `Are you sure you want to record a payment of ${formatCurrency(slip.amount)} to ${slip.vendor_name}?`,
      confirmText: 'Record Payment',
      cancelText: 'Cancel',
    });

    if (!confirmed.confirmed) return;

    try {
      const currentUser = await modulesService.getCurrentUser();
      const result = await modulesService.createPaymentSlip(slip, currentUser?.id || 'anonymous');
      const finalSlip = {
        ...slip,
        id: result.id,
        slip_no: result.slip_no,
        prepared_by: currentUser?.full_name || slip.prepared_by,
      };
      setSlips((current) => [finalSlip, ...current]);
      setCreatePaymentOpen(false);
      setNewPayment({
        date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        payment_method: 'BANK_TRANSFER',
        status: 'ISSUED'
      });

      await modulesService.addAudit({
        action: 'PAYMENT_CREATED',
        entity_type: 'payment',
        entity_id: result.id,
        entity_name: result.slip_no,
        reason: `Payment slip issued for ${finalSlip.vendor_name}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${finalSlip.po_ref || 'Manual Entry'} | ${formatCurrency(finalSlip.amount)}`,
        new_values: {
          vendor_name: finalSlip.vendor_name,
          amount: finalSlip.amount,
          payment_method: finalSlip.payment_method,
          status: finalSlip.status
        }
      });
      showToast('Payment Recorded', 'success');
    } catch (error) {
      console.error('Failed to create payment:', error);
      showToast('Could not save payment to database', 'error');
    }
  };

  const filteredReceipts = receipts.filter(r => r.receipt_no.toLowerCase().includes(search.toLowerCase()) || r.project_name.toLowerCase().includes(search.toLowerCase()));
  const filteredSlips = slips.filter(s => s.slip_no.toLowerCase().includes(search.toLowerCase()) || s.vendor_name.toLowerCase().includes(search.toLowerCase()));

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Delivery & Payments</h1>
          <div className={styles.tabList}>
            {canViewReceipts && (
              <button className={`${styles.tabItem} ${activeTab === 'RECEIPTS' ? styles.activeTab : ''}`} onClick={() => setActiveTab('RECEIPTS')}>
                Delivery Receipts ({receipts.length})
              </button>
            )}
            {canViewPayments && (
              <button className={`${styles.tabItem} ${activeTab === 'PAYMENTS' ? styles.activeTab : ''}`} onClick={() => setActiveTab('PAYMENTS')}>
                Payment Slips ({slips.length})
              </button>
            )}
          </div>
        </div>
        {(activeTab === 'RECEIPTS' ? canCreateReceipt : canCreatePayment) && (
          <button className={styles.primaryBtn} onClick={() => activeTab === 'RECEIPTS' ? setCreateReceiptOpen(true) : setCreatePaymentOpen(true)}>
            <Plus size={14} /> New {activeTab === 'RECEIPTS' ? 'Receipt' : 'Payment'}
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={14} />
          <input placeholder={`Search ${activeTab === 'RECEIPTS' ? 'receipts' : 'payments'}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {activeTab === 'RECEIPTS' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Receipt No</th>
                <th>Type</th>
                <th>Project & Vendor</th>
                <th>Receiver</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.dim}>{i+1}</td>
                  <td className={styles.bold}>{r.receipt_no}</td>
                  <td><span className={styles.miniTag}>{r.type.replace('_', ' ')}</span></td>
                  <td>
                    <div className={styles.bold}>{r.project_name}</div>
                    <div className={styles.dim}>{r.vendor_name}</div>
                  </td>
                  <td>
                    <div className={styles.bold} style={{ fontSize: '0.7rem' }}>{r.receiver_name}</div>
                    <div className={styles.dim}>{r.contact}</div>
                  </td>
                  <td><span className={`${styles.badge} ${styles[r.status.toLowerCase()]}`}>{r.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className={styles.iconBtn} onClick={() => setViewingReceipt(r)}><Eye size={14} /></button>
                    <button className={styles.iconBtn} onClick={() => { setViewingReceipt(r); setTimeout(()=>window.print(),100); }}><Printer size={14} /></button>
                    {canDeleteReceipt && (
                      <button className={styles.iconBtn} style={{ color: 'var(--text-secondary)' }} onClick={async () => {
                          const confirmed = await confirmAction({
                            title: 'Delete Receipt',
                            message: `Are you sure you want to delete receipt ${r.receipt_no}? This action cannot be undone.`,
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            requireReason: true,
                          });
                          if (confirmed.confirmed) {
                            try {
                              const currentUser = await modulesService.getCurrentUser();
                              await modulesService.deleteDeliveryReceipt(r.id, currentUser?.id || 'anonymous');
                              
                              const next = receipts.filter(x => x.id !== r.id);
                              setReceipts(next);

                              await modulesService.addAudit({
                                action: 'RECEIPT_DELETED',
                                entity_type: 'receipt',
                                entity_id: r.id,
                                entity_name: r.receipt_no,
                                reason: confirmed.reason || `Receipt deleted for ${r.project_name}`,
                                performed_by: currentUser?.email || 'Unknown',
                                details: `${r.vendor_name} | ${r.type}`,
                                old_values: {
                                  receipt_no: r.receipt_no,
                                  project_name: r.project_name,
                                  type: r.type
                                }
                              });
                              showToast('Receipt deleted', 'success');
                            } catch (error) {
                              console.error('Failed to delete receipt:', error);
                              showToast('Could not delete receipt from database', 'error');
                            }
                          }
                      }}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Slip No</th>
                <th>Payment & Due Date</th>
                <th>Vendor & PO</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlips.map((s, i) => {
                const currentStatus = getSlipStatus(s);
                return (
                  <tr key={s.id}>
                    <td className={styles.dim}>{i+1}</td>
                    <td className={styles.bold}>{s.slip_no}</td>
                    <td>
                      <div className={styles.dim}>Ref: {s.date}</div>
                      <div style={{ marginTop: '0.2rem' }}>
                        <input 
                          type="date" 
                          className={styles.miniDateInput} 
                          value={s.due_date} 
                          onChange={(e) => updateSlipDueDate(s.id, e.target.value)} 
                        />
                      </div>
                    </td>
                    <td>
                      <div className={styles.bold}>{s.vendor_name}</div>
                      <div className={styles.dim}>{s.po_ref}</div>
                    </td>
                    <td className={styles.greenBold}>{formatCurrency(s.amount)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className={`${styles.badge} ${styles[currentStatus.toLowerCase()]}`}>{currentStatus}</span>
                        {canEditPayment && (
                          currentStatus !== 'PAID' ? (
                            <button className={styles.rowActionBtn} onClick={() => updateSlipStatus(s.id, 'PAID')}>
                              <CheckCircle2 size={12} /> MARK PAID
                            </button>
                          ) : (
                            <button className={styles.resetBtn} onClick={() => updateSlipStatus(s.id, 'ISSUED')}>
                              <RotateCcw size={10} /> RESET
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className={styles.iconBtn} onClick={() => setViewingSlip(s)}><Eye size={14} /></button>
                        <button className={styles.iconBtn} onClick={() => { setViewingSlip(s); setTimeout(()=>window.print(),100); }}><Printer size={14} /></button>
                        {canDeletePayment && (
                          <button className={styles.iconBtn} style={{ color: 'var(--text-secondary)' }} onClick={async () => {
                              const confirmed = await confirmAction({
                                title: 'Delete Payment Slip',
                                message: `Are you sure you want to delete payment slip ${s.slip_no}?`,
                                confirmText: 'Delete',
                                cancelText: 'Cancel',
                                requireReason: true,
                              });
                              if (confirmed.confirmed) {
                                try {
                                  const currentUser = await modulesService.getCurrentUser();
                                  await modulesService.deletePaymentSlip(s.id, currentUser?.id || 'anonymous');
                                  setSlips((current) => current.filter((entry) => entry.id !== s.id));
                                  await modulesService.addAudit({
                                    action: 'PAYMENT_DELETED',
                                    entity_type: 'payment',
                                    entity_id: s.id,
                                    entity_name: s.slip_no,
                                    reason: confirmed.reason || `Payment slip deleted for ${s.vendor_name}`,
                                    performed_by: currentUser?.email || 'Unknown',
                                    details: `${s.po_ref || 'Manual Entry'} | ${formatCurrency(s.amount)}`,
                                    old_values: {
                                      slip_no: s.slip_no,
                                      vendor_name: s.vendor_name,
                                      amount: s.amount
                                    }
                                  });
                                  showToast('Payment slip deleted', 'success');
                                } catch (error) {
                                  console.error('Failed to delete payment slip:', error);
                                  showToast('Could not delete payment slip from database', 'error');
                                }
                              }
                          }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODALS START HERE */}
      {createReceiptOpen && (
        <div className={styles.overlay}>
          <div className={styles.modalCompact}>
            <div className={styles.modalHead}>
              <h2>Material Receipt Entry</h2>
              <button onClick={() => setCreateReceiptOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.grid2}>
                <div className={styles.fGroup}>
                  <label>DELIVERY TYPE</label>
                  <select value={newReceipt.type} onChange={e => setNewReceipt({...newReceipt, type: e.target.value as any})} className={styles.fSelect}>
                    <option value="SITE_DELIVERY">Site Delivery</option>
                    <option value="STORE_DELIVERY">Store Delivery</option>
                  </select>
                </div>
                <div className={styles.fGroup}>
                  <label>PROJECT</label>
                  <select 
                    className={styles.fSelect} 
                    value={newReceipt.project_name || ''}
                    onChange={e => {
                      const pname = e.target.value;
                      const proj = projects.find(p => p.name === pname);
                    if(proj && newReceipt.type === 'SITE_DELIVERY') {
                      projectsService.listBoqItems(proj.id).then(res => {
                        const pendingItems = res
                          .map((i) => ({ 
                            id: i.id, 
                            name: i.item_name, 
                            variant_id: i.variant_id,
                            quantity: Math.max(0, i.quantity - (i.delivered || 0)), 
                            unit: i.unit, 
                            condition: 'GOOD' as const 
                          }))
                          .filter(i => i.quantity > 0);
                        
                        setNewReceipt({
                          ...newReceipt, 
                          project_name: pname, 
                          items: pendingItems
                        });
                      });
                    }
 else {
                        setNewReceipt({...newReceipt, project_name: pname});
                      }
                    }}
                  >
                    <option value="">Select Project...</option>
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {newReceipt.type === 'STORE_DELIVERY' && (
                <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                  <SearchableSelect
                    label="LINKED PURCHASE ORDER (PO)"
                    placeholder="Search PO Number..."
                    value={newReceipt.linked_po || ''}
                    options={orders.map(o => ({
                      value: o.order_number,
                      label: `${o.order_number} - ${o.vendor_name}`,
                      keywords: [o.order_number, o.vendor_name]
                    }))}
                    onChange={orderNo => {
                      const order = orders.find(o => o.order_number === orderNo);
                      if (order) {
                        setNewReceipt({
                          ...newReceipt,
                          linked_po: orderNo,
                          vendor_name: order.vendor_name,
                          project_name: order.project_name || newReceipt.project_name,
                          items: order.items.map(i => ({
                            id: i.id,
                            name: i.product_name,
                            quantity: i.quantity,
                            unit: i.unit || 'Nos',
                            condition: 'GOOD'
                          }))
                        });
                      } else {
                        setNewReceipt({ ...newReceipt, linked_po: orderNo });
                      }
                    }}
                  />
                </div>
              )}

              <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                <SearchableSelect
                  label="VENDOR NAME"
                  placeholder={newReceipt.type === 'STORE_DELIVERY' ? "Auto-filled from PO" : "Select or enter vendor..."}
                  value={newReceipt.vendor_name || ''}
                  options={vendors.map(v => ({ value: v.name, label: v.name }))}
                  onChange={val => setNewReceipt({...newReceipt, vendor_name: val})}
                  onCreateOption={val => {
                    setNewReceipt({...newReceipt, vendor_name: val});
                    return val;
                  }}
                />
              </div>

              <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                <label>VENDOR / RECEIVER INFO</label>
                <div className={styles.grid2}>
                  <input placeholder="Receiver Name" className={styles.fInput} onChange={e => setNewReceipt({...newReceipt, receiver_name: e.target.value})} />
                  <input placeholder="Contact Phone" className={styles.fInput} onChange={e => setNewReceipt({...newReceipt, contact: e.target.value})} />
                </div>
              </div>
              <div className={styles.materialSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label>MATERIAL ITEMS</label>
                  <button className={styles.miniPlus} onClick={() => setNewReceipt({...newReceipt, items: [...(newReceipt.items || []), { id: Math.random().toString(), name: '', quantity: 0, unit: 'Nos', condition: 'GOOD' }]})}>+ Add Item</button>
                </div>
                <div className={styles.matList}>
                  {newReceipt.items?.map((item, idx) => (
                    <div key={item.id} className={styles.matRow}>
                      <select className={styles.fSelect} style={{ flex: 1 }} value={item.name} onChange={e => {
                        const pname = e.target.value;
                        const items = [...(newReceipt.items || [])];
                        items[idx].name = pname;
                        
                        // Auto-pick variant and unit from catalog
                        const product = catalogItems.find(p => p.name === pname);
                        if (product) {
                          if (product.variants?.[0]) {
                            items[idx].variant_id = product.variants[0].id;
                          }
                          if (product.unit) {
                            items[idx].unit = product.unit;
                          }
                        }
                        
                        if (items[idx].quantity === 0) items[idx].quantity = 1;
                        setNewReceipt({...newReceipt, items});
                      }}>
                        <option value="">Choose item...</option>
                        {catalogItems.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        {item.name && !catalogItems.some(p => p.name === item.name) && <option value={item.name}>{item.name}</option>}
                      </select>
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        className={styles.fInput} 
                        style={{ width: '60px' }} 
                        value={item.quantity || ''}
                        onChange={e => {
                          const items = [...(newReceipt.items || [])];
                          items[idx].quantity = Number(e.target.value);
                          setNewReceipt({...newReceipt, items});
                        }} 
                      />
                      <button onClick={() => setNewReceipt({...newReceipt, items: newReceipt.items?.filter((_, i) => i !== idx)})} className={styles.iconBtn} style={{ color: 'var(--text-secondary)' }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.primaryFull} onClick={handleCreateReceipt}>Save Material Record</button>
            </div>
          </div>
        </div>
      )}

      {createPaymentOpen && (
        <div className={styles.overlay}>
          <div className={styles.modalCompact} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHead}>
              <h2>Record Payment Voucher</h2>
              <button onClick={() => setCreatePaymentOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePayment}>
              <div className={styles.modalBody}>
                <div className={styles.fGroup}>
                  <SearchableSelect
                    label="PO REFERENCE (Optional)"
                    placeholder="Search PO Number..."
                    value={newPayment.po_ref || ''}
                    options={orders.map(o => ({
                      value: o.order_number,
                      label: `${o.order_number} - ${o.vendor_name}`,
                      keywords: [o.order_number, o.vendor_name]
                    }))}
                    onChange={orderNo => {
                      const order = orders.find(o => o.order_number === orderNo);
                      if (order) {
                        setNewPayment({
                          ...newPayment,
                          po_ref: orderNo,
                          vendor_name: order.vendor_name
                        });
                      } else {
                        setNewPayment({ ...newPayment, po_ref: orderNo });
                      }
                    }}
                  />
                </div>
                <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                  <SearchableSelect
                    label="VENDOR / PAYEE NAME *"
                    placeholder="Select or enter payee..."
                    value={newPayment.vendor_name || ''}
                    options={vendors.map(v => ({ value: v.name, label: v.name }))}
                    onChange={val => setNewPayment({...newPayment, vendor_name: val})}
                    onCreateOption={val => {
                      setNewPayment({...newPayment, vendor_name: val});
                      return val;
                    }}
                  />
                </div>
                <div className={styles.grid2} style={{ marginTop: '0.75rem' }}>
                  <div className={styles.fGroup}>
                    <label>DUE DATE *</label>
                    <input 
                      type="date" 
                      name="due_date" 
                      className={styles.fInput} 
                      required 
                      value={newPayment.due_date || ''} 
                      onChange={e => setNewPayment({...newPayment, due_date: e.target.value})} 
                    />
                  </div>
                  <div className={styles.fGroup}>
                    <label>AMOUNT (INR) *</label>
                    <input 
                      type="number" 
                      name="amount" 
                      className={styles.fInput} 
                      required 
                      value={newPayment.amount || ''} 
                      onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} 
                    />
                  </div>
                </div>
                <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                  <label>PAYMENT MODE</label>
                  <select 
                    name="payment_method" 
                    className={styles.fSelect}
                    value={newPayment.payment_method || 'BANK_TRANSFER'}
                    onChange={e => setNewPayment({...newPayment, payment_method: e.target.value as any})}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalFoot}>
                <button type="submit" className={styles.primaryFull}>Issue Payment Slip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODALS FOR PRINT */}
      {viewingReceipt && (
        <div className={styles.overlay}>
          <div className={`${styles.modalCompact} ${styles.printMe}`}>
            <div className={styles.modalHead + " no-print"}>
              <h2>Receipt Detail</h2>
              <button onClick={() => setViewingReceipt(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
               <div style={{ borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>MATERIAL DELIVERY RECEIPT</h1>
                  <div style={{ textAlign: 'right', fontSize: '0.7rem' }}><strong>{viewingReceipt.receipt_no}</strong></div>
               </div>
               <div className={styles.viewGrid}>
                 <div><span>Date:</span> <strong>{viewingReceipt.date}</strong></div>
                 <div><span>Type:</span> <strong>{viewingReceipt.type.replace('_', ' ')}</strong></div>
                 <div><span>Project:</span> <strong>{viewingReceipt.project_name}</strong></div>
                 <div><span>Vendor:</span> <strong>{viewingReceipt.vendor_name}</strong></div>
                 <div><span>Receiver:</span> <strong>{viewingReceipt.receiver_name}</strong></div>
                 <div><span>Contact:</span> <strong>{viewingReceipt.contact}</strong></div>
               </div>
               <table className={styles.printTab}>
                 <thead><tr><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th></tr></thead>
                 <tbody>{viewingReceipt.items.map(i=><tr key={i.id}><td>{i.name}</td><td style={{ textAlign: 'right' }}>{i.quantity}</td></tr>)}</tbody>
               </table>
               <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                  <div className={styles.sign}>Receiver Signature</div>
                  <div className={styles.sign}>Manager Approval</div>
               </div>
            </div>
            <div className={styles.modalFoot + " no-print"}>
              <button className={styles.primaryFull} onClick={() => window.print()}><Download size={14} /> Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {viewingSlip && (
        <div className={styles.overlay}>
          <div className={`${styles.modalCompact} ${styles.printMe}`} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHead + " no-print"}>
              <h2>Voucher Detail</h2>
              <button onClick={() => setViewingSlip(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
               <div style={{ borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>PAYMENT VOUCHER</h1>
               </div>
               <div className={styles.voucherBox}>
                  <div className={styles.vLine}><span>NO:</span> <strong>{viewingSlip.slip_no}</strong></div>
                  <div className={styles.vLine}><span>DATED:</span> <strong>{viewingSlip.date}</strong></div>
                  <div className={styles.vLine}><span>PAID TO:</span> <strong>{viewingSlip.vendor_name}</strong></div>
                  <div className={styles.vLine}><span style={{ fontSize: '1rem' }}>AMOUNT:</span> <strong style={{ fontSize: '1.2rem' }}>{formatCurrency(viewingSlip.amount)}</strong></div>
                  <div className={styles.vLine}><span>MODE:</span> <strong>{viewingSlip.payment_method.replace('_', ' ')}</strong></div>
               </div>
               
               <div style={{ marginTop: '1.5rem' }}>
                  <div className={styles.fGroup}>
                    <label>UPDATE STATUS</label>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {(['ISSUED', 'DUE', 'PAID'] as const).map(st => (
                        <button 
                          key={st}
                          className={styles.rowActionBtn}
                          style={{ 
                            flex: 1, 
                            justifyContent: 'center',
                            background: viewingSlip.status === st ? '#111827' : '#f3f4f6',
                            color: viewingSlip.status === st ? 'white' : '#4b5563',
                            border: viewingSlip.status === st ? 'none' : '1px solid #e5e7eb'
                          }}
                          onClick={() => {
                            updateSlipStatus(viewingSlip.id, st);
                            setViewingSlip({...viewingSlip, status: st});
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>

               <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                  <div className={styles.sign}>Receiver</div>
                  <div className={styles.sign}>Authorized</div>
               </div>
            </div>
            <div className={styles.modalFoot + " no-print"}>
              <button className={styles.primaryFull} onClick={() => window.print()}><Download size={14} /> Download PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

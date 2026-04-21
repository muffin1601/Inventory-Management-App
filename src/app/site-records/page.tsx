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
  const [receipts, setReceipts] = useState<DeliveryReceiptRow[]>(() => modulesService.getDeliveryReceipts());
  const [slips, setSlips] = useState<PaymentSlipRow[]>(() => modulesService.getPaymentSlips());
  const [search, setSearch] = useState('');
  
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  
  const [createReceiptOpen, setCreateReceiptOpen] = useState(false);
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<DeliveryReceiptRow | null>(null);
  const [viewingSlip, setViewingSlip] = useState<PaymentSlipRow | null>(null);
  
  const { showToast } = useUi();

  // Modal States
  const [newReceipt, setNewReceipt] = useState<Partial<DeliveryReceiptRow>>({
    type: 'SITE_DELIVERY', status: 'VERIFIED', items: []
  });

  useEffect(() => {
    const loadData = async () => {
      const [projRes, orderRes, prodRes] = await Promise.all([
        projectsService.listProjects(),
        modulesService.getOrders(),
        inventoryService.getProducts()
      ]);
      setProjects(projRes.projects);
      setOrders(orderRes.filter(o => o.type === 'PURCHASE'));
      setCatalogItems(prodRes);
    };
    loadData();

  }, []);

  const saveReceipts = (data: DeliveryReceiptRow[]) => {
    setReceipts(data);
    modulesService.saveDeliveryReceipts(data);
  };

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
    saveReceipts([receipt, ...receipts]);
    setCreateReceiptOpen(false);
    setNewReceipt({ type: 'SITE_DELIVERY', status: 'VERIFIED', items: [] });
    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Delivery Receipt Created',
        entity_type: 'receipt',
        entity_id: receipt.id,
        entity_name: receipt.receipt_no,
        reason: `Receipt recorded for ${receipt.project_name}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${receipt.type} | ${receipt.items.length} items | ${receipt.vendor_name}`,
      });
    } catch (error) {
      console.error('Failed to add receipt audit:', error);
    }
    showToast('Receipt Created', 'success');
  };

  const getSlipStatus = (slip: PaymentSlipRow) => {
    if (slip.status === 'PAID') return 'PAID';
    const today = new Date().toISOString().split('T')[0];
    if (slip.due_date < today) return 'DUE';
    return slip.status;
  };

  const updateSlipStatus = async (id: string, status: 'ISSUED' | 'DUE' | 'PAID') => {
    const next = slips.map(s => s.id === id ? { ...s, status } : s);
    saveSlips(next);
    const updatedSlip = next.find(s => s.id === id);
    if (updatedSlip) {
      try {
        const currentUser = await modulesService.getCurrentUser();
        await modulesService.addAudit({
          action: 'Payment Slip Status Updated',
          entity_type: 'payment',
          entity_id: updatedSlip.id,
          entity_name: updatedSlip.slip_no,
          reason: `Status changed to ${status}`,
          performed_by: currentUser?.email || 'Unknown',
          details: `${updatedSlip.vendor_name} | ${updatedSlip.po_ref || 'Manual Entry'}`,
        });
      } catch (error) {
        console.error('Failed to add payment status audit:', error);
      }
    }
    showToast(`Status updated to ${status}`, 'success');
  };

  const updateSlipDueDate = (id: string, date: string) => {
    const next = slips.map(s => s.id === id ? { ...s, due_date: date } : s);
    saveSlips(next);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const slip: PaymentSlipRow = {
      id: makeClientId('payment'),
      slip_no: makeDocumentNumber('PS'),
      date: new Date().toISOString().split('T')[0],
      due_date: fd.get('due_date') as string,
      vendor_name: fd.get('vendor_name') as string,
      po_ref: fd.get('po_ref') as string,
      amount: Number(fd.get('amount')),
      payment_method: fd.get('payment_method') as any,
      ref_no: fd.get('ref_no') as string,
      prepared_by: 'Admin',
      status: 'ISSUED'
    };
    saveSlips([slip, ...slips]);
    setCreatePaymentOpen(false);
    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Payment Slip Created',
        entity_type: 'payment',
        entity_id: slip.id,
        entity_name: slip.slip_no,
        reason: `Payment slip issued for ${slip.vendor_name}`,
        performed_by: currentUser?.email || 'Unknown',
        details: `${slip.po_ref || 'Manual Entry'} | ${formatCurrency(slip.amount)}`,
      });
    } catch (error) {
      console.error('Failed to add payment audit:', error);
    }
    showToast('Payment Recorded', 'success');
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
            <button className={`${styles.tabItem} ${activeTab === 'RECEIPTS' ? styles.activeTab : ''}`} onClick={() => setActiveTab('RECEIPTS')}>
              Delivery Receipts ({receipts.length})
            </button>
            <button className={`${styles.tabItem} ${activeTab === 'PAYMENTS' ? styles.activeTab : ''}`} onClick={() => setActiveTab('PAYMENTS')}>
              Payment Slips ({slips.length})
            </button>
          </div>
        </div>
        <button className={styles.primaryBtn} onClick={() => activeTab === 'RECEIPTS' ? setCreateReceiptOpen(true) : setCreatePaymentOpen(true)}>
          <Plus size={14} /> New {activeTab === 'RECEIPTS' ? 'Receipt' : 'Payment'}
        </button>
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
                    <button className={styles.iconBtn} style={{ color: 'var(--text-secondary)' }} onClick={async () => {
                        if(confirm('Delete this receipt permanently?')) {
                          const next = receipts.filter(x => x.id !== r.id);
                          saveReceipts(next);
                          try {
                            const currentUser = await modulesService.getCurrentUser();
                            await modulesService.addAudit({
                              action: 'Delivery Receipt Deleted',
                              entity_type: 'receipt',
                              entity_id: r.id,
                              entity_name: r.receipt_no,
                              reason: `Receipt deleted for ${r.project_name}`,
                              performed_by: currentUser?.email || 'Unknown',
                              details: `${r.vendor_name} | ${r.type}`,
                            });
                          } catch (error) {
                            console.error('Failed to add receipt deletion audit:', error);
                          }
                          showToast('Receipt deleted', 'success');
                        }
                    }}><Trash2 size={14} /></button>
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
                        {currentStatus !== 'PAID' ? (
                          <button className={styles.rowActionBtn} onClick={() => updateSlipStatus(s.id, 'PAID')}>
                            <CheckCircle2 size={12} /> MARK PAID
                          </button>
                        ) : (
                          <button className={styles.resetBtn} onClick={() => updateSlipStatus(s.id, 'ISSUED')}>
                            <RotateCcw size={10} /> RESET
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className={styles.iconBtn} onClick={() => setViewingSlip(s)}><Eye size={14} /></button>
                        <button className={styles.iconBtn} onClick={() => { setViewingSlip(s); setTimeout(()=>window.print(),100); }}><Printer size={14} /></button>
                        <button className={styles.iconBtn} style={{ color: 'var(--text-secondary)' }} onClick={async () => {
                            if(confirm('Delete permanently?')) {
                              const next = slips.filter(x => x.id !== s.id);
                              saveSlips(next);
                              try {
                                const currentUser = await modulesService.getCurrentUser();
                                await modulesService.addAudit({
                                  action: 'Payment Slip Deleted',
                                  entity_type: 'payment',
                                  entity_id: s.id,
                                  entity_name: s.slip_no,
                                  reason: `Payment slip deleted for ${s.vendor_name}`,
                                  performed_by: currentUser?.email || 'Unknown',
                                  details: `${s.po_ref || 'Manual Entry'} | ${formatCurrency(s.amount)}`,
                                });
                              } catch (error) {
                                console.error('Failed to add payment deletion audit:', error);
                              }
                            }
                        }}><Trash2 size={14} /></button>
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
                        const pendingItems = res.items
                          .map(i => ({ 
                            id: i.id, 
                            name: i.item_name, 
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
                  <label>LINKED PURCHASE ORDER (PO)</label>
                  <select 
                    className={styles.fSelect}
                    value={newReceipt.linked_po || ''}
                    onChange={e => {
                      const orderNo = e.target.value;
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
                  >
                    <option value="">Select PO to auto-fill items...</option>
                    {orders.map(o => <option key={o.id} value={o.order_number}>{o.order_number} - {o.vendor_name}</option>)}
                  </select>
                </div>
              )}

              <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                <label>VENDOR NAME</label>
                <input 
                  className={styles.fInput}
                  placeholder={newReceipt.type === 'STORE_DELIVERY' ? "Auto-filled from PO" : "Enter Vendor Name"}
                  value={newReceipt.vendor_name || ''}
                  onChange={e => setNewReceipt({...newReceipt, vendor_name: e.target.value})}
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
                        const items = [...(newReceipt.items || [])];
                        items[idx].name = e.target.value;
                        if (items[idx].quantity === 0) items[idx].quantity = 1;
                        setNewReceipt({...newReceipt, items});
                      }}>
                        <option value="">Choose item...</option>
                        {catalogItems.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        {item.name && <option value={item.name}>{item.name}</option>}
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
                  <label>PO REFERENCE (Optional)</label>
                  <select name="po_ref" className={styles.fSelect} onChange={e => {
                     const order = orders.find(o => o.order_number === e.target.value);
                     if(order) (document.getElementById('ven_name') as HTMLInputElement).value = order.vendor_name;
                  }}>
                    <option value="">Manual Entry...</option>
                    {orders.map(o => <option key={o.id} value={o.order_number}>{o.order_number} - {o.vendor_name}</option>)}
                  </select>
                </div>
                <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                  <label>VENDOR / PAYEE NAME *</label>
                  <input id="ven_name" name="vendor_name" className={styles.fInput} required />
                </div>
                <div className={styles.grid2} style={{ marginTop: '0.75rem' }}>
                  <div className={styles.fGroup}>
                    <label>DUE DATE *</label>
                    <input type="date" name="due_date" className={styles.fInput} required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className={styles.fGroup}>
                    <label>AMOUNT (INR) *</label>
                    <input type="number" name="amount" className={styles.fInput} required />
                  </div>
                </div>
                <div className={styles.fGroup} style={{ marginTop: '0.75rem' }}>
                  <label>PAYMENT MODE</label>
                  <select name="payment_method" className={styles.fSelect}>
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

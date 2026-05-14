"use client";

import React from 'react';
import styles from './ProjectDetail.module.css';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, X, Eye, Package, Edit2 } from 'lucide-react';
import { projectsService, type ProjectRecord, type ProjectOrderRecord, type BoqItemRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';

export default function ProjectOrdersPage() {
  const ui = useUi();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = React.useState<ProjectRecord | null>(null);
  const [orders, setOrders] = React.useState<ProjectOrderRecord[]>([]);
  const [allBoq, setAllBoq] = React.useState<BoqItemRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Dialog state
  const [isOrderDialogOpen, setIsOrderDialogOpen] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState<ProjectOrderRecord | null>(null);
  const [orderName, setOrderName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectResult, ordersResult, boqResult] = await Promise.all([
        projectsService.getProject(projectId),
        projectsService.listProjectOrders(projectId),
        projectsService.listBoqItems(projectId)
      ]);
      setProject(projectResult);
      setOrders(ordersResult);
      setAllBoq(boqResult);
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to load project data.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, ui]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openAddDialog = () => {
    setEditingOrder(null);
    setOrderName('');
    setIsOrderDialogOpen(true);
  };

  const openEditDialog = (order: ProjectOrderRecord) => {
    setEditingOrder(order);
    setOrderName(order.order_number);
    setIsOrderDialogOpen(true);
  };

  const saveOrder = async () => {
    if (!orderName.trim()) {
      ui.showToast('Enter order/category name.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      if (editingOrder) {
        await projectsService.updateProjectOrder(projectId, editingOrder.id, {
          order_number: orderName.trim(),
        });
        ui.showToast('Order updated.', 'success');
      } else {
        await projectsService.createProjectOrder({
          projectId,
          order_number: orderName.trim(),
        });
        ui.showToast('Order created.', 'success');
      }
      setIsOrderDialogOpen(false);
      setOrderName('');
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not save order.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    const confirm = await ui.confirmAction({
      title: 'Delete Order?',
      message: 'This will delete the order and all its items.',
      confirmText: 'Delete',
    });
    if (!confirm.confirmed) return;

    try {
      await projectsService.deleteProjectOrder(projectId, orderId);
      ui.showToast('Order deleted.', 'success');
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not delete order.', 'error');
    }
  };

  const title = project?.name || 'Project';
  const clientLine = project?.client_name ? `Client: ${project.client_name}` : 'Client not set';

  if (isLoading) return <div className={styles.loading}>Loading orders...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.titleRow}>
          <Link href="/projects" className={styles.backBtn} title="Back to Projects">
            <ArrowLeft size={16} />
          </Link>
          <div className={styles.titleBlock}>
            <div className={styles.title}>{title}</div>
            <div className={styles.subtitle}>{clientLine}</div>
          </div>
        </div>
        <button className={styles.primaryAction} onClick={openAddDialog}>
          <Plus size={14} /> New Order/Category
        </button>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Icon</th>
                <th>Order / Category Name</th>
                <th className={styles.numericCell}>Items</th>
                <th className={styles.actionsCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const orderItems = allBoq.filter(i => i.order_id === order.id);
                return (
                  <tr key={order.id}>
                    <td>
                      <div className={styles.plainIconBox}>
                        <Package size={14} />
                      </div>
                    </td>
                    <td className={styles.orderTitleCell}>
                      <div className={styles.orderMainTitle}>{order.order_number}</div>
                      <div className={styles.orderSubtitle}>Project Category</div>
                    </td>
                    <td className={styles.numericCell}>
                      <span className={styles.itemCountBadge}>{orderItems.length}</span>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionRow}>
                        <Link href={`/projects/${projectId}/orders/${order.id}`} className={styles.viewLink}>
                          <Eye size={12} /> View BOQ
                        </Link>
                        <button className={styles.iconAction} onClick={() => openEditDialog(order)} title="Edit Category">
                          <Edit2 size={12} />
                        </button>
                        <button className={styles.iconDanger} onClick={() => deleteOrder(order.id)} title="Delete Category">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    No categories created yet. Click "New Category" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOrderDialogOpen && (
        <div className={styles.overlay} onClick={() => setIsOrderDialogOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>{editingOrder ? 'Edit Category' : 'New Category'}</div>
              <button className={styles.closeBtn} onClick={() => setIsOrderDialogOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.field}>
                <label className={styles.label}>Category Name *</label>
                <input 
                  autoFocus
                  className={styles.input} 
                  value={orderName} 
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder="e.g. Swimming Pools, Tiles, etc."
                />
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} onClick={() => setIsOrderDialogOpen(false)}>Cancel</button>
              <button className={styles.primaryAction} disabled={isSaving} onClick={saveOrder}>
                {isSaving ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

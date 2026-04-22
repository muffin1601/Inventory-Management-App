"use client";

import React, { useMemo, useState } from 'react';
import styles from './Orders.module.css';
import { Search, Filter, ArrowRight, Eye, Plus, Trash2, Copy, Printer, Bell, ChevronDown, Check, X, Settings } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';
import { inventoryService } from '@/lib/services/inventory';
import { projectsService } from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderType } from '@/types/modules';
import { useUi } from '@/components/ui/AppProviders';
import TablePagination from '@/components/ui/TablePagination';

const VENDOR_DETAILS_KEY = 'ims_vendor_details_v1';

type VendorOption = { id: string; name: string; delivery_address?: string; payment_terms?: string };

type VendorRow = Record<string, unknown>;

function readVendorDetails(): Record<string, Partial<VendorOption>> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(VENDOR_DETAILS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Partial<VendorOption>>;
  } catch {
    return {};
  }
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return candidate.code === '42703' || candidate.code === 'PGRST204' || message.includes('column');
}

function normalizeVendorRow(row: VendorRow): VendorOption {
  const id = String(row.id || row.vendor_id || '');
  const name = String(row.name || row.vendor_name || row.entity_name || '');
  const delivery_address =
    (typeof row.delivery_address === 'string' && row.delivery_address) ||
    (typeof row.address === 'string' && row.address) ||
    (typeof row.city === 'string' && row.city) ||
    '';
  const payment_terms = typeof row.payment_terms === 'string' ? row.payment_terms : '';
  return { id, name, delivery_address, payment_terms };
}

type ProjectOption = { id: string; name: string; delivery_address?: string };
type VariantOption = {
  id: string;
  sku: string;
  product_name: string;
  unit?: string;
  price?: number;
  total_stock: number;
  warehouse_id?: string;
  warehouse_name?: string;
};

type ProductWithVariants = {
  name: string;
  variants?: Array<{
    id: string;
    sku: string;
    price?: number;
    attributes?: Record<string, string>;
    total_stock?: number;
    stock_data?: Array<{ warehouse_id?: string; warehouse_name?: string }>;
  }>;
};

type PurchaseOrderLineDraft = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  unit: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
  price: number;
  gst_rate: number;
  max_stock: number;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function createDraftLine(): PurchaseOrderLineDraft {
  return {
    id: `line_${Math.random().toString(36).slice(2, 10)}`,
    variant_id: '',
    sku: '',
    product_name: '',
    unit: '',
    warehouse_id: '',
    warehouse_name: '',
    quantity: 1,
    price: 0,
    gst_rate: 0,
    max_stock: 0,
  };
}

export default function OrdersPage() {
  const { showToast, confirmAction } = useUi();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkSelectorOpen, setBulkSelectorOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({ vendor_id: '', project_id: '', delivery_address: '', payment_terms: '' });
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>([createDraftLine()]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderRow['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [canCreate, setCanCreate] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPO, setSelectedPO] = useState<OrderRow | null>(null);
  const [statusChangeModal, setStatusChangeModal] = useState<{ order: OrderRow; newStatus: string } | null>(null);

  React.useEffect(() => {
    async function load() {
      const [existingOrders, productsData, projectList] = await Promise.all([
        modulesService.getOrders(),
        inventoryService.getProducts(),
        projectsService.listProjects(),
      ]);

      const vendorSelects = [
        { select: 'id, name, delivery_address, payment_terms', order: 'name' },
        { select: 'id, name, city, payment_terms', order: 'name' },
        { select: 'id, name, delivery_address', order: 'name' },
        { select: 'id, name, city', order: 'name' },
        { select: 'id, name, payment_terms', order: 'name' },
        { select: 'id, name', order: 'name' },
        { select: '*', order: 'name' },
        { select: '*', order: 'id' },
      ];

      let vendorItems: VendorOption[] = [];
      let lastError: unknown = null;

      for (const { select, order } of vendorSelects) {
        const response = await supabase.from('vendors').select(select).order(order);
        if (!response.error) {
          vendorItems = ((response.data || []) as unknown as VendorRow[]).map(normalizeVendorRow);
          lastError = null;
          break;
        }

        if (!isMissingColumnError(response.error)) {
          lastError = response.error;
          break;
        }
      }

      const savedDetails = readVendorDetails();
      const mergedVendors = vendorItems.map((vendor) => ({
        ...vendor,
        ...(savedDetails[vendor.id] || {}),
      }));

      if (lastError) {
        console.error('Failed to load vendors due to unexpected schema error:', lastError);
        showToast('Could not load vendor options due to a schema issue.', 'error');
      }

      setOrders(existingOrders);
      setProducts(productsData as ProductWithVariants[]);
      setVendors(mergedVendors);
      setProjects(projectList.projects || []);

      const current = await modulesService.getCurrentUser();
      if (current) {
        setCanCreate(await modulesService.hasPermission(current, 'orders.create'));
        setCanApprove(await modulesService.hasPermission(current, 'orders.approve'));
        setCanCancel(await modulesService.hasPermission(current, 'orders.cancel'));
        setIsAdmin((await modulesService.hasPermission(current, 'roles.manage')) || current.role_name === 'Super Admin');
      }
    }

    load();
    const onUserChange = () => load();
    window.addEventListener('ims-current-user-changed', onUserChange);
    return () => window.removeEventListener('ims-current-user-changed', onUserChange);
  }, []);

  const variantOptions = useMemo(() => {
    return products.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        product_name: product.name,
        unit: variant.attributes?.Unit || variant.attributes?.unit || '',
        price: variant.price ?? 0,
        total_stock: variant.total_stock ?? 0,
        warehouse_id: variant.stock_data?.[0]?.warehouse_id || 'unknown',
        warehouse_name: variant.stock_data?.[0]?.warehouse_name || 'Unknown',
      })),
    );
  }, [products]);

  const variantLookup = useMemo(
    () => new Map(variantOptions.map((variant) => [variant.id, variant])),
    [variantOptions],
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = search.toLowerCase();
      const entityName = (order.vendor_name || order.entity_name || '').toLowerCase();
      const projectName = (order.project_name || '').toLowerCase();
      const itemMatches = (order.items || []).some((item) => item.sku.toLowerCase().includes(query) || item.product_name.toLowerCase().includes(query));
      const hit = order.order_number.toLowerCase().includes(query) || entityName.includes(query) || projectName.includes(query) || itemMatches || (order.sku || '').toLowerCase().includes(query);
      const hitType = typeFilter === 'ALL' || order.type === typeFilter;
      const hitStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return hit && hitType && hitStatus;
    });
  }, [orders, search, statusFilter, typeFilter]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [orders.length, pageSize, search, statusFilter, typeFilter]);

  async function refreshOrders() {
    const data = await modulesService.getOrders();
    setOrders(data);
  }

  function updateLine(lineId: string, updates: Partial<PurchaseOrderLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, createDraftLine()]);
  }

  function removeLine(lineId: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  }

  function toggleBulkItemSelection(variantId: string) {
    const newSet = new Set(bulkSelectedIds);
    if (newSet.has(variantId)) {
      newSet.delete(variantId);
    } else {
      newSet.add(variantId);
    }
    setBulkSelectedIds(newSet);
  }

  function addBulkItemsToOrder() {
    if (bulkSelectedIds.size === 0) {
      showToast('Select at least one item to add.', 'info');
      return;
    }

    const newLines: PurchaseOrderLineDraft[] = [];
    bulkSelectedIds.forEach((variantId) => {
      const selected = variantLookup.get(variantId);
      if (selected) {
        newLines.push({
          id: `line_${Math.random().toString(36).slice(2, 10)}`,
          variant_id: selected.id,
          sku: selected.sku,
          product_name: selected.product_name,
          unit: selected.unit || '',
          warehouse_id: selected.warehouse_id || 'unknown',
          warehouse_name: selected.warehouse_name || 'Unknown',
          quantity: 1,
          price: selected.price || 0,
          gst_rate: 18,
          max_stock: selected.total_stock,
        });
      }
    });

    setLines((current) => [...current.filter((l) => l.variant_id), ...newLines]);
    setBulkSelectedIds(new Set());
    setBulkSelectorOpen(false);
    showToast(`Added ${newLines.length} items to order.`, 'success');
  }

  const filteredBulkVariants = useMemo(() => {
    if (!bulkSearch.trim()) return variantOptions;
    const query = bulkSearch.toLowerCase();
    return variantOptions.filter(
      (variant) =>
        variant.product_name.toLowerCase().includes(query) ||
        variant.sku.toLowerCase().includes(query),
    );
  }, [bulkSearch, variantOptions]);

  const orderSummary = useMemo(() => {
    const validLines = lines.filter((line) => line.variant_id && line.quantity > 0);
    const subtotal = validLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const totalGst = validLines.reduce((sum, line) => sum + (line.price * line.quantity * line.gst_rate) / 100, 0);
    const totalAmount = subtotal + totalGst;
    const hasInvalidStock = validLines.some((line) => line.max_stock > 0 && line.quantity > line.max_stock);
    return {
      validLines,
      subtotal,
      totalGst,
      totalAmount,
      lineCount: validLines.length,
      hasInvalidStock,
    };
  }, [lines]);

  const canSubmitOrder = Boolean(draft.vendor_id && orderSummary.lineCount > 0 && !orderSummary.hasInvalidStock);

  async function createPurchaseOrder() {
    if (!draft.vendor_id) {
      showToast('Please select a vendor before creating a purchase order.', 'error');
      return;
    }

    const vendor = vendors.find((item) => item.id === draft.vendor_id);
    if (!vendor) {
      showToast('Selected vendor was not found.', 'error');
      return;
    }

    const validLines = orderSummary.validLines;
    if (validLines.length === 0) {
      showToast('Add at least one product line with quantity before creating the order.', 'error');
      return;
    }

    if (orderSummary.hasInvalidStock) {
      showToast('One or more line quantities exceed available stock for the selected variant.', 'error');
      return;
    }

    const project = projects.find((item) => item.id === draft.project_id);

    const confirmed = await confirmAction({
      title: 'Create Purchase Order',
      message: `Are you sure you want to create this purchase order for ${vendor.name}? Total items: ${orderSummary.lineCount}.`,
      confirmText: 'Create PO',
      cancelText: 'Cancel',
    });

    if (!confirmed.confirmed) return;

    try {
      await modulesService.createOrder({
        type: 'PURCHASE',
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        project_id: project?.id,
        project_name: project?.name,
        items: validLines.map((line) => {
          const baseAmount = line.price * line.quantity;
          const gstAmount = (baseAmount * line.gst_rate) / 100;
          return {
            variant_id: line.variant_id,
            sku: line.sku,
            product_name: line.product_name,
            unit: line.unit,
            quantity: line.quantity,
            price: line.price,
            gst_rate: line.gst_rate,
            gst_amount: gstAmount,
            total_price: baseAmount + gstAmount,
            warehouse_id: line.warehouse_id,
            warehouse_name: line.warehouse_name,
          };
        }),
        delivery_address: draft.delivery_address,
        payment_terms: draft.payment_terms,
      });

      const res = await modulesService.getOrders();
      const newOrder = res.find(o => o.order_number === (res as any).order_number) || res[0];

      // Log Audit
      await modulesService.addAudit({
        action: 'CREATE_ORDER',
        entity_type: 'order',
        entity_id: newOrder?.id || 'new',
        entity_name: newOrder?.order_number || 'New Order',
        reason: 'Manual order creation',
        details: `Created ${newOrder?.type} order for ${newOrder?.vendor_name}. Items: ${validLines.length}`,
        new_values: {
          vendor_name: vendor.name,
          project_name: project?.name,
          items_count: validLines.length,
          total_amount: orderSummary.totalAmount
        }
      });

      setCreateOpen(false);
      setDraft({ vendor_id: '', project_id: '', delivery_address: '', payment_terms: '' });
      setLines([createDraftLine()]);
      await refreshOrders();
      showToast('Purchase order created successfully.', 'success');
    } catch (error) {
      console.error('Failed to create purchase order:', error);
      showToast('Failed to create purchase order. Please check your inputs and try again.', 'error');
    }
  }

  async function approveOrder(order: OrderRow) {
    if (order.status !== 'PENDING') return;

    const confirmation = await confirmAction({
      title: 'Approve this order?',
      message: 'This will apply stock changes immediately.',
      confirmText: 'Approve',
      requireReason: true,
      reasonLabel: 'Approval reason',
      reasonPlaceholder: 'Why are you approving this order?',
    });
    if (!confirmation.confirmed) return;

    const items = order.items?.length ? order.items : [{
      variant_id: order.variant_id || '',
      sku: order.sku || '',
      product_name: order.items?.[0]?.product_name || 'Order Transaction',
      warehouse_id: order.warehouse_id || '',
      warehouse_name: order.warehouse_name || 'Unknown',
      quantity: order.quantity || 0,
    }];

    let inventoryErrors = false;

    for (const item of items) {
      const recordWarehouseId = item.warehouse_id || order.warehouse_id || '';

      // Only record movement if we have a valid warehouse_id (UUID format)
      if (recordWarehouseId && recordWarehouseId !== 'unknown' && recordWarehouseId.length > 0) {
        try {
          await inventoryService.recordMovement({
            variant_id: item.variant_id,
            warehouse_id: recordWarehouseId,
            type: order.type === 'SALE' ? 'OUT' : 'IN',
            quantity: item.quantity,
            notes: `${order.type} order ${order.order_number} | Reason: ${confirmation.reason}`,
          });
        } catch (error) {
          console.error('Failed to record inventory movement:', error);
          inventoryErrors = true;
        }
      } else {
        console.warn('Skipping inventory movement: warehouse assignment needed for item', item.sku);
        inventoryErrors = true;
      }

      // Always add movement record even if inventory update fails
      try {
        await modulesService.addMovement({
          variant_id: item.variant_id,
          sku: item.sku,
          product_name: item.product_name,
          warehouse_id: recordWarehouseId || 'unknown',
          warehouse_name: item.warehouse_name || order.warehouse_name || 'Unknown',
          type: order.type === 'SALE' ? 'OUT' : 'IN',
          quantity: item.quantity,
          notes: `Approved ${order.order_number} | Reason: ${confirmation.reason}`,
        });
      } catch (error) {
        console.error('Failed to add movement record:', error);
      }
    }

    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'ORDER_APPROVED',
        entity_type: 'order',
        entity_id: order.id,
        entity_name: order.order_number,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: `${order.type} approved for ${order.vendor_name || order.entity_name}. Stock impacted.`,
        old_values: { status: order.status },
        new_values: { status: 'APPROVED' }
      });
    } catch (error) {
      console.error('Failed to add audit:', error);
    }

    await modulesService.updateOrderStatus(order.id, 'APPROVED');
    await refreshOrders();

    if (inventoryErrors) {
      showToast('Order approved. Note: Some items lack warehouse assignment for inventory tracking.', 'info');
    } else {
      showToast('Order approved and stock updated successfully.', 'success');
    }
  }

  async function changeOrderStatus(order: OrderRow, newStatus: string) {
    const statusLabels: Record<string, string> = {
      'PENDING': 'Pending Approval',
      'APPROVED': 'Approved',
      'CANCELLED': 'Rejected',
      'SENT': 'Sent',
      'ACKNOWLEDGED': 'Acknowledged',
      'PARTIALLY_RECEIVED': 'Partially Received',
      'COMPLETED': 'Completed',
      'CLOSED': 'Closed',
    };

    const confirmation = await confirmAction({
      title: `Change status to ${statusLabels[newStatus]}?`,
      message: `The order status will be updated from ${statusLabels[order.status]} to ${statusLabels[newStatus]}.`,
      confirmText: 'Change Status',
      requireReason: true,
      reasonLabel: 'Reason for status change',
      reasonPlaceholder: 'Why are you changing this status?',
    });
    if (!confirmation.confirmed) return;

    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'ORDER_STATUS_CHANGED',
        entity_type: 'order',
        entity_id: order.id,
        entity_name: order.order_number,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: `Status changed from ${order.status} to ${newStatus}`,
        old_values: { status: order.status },
        new_values: { status: newStatus }
      });
    } catch (error) {
      console.error('Failed to add audit:', error);
    }

    try {
      await modulesService.updateOrderStatus(order.id, newStatus as any);
      await refreshOrders();
      setStatusChangeModal(null);
      showToast(`Order status updated to ${statusLabels[newStatus]}.`, 'success');
    } catch (error) {
      console.error('Failed to change status:', error);
      showToast('Failed to change order status. Please try again.', 'error');
    }
  }

  async function rejectOrder(order: OrderRow) {
    if (order.status !== 'PENDING') return;
    const confirmation = await confirmAction({
      title: 'Reject this order?',
      message: 'Select a status and provide rejection reason.',
      confirmText: 'Reject Order',
      requireReason: true,
      reasonLabel: 'Rejection reason',
      reasonPlaceholder: 'Why are you rejecting this order?',
    });
    if (!confirmation.confirmed) return;

    try {
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Order Rejected',
        entity_type: 'order',
        entity_id: order.id,
        entity_name: order.order_number,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: `${order.type} for ${order.vendor_name || order.entity_name}`,
      });
    } catch (error) {
      console.error('Failed to add audit:', error);
    }

    try {
      // Use CANCELLED status for rejected orders
      await modulesService.updateOrderStatus(order.id, 'CANCELLED');
      await refreshOrders();
      showToast('Order rejected successfully.', 'info');
    } catch (error) {
      console.error('Failed to reject order:', error);
      showToast('Failed to reject order. Please try again.', 'error');
    }
  }

  async function deletePurchaseOrder(order: OrderRow) {
    const confirmation = await confirmAction({
      title: 'Delete this purchase order?',
      message: 'The PO will be marked as cancelled. This action cannot be undone.',
      confirmText: 'Delete',
      requireReason: true,
      reasonLabel: 'Deletion reason',
      reasonPlaceholder: 'Why are you deleting this order?',
    });
    if (!confirmation.confirmed) return;

    try {
      // Add audit log for deletion
      const currentUser = await modulesService.getCurrentUser();
      await modulesService.addAudit({
        action: 'Order Deleted',
        entity_type: 'order',
        entity_id: order.id,
        entity_name: order.order_number,
        reason: confirmation.reason,
        performed_by: currentUser?.email || 'Unknown',
        details: `${order.type} for ${order.vendor_name || order.entity_name}`,
      });

      // Mark order as cancelled (soft delete)
      await modulesService.updateOrderStatus(order.id, 'CANCELLED');

      // Refresh the orders list
      await refreshOrders();

      showToast('Purchase order deleted successfully.', 'success');
    } catch (error) {
      console.error('Failed to delete order:', error);
      showToast('Failed to delete purchase order. Please try again.', 'error');
    }
  }

  function downloadPDF(order: OrderRow) {
    const vendorName = order.vendor_name || order.entity_name || 'Unknown';
    const items = order.items || [];

    // Calculate totals properly
    const itemRows = items.map((item) => {
      const qty = item.quantity || 0;
      const rate = item.price || 0;
      const gst = item.gst_rate || 0;
      const baseAmount = rate * qty;
      const gstAmount = baseAmount * (gst / 100);
      const totalAmount = baseAmount + gstAmount;
      return { item, qty, rate, gst, baseAmount, gstAmount, totalAmount };
    });

    const subtotal = itemRows.reduce((sum, row) => sum + row.baseAmount, 0);
    const totalGst = itemRows.reduce((sum, row) => sum + row.gstAmount, 0);
    const grandTotal = subtotal + totalGst;

    // Generate professional HTML content for PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; background: white; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
    .logo-section { display: flex; align-items: center; gap: 15px; }
    .logo-text { font-size: 24px; font-weight: bold; color: #1e40af; }
    .logo-subtext { font-size: 12px; color: #666; }
    .po-header { text-align: right; }
    .po-title { font-size: 28px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
    .po-number { font-size: 16px; color: #666; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-block { }
    .info-label { font-size: 11px; color: #999; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; color: #333; line-height: 1.4; }
    .status { padding: 6px 12px; display: inline-block; font-size: 13px; font-weight: bold; margin-top: 5px; }
    .status-approved { background-color: rgba(34, 197, 94, 0.15); color: #15803d; }
    .status-rejected { background-color: rgba(239, 68, 68, 0.15); color: #dc2626; }
    .status-pending { background-color: rgba(251, 191, 36, 0.15); color: #b45309; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background-color: #f0f4f8; }
    th { padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #1e40af; }
    td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    td.amount { text-align: right; font-weight: 500; }
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .summary { width: 350px; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
    .summary-row.total { border: none; padding: 12px 0; font-size: 16px; font-weight: bold; color: #1e40af; }
    .notes-section { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-left: 3px solid #1e40af; }
    .notes-label { font-size: 11px; color: #999; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
    .notes-text { font-size: 13px; color: #333; line-height: 1.5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; text-align: center; }
    .footer-note { margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header with Logo -->
    <div class="header">
      <div class="logo-section">
        <div>
          <div class="logo-text">WATCON</div>
          <div class="logo-subtext">Purchase Order Management</div>
        </div>
      </div>
      <div class="po-header">
        <div class="po-title">PURCHASE ORDER</div>
        <div class="po-number">${order.order_number}</div>
      </div>
    </div>

    <!-- Order Information -->
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Vendor</div>
        <div class="info-value">${vendorName}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Status</div>
        <div class="status ${order.status === 'APPROVED' ? 'status-approved' : order.status === 'CANCELLED' ? 'status-rejected' : 'status-pending'}">
          ${order.status === 'APPROVED' ? 'Approved' : order.status === 'CANCELLED' ? 'Rejected' : 'Pending Approval'}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Date</div>
        <div class="info-value">${new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Total Amount</div>
        <div class="info-value" style="color: #1e40af; font-weight: bold; font-size: 16px;">₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(grandTotal)}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: center;">GST%</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows.map((row) => `
        <tr>
          <td><strong>${row.item.product_name}</strong><br><span style="color: #999; font-size: 12px;">${row.item.sku}</span></td>
          <td style="text-align: center;">${row.qty}</td>
          <td style="text-align: right;">₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(row.rate)}</td>
          <td style="text-align: center;">${row.gst}%</td>
          <td class="amount">₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(row.totalAmount)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Summary -->
    <div class="summary-section">
      <div class="summary">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(subtotal)}</span>
        </div>
        <div class="summary-row">
          <span>GST (Total):</span>
          <span>₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(totalGst)}</span>
        </div>
        <div class="summary-row total">
          <span>GRAND TOTAL:</span>
          <span>₹${new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- Notes Section -->
    ${order.delivery_address || order.payment_terms ? `
    <div class="notes-section">
      ${order.delivery_address ? `
      <div style="margin-bottom: 12px;">
        <div class="notes-label">Delivery Address</div>
        <div class="notes-text">${order.delivery_address}</div>
      </div>
      ` : ''}
      ${order.payment_terms ? `
      <div>
        <div class="notes-label">Payment Terms</div>
        <div class="notes-text">${order.payment_terms}</div>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div>This is a digitally generated Purchase Order from Watcon Inventory Management System</div>
      <div class="footer-note">Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.order_number}.html`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    showToast('PO downloaded successfully.', 'success');
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Purchase Orders</h1>
          <p className={styles.subtitle}>Use bulk product selection, vendor/project linkage, and approval-based stock movement.</p>
        </div>
        {canCreate && (
          <button type="button" className={styles.primaryAction} onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            <span>New Purchase Order</span>
          </button>
        )}
      </div>

      {createOpen && (
        <div className={`${styles.card} ${styles.createCard}`}>
          <div className={styles.createHeader}>
            <div>
              <p className={styles.subtitle} style={{ margin: 0 }}>Purchase order form</p>
              <h2 className={styles.title} style={{ fontSize: '1.3rem', margin: '0.35rem 0 0 0' }}>Create Purchase Order</h2>
              <p className={styles.subtitle} style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
                Build your PO inline with vendor, project, and inventory-connected line items.
              </p>
            </div>
            <button
              className={styles.actionBtn}
              onClick={() => setCreateOpen(false)}
              style={{ fontSize: '1rem', padding: '0.65rem 1rem', color: 'var(--text-secondary)' }}
              title="Close"
            >
              Close
            </button>
          </div>

          <div className={styles.bulkModalBody}>
            <div className={styles.createGrid}>
              <div>
                <label className={styles.fieldLabel}>Vendor</label>
                <select 
                  className={styles.select} 
                  value={draft.vendor_id} 
                  onChange={(e) => {
                    const selectedVendor = vendors.find((v) => v.id === e.target.value);
                    setDraft((prev) => ({ 
                      ...prev, 
                      vendor_id: e.target.value,
                      payment_terms: selectedVendor?.payment_terms || '',
                      delivery_address: prev.project_id
                        ? prev.delivery_address
                        : selectedVendor?.delivery_address || prev.delivery_address,
                    }));
                  }}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Project (optional)</label>
                <select
                  className={styles.select}
                  value={draft.project_id}
                  onChange={(e) => {
                    const selectedProject = projects.find((project) => project.id === e.target.value);
                    setDraft((prev) => ({
                      ...prev,
                      project_id: e.target.value,
                      delivery_address: selectedProject?.delivery_address || prev.delivery_address,
                    }));
                  }}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {draft.vendor_id && (
              <div className={styles.vendorDetailsSection}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className={styles.fieldLabel}>Delivery Address</label>
                    <textarea
                      className={styles.vendorDetailInput}
                      value={draft.delivery_address}
                      onChange={(e) => setDraft((prev) => ({ ...prev, delivery_address: e.target.value }))}
                      placeholder="Enter delivery address"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Payment Terms</label>
                    <textarea
                      className={styles.vendorDetailInput}
                      value={draft.payment_terms}
                      onChange={(e) => setDraft((prev) => ({ ...prev, payment_terms: e.target.value }))}
                      placeholder="e.g., Net 30, Due on delivery"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className={styles.lineHeader}>
              <div>
                <h3 className={styles.title} style={{ fontSize: '1rem', margin: 0 }}>Order Lines</h3>
                <p className={styles.helperText} style={{ margin: '0.5rem 0 0 0' }}>
                  Select a product variant to auto-fill unit, warehouse, price, and available stock. Keep quantities within stock limits.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className={styles.bulkSelectorBtn} onClick={() => setBulkSelectorOpen(true)}>
                  <Plus size={16} />
                  <span>Bulk Add Items</span>
                </button>
                <button type="button" className={styles.iconButton} onClick={addLine} title="Add a single order line">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className={styles.lineTableWrapper}>
              <table className={styles.lineTable}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '240px' }}>Product / Variant</th>
                    <th style={{ minWidth: '60px' }}>Unit</th>
                    <th style={{ minWidth: '80px' }}>Qty</th>
                    <th style={{ minWidth: '90px' }}>Per Price</th>
                    <th style={{ minWidth: '70px' }}>GST %</th>
                    <th style={{ minWidth: '140px' }}>Price after GST</th>
                    <th style={{ minWidth: '70px' }}>Available</th>
                    <th style={{ minWidth: '120px' }}>Warehouse</th>
                    <th style={{ minWidth: '50px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <select
                          className={styles.select}
                          value={line.variant_id}
                          onChange={(e) => {
                            const selected = variantLookup.get(e.target.value);
                            if (!selected) {
                              updateLine(line.id, {
                                variant_id: '',
                                sku: '',
                                product_name: '',
                                unit: '',
                                warehouse_id: '',
                                warehouse_name: '',
                                price: 0,
                                gst_rate: 0,
                                max_stock: 0,
                              });
                              return;
                            }

                            updateLine(line.id, {
                              variant_id: selected.id,
                              sku: selected.sku,
                              product_name: selected.product_name,
                              unit: selected.unit || '',
                              warehouse_id: selected.warehouse_id || 'unknown',
                              warehouse_name: selected.warehouse_name || 'Unknown',
                              price: selected.price ?? 0,
                              gst_rate: 18,
                              max_stock: selected.total_stock,
                              quantity: 1,
                            });
                          }}
                        >
                          <option value="">Select variant</option>
                          {variantOptions.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.product_name} — {variant.sku}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{line.unit || "-"}</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          className={styles.searchInput}
                          title={"Available stock: " + line.max_stock}
                          onChange={(e) => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.price}
                          className={styles.searchInput}
                          onChange={(e) => updateLine(line.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={line.gst_rate}
                          className={styles.searchInput}
                          onChange={(e) => updateLine(line.id, { gst_rate: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>
                          Rs. {new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(
                            (line.price * line.quantity) * (1 + line.gst_rate / 100),
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: line.max_stock > 0 ? "var(--success)" : "var(--text-secondary)" }}>
                          {line.max_stock > 0 ? `${line.max_stock} in stock` : 'Out of stock'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem" }}>{line.warehouse_name || "-"}</div>
                      </td>
                      <td className={styles.lineActions}>
                        <button className={styles.actionBtn} onClick={() => removeLine(line.id)} title="Remove line">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className={styles.subtitle} style={{ marginTop: '1rem', fontSize: "0.85rem" }}>
              Each purchase order can include multiple variant rows. Quantities are validated against total available stock.
            </p>

            <div className={styles.orderSummary}>
              <div className={styles.summaryItem}>
                <span>Subtotal</span>
                <strong>Rs. {new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(orderSummary.subtotal)}</strong>
              </div>
              <div className={styles.summaryItem}>
                <span>Total GST</span>
                <strong>Rs. {new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(orderSummary.totalGst)}</strong>
              </div>
              <div className={styles.summaryItem}>
                <span>Order total</span>
                <strong>Rs. {new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(orderSummary.totalAmount)}</strong>
              </div>
            </div>
          </div>

          <div className={styles.bulkModalFooter}>
            <button type="button" className={styles.bulkCancelBtn} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className={styles.submitBtn} onClick={createPurchaseOrder} disabled={!canSubmitOrder}>
              Create Purchase Order
            </button>
          </div>
        </div>
      )}

      {bulkSelectorOpen && (
        <div className={styles.bulkModalOverlay} onClick={() => setBulkSelectorOpen(false)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <h2 className={styles.title} style={{ fontSize: '1.2rem', margin: 0 }}>Add Items in Bulk</h2>
              <button
                className={styles.actionBtn}
                onClick={() => setBulkSelectorOpen(false)}
                style={{ fontSize: '1.5rem', padding: '0' }}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody}>
              <input
                type="text"
                className={styles.bulkSearchInput}
                placeholder="Search by product name or SKU..."
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
              />
              <div className={styles.bulkItemsList}>
                {filteredBulkVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className={`${styles.bulkItemCard} ${bulkSelectedIds.has(variant.id) ? styles.selected : ''}`}
                  >
                    <label className={styles.bulkItemLabel}>
                      <input
                        type="checkbox"
                        className={styles.bulkItemCheckbox}
                        checked={bulkSelectedIds.has(variant.id)}
                        onChange={() => toggleBulkItemSelection(variant.id)}
                      />
                      <div className={styles.bulkItemContent}>
                        <div className={styles.bulkItemName}>{variant.product_name}</div>
                        <div className={styles.bulkItemMeta}>SKU: {variant.sku}</div>
                        <div className={styles.bulkItemMeta}>
                          Stock: <strong>{variant.total_stock}</strong> | Unit: <strong>{variant.unit || "-"}</strong> | Warehouse: <strong>{variant.warehouse_name || "Unknown"}</strong>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {filteredBulkVariants.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No items found. Try a different search.
                </div>
              )}
            </div>
            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setBulkSelectorOpen(false)}>
                Cancel
              </button>
              <button className={styles.bulkConfirmBtn} onClick={addBulkItemsToOrder}>
                Add {bulkSelectedIds.size} Item{bulkSelectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPO && (
        <div className={styles.bulkModalOverlay} onClick={() => setSelectedPO(null)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div>
                <h2 className={styles.title} style={{ fontSize: '1.2rem', margin: 0 }}>{selectedPO.order_number}</h2>
              </div>
              <button
                className={styles.actionBtn}
                onClick={() => setSelectedPO(null)}
                style={{ fontSize: '1.5rem', padding: '0' }}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>VENDOR</p>
                  <p style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedPO.vendor_name || selectedPO.entity_name || 'Unknown'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>STATUS</p>
                  <span className={selectedPO.status === 'APPROVED' ? styles.statusCreated : selectedPO.status === 'CANCELLED' ? styles.statusCancelled : styles.statusPendingApproval}>
                    {selectedPO.status === 'APPROVED' ? 'created' : selectedPO.status === 'CANCELLED' ? 'cancelled' : 'pending approval'}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ITEM</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>QTY</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RATE</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>GST%</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPO.items || []).map((item, idx) => {
                      const baseAmount = (item.price || 0) * (item.quantity || 0);
                      const gstAmount = baseAmount * ((item.gst_rate || 0) / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                            <strong>{item.product_name}</strong>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>{item.quantity}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>₹{item.price}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>{item.gst_rate || 0}%</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>
                            ₹{new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(baseAmount + gstAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ minWidth: '250px' }}>
                  {(() => {
                    const subtotal = (selectedPO.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
                    const totalGst = (selectedPO.items || []).reduce((sum, item) => {
                      const baseAmount = (item.price || 0) * (item.quantity || 0);
                      return sum + (baseAmount * ((item.gst_rate || 0) / 100));
                    }, 0);
                    const grandTotal = subtotal + totalGst;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                          <span>Subtotal:</span>
                          <strong>₹{new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(subtotal)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                          <span>GST:</span>
                          <strong>₹{new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(totalGst)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                          <span>Transport:</span>
                          <strong>₹0</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: '700' }}>
                          <span>Grand Total:</span>
                          <strong>₹{new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(grandTotal)}</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setSelectedPO(null)}>
                Close
              </button>
              <button className={styles.submitBtn} onClick={() => { downloadPDF(selectedPO); setSelectedPO(null); }}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {statusChangeModal && (
        <div className={styles.bulkModalOverlay} onClick={() => setStatusChangeModal(null)}>
          <div className={styles.bulkModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div>
                <h2 className={styles.title} style={{ fontSize: '1.2rem', margin: 0 }}>Change Order Status</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{statusChangeModal.order.order_number}</p>
              </div>
              <button
                className={styles.actionBtn}
                onClick={() => setStatusChangeModal(null)}
                style={{ fontSize: '1.5rem', padding: '0' }}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.bulkModalBody} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className={styles.fieldLabel}>Select New Status</label>
                <select
                  className={styles.select}
                  value={statusChangeModal.newStatus}
                  onChange={(e) => setStatusChangeModal({ ...statusChangeModal, newStatus: e.target.value })}
                  style={{ marginTop: '0.5rem' }}
                >
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="CANCELLED">Rejected</option>
                  <option value="SENT">Sent</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Reason for Status Change</label>
                <textarea
                  className={styles.vendorDetailInput}
                  placeholder="Explain why you are changing this order's status..."
                  rows={4}
                  style={{ marginTop: '0.5rem' }}
                  id="statusChangeReason"
                />
              </div>
            </div>
            <div className={styles.bulkModalFooter}>
              <button className={styles.bulkCancelBtn} onClick={() => setStatusChangeModal(null)}>
                Cancel
              </button>
              <button
                className={styles.submitBtn}
                onClick={() => {
                  const reason = (document.getElementById('statusChangeReason') as HTMLTextAreaElement)?.value || '';
                  if (!reason.trim()) {
                    showToast('Please provide a reason for the status change.', 'error');
                    return;
                  }
                  changeOrderStatus(statusChangeModal.order, statusChangeModal.newStatus);
                }}
              >
                Change Status
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input type="text" placeholder="Search order number, vendor or item..." className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OrderRow['status'])}>
              <option value="ALL">All Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className={styles.iconButton}><Filter size={18} /></button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>PO NUMBER</th>
              <th>VENDOR</th>
              <th>TOTAL</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No purchase orders found. Use New Purchase Order to start.
                </td>
              </tr>
            ) : paginatedOrders.map((order) => {
              const displayName = order.vendor_name || order.entity_name || 'Unknown';
              const orderTotal = (order.items || []).reduce((sum, item) => {
                const baseAmount = (item.price || 0) * (item.quantity || 0);
                const gstAmount = baseAmount * ((item.gst_rate || 0) / 100);
                return sum + baseAmount + gstAmount;
              }, 0);
              const statusMap: Record<string, 'created' | 'pending_approval'> = {
                'APPROVED': 'created',
                'PENDING': 'pending_approval',
                'CANCELLED': 'created',
              };
              const mappedStatus = statusMap[order.status] || 'created';
              return (
                <tr key={order.id}>
                  <td><strong>{order.order_number}</strong></td>
                  <td>{displayName}</td>
                  <td>
                    <strong>₹{new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 2 }).format(orderTotal)}</strong>
                  </td>
                  <td>
                    <span className={order.status === 'APPROVED' ? styles.statusCreated : order.status === 'CANCELLED' ? styles.statusCancelled : styles.statusPendingApproval}>
                      {order.status === 'APPROVED' ? 'approved' : order.status === 'CANCELLED' ? 'rejected' : 'pending approval'}
                    </span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {canApprove && order.status === 'PENDING' && (
                        <button className={styles.actionBtn} title="Approve" onClick={() => approveOrder(order)}>
                          <Check size={16} color="currentColor" />
                        </button>
                      )}
                      {canCancel && order.status === 'PENDING' && (
                        <button className={styles.actionBtn} title="Reject" onClick={() => rejectOrder(order)}>
                          <X size={16} color="currentColor" />
                        </button>
                      )}
                      <button className={styles.actionBtn} title="View details" onClick={() => setSelectedPO(order)}>
                        <Eye size={16} />
                      </button>
                      <button className={styles.actionBtn} title="Download PDF" onClick={() => downloadPDF(order)}>
                        <Printer size={16} />
                      </button>
                      <button className={styles.actionBtn} title="Change Status" onClick={() => setStatusChangeModal({ order, newStatus: order.status })}>
                        <Settings size={16} />
                      </button>
                      <button className={styles.actionBtn} title="Delete" onClick={() => deletePurchaseOrder(order)}>
                        <Trash2 size={16} color="currentColor" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredOrders.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="orders"
        />
      </div>
    </div>
  );
}

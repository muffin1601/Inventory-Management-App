"use client";

import React from "react";
import styles from "./Reports.module.css";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FolderKanban,
  History,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { modulesService } from "@/lib/services/modules";
import { projectsService, type ProjectRecord, type BoqItemRecord } from "@/lib/services/projects";
import { useUi } from "@/components/ui/AppProviders";
import type { AuditTrailRow, InventorySnapshotRow, OrderRow, StockMovementRow } from "@/types/modules";

type VendorRecord = {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  delivery_address?: string;
  payment_terms?: string;
  status?: string;
};

type PreviewKey = "vendors" | "orders" | "stock";

type VendorPerformanceRow = {
  id: string;
  name: string;
  contact_person: string;
  totalOrders: number;
  approvedOrders: number;
  pendingOrders: number;
  totalValue: number;
  linkedProjects: number;
  averageOrderAge: number | null;
  lastOrderDate: string;
  paymentTerms: string;
};

const VENDOR_DETAILS_KEY = "ims_vendor_details_v1";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];
  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderValue(order: OrderRow) {
  return (order.items || []).reduce((sum, item) => {
    if (typeof item.total_price === "number") return sum + item.total_price;
    const baseAmount = (item.price || 0) * (item.quantity || 0);
    const gstAmount = typeof item.gst_amount === "number" ? item.gst_amount : (baseAmount * (item.gst_rate || 0)) / 100;
    return sum + baseAmount + gstAmount;
  }, 0);
}

function getAttributesLabel(attributes: Record<string, string>) {
  const value = Object.entries(attributes || {})
    .map(([key, item]) => `${key}: ${item}`)
    .join(" | ");
  return value || "-";
}

function normalizeVendor(row: Record<string, unknown>): VendorRecord {
  return {
    id: String(row.id || row.vendor_id || ""),
    name: String(row.name || row.vendor_name || row.entity_name || ""),
    contact_person: typeof row.contact_person === "string" ? row.contact_person : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    delivery_address:
      typeof row.delivery_address === "string"
        ? row.delivery_address
        : typeof row.address === "string"
          ? row.address
          : typeof row.city === "string"
            ? row.city
            : "",
    payment_terms: typeof row.payment_terms === "string" ? row.payment_terms : "",
    status: typeof row.status === "string" ? row.status : "ACTIVE",
  };
}

function readVendorDetails(): Record<string, Partial<VendorRecord>> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(VENDOR_DETAILS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Partial<VendorRecord>>;
  } catch {
    return {};
  }
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  const message = `${candidate.message || ""} ${candidate.details || ""}`.toLowerCase();
  return candidate.code === "42703" || candidate.code === "PGRST204" || message.includes("column");
}

async function loadVendors() {
  const vendorSelects = [
    { select: "id, name, status, contact_person, phone, email, delivery_address, payment_terms", order: "name" },
    { select: "id, name, status, phone, email, delivery_address, payment_terms", order: "name" },
    { select: "id, name, status, city, payment_terms", order: "name" },
    { select: "id, name, status", order: "name" },
    { select: "*", order: "name" },
  ];

  for (const { select, order } of vendorSelects) {
    const response = await supabase.from("vendors").select(select).order(order);
    if (!response.error) {
      const savedDetails = readVendorDetails();
      return (response.data || []).map((row) => {
        const normalized = normalizeVendor(row as unknown as Record<string, unknown>);
        return {
          ...normalized,
          ...(savedDetails[normalized.id] || {}),
          id: normalized.id,
          name: normalized.name,
        };
      });
    }

    if (!isMissingColumnError(response.error)) {
      throw response.error;
    }
  }

  return [];
}

export default function ReportsPage() {
  const { showToast } = useUi();
  const [isLoading, setIsLoading] = React.useState(true);
  const [snapshot, setSnapshot] = React.useState<InventorySnapshotRow[]>([]);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [movements, setMovements] = React.useState<StockMovementRow[]>([]);
  const [auditTrail, setAuditTrail] = React.useState<AuditTrailRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRecord[]>([]);
  const [boqItems, setBoqItems] = React.useState<BoqItemRecord[]>([]);
  const [vendors, setVendors] = React.useState<VendorRecord[]>([]);
  const [projectWarning, setProjectWarning] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewKey>("vendors");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | OrderRow["status"]>("ALL");
  const [canExport, setCanExport] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const currentUser = await modulesService.getCurrentUser();
        setCanExport(currentUser ? await modulesService.hasPermission(currentUser, "reports.export") : false);

        const [stockRows, orderRows, movementRows, auditRows, projectList, boqList, vendorRows] = await Promise.all([
          modulesService.getInventorySnapshot(),
          modulesService.getOrders(),
          modulesService.getMovements(),
          modulesService.getAuditTrail(),
          projectsService.listProjects(),
          projectsService.listAllBoqItems(),
          loadVendors(),
        ]);

        setSnapshot(stockRows);
        setOrders(orderRows);
        setMovements(movementRows);
        setAuditTrail(auditRows);
        setProjects(projectList.projects);
        setBoqItems(boqList.items);
        setVendors(vendorRows);
        setProjectWarning(projectList.warning || boqList.warning || "");
      } catch (error) {
        console.error("Failed to load report data:", error);
        showToast("Could not load reports right now.", "error");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    const handleUserChange = () => {
      void load();
    };

    window.addEventListener("ims-current-user-changed", handleUserChange);
    return () => window.removeEventListener("ims-current-user-changed", handleUserChange);
  }, [showToast]);

  const projectSummary = React.useMemo(() => {
    const boqByProject = new Map<string, BoqItemRecord[]>();
    boqItems.forEach((item) => {
      const existing = boqByProject.get(item.project_id) || [];
      existing.push(item);
      boqByProject.set(item.project_id, existing);
    });

    return projects.map((project) => {
      const items = boqByProject.get(project.id) || [];
      const plannedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const deliveredQty = items.reduce((sum, item) => sum + (item.delivered || 0), 0);
      const pendingQty = Math.max(plannedQty - deliveredQty, 0);
      return {
        id: project.id,
        name: project.name,
        client: project.client_name || "-",
        address: project.delivery_address || "-",
        lineItems: items.length,
        plannedQty,
        deliveredQty,
        pendingQty,
        status: project.status || "ACTIVE",
        createdAt: formatDate(project.created_at),
      };
    });
  }, [boqItems, projects]);

  const vendorPerformance = React.useMemo<VendorPerformanceRow[]>(() => {
    const map = new Map<string, VendorPerformanceRow>();

    vendors.forEach((vendor) => {
      map.set(vendor.id || vendor.name, {
        id: vendor.id || vendor.name,
        name: vendor.name,
        contact_person: vendor.contact_person || "-",
        totalOrders: 0,
        approvedOrders: 0,
        pendingOrders: 0,
        totalValue: 0,
        linkedProjects: 0,
        averageOrderAge: null,
        lastOrderDate: "",
        paymentTerms: vendor.payment_terms || "Not set",
      });
    });

    orders.forEach((order) => {
      const key = order.vendor_id || order.vendor_name || order.entity_name || "unassigned";
      const name = order.vendor_name || order.entity_name || "Unassigned Vendor";
      const current = map.get(key) || {
        id: key,
        name,
        contact_person: "-",
        totalOrders: 0,
        approvedOrders: 0,
        pendingOrders: 0,
        totalValue: 0,
        linkedProjects: 0,
        averageOrderAge: null,
        lastOrderDate: "",
        paymentTerms: "Not set",
      };

      const orderAge = Math.max(
        0,
        Math.round((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      );

      const nextCount = current.totalOrders + 1;
      current.totalOrders = nextCount;
      current.approvedOrders += order.status === "APPROVED" ? 1 : 0;
      current.pendingOrders += order.status === "PENDING" ? 1 : 0;
      current.totalValue += getOrderValue(order);
      current.linkedProjects += order.project_id ? 1 : 0;
      current.averageOrderAge =
        current.averageOrderAge == null
          ? orderAge
          : Math.round(((current.averageOrderAge * (nextCount - 1)) + orderAge) / nextCount);
      if (!current.lastOrderDate || new Date(order.created_at) > new Date(current.lastOrderDate)) {
        current.lastOrderDate = order.created_at;
      }

      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [orders, vendors]);

  const stockPreviewRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return snapshot
      .filter((row) => {
        if (!query) return true;
        return (
          row.sku.toLowerCase().includes(query) ||
          row.product_name.toLowerCase().includes(query) ||
          row.warehouse_name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8);
  }, [search, snapshot]);

  const orderPreviewRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders
      .filter((order) => {
        const matchesQuery =
          !query ||
          order.order_number.toLowerCase().includes(query) ||
          (order.vendor_name || order.entity_name || "").toLowerCase().includes(query) ||
          (order.project_name || "").toLowerCase().includes(query);
        const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [orders, search, statusFilter]);

  const vendorPreviewRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendorPerformance
      .filter((row) => {
        if (!query) return true;
        return row.name.toLowerCase().includes(query) || row.contact_person.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [search, vendorPerformance]);

  const totals = React.useMemo(() => {
    const totalStock = snapshot.reduce((sum, row) => sum + row.quantity, 0);
    const lowStockRows = snapshot.filter((row) => row.quantity <= 20).length;
    const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
    const approvedOrders = orders.filter((order) => order.status === "APPROVED").length;
    const pendingBoqQty = projectSummary.reduce((sum, row) => sum + row.pendingQty, 0);
    const recentMovements = movements.filter((row) => {
      const createdAt = new Date(row.created_at).getTime();
      return Date.now() - createdAt <= 1000 * 60 * 60 * 24 * 7;
    }).length;

    return {
      totalStock,
      lowStockRows,
      pendingOrders,
      approvedOrders,
      activeProjects: projects.length,
      pendingBoqQty,
      trackedVendors: vendorPerformance.length,
      recentMovements,
    };
  }, [movements, orders, projectSummary, projects.length, snapshot, vendorPerformance.length]);

  const exportData = React.useMemo(() => {
    const stockRows = snapshot.map((row) => ({
      SKU: row.sku,
      Product: row.product_name,
      Attributes: getAttributesLabel(row.attributes),
      Warehouse: row.warehouse_name,
      Quantity: row.quantity,
      Status: row.quantity <= 20 ? "Low Stock" : "In Stock",
    }));

    const orderRows = orders.map((order) => ({
      "PO Number": order.order_number,
      Vendor: order.vendor_name || order.entity_name || "-",
      Project: order.project_name || "-",
      Status: order.status,
      Items: order.items.length,
      Quantity: order.quantity || order.items.reduce((sum, item) => sum + item.quantity, 0),
      Total: getOrderValue(order),
      "Payment Terms": order.payment_terms || "-",
      "Delivery Address": order.delivery_address || "-",
      "Created On": formatDate(order.created_at),
      "Created By": order.created_by,
    }));

    const projectRows = projectSummary.map((project) => ({
      Project: project.name,
      Client: project.client,
      Address: project.address,
      "BOQ Lines": project.lineItems,
      "Planned Qty": project.plannedQty,
      "Delivered Qty": project.deliveredQty,
      "Pending Qty": project.pendingQty,
      Status: project.status,
      "Created On": project.createdAt,
    }));

    const vendorRows = vendorPerformance.map((vendor) => ({
      Vendor: vendor.name,
      Contact: vendor.contact_person,
      "Total Orders": vendor.totalOrders,
      Approved: vendor.approvedOrders,
      Pending: vendor.pendingOrders,
      "Order Value": vendor.totalValue,
      "Projects Linked": vendor.linkedProjects,
      "Average Age (Days)": vendor.averageOrderAge ?? "-",
      "Last Order": formatDate(vendor.lastOrderDate),
      "Payment Terms": vendor.paymentTerms,
    }));

    const movementRows = movements.map((movement) => ({
      "Date & Time": formatDateTime(movement.created_at),
      SKU: movement.sku,
      Product: movement.product_name,
      Warehouse: movement.warehouse_name,
      Type: movement.type,
      Quantity: movement.quantity,
      Notes: movement.notes || "-",
    }));

    const auditRows = auditTrail.map((audit) => ({
      "Date & Time": formatDateTime(audit.created_at),
      Action: audit.action,
      Module: audit.entity_type,
      Entity: audit.entity_name,
      Reason: audit.reason,
      "Performed By": audit.performed_by,
      Details: audit.details || "-",
    }));

    return {
      stockRows,
      orderRows,
      projectRows,
      vendorRows,
      movementRows,
      auditRows,
    };
  }, [auditTrail, movements, orders, projectSummary, snapshot, vendorPerformance]);

  function handleExport(
    filename: string,
    rows: Array<Record<string, unknown>>,
    emptyMessage: string,
  ) {
    if (!canExport) {
      showToast("Your account does not have export permission.", "error");
      return;
    }

    if (!downloadCsv(filename, rows)) {
      showToast(emptyMessage, "info");
      return;
    }

    showToast(`${filename} downloaded.`, "success");
  }

  const exportCards = [
    {
      key: "stock",
      title: "Stock Report",
      description: "Share current stock, warehouse-wise balances, and low-stock items with the store team.",
      meta: `${formatNumber(snapshot.length)} stock rows`,
      icon: Boxes,
      action: () => handleExport("stock-report.csv", exportData.stockRows, "There is no stock data to export yet."),
    },
    {
      key: "orders",
      title: "Purchase Order Report",
      description: "Download vendor-wise orders with status, totals, payment terms, and linked projects.",
      meta: `${formatNumber(orders.length)} purchase orders`,
      icon: ClipboardList,
      action: () => handleExport("purchase-orders-report.csv", exportData.orderRows, "There are no purchase orders to export yet."),
    },
    {
      key: "projects",
      title: "Projects & BOQ Report",
      description: "See each project’s BOQ lines, delivered quantity, and remaining requirement in one file.",
      meta: `${formatNumber(projects.length)} projects`,
      icon: FolderKanban,
      action: () => handleExport("projects-boq-report.csv", exportData.projectRows, "There are no projects to export yet."),
    },
    {
      key: "vendors",
      title: "Vendor Performance",
      description: "Compare suppliers by order volume, pending approvals, value, and project involvement.",
      meta: `${formatNumber(vendorPerformance.length)} vendors`,
      icon: TrendingUp,
      action: () => handleExport("vendor-performance-report.csv", exportData.vendorRows, "There are no vendor records to export yet."),
    },
    {
      key: "movements",
      title: "Stock Movement Log",
      description: "Give stores or auditors a clean history of stock in, stock out, and transfer activity.",
      meta: `${formatNumber(movements.length)} movement records`,
      icon: History,
      action: () => handleExport("stock-movement-log.csv", exportData.movementRows, "There is no stock movement data to export yet."),
    },
    {
      key: "audit",
      title: "Audit Trail",
      description: "Export approval and change history for reviews, accountability, and internal checks.",
      meta: `${formatNumber(auditTrail.length)} audit entries`,
      icon: ShieldCheck,
      action: () => handleExport("audit-trail-report.csv", exportData.auditRows, "There is no audit data to export yet."),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports & Export</h1>
          <p className={styles.subtitle}>
            Download clean reports from inventory, purchase orders, vendors, projects, and audit activity without leaving this page.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.permissionBadge}>{canExport ? "Export enabled" : "View only"}</span>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => handleExport("stock-report.csv", exportData.stockRows, "There is no stock data to export yet.")}
          >
            <Download size={16} />
            Quick Export Stock
          </button>
        </div>
      </div>

      {/* <div className={styles.heroGrid}>
        <div className={styles.heroCard}>
          <div className={styles.heroIcon}>
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <div className={styles.heroTitle}>Built for everyday use</div>
            <p className={styles.heroText}>
              The reports below are written in plain language so store, purchase, and project teams can download the right file quickly.
            </p>
          </div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroIcon}>
            <ArrowRight size={18} />
          </div>
          <div>
            <div className={styles.heroTitle}>Connected to live modules</div>
            <p className={styles.heroText}>
              This page combines data from inventory, orders, vendors, BOQ, movements, and audit logs for production use.
            </p>
          </div>
        </div>
      </div> */}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Stock Units</span>
          <strong className={styles.statValue}>{formatNumber(totals.totalStock)}</strong>
          <span className={styles.statMeta}>{formatNumber(totals.lowStockRows)} low-stock rows need attention</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Purchase Orders</span>
          <strong className={styles.statValue}>{formatNumber(orders.length)}</strong>
          <span className={styles.statMeta}>
            {formatNumber(totals.pendingOrders)} pending, {formatNumber(totals.approvedOrders)} approved
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Projects & BOQ</span>
          <strong className={styles.statValue}>{formatNumber(totals.activeProjects)}</strong>
          <span className={styles.statMeta}>{formatNumber(totals.pendingBoqQty)} quantity still pending</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Vendors Tracked</span>
          <strong className={styles.statValue}>{formatNumber(totals.trackedVendors)}</strong>
          <span className={styles.statMeta}>{formatNumber(totals.recentMovements)} stock moves in the last 7 days</span>
        </div>
      </div>

      {projectWarning ? <div className={styles.notice}>{projectWarning}</div> : null}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>One-click export library</h2>
            <p className={styles.sectionSubtitle}>Each file is designed for a real business handoff, not just raw data dumping.</p>
          </div>
        </div>

        <div className={styles.exportGrid}>
          {exportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className={styles.exportCard}>
                <div className={styles.exportTop}>
                  <div className={styles.exportIcon}>
                    <Icon size={18} />
                  </div>
                  <span className={styles.exportMeta}>{card.meta}</span>
                </div>
                <div>
                  <h3 className={styles.exportTitle}>{card.title}</h3>
                  <p className={styles.exportDescription}>{card.description}</p>
                </div>
                <button type="button" className={styles.secondaryAction} onClick={card.action}>
                  <Download size={15} />
                  Download CSV
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Live preview before export</h2>
            <p className={styles.sectionSubtitle}>Search and scan the important numbers before you download or share them.</p>
          </div>
        </div>

        <div className={styles.previewTabs}>
          <button
            type="button"
            className={`${styles.previewTab} ${preview === "vendors" ? styles.previewTabActive : ""}`}
            onClick={() => setPreview("vendors")}
          >
            Vendor performance
          </button>
          <button
            type="button"
            className={`${styles.previewTab} ${preview === "orders" ? styles.previewTabActive : ""}`}
            onClick={() => setPreview("orders")}
          >
            Purchase orders
          </button>
          <button
            type="button"
            className={`${styles.previewTab} ${preview === "stock" ? styles.previewTabActive : ""}`}
            onClick={() => setPreview("stock")}
          >
            Stock watchlist
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={
                  preview === "vendors"
                    ? "Search vendor or contact..."
                    : preview === "orders"
                      ? "Search order number, vendor, or project..."
                      : "Search SKU, product, or warehouse..."
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {preview === "orders" ? (
              <select
                className={styles.select}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | OrderRow["status"])}
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            ) : null}
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Loading report data...</div>
          ) : preview === "vendors" ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Total Orders</th>
                  <th>Approved</th>
                  <th>Pending</th>
                  <th>Order Value</th>
                  <th>Projects</th>
                  <th>Last Order</th>
                </tr>
              </thead>
              <tbody>
                {vendorPreviewRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>No vendor records match this search.</td>
                  </tr>
                ) : (
                  vendorPreviewRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.primaryCell}>{row.name}</div>
                        <div className={styles.secondaryCell}>{row.contact_person === "-" ? row.paymentTerms : row.contact_person}</div>
                      </td>
                      <td>{formatNumber(row.totalOrders)}</td>
                      <td>{formatNumber(row.approvedOrders)}</td>
                      <td>{formatNumber(row.pendingOrders)}</td>
                      <td>{formatCurrency(row.totalValue)}</td>
                      <td>{formatNumber(row.linkedProjects)}</td>
                      <td>{formatDate(row.lastOrderDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : preview === "orders" ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orderPreviewRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>No purchase orders match this view.</td>
                  </tr>
                ) : (
                  orderPreviewRows.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className={styles.primaryCell}>{order.order_number}</div>
                        <div className={styles.secondaryCell}>{order.created_by}</div>
                      </td>
                      <td>{order.vendor_name || order.entity_name || "-"}</td>
                      <td>{order.project_name || "-"}</td>
                      <td>
                        <span
                          className={
                            order.status === "APPROVED"
                              ? styles.statusApproved
                              : order.status === "PENDING"
                                ? styles.statusPending
                                : styles.statusCancelled
                          }
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>{formatCurrency(getOrderValue(order))}</td>
                      <td>{formatDate(order.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stockPreviewRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>No stock rows match this search.</td>
                  </tr>
                ) : (
                  stockPreviewRows.map((row, index) => (
                    <tr key={`${row.variant_id}-${row.warehouse_id}-${index}`}>
                      <td>
                        <div className={styles.primaryCell}>{row.sku}</div>
                        <div className={styles.secondaryCell}>{getAttributesLabel(row.attributes)}</div>
                      </td>
                      <td>{row.product_name}</td>
                      <td>{row.warehouse_name}</td>
                      <td>{formatNumber(row.quantity)}</td>
                      <td>
                        <span className={row.quantity <= 20 ? styles.statusAlert : styles.statusHealthy}>
                          {row.quantity <= 20 ? "Low Stock" : "Healthy"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

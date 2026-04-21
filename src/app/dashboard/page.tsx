"use client";

import React from "react";
import Link from "next/link";
import styles from "../Dashboard.module.css";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  History,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { inventoryService } from "@/lib/services/inventory";
import { modulesService } from "@/lib/services/modules";
import { projectsService } from "@/lib/services/projects";
import type {
  AuditTrailRow,
  ChallanRow,
  OrderRow,
  PaymentSlipRow,
  StockMovementRow,
} from "@/types/modules";

type VendorRecord = {
  id: string;
  name: string;
};

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

function getOrderValue(order: OrderRow) {
  return (order.items || []).reduce((sum, item) => {
    if (typeof item.total_price === "number") return sum + item.total_price;
    const baseAmount = (item.price || 0) * (item.quantity || 0);
    const gstAmount = typeof item.gst_amount === "number" ? item.gst_amount : (baseAmount * (item.gst_rate || 0)) / 100;
    return sum + baseAmount + gstAmount;
  }, 0);
}

function withinDays(value: string, days: number) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
}

function extractMovementActor(notes?: string) {
  if (!notes) return "System";
  const actorMatch = notes.match(/By:\s*([^|]+)/i);
  return actorMatch?.[1]?.trim() || "System";
}

function normalizeVendor(row: Record<string, unknown>): VendorRecord {
  return {
    id: String(row.id || row.vendor_id || ""),
    name: String(row.name || row.vendor_name || row.entity_name || ""),
  };
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  const message = `${candidate.message || ""} ${candidate.details || ""}`.toLowerCase();
  return candidate.code === "42703" || candidate.code === "PGRST204" || message.includes("column");
}

async function loadVendors() {
  const vendorSelects = [
    { select: "id, name", order: "name" },
    { select: "*", order: "name" },
  ];

  for (const { select, order } of vendorSelects) {
    const response = await supabase.from("vendors").select(select).order(order);
    if (!response.error) {
      return (response.data || []).map((row) => normalizeVendor(row as unknown as Record<string, unknown>));
    }

    if (!isMissingColumnError(response.error)) {
      break;
    }
  }

  return [];
}

type DashboardState = {
  products: number;
  variants: number;
  vendors: number;
  projects: number;
  pendingPos: number;
  approvedPos: number;
  challans: number;
  stockValue: number;
  deadStock: number;
  lowStock: number;
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  pendingDispatches: number;
  receipts: number;
  recentAudit: number;
};

const EMPTY_STATE: DashboardState = {
  products: 0,
  variants: 0,
  vendors: 0,
  projects: 0,
  pendingPos: 0,
  approvedPos: 0,
  challans: 0,
  stockValue: 0,
  deadStock: 0,
  lowStock: 0,
  pendingPaymentsAmount: 0,
  pendingPaymentsCount: 0,
  pendingDispatches: 0,
  receipts: 0,
  recentAudit: 0,
};

export default function Dashboard() {
  const [stats, setStats] = React.useState<DashboardState>(EMPTY_STATE);
  const [purchaseTrend, setPurchaseTrend] = React.useState<Array<{ label: string; count: number; value: number }>>([]);
  const [warehouseStock, setWarehouseStock] = React.useState<Array<{ warehouse: string; quantity: number; value: number }>>([]);
  const [topVendors, setTopVendors] = React.useState<Array<{ name: string; orders: number; value: number }>>([]);
  const [fastItems, setFastItems] = React.useState<Array<{ name: string; quantity: number }>>([]);
  const [deadStockRows, setDeadStockRows] = React.useState<Array<{ name: string; sku: string; stock: number }>>([]);
  const [delayedDeliveries, setDelayedDeliveries] = React.useState<ChallanRow[]>([]);
  const [recentOrders, setRecentOrders] = React.useState<OrderRow[]>([]);
  const [recentChallans, setRecentChallans] = React.useState<ChallanRow[]>([]);
  const [pendingPayments, setPendingPayments] = React.useState<PaymentSlipRow[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<Array<{ id: string; action: string; meta: string; date: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [
          products,
          orders,
          snapshot,
          movements,
          auditTrail,
          vendors,
          projectList,
        ] = await Promise.all([
          inventoryService.getProducts(),
          modulesService.getOrders(),
          modulesService.getInventorySnapshot(),
          modulesService.getMovements(),
          modulesService.getAuditTrail(),
          loadVendors(),
          projectsService.listProjects(),
        ]);

        const challans = modulesService.getChallans();
        const receipts = modulesService.getDeliveryReceipts();
        const slips = modulesService.getPaymentSlips();

        const productCount = products.length;
        const allVariants = products.flatMap((product: any) => product.variants || []);
        const stockValue = allVariants.reduce((sum: number, variant: any) => sum + ((variant.total_stock || 0) * (variant.price || 0)), 0);
        const lowStockRows = snapshot.filter((row) => row.quantity <= 20).length;

        const movementByVariant = new Map<string, number>();
        movements.forEach((movement) => {
          const existing = movementByVariant.get(movement.variant_id);
          const createdAt = new Date(movement.created_at).getTime();
          if (!existing || createdAt > existing) {
            movementByVariant.set(movement.variant_id, createdAt);
          }
        });

        const deadRows = allVariants
          .filter((variant: any) => (variant.total_stock || 0) > 0)
          .filter((variant: any) => {
            const lastMovement = movementByVariant.get(variant.id);
            return !lastMovement || Date.now() - lastMovement > 90 * 24 * 60 * 60 * 1000;
          })
          .map((variant: any) => ({
            name: variant.product_name || variant.name || "Unnamed Item",
            sku: variant.sku,
            stock: variant.total_stock || 0,
          }))
          .slice(0, 5);

        const pendingOrderCount = orders.filter((order) => order.status === "PENDING").length;
        const approvedOrderCount = orders.filter((order) => order.status === "APPROVED").length;

        const warehouseMap = new Map<string, { warehouse: string; quantity: number; value: number }>();
        snapshot.forEach((row) => {
          const existing = warehouseMap.get(row.warehouse_name) || { warehouse: row.warehouse_name, quantity: 0, value: 0 };
          existing.quantity += row.quantity;
          const variant = allVariants.find((item: any) => item.id === row.variant_id);
          existing.value += row.quantity * (variant?.price || 0);
          warehouseMap.set(row.warehouse_name, existing);
        });

        const vendorMap = new Map<string, { name: string; orders: number; value: number }>();
        orders.forEach((order) => {
          const key = order.vendor_id || order.vendor_name || order.entity_name || "unknown";
          const existing = vendorMap.get(key) || {
            name: order.vendor_name || order.entity_name || "Unknown Vendor",
            orders: 0,
            value: 0,
          };
          existing.orders += 1;
          existing.value += getOrderValue(order);
          vendorMap.set(key, existing);
        });

        vendors.forEach((vendor) => {
          if (!Array.from(vendorMap.values()).some((item) => item.name === vendor.name)) {
            vendorMap.set(vendor.id || vendor.name, { name: vendor.name, orders: 0, value: 0 });
          }
        });

        const fastItemMap = new Map<string, number>();
        movements
          .filter((row) => row.type === "OUT" && withinDays(row.created_at, 30))
          .forEach((row) => {
            const key = `${row.product_name} (${row.sku})`;
            fastItemMap.set(key, (fastItemMap.get(key) || 0) + row.quantity);
          });

        const delayed = challans.filter(
          (challan) => challan.status === "DISPATCHED" && !withinDays(challan.dispatch_date, 7),
        );

        const paymentExposure = slips.filter((slip) => {
          if (slip.status === "PAID") return false;
          const today = new Date().toISOString().split("T")[0];
          return slip.due_date <= today || slip.status === "DUE" || slip.status === "ISSUED";
        });

        const monthMap = new Map<string, { label: string; count: number; value: number }>();
        orders.forEach((order) => {
          const date = new Date(order.created_at);
          if (Number.isNaN(date.getTime())) return;
          const label = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
          const existing = monthMap.get(label) || { label, count: 0, value: 0 };
          existing.count += 1;
          existing.value += getOrderValue(order);
          monthMap.set(label, existing);
        });

        const auditActivity = auditTrail.map((row: AuditTrailRow) => ({
          id: row.id,
          action: row.action,
          meta: `${row.entity_name} • ${row.performed_by}`,
          date: row.created_at,
        }));
        const movementActivity = movements.map((row: StockMovementRow) => ({
          id: `mv_${row.id}`,
          action: `${row.type} ${row.quantity} units`,
          meta: `${row.product_name} • ${extractMovementActor(row.notes)}`,
          date: row.created_at,
        }));

        setStats({
          products: productCount,
          variants: allVariants.length,
          vendors: vendors.length || vendorMap.size,
          projects: projectList.projects.length,
          pendingPos: pendingOrderCount,
          approvedPos: approvedOrderCount,
          challans: challans.length,
          stockValue,
          deadStock: deadRows.length,
          lowStock: lowStockRows,
          pendingPaymentsAmount: paymentExposure.reduce((sum, slip) => sum + slip.amount, 0),
          pendingPaymentsCount: paymentExposure.length,
          pendingDispatches: delayed.length,
          receipts: receipts.length,
          recentAudit: auditTrail.filter((row) => withinDays(row.created_at, 7)).length,
        });

        setPurchaseTrend(
          Array.from(monthMap.values())
            .sort((a, b) => a.label.localeCompare(b.label))
            .slice(-6),
        );
        setWarehouseStock(
          Array.from(warehouseMap.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5),
        );
        setTopVendors(
          Array.from(vendorMap.values())
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        );
        setFastItems(
          Array.from(fastItemMap.entries())
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5),
        );
        setDeadStockRows(deadRows);
        setDelayedDeliveries(delayed.slice(0, 5));
        setRecentOrders(
          [...orders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5),
        );
        setRecentChallans(
          [...challans]
            .sort((a, b) => new Date(b.dispatch_date).getTime() - new Date(a.dispatch_date).getTime())
            .slice(0, 5),
        );
        setPendingPayments(
          [...paymentExposure].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5),
        );
        setRecentActivity(
          [...auditActivity, ...movementActivity]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6),
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading live dashboard...</p>
      </div>
    );
  }

  const maxTrendCount = Math.max(...purchaseTrend.map((item) => item.count), 1);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Owner Dashboard</h1>
          <p className={styles.subtitle}>
            Live business snapshot across inventory, projects, purchase orders, dispatches, receipts, payments, and audit activity.
          </p>
        </div>
      </div>

      <div className={styles.rowFour}>
        <div className={`${styles.metricCard} ${styles.metricPrimary}`}>
          <div className={styles.metricLabelLight}>Stock Value</div>
          <div className={styles.metricValueLight}>{formatCurrency(stats.stockValue)}</div>
          <div className={styles.metricSubLight}>{formatNumber(stats.variants)} active variants in stock</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div>
              <div className={styles.metricLabel}>Dead Stock</div>
              <div className={styles.metricValue}>{formatNumber(stats.deadStock)}</div>
              <div className={styles.metricSub}>Items with stock but no movement in 90 days</div>
            </div>
            <AlertCircle size={18} />
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div>
              <div className={styles.metricLabel}>Pending Payments</div>
              <div className={styles.metricValue}>{formatCurrency(stats.pendingPaymentsAmount)}</div>
              <div className={styles.metricSub}>{formatNumber(stats.pendingPaymentsCount)} vouchers still open</div>
            </div>
            <CreditCard size={18} />
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div>
              <div className={styles.metricLabel}>Awaiting Approval</div>
              <div className={styles.metricValue}>{formatNumber(stats.pendingPos)}</div>
              <div className={styles.metricSub}>Purchase orders pending action</div>
            </div>
            <ClipboardList size={18} />
          </div>
        </div>
      </div>

      <div className={styles.rowSix}>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Stock Items</div>
          <div className={styles.smallValue}>{formatNumber(stats.products)}</div>
          <div className={styles.smallSub}>{formatNumber(stats.lowStock)} low-stock rows</div>
          <Package size={15} className={styles.smallIcon} />
        </div>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Projects</div>
          <div className={styles.smallValue}>{formatNumber(stats.projects)}</div>
          <div className={styles.smallSub}>Live BOQ-connected work</div>
          <Building2 size={15} className={styles.smallIcon} />
        </div>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Vendors</div>
          <div className={styles.smallValue}>{formatNumber(stats.vendors)}</div>
          <div className={styles.smallSub}>Suppliers in the system</div>
          <Users size={15} className={styles.smallIcon} />
        </div>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Approved POs</div>
          <div className={styles.smallValue}>{formatNumber(stats.approvedPos)}</div>
          <div className={styles.smallSub}>{formatNumber(stats.pendingPos)} still pending</div>
          <ShoppingCart size={15} className={styles.smallIcon} />
        </div>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Challans</div>
          <div className={styles.smallValue}>{formatNumber(stats.challans)}</div>
          <div className={styles.smallSub}>{formatNumber(stats.pendingDispatches)} delayed dispatches</div>
          <Truck size={15} className={styles.smallIcon} />
        </div>
        <div className={styles.smallCard}>
          <div className={styles.smallLabel}>Audit Activity</div>
          <div className={styles.smallValue}>{formatNumber(stats.recentAudit)}</div>
          <div className={styles.smallSub}>Entries in the last 7 days</div>
          <History size={15} className={styles.smallIcon} />
        </div>
      </div>

      <div className={styles.rowCharts}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <TrendingUp size={16} />
              <span className={styles.panelTitle}>Monthly Purchase Order Trend</span>
            </div>
          </div>
          {purchaseTrend.length === 0 ? (
            <div className={styles.panelEmpty}>Create purchase orders to see monthly trend lines.</div>
          ) : (
            <div className={styles.trendList}>
              {purchaseTrend.map((item) => (
                <div key={item.label} className={styles.trendRow}>
                  <div className={styles.trendLabel}>{item.label}</div>
                  <div className={styles.trendBarWrap}>
                    <div className={styles.trendBar} style={{ width: `${(item.count / maxTrendCount) * 100}%` }} />
                  </div>
                  <div className={styles.trendMeta}>
                    <strong>{item.count}</strong>
                    <span>{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Boxes size={16} />
              <span className={styles.panelTitle}>Operational Snapshot</span>
            </div>
          </div>
          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <span>Delivery receipts</span>
              <strong>{formatNumber(stats.receipts)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Open payment slips</span>
              <strong>{formatNumber(stats.pendingPaymentsCount)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Low stock rows</span>
              <strong>{formatNumber(stats.lowStock)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Delayed challans</span>
              <strong>{formatNumber(stats.pendingDispatches)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.rowSingle}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Package size={16} />
              <span className={styles.panelTitle}>Stock by Warehouse</span>
            </div>
            <Link href="/reports" className={styles.viewAll}>View Reports <ArrowRight size={14} /></Link>
          </div>
          {warehouseStock.length === 0 ? (
            <div className={styles.panelEmpty}>No warehouse stock data is available yet.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Total Qty</th>
                  <th>Approx. Value</th>
                </tr>
              </thead>
              <tbody>
                {warehouseStock.map((row) => (
                  <tr key={row.warehouse}>
                    <td>{row.warehouse}</td>
                    <td>{formatNumber(row.quantity)}</td>
                    <td>{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className={styles.rowTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Users size={16} />
              <span className={styles.panelTitle}>Top Vendors</span>
            </div>
            <Link href="/vendors" className={styles.viewAll}>View Vendors <ArrowRight size={14} /></Link>
          </div>
          {topVendors.length === 0 ? (
            <div className={styles.panelEmpty}>No vendor-linked order data yet.</div>
          ) : (
            <div className={styles.list}>
              {topVendors.map((vendor) => (
                <div key={vendor.name} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{vendor.name}</div>
                    <div className={styles.listSub}>{vendor.orders} orders</div>
                  </div>
                  <strong>{formatCurrency(vendor.value)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <TrendingUp size={16} />
              <span className={styles.panelTitle}>Fast-Moving Items (30 days)</span>
            </div>
            <Link href="/inventory" className={styles.viewAll}>View Flow <ArrowRight size={14} /></Link>
          </div>
          {fastItems.length === 0 ? (
            <div className={styles.panelEmpty}>No outward stock movement in the last 30 days.</div>
          ) : (
            <div className={styles.list}>
              {fastItems.map((item) => (
                <div key={item.name} className={styles.listItem}>
                  <div className={styles.listTitle}>{item.name}</div>
                  <strong>{formatNumber(item.quantity)} units</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.rowTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <AlertCircle size={16} />
              <span className={styles.panelTitle}>Dead Stock Watchlist</span>
            </div>
            <Link href="/stock" className={styles.viewAll}>View Stock <ArrowRight size={14} /></Link>
          </div>
          {deadStockRows.length === 0 ? (
            <div className={styles.panelEmpty}>No dead stock detected right now.</div>
          ) : (
            <div className={styles.list}>
              {deadStockRows.map((row) => (
                <div key={row.sku} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{row.name}</div>
                    <div className={styles.listSub}>{row.sku}</div>
                  </div>
                  <strong>{formatNumber(row.stock)} in stock</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Truck size={16} />
              <span className={styles.panelTitle}>Delayed Deliveries</span>
            </div>
            <Link href="/challans" className={styles.viewAll}>View Challans <ArrowRight size={14} /></Link>
          </div>
          {delayedDeliveries.length === 0 ? (
            <div className={styles.panelEmpty}>No delayed dispatched challans at the moment.</div>
          ) : (
            <div className={styles.list}>
              {delayedDeliveries.map((challan) => (
                <div key={challan.id} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{challan.challan_no}</div>
                    <div className={styles.listSub}>{challan.project_name}</div>
                  </div>
                  <strong>{formatDate(challan.dispatch_date)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.rowThree}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <CreditCard size={16} />
              <span className={styles.panelTitle}>Pending Payments</span>
            </div>
            <Link href="/site-records" className={styles.viewAll}>View Payments <ArrowRight size={14} /></Link>
          </div>
          {pendingPayments.length === 0 ? (
            <div className={styles.panelEmpty}>All current payment slips are cleared.</div>
          ) : (
            <div className={styles.list}>
              {pendingPayments.map((slip) => (
                <div key={slip.id} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{slip.vendor_name}</div>
                    <div className={styles.listSub}>Due {formatDate(slip.due_date)}</div>
                  </div>
                  <strong>{formatCurrency(slip.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <ShoppingCart size={16} />
              <span className={styles.panelTitle}>Recent Purchase Orders</span>
            </div>
            <Link href="/orders" className={styles.viewAll}>View Orders <ArrowRight size={14} /></Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className={styles.panelEmpty}>No purchase orders recorded yet.</div>
          ) : (
            <div className={styles.list}>
              {recentOrders.map((order) => (
                <div key={order.id} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{order.order_number}</div>
                    <div className={styles.listSub}>{order.vendor_name || order.entity_name || "-"}</div>
                  </div>
                  <strong>{formatCurrency(getOrderValue(order))}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <History size={16} />
              <span className={styles.panelTitle}>Recent Activity</span>
            </div>
            <Link href="/audit" className={styles.viewAll}>Open Audit <ArrowRight size={14} /></Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className={styles.panelEmpty}>No audit or movement activity yet.</div>
          ) : (
            <div className={styles.list}>
              {recentActivity.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>{item.action}</div>
                    <div className={styles.listSub}>{item.meta}</div>
                  </div>
                  <strong>{formatDate(item.date)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.rowSingle}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Truck size={16} />
              <span className={styles.panelTitle}>Recent Challans</span>
            </div>
            <Link href="/challans" className={styles.viewAll}>Open Dispatches <ArrowRight size={14} /></Link>
          </div>
          {recentChallans.length === 0 ? (
            <div className={styles.panelEmpty}>No challans recorded yet.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Challan</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentChallans.map((challan) => (
                  <tr key={challan.id}>
                    <td>{challan.challan_no}</td>
                    <td>{challan.project_name}</td>
                    <td>{challan.status}</td>
                    <td>{formatDate(challan.dispatch_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

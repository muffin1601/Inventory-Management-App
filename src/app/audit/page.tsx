"use client";

import React from "react";
import styles from "./Audit.module.css";
import {
  Download,
  FileSearch,
  History,
  Search,
  ShieldCheck,
  UserRound,
  Eye,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { modulesService } from "@/lib/services/modules";
import { useUi } from "@/components/ui/AppProviders";
import type { AuditTrailRow, ChallanRow, DeliveryReceiptRow, PaymentSlipRow, StockMovementRow } from "@/types/modules";

type ActivityModule =
  | "all"
  | "inventory"
  | "order"
  | "vendor"
  | "user"
  | "challan"
  | "receipt"
  | "payment"
  | "stock_movement";

type ActivityRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_name: string;
  reason: string;
  performed_by: string;
  details: string;
  source: "audit" | "movement";
};

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

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const content = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];
  const blob = new Blob([`\ufeff${content.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function normalizeMovementActor(notes?: string) {
  if (!notes) return "System";
  const actorMatch = notes.match(/By:\s*([^|]+)/i);
  return actorMatch?.[1]?.trim() || "System";
}

function normalizeMovementReason(notes?: string) {
  if (!notes) return "Inventory movement recorded";
  const reasonMatch = notes.match(/Reason:\s*([^|]+)/i);
  return reasonMatch?.[1]?.trim() || notes;
}

function normalizeMovementAction(row: StockMovementRow) {
  if (row.type === "IN") return "Stock Received";
  if (row.type === "OUT") return "Stock Issued";
  if (row.type === "TRANSFER") return "Stock Transferred";
  return "Stock Adjusted";
}

function withinDays(value: string, days: number) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
}

export default function AuditPage() {
  const { showToast } = useUi();
  const [isLoading, setIsLoading] = React.useState(true);
  const [auditRows, setAuditRows] = React.useState<AuditTrailRow[]>([]);
  const [movementRows, setMovementRows] = React.useState<StockMovementRow[]>([]);
  const [challans, setChallans] = React.useState<ChallanRow[]>([]);
  const [receipts, setReceipts] = React.useState<DeliveryReceiptRow[]>([]);
  const [slips, setSlips] = React.useState<PaymentSlipRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState<ActivityModule>("all");
  const [dateFilter, setDateFilter] = React.useState<"all" | "7" | "30" | "90">("30");
  const [selectedRow, setSelectedRow] = React.useState<ActivityRow | null>(null);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [auditTrail, movements, challanRows, receiptRows, slipRows] = await Promise.all([
          modulesService.getAuditTrail(),
          modulesService.getMovements(),
          modulesService.getChallans(),
          modulesService.getDeliveryReceipts(),
          modulesService.getPaymentSlips(),
        ]);
        setAuditRows(auditTrail);
        setMovementRows(movements);
        setChallans(challanRows);
        setReceipts(receiptRows);
        setSlips(slipRows);
      } catch (error) {
        console.error("Failed to load audit data:", error);
        showToast("Could not load audit activity right now.", "error");
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

  const activityRows = React.useMemo<ActivityRow[]>(() => {
    const primaryRows = auditRows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      entity_type: row.entity_type,
      entity_name: row.entity_name || row.entity_id || "-",
      reason: row.reason || "-",
      performed_by: row.performed_by || "-",
      details: row.details || "-",
      source: "audit" as const,
    }));

    const movementActivity = movementRows.map((row) => ({
      id: `mv_${row.id}`,
      created_at: row.created_at,
      action: normalizeMovementAction(row),
      entity_type: "stock_movement",
      entity_name: `${row.product_name} (${row.sku})`,
      reason: normalizeMovementReason(row.notes),
      performed_by: normalizeMovementActor(row.notes),
      details: `${row.type} ${row.quantity} at ${row.warehouse_name}${row.notes ? ` | ${row.notes}` : ""}`,
      source: "movement" as const,
    }));

    return [...primaryRows, ...movementActivity].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [auditRows, movementRows]);

  const filteredRows = React.useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return activityRows.filter((row) => {
      const matchesQuery =
        !loweredQuery ||
        row.action.toLowerCase().includes(loweredQuery) ||
        row.entity_name.toLowerCase().includes(loweredQuery) ||
        row.reason.toLowerCase().includes(loweredQuery) ||
        row.performed_by.toLowerCase().includes(loweredQuery) ||
        row.details.toLowerCase().includes(loweredQuery);

      const matchesModule = moduleFilter === "all" || row.entity_type === moduleFilter;
      const matchesDate =
        dateFilter === "all" || withinDays(row.created_at, Number(dateFilter));

      return matchesQuery && matchesModule && matchesDate;
    });
  }, [activityRows, dateFilter, moduleFilter, query]);

  const summary = React.useMemo(() => {
    const last7Days = filteredRows.filter((row) => withinDays(row.created_at, 7)).length;
    const actorCount = new Set(filteredRows.map((row) => row.performed_by)).size;
    const moduleCount = new Set(filteredRows.map((row) => row.entity_type)).size;
    const lastAction = filteredRows[0]?.created_at || "";
    return {
      total: filteredRows.length,
      last7Days,
      actorCount,
      moduleCount,
      lastAction,
    };
  }, [filteredRows]);

  const recentExceptions = React.useMemo(() => {
    return filteredRows
      .filter((row) => {
        const combined = `${row.action} ${row.reason} ${row.details}`.toLowerCase();
        return (
          combined.includes("delete") ||
          combined.includes("cancel") ||
          combined.includes("reject") ||
          combined.includes("damage") ||
          combined.includes("adjust")
        );
      })
      .slice(0, 6);
  }, [filteredRows]);

  const exportRows = React.useMemo(
    () =>
      filteredRows.map((row) => ({
        "Date & Time": formatDateTime(row.created_at),
        Module: row.entity_type,
        Action: row.action,
        Entity: row.entity_name,
        Reason: row.reason,
        "Performed By": row.performed_by,
        Details: row.details,
        Source: row.source,
      })),
    [filteredRows],
  );

  function handleExport() {
    if (!downloadCsv("audit-trail.csv", exportRows)) {
      showToast("There are no audit rows to export.", "info");
      return;
    }
    showToast("audit-trail.csv downloaded.", "success");
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Trail</h1>
          <p className={styles.subtitle}>
            Review approvals, edits, deletions, stock actions, challans, receipts, and payment activity in one place.
          </p>
        </div>
        <button type="button" className={styles.primaryAction} onClick={handleExport}>
          <Download size={16} />
          Export Audit CSV
        </button>
      </div>

      <div className={styles.heroGrid}>
        <div className={styles.heroCard}>
          <div className={styles.heroIcon}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className={styles.heroTitle}>Made for accountability</div>
            <p className={styles.heroText}>
              Each row explains who acted, what changed, why it happened, and which module was affected.
            </p>
          </div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroIcon}>
            <History size={18} />
          </div>
          <div>
            <div className={styles.heroTitle}>Connected to live modules</div>
            <p className={styles.heroText}>
              This page combines saved audit entries with stock movement traces plus operational records from challans and finance flows.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Visible Activities</span>
          <strong className={styles.statValue}>{summary.total}</strong>
          <span className={styles.statMeta}>{summary.last7Days} happened in the last 7 days</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>People Involved</span>
          <strong className={styles.statValue}>{summary.actorCount}</strong>
          <span className={styles.statMeta}>Across approvals, changes, and stock actions</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Modules Covered</span>
          <strong className={styles.statValue}>{summary.moduleCount}</strong>
          <span className={styles.statMeta}>Orders, inventory, vendors, challans, receipts, payments, and more</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Latest Recorded Action</span>
          <strong className={styles.statValueSmall}>{formatDate(summary.lastAction)}</strong>
          <span className={styles.statMeta}>
            {challans.length} challans, {receipts.length} receipts, {slips.length} payment slips tracked
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search action, user, reason, entity, or details..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <select
                className={styles.select}
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value as ActivityModule)}
              >
                <option value="all">All Modules</option>
                <option value="inventory">Inventory</option>
                <option value="stock_movement">Stock Movements</option>
                <option value="order">Orders</option>
                <option value="vendor">Vendors</option>
                <option value="user">Users</option>
                <option value="challan">Challans</option>
                <option value="receipt">Receipts</option>
                <option value="payment">Payments</option>
              </select>
              <select
                className={styles.select}
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as "all" | "7" | "30" | "90")}
              >
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Loading audit activity...</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>Reason</th>
                  <th>Performed By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>No activity matches the current search and filters.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>
                        <div className={styles.actionCell}>
                          {row.action.toLowerCase().includes('delete') || row.action.toLowerCase().includes('cancel') ? (
                            <AlertTriangle size={14} className={styles.warningIcon} />
                          ) : (
                            <Info size={14} className={styles.infoIcon} />
                          )}
                          <div className={styles.primaryCell}>{row.action}</div>
                        </div>
                        <div className={styles.secondaryCell}>{row.source === "movement" ? "From movement log" : "From audit log"}</div>
                      </td>
                      <td>
                        <span className={styles.moduleBadge}>{row.entity_type.replace("_", " ")}</span>
                      </td>
                      <td>
                        <div className={styles.primaryCell}>{row.entity_name}</div>
                        <div className={styles.secondaryCell}>{row.details}</div>
                      </td>
                      <td>{row.reason}</td>
                      <td>
                        <div className={styles.actorCell}>
                          <UserRound size={14} />
                          <span>{row.performed_by}</span>
                        </div>
                      </td>
                      <td>
                        <button className={styles.iconButton} onClick={() => setSelectedRow(row)} title="View Details">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <FileSearch size={16} />
              <h2 className={styles.cardTitle}>Recent sensitive actions</h2>
            </div>
          </div>
          {recentExceptions.length === 0 ? (
            <div className={styles.emptyState}>No deletions, cancellations, or major adjustments in this view.</div>
          ) : (
            <div className={styles.list}>
              {recentExceptions.map((row) => (
                <div key={row.id} className={styles.listItem}>
                  <div>
                    <div className={styles.primaryCell}>{row.action}</div>
                    <div className={styles.secondaryCell}>{row.entity_name}</div>
                  </div>
                  <div className={styles.listMeta}>
                    <span>{formatDate(row.created_at)}</span>
                    <span>{row.performed_by}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <History size={16} />
              <h2 className={styles.cardTitle}>Coverage snapshot</h2>
            </div>
          </div>
          <div className={styles.coverageList}>
            <div className={styles.coverageRow}>
              <span>Audit log entries</span>
              <strong>{auditRows.length}</strong>
            </div>
            <div className={styles.coverageRow}>
              <span>Stock movement traces</span>
              <strong>{movementRows.length}</strong>
            </div>
            <div className={styles.coverageRow}>
              <span>Challan records linked</span>
              <strong>{challans.length}</strong>
            </div>
            <div className={styles.coverageRow}>
              <span>Receipt records linked</span>
              <strong>{receipts.length}</strong>
            </div>
            <div className={styles.coverageRow}>
              <span>Payment slip records linked</span>
              <strong>{slips.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {selectedRow && (
        <div className={styles.overlay} onClick={() => setSelectedRow(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Activity Details</h2>
              <button className={styles.closeButton} onClick={() => setSelectedRow(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <label>Timestamp</label>
                  <div>{formatDateTime(selectedRow.created_at)}</div>
                </div>
                <div className={styles.detailItem}>
                  <label>Action</label>
                  <div className={styles.primaryText}>{selectedRow.action}</div>
                </div>
                <div className={styles.detailItem}>
                  <label>Module / Type</label>
                  <div className={styles.badgeText}>{selectedRow.entity_type}</div>
                </div>
                <div className={styles.detailItem}>
                  <label>Performed By</label>
                  <div className={styles.primaryText}>{selectedRow.performed_by}</div>
                </div>
              </div>

              <div className={styles.detailSection}>
                <label>Entity Involved</label>
                <div className={styles.primaryText}>{selectedRow.entity_name}</div>
              </div>

              <div className={styles.detailSection}>
                <label>Reason Provided</label>
                <div className={styles.reasonBox}>{selectedRow.reason}</div>
              </div>

              <div className={styles.detailSection}>
                <label>Full Activity Details</label>
                <div className={styles.detailsBox}>{selectedRow.details}</div>
              </div>

              {selectedRow.source === 'audit' && (auditRows.find(r => r.id === selectedRow.id) as any)?.old_values && (
                <div className={styles.detailSection}>
                  <label>Value Changes</label>
                  <div className={styles.diffGrid}>
                    <div className={styles.diffSide}>
                      <div className={styles.diffLabel}>Previous Values</div>
                      <pre className={styles.diffPre}>
                        {JSON.stringify((auditRows.find(r => r.id === selectedRow.id) as any).old_values, null, 2)}
                      </pre>
                    </div>
                    <div className={styles.diffSide}>
                      <div className={styles.diffLabel}>New Values</div>
                      <pre className={styles.diffPre}>
                        {JSON.stringify((auditRows.find(r => r.id === selectedRow.id) as any).new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryAction} onClick={() => setSelectedRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

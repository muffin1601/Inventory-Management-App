"use client";

import React, { useEffect, useState } from 'react';
import styles from '../Dashboard.module.css';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, AlertCircle, CreditCard, CheckCircle, Package, 
  BarChart2, Users, ShoppingCart, Truck, ArrowRight,
  TrendingUp, Clock
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    products: 0,
    variants: 0,
    vendors: 0,
    projects: 0,
    pendingPos: 0,
    activePos: 0,
    challans: 0,
    stockValue: 0,
  });

  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [recentChallans, setRecentChallans] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [
          { count: productsCount },
          { count: variantsCount },
          { count: vendorsCount },
          { count: projectsCount },
          { count: pendingPosCount },
          { count: activePosCount },
          { count: challansCount }
        ] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('variants').select('*', { count: 'exact', head: true }),
          supabase.from('vendors').select('*', { count: 'exact', head: true }),
          supabase.from('projects').select('*', { count: 'exact', head: true }),
          supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
          supabase.from('purchase_orders').select('*', { count: 'exact', head: true }),
          supabase.from('challans').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          products: productsCount || 0,
          variants: variantsCount || 0,
          vendors: vendorsCount || 0,
          projects: projectsCount || 0,
          pendingPos: pendingPosCount || 0,
          activePos: activePosCount || 0,
          challans: challansCount || 0,
          stockValue: 0,
        });

        const [posResponse, challansResponse, paymentsResponse, vendorsResponse] = await Promise.all([
          supabase.from('purchase_orders').select('po_number, total_amount, status, created_at, vendors(name)').order('created_at', { ascending: false }).limit(3),
          supabase.from('challans').select('challan_number, status, dispatch_date').order('created_at', { ascending: false }).limit(3),
          supabase.from('payments').select('amount_due, status, due_date').eq('status', 'pending').limit(3),
          supabase.from('vendors').select('name, status').limit(4)
        ]);

        setRecentPOs(posResponse.data || []);
        setRecentChallans(challansResponse.data || []);
        setPendingPayments(paymentsResponse.data || []);
        setTopVendors(vendorsResponse.data || []);

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Owner Dashboard</h1>
        <p className={styles.subtitle}>Business intelligence • Real-time analytics • Watcon International</p>
      </div>

      {/* Row 1: 4 Main Cards aligned directly with reference UI */}
      <div className={styles.rowFour}>
        <div className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.cardContent}>
            <span className={styles.cardLabelLight}>STOCK VALUE</span>
            <span className={styles.cardValueLight}>₹ {stats.stockValue.toLocaleString()}</span>
            <span className={styles.cardSubLight}>{stats.variants} active items</span>
          </div>
          <div className={styles.cardIconBoxLight}><DollarSign size={16} /></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>DEAD STOCK</span>
            <span className={styles.cardValue}>0</span>
            <span className={styles.cardSub}>Not moved in 90 days</span>
          </div>
          <div className={styles.cardIconBox}><AlertCircle size={16} color="#ef4444" /></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>PENDING PAYMENTS</span>
            <span className={styles.cardValue}>₹ 0</span>
            <span className={styles.cardSub}>{pendingPayments.length} invoices due</span>
          </div>
          <div className={styles.cardIconBox}><CreditCard size={16} color="#f59e0b" /></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>AWAITING APPROVAL</span>
            <span className={styles.cardValue}>{stats.pendingPos}</span>
            <span className={styles.cardSub}>Purchase orders</span>
          </div>
          <div className={styles.cardIconBox}><CheckCircle size={16} color="#10b981" /></div>
        </div>
      </div>

      {/* Row 2: 6 Small Operational Cards */}
      <div className={styles.rowSix}>
        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>STOCK ITEMS</span>
            <span className={styles.smallCardValue}>{stats.products}</span>
            <span className={styles.smallCardSub}>0 low stock</span>
          </div>
          <div className={styles.smallIconBox}><Package size={14} color="#ec4899" /></div>
        </div>

        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>PROJECTS</span>
            <span className={styles.smallCardValue}>{stats.projects}</span>
          </div>
          <div className={styles.smallIconBox}><BarChart2 size={14} color="#06b6d4" /></div>
        </div>

        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>VENDORS</span>
            <span className={styles.smallCardValue}>{stats.vendors}</span>
          </div>
          <div className={styles.smallIconBox}><Users size={14} color="#f59e0b" /></div>
        </div>

        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>POS</span>
            <span className={styles.smallCardValue}>{stats.activePos}</span>
            <span className={styles.smallCardSub}>{stats.pendingPos} pending</span>
          </div>
          <div className={styles.smallIconBox}><ShoppingCart size={14} color="#ef4444" /></div>
        </div>

        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>CHALLANS</span>
            <span className={styles.smallCardValue}>{stats.challans}</span>
            <span className={styles.smallCardSub}>0 pending</span>
          </div>
          <div className={styles.smallIconBox}><Truck size={14} color="#8b5cf6" /></div>
        </div>

        <div className={styles.smallCard}>
          <div className={styles.smallCardContent}>
            <span className={styles.smallCardLabel}>PAYMENTS</span>
            <span className={styles.smallCardValue}>0</span>
          </div>
          <div className={styles.smallIconBox}><CreditCard size={14} color="#10b981" /></div>
        </div>
      </div>

      {/* Row 3: Charts */}
      <div className={styles.rowCharts}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <TrendingUp size={16} color="var(--accent-primary)" />
            <span className={styles.panelTitle}>Monthly Purchase Order Trend</span>
          </div>
          <div className={styles.panelEmpty}>Create purchase orders to see trends</div>
        </div>
        
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <ShoppingCart size={16} color="#ef4444" />
            <span className={styles.panelTitle}>PO Status</span>
          </div>
          <div className={styles.panelEmpty}>No POs yet</div>
        </div>
      </div>

      {/* Row 4: Wide List */}
      <div className={styles.rowSingle}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Package size={16} color="#ec4899" />
              <span className={styles.panelTitle}>Stock by Warehouse</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>No warehouse data</div>
        </div>
      </div>

      {/* Row 5: 2-Col Lists Top */}
      <div className={styles.rowTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Users size={16} color="#f59e0b" />
              <span className={styles.panelTitle}>Top Vendors</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>
            {topVendors.length > 0 ? (
              <div style={{width: '100%', textAlign: 'left', padding: '0 1rem'}}>
                {topVendors.map((v, i) => (
                   <div key={i} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)'}}>{v.name}</div>
                ))}
              </div>
            ) : "No vendor data"}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <TrendingUp size={16} color="#10b981" />
              <span className={styles.panelTitle}>Fast-Moving Items (30 days)</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>No dispatch activity in 30 days</div>
        </div>
      </div>

      {/* Row 6: 2-Col Lists Bottom */}
      <div className={styles.rowTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <AlertCircle size={16} color="#ef4444" />
              <span className={styles.panelTitle}>Dead Stock (0 items not moved in 90d)</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>No dead stock detected</div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Clock size={16} color="#6b7280" />
              <span className={styles.panelTitle}>Delayed Deliveries (0)</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>No delayed deliveries</div>
        </div>
      </div>

      {/* Row 7: 3-Col Lists */}
      <div className={styles.rowThree}>
        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <CreditCard size={16} color="#10b981" />
              <span className={styles.panelTitle}>Pending Payments</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>
             {pendingPayments.length > 0 ? "Pending payments exist" : "All payments cleared"}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <ShoppingCart size={16} color="#ef4444" />
              <span className={styles.panelTitle}>Recent Purchase Orders</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>
             {recentPOs.length > 0 ? "POs exist" : "No purchase orders yet"}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeaderBetween}>
            <div className={styles.panelHeader}>
              <Truck size={16} color="#8b5cf6" />
              <span className={styles.panelTitle}>Recent Challans</span>
            </div>
            <a href="#" className={styles.viewAll}>View All <ArrowRight size={14} /></a>
          </div>
          <div className={styles.panelEmpty}>
             {recentChallans.length > 0 ? "Challans exist" : "No challans yet"}
          </div>
        </div>
      </div>

    </div>
  );
}

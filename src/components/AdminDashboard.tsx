import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { OrderRecord } from '../server/orders-service';

interface DashboardStats {
  totalOrders: number;
  newOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  dispatchedOrders: number;
  deliveredOrders: number;
  failedDeliveries: number;
  cancelledOrders: number;
  outstandingCodEur: number;
  collectedCodEur: number;
  remittedCodEur: number;
}

interface AdminSession {
  email: string;
  role: string;
  token: string;
}

export const AdminDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('noire.ireland@gmail.com');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);

  // Active admin check
  const activeAdmin = adminSession || user;

  // Dashboard Data
  const [activeTab, setActiveTab] = useState<'orders' | 'cod' | 'inventory'>('orders');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Selected Order for Drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [statusUpdateNote, setStatusUpdateNote] = useState<string>('');
  const [newSelectedStatus, setNewSelectedStatus] = useState<OrderRecord['orderStatus']>('CONFIRMED');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // COD Reconciliation Form in Drawer
  const [courierName, setCourierName] = useState<string>('DHL Express Ireland');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [actualCollectedEur, setActualCollectedEur] = useState<number>(88);
  const [settlementStatus, setSettlementStatus] = useState<'PENDING_COLLECTION' | 'COLLECTED_BY_COURIER' | 'REMITTED_TO_BANK' | 'DISCREPANCY'>('PENDING_COLLECTION');
  const [amountRemittedEur, setAmountRemittedEur] = useState<number>(0);
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // Email Delivery & Resend Service State
  const [emailServiceStatus, setEmailServiceStatus] = useState<{ hasApiKey: boolean; fromEmail: string; isCustomDomain: boolean; mode: string } | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [resendNotificationResult, setResendNotificationResult] = useState<{ success: boolean; message: string } | null>(null);


  // Helper to obtain bearer token securely
  const getAuthToken = async (): Promise<string> => {
    if (adminSession?.token) {
      return adminSession.token;
    }
    if (user) {
      return await user.getIdToken();
    }
    throw new Error('Administrator session not found. Please authenticate.');
  };

  // Enforce noindex and custom title while in Admin Portal
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Staff Registry & Operations // Atelier NOIRÉ';

    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previousRobotsContent = metaRobots ? metaRobots.content : 'index, follow';

    if (metaRobots) {
      metaRobots.content = 'noindex, nofollow';
    } else {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      metaRobots.content = 'noindex, nofollow';
      document.head.appendChild(metaRobots);
    }

    return () => {
      document.title = originalTitle;
      if (metaRobots) {
        metaRobots.content = previousRobotsContent;
      }
    };
  }, []);

  // Restore session token and listen to Firebase auth
  useEffect(() => {
    const savedToken = sessionStorage.getItem('noire_admin_token');
    const savedEmail = sessionStorage.getItem('noire_admin_email');
    if (savedToken && savedEmail) {
      setAdminSession({
        token: savedToken,
        email: savedEmail,
        role: 'SUPER_ADMIN',
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Dashboard Data once authenticated
  const fetchDashboardData = async () => {
    if (!activeAdmin) return;
    setIsLoadingOrders(true);

    try {
      const token = await getAuthToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // 1. Fetch Stats
      const statsRes = await fetch('/api/admin/stats', { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }

      // 2. Fetch Orders
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterPayment !== 'ALL') params.append('paymentStatus', filterPayment);
      if (searchTerm) params.append('search', searchTerm);

      const ordersRes = await fetch(`/api/admin/orders?${params.toString()}`, { headers });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (ordersData.success) {
          setOrders(ordersData.orders || []);
        }
      }

      // 3. Fetch Email Service Health
      try {
        const emailRes = await fetch('/api/admin/email-status', { headers });
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          if (emailData.success) {
            setEmailServiceStatus(emailData);
          }
        }
      } catch {
        // Non-blocking
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleResendCustomerEmail = async (orderId: string) => {
    setIsResendingEmail(true);
    setResendNotificationResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/orders/${orderId}/resend-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendNotificationResult({
          success: true,
          message: data.status === 'SENT'
            ? `✓ Delivered: Customer confirmation successfully dispatched to ${data.recipient}.`
            : `ℹ Logged: Email recorded for ${data.recipient}. (Mode: ${data.status})`,
        });
      } else {
        setResendNotificationResult({
          success: false,
          message: data.error || 'Failed to dispatch email.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResendNotificationResult({ success: false, message: `Error: ${msg}` });
    } finally {
      setIsResendingEmail(false);
    }
  };

  useEffect(() => {
    if (activeAdmin) {
      fetchDashboardData();
    }
  }, [activeAdmin, filterStatus, filterPayment, searchTerm]);

  // Sync selected order to reconciliation state
  useEffect(() => {
    if (selectedOrder) {
      setNewSelectedStatus(selectedOrder.orderStatus);
      setActualCollectedEur(selectedOrder.financials?.totalEur || 88);
      setAmountRemittedEur(selectedOrder.paymentStatus === 'REMITTED' ? (selectedOrder.financials?.totalEur || 88) : 0);
      setSettlementStatus(
        selectedOrder.paymentStatus === 'REMITTED'
          ? 'REMITTED_TO_BANK'
          : selectedOrder.paymentStatus === 'COLLECTED'
          ? 'COLLECTED_BY_COURIER'
          : 'PENDING_COLLECTION'
      );
    }
  }, [selectedOrder]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setIsAuthorizing(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.field === 'email') {
          setFieldErrors({ email: data.error || 'Unrecognized email address.' });
        } else if (data.field === 'password') {
          setFieldErrors({ password: data.error || 'Incorrect security password.' });
        } else {
          setFieldErrors({ password: data.error || 'Authentication failed.' });
        }
        return;
      }

      sessionStorage.setItem('noire_admin_token', data.token);
      sessionStorage.setItem('noire_admin_email', data.user.email);
      setAdminSession({
        token: data.token,
        email: data.user.email,
        role: data.user.role || 'SUPER_ADMIN',
      });
    } catch {
      setFieldErrors({ password: 'Connection failed. Please check network and retry.' });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem('noire_admin_token');
    sessionStorage.removeItem('noire_admin_email');
    setAdminSession(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setUser(null);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !user) return;
    setIsUpdatingStatus(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newSelectedStatus,
          note: statusUpdateNote || `Status updated to ${newSelectedStatus} by administrator`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusUpdateNote('');
        setSelectedOrder(data.order);
        await fetchDashboardData();
      } else {
        alert(data.error || 'Failed to update status.');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !user) return;
    setIsReconciling(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/reconcile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courierName,
          trackingNumber,
          actualCollectedEur: Number(actualCollectedEur),
          settlementStatus,
          amountRemittedEur: Number(amountRemittedEur),
          reconciliationNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('COD reconciliation recorded and verified.');
        await fetchDashboardData();
        // Update local order payment status view
        setSelectedOrder((prev) => prev ? {
          ...prev,
          paymentStatus: settlementStatus === 'REMITTED_TO_BANK' ? 'REMITTED' : settlementStatus === 'COLLECTED_BY_COURIER' ? 'COLLECTED' : 'UNPAID'
        } : null);
      } else {
        alert(data.error || 'Failed to reconcile COD settlement.');
      }
    } catch (err) {
      console.error('Error during COD reconciliation:', err);
    } finally {
      setIsReconciling(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111111] text-[#D6CCBA] flex items-center justify-center font-mono-archive">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 mx-auto border-2 border-[#D6CCBA] border-t-transparent animate-spin" />
          <p className="text-xs uppercase tracking-widest text-[#D6CCBA]/60">Authenticating Atelier Registry...</p>
        </div>
      </div>
    );
  }

  // ── UNAUTHENTICATED / LOGIN SCREEN ─────────────────────────────────────────
  if (!activeAdmin) {
    return (
      <div className="min-h-screen bg-[#111111] text-[#D6CCBA] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161616] border border-[#2B2A28] p-8 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-[10px] font-mono-archive uppercase tracking-[0.24em] text-[#D6CCBA]/60 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
              <span>PRIVATE ARCHIVE MANAGEMENT</span>
            </div>
            <h1 className="font-serif-editorial text-3xl text-white">Atelier NOIRÉ</h1>
            <p className="text-xs font-mono-archive tracking-wider text-[#D6CCBA]/50 mt-1">
              Order Registry &middot; Restricted Administrator Access
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                Authorized Administrator Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                }}
                className={`w-full bg-[#1F1E1D] border ${
                  fieldErrors.email ? 'border-[#FF0800] text-red-100' : 'border-[#2B2A28] text-white'
                } px-3 py-2 text-xs font-mono focus:border-[#D6CCBA] focus:outline-none transition-colors`}
              />
              {fieldErrors.email ? (
                <p className="mt-1.5 text-xs text-[#FF0800] font-mono-archive flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
                  {fieldErrors.email}
                </p>
              ) : (
                <span className="text-[10px] font-mono-archive text-[#D6CCBA]/40 block mt-1">
                  Authorized primary: noire.ireland@gmail.com
                </span>
              )}
            </div>

            <div>
              <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                Archive Security Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                }}
                className={`w-full bg-[#1F1E1D] border ${
                  fieldErrors.password ? 'border-[#FF0800] text-red-100' : 'border-[#2B2A28] text-white'
                } px-3 py-2 text-xs font-mono focus:border-[#D6CCBA] focus:outline-none transition-colors`}
              />
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-[#FF0800] font-mono-archive flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthorizing}
              className="w-full py-3.5 bg-[#D6CCBA] hover:bg-white text-[#161616] text-xs font-mono-archive uppercase tracking-[0.22em] font-bold transition-all cursor-pointer shadow-lg disabled:opacity-50 mt-2"
            >
              {isAuthorizing ? 'Authenticating Archive Credentials...' : 'Authenticate & Enter Dashboard →'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#2B2A28] text-center">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[11px] font-mono-archive uppercase tracking-widest text-[#D6CCBA]/50 hover:text-[#D6CCBA] transition-colors"
            >
              &larr; Return to Storefront
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── AUTHENTICATED ADMIN DASHBOARD ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E0E0E] text-[#D6CCBA] font-sans antialiased">
      {/* Top Bar */}
      <header className="bg-[#141414] border-b border-[#2B2A28] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="font-serif-editorial text-2xl text-white tracking-wide">
            ATELIER NOIRÉ
          </div>
          <span className="text-[#2B2A28]">/</span>
          <span className="text-[11px] font-mono-archive uppercase tracking-[0.2em] text-[#D6CCBA]/70">
            Order Management &middot; Cash on Delivery
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-archive">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1F1E1D] border border-[#2B2A28]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[#D6CCBA]">{activeAdmin.email}</span>
          </div>

          <a
            href="/"
            className="px-3 py-1.5 border border-[#2B2A28] hover:border-[#D6CCBA] text-[#D6CCBA]/70 hover:text-white uppercase tracking-wider transition-colors"
          >
            Storefront &rarr;
          </a>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1.5 bg-[#2B2A28] hover:bg-[#FF0800] text-white uppercase tracking-wider transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#161616] border border-[#2B2A28] p-4 space-y-1">
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block">
                Total Orders
              </span>
              <span className="text-2xl font-serif-editorial text-white">{stats.totalOrders}</span>
            </div>

            <div className="bg-[#161616] border border-[#FF0800]/50 p-4 space-y-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-2 bg-[#FF0800]" />
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#FF0800] font-bold block">
                ★ New Orders
              </span>
              <span className="text-2xl font-serif-editorial text-white font-bold">{stats.newOrders}</span>
            </div>

            <div className="bg-[#161616] border border-[#2B2A28] p-4 space-y-1">
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block">
                In Fulfillment
              </span>
              <span className="text-2xl font-serif-editorial text-[#8FA9C4]">
                {stats.confirmedOrders + stats.processingOrders + stats.dispatchedOrders}
              </span>
            </div>

            <div className="bg-[#161616] border border-[#2B2A28] p-4 space-y-1">
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block">
                Delivered
              </span>
              <span className="text-2xl font-serif-editorial text-emerald-400">{stats.deliveredOrders}</span>
            </div>

            <div className="bg-[#161616] border border-[#2B2A28] p-4 space-y-1">
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block">
                Outstanding COD
              </span>
              <span className="text-2xl font-serif-editorial text-[#D6CCBA]">€{stats.outstandingCodEur}</span>
            </div>

            <div className="bg-[#161616] border border-[#2B2A28] p-4 space-y-1">
              <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block">
                Remitted COD
              </span>
              <span className="text-2xl font-serif-editorial text-emerald-400">€{stats.remittedCodEur}</span>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-[#2B2A28] space-x-1 font-mono-archive text-xs uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-3 border-b-2 font-bold cursor-pointer transition-colors ${
              activeTab === 'orders'
                ? 'border-[#D6CCBA] text-white bg-[#161616]'
                : 'border-transparent text-[#D6CCBA]/50 hover:text-white'
            }`}
          >
            [ Orders Registry ({orders.length}) ]
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cod')}
            className={`px-4 py-3 border-b-2 font-bold cursor-pointer transition-colors ${
              activeTab === 'cod'
                ? 'border-[#D6CCBA] text-white bg-[#161616]'
                : 'border-transparent text-[#D6CCBA]/50 hover:text-white'
            }`}
          >
            [ COD Courier & Remittance Reconciliation ]
          </button>
        </div>

        {/* Filters and Search Strip */}
        <div className="bg-[#161616] border border-[#2B2A28] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs font-mono-archive">
          <div className="flex-1 flex gap-3">
            <input
              type="text"
              placeholder="Search reference, name, email, phone, Eircode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-[#1F1E1D] border border-[#2B2A28] px-3 py-2 text-white placeholder-[#D6CCBA]/30 focus:border-[#D6CCBA] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#1F1E1D] border border-[#2B2A28] px-3 py-2 text-white focus:border-[#D6CCBA] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="NEW">Status: NEW</option>
              <option value="CONFIRMED">Status: CONFIRMED</option>
              <option value="PROCESSING">Status: PROCESSING</option>
              <option value="DISPATCHED">Status: DISPATCHED</option>
              <option value="DELIVERED">Status: DELIVERED</option>
              <option value="DELIVERY_FAILED">Status: DELIVERY_FAILED</option>
              <option value="CANCELLED">Status: CANCELLED</option>
            </select>

            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="bg-[#1F1E1D] border border-[#2B2A28] px-3 py-2 text-white focus:border-[#D6CCBA] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Payment: All</option>
              <option value="UNPAID">Payment: UNPAID</option>
              <option value="COLLECTED">Payment: COLLECTED</option>
              <option value="REMITTED">Payment: REMITTED</option>
              <option value="REFUNDED">Payment: REFUNDED</option>
            </select>

            <button
              type="button"
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-[#2B2A28] hover:bg-[#D6CCBA] hover:text-[#161616] text-white uppercase tracking-wider transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tab 1: Orders Registry Table */}
        {activeTab === 'orders' && (
          <div className="bg-[#161616] border border-[#2B2A28] overflow-x-auto shadow-2xl">
            {isLoadingOrders ? (
              <div className="p-12 text-center text-xs font-mono-archive text-[#D6CCBA]/50">
                Loading orders dossier...
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono-archive text-[#D6CCBA]/50">
                No orders match the selected filters.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono-archive">
                <thead>
                  <tr className="border-b border-[#2B2A28] bg-[#1A1A1A] text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">
                    <th className="p-3.5">Reference</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Customer & Destination</th>
                    <th className="p-3.5">Garments</th>
                    <th className="p-3.5">COD Amount</th>
                    <th className="p-3.5">Order Status</th>
                    <th className="p-3.5">Payment</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2A28]">
                  {orders.map((ord) => {
                    const isNew = ord.orderStatus === 'NEW';
                    return (
                      <tr
                        key={ord.id}
                        className={`hover:bg-[#1F1E1D] transition-colors ${
                          isNew ? 'bg-[#FF0800]/5' : ''
                        }`}
                      >
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-[#FF0800] shrink-0 animate-ping" />
                          )}
                          <span>{ord.orderReference}</span>
                        </td>
                        <td className="p-3.5 text-[#D6CCBA]/70 text-[11px]">
                          {new Date(ord.createdAt).toLocaleDateString('en-IE', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-white">{ord.customer?.fullName}</div>
                          <div className="text-[10px] text-[#D6CCBA]/60">
                            {ord.customer?.city}, Co. {ord.customer?.county} &middot; {ord.customer?.phone}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {ord.items?.map((item, idx) => (
                            <div key={idx} className="text-[11px] text-[#D6CCBA]">
                              {item.quantity}× {item.colorwayName} ({item.size})
                            </div>
                          ))}
                        </td>
                        <td className="p-3.5 font-bold text-white">
                          €{ord.financials?.totalEur}.00
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block ${
                              ord.orderStatus === 'NEW'
                                ? 'bg-[#FF0800] text-white'
                                : ord.orderStatus === 'CONFIRMED'
                                ? 'bg-blue-600 text-white'
                                : ord.orderStatus === 'DISPATCHED'
                                ? 'bg-amber-600 text-white'
                                : ord.orderStatus === 'DELIVERED'
                                ? 'bg-emerald-600 text-white'
                                : ord.orderStatus === 'CANCELLED'
                                ? 'bg-zinc-700 text-zinc-300'
                                : 'bg-[#2B2A28] text-white'
                            }`}
                          >
                            {ord.orderStatus}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block ${
                              ord.paymentStatus === 'REMITTED'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500'
                                : ord.paymentStatus === 'COLLECTED'
                                ? 'bg-amber-900/60 text-amber-300 border border-amber-500'
                                : 'bg-[#2B2A28] text-[#D6CCBA]/70'
                            }`}
                          >
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="px-3 py-1 bg-[#2B2A28] hover:bg-[#D6CCBA] hover:text-[#161616] text-white uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Manage &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Dedicated COD Courier & Remittance Reconciliation */}
        {activeTab === 'cod' && (
          <div className="bg-[#161616] border border-[#2B2A28] p-6 space-y-6">
            <div>
              <h2 className="font-serif-editorial text-2xl text-white">Cash on Delivery Settlement Ledger</h2>
              <p className="text-xs font-mono-archive text-[#D6CCBA]/60 mt-1">
                Strict financial control: Payment status remains UNPAID until cash collection or courier bank remittance is verified.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono-archive">
                <thead>
                  <tr className="border-b border-[#2B2A28] bg-[#1A1A1A] text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">
                    <th className="p-3.5">Reference</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Expected COD</th>
                    <th className="p-3.5">Collected by Courier</th>
                    <th className="p-3.5">Bank Remitted</th>
                    <th className="p-3.5">Outstanding</th>
                    <th className="p-3.5">Payment Status</th>
                    <th className="p-3.5 text-right">Reconcile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2A28]">
                  {orders.map((ord) => {
                    const expected = ord.financials?.totalEur || 0;
                    return (
                      <tr key={ord.id} className="hover:bg-[#1F1E1D]">
                        <td className="p-3.5 font-bold text-white">{ord.orderReference}</td>
                        <td className="p-3.5 text-[#D6CCBA]">
                          {ord.customer?.fullName} ({ord.customer?.city})
                        </td>
                        <td className="p-3.5 font-bold text-white">€{expected}.00</td>
                        <td className="p-3.5 text-amber-300">
                          {ord.paymentStatus === 'COLLECTED' || ord.paymentStatus === 'REMITTED'
                            ? `€${expected}.00`
                            : '€0.00'}
                        </td>
                        <td className="p-3.5 text-emerald-400">
                          {ord.paymentStatus === 'REMITTED' ? `€${expected}.00` : '€0.00'}
                        </td>
                        <td className="p-3.5 font-bold text-[#FF0800]">
                          {ord.paymentStatus === 'REMITTED' ? '€0.00' : `€${expected}.00`}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-[#2B2A28] text-[10px] uppercase tracking-wider">
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="px-3 py-1 bg-[#D6CCBA] hover:bg-white text-[#161616] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Reconcile &rarr;
                          </button>
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

      {/* ── ORDER DETAILS & RECONCILIATION MODAL DRAWER ─────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/80 backdrop-blur-sm">
          <div className="w-screen max-w-2xl bg-[#161616] border-l border-[#2B2A28] h-full flex flex-col shadow-2xl animate-fadeIn">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#2B2A28] bg-[#121212] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono-archive uppercase tracking-widest text-[#FF0800] block mb-1">
                  ORDER DOSSIER &middot; {selectedOrder.orderStatus}
                </span>
                <h3 className="font-serif-editorial text-2xl text-white">
                  {selectedOrder.orderReference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 border border-[#2B2A28] hover:border-white text-xs font-mono-archive uppercase tracking-widest text-white cursor-pointer"
              >
                Close [✕]
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono-archive text-xs">
              {/* Customer Dossier */}
              <div className="bg-[#1A1A1A] border border-[#2B2A28] p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60 border-b border-[#2B2A28] pb-1">
                  CUSTOMER INFORMATION
                </div>
                <div className="grid grid-cols-2 gap-2 text-white">
                  <div>
                    <span className="text-[#D6CCBA]/60 block text-[10px]">Name:</span>
                    <strong className="text-white">{selectedOrder.customer?.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[#D6CCBA]/60 block text-[10px]">Email:</span>
                    <a href={`mailto:${selectedOrder.customer?.email}`} className="text-[#8FA9C4] underline">
                      {selectedOrder.customer?.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-[#D6CCBA]/60 block text-[10px]">Irish Phone:</span>
                    <a href={`tel:${selectedOrder.customer?.phone}`} className="text-[#D6CCBA] font-bold">
                      {selectedOrder.customer?.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-[#D6CCBA]/60 block text-[10px]">Eircode:</span>
                    <strong className="text-[#FF0800]">{selectedOrder.customer?.eircode}</strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#2B2A28]">
                  <span className="text-[#D6CCBA]/60 block text-[10px]">Full Delivery Address:</span>
                  <div className="text-white leading-relaxed">
                    {selectedOrder.customer?.streetAddress}
                    {selectedOrder.customer?.unitOrApartment ? `, ${selectedOrder.customer?.unitOrApartment}` : ''}<br />
                    {selectedOrder.customer?.city}, Co. {selectedOrder.customer?.county}<br />
                    {selectedOrder.customer?.eircode} &middot; Ireland
                  </div>
                </div>
              </div>

              {/* Garments Breakdown */}
              <div className="bg-[#1A1A1A] border border-[#2B2A28] p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60 border-b border-[#2B2A28] pb-1">
                  GARMENT ALLOCATION SNAPSHOT
                </div>
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1">
                    <div>
                      <span className="font-bold text-white">{it.quantity}× Tracksuit — {it.colorwayName}</span>
                      <span className="block text-[10px] text-[#D6CCBA]/60">Size: {it.size}</span>
                    </div>
                    <span className="font-bold text-white">€{it.subtotalEur}.00</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#2B2A28] flex justify-between font-bold text-white">
                  <span>Total Due Upon Delivery (COD):</span>
                  <span>€{selectedOrder.financials?.totalEur}.00</span>
                </div>
              </div>

              {/* Email & Notification Delivery Audit */}
              <div className="bg-[#1A1A1A] border border-[#2B2A28] p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#2B2A28] pb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">
                    TRANSACTIONAL NOTIFICATION AUDIT (RESEND)
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 uppercase font-bold tracking-wider ${
                    emailServiceStatus?.hasApiKey
                      ? emailServiceStatus.isCustomDomain
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-300'
                      : 'bg-[#FF0800]/20 text-[#FF0800]'
                  }`}>
                    {emailServiceStatus?.hasApiKey
                      ? emailServiceStatus.isCustomDomain
                        ? 'LIVE · CUSTOM DOMAIN'
                        : 'LIVE · ONBOARDING DOMAIN'
                      : 'SIMULATION / LOGGED'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center text-[#D6CCBA]/80">
                    <span>Customer Email Template:</span>
                    <span className="text-emerald-400 font-mono">
                      ✓ Generated & Logged ({selectedOrder.customer?.email})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#D6CCBA]/80">
                    <span>Admin Alert Template:</span>
                    <span className="text-emerald-400 font-mono">
                      ✓ Generated & Logged (noire.ireland@gmail.com)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#D6CCBA]/80">
                    <span>Active Sender Identity:</span>
                    <span className="text-white font-mono text-[10px]">
                      {emailServiceStatus?.fromEmail || 'Atelier NOIRÉ <onboarding@resend.dev>'}
                    </span>
                  </div>
                </div>

                {/* Resend Customer Confirmation Trigger */}
                <div className="pt-2 border-t border-[#2B2A28]">
                  <button
                    type="button"
                    disabled={isResendingEmail}
                    onClick={() => handleResendCustomerEmail(selectedOrder.id)}
                    className="w-full py-2 bg-[#263443] hover:bg-[#34465a] text-[#8FA9C4] hover:text-white text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isResendingEmail ? (
                      'Dispatching to customer...'
                    ) : (
                      <>
                        <span>↻ Re-dispatch Confirmation Email to Customer</span>
                      </>
                    )}
                  </button>

                  {resendNotificationResult && (
                    <div className={`mt-2 p-2 text-[10px] leading-relaxed border ${
                      resendNotificationResult.success
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-red-950/40 border-red-800 text-red-300'
                    }`}>
                      {resendNotificationResult.message}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-[#141414] border border-[#2B2A28] text-[10px] text-[#D6CCBA]/70 space-y-1">
                  <strong className="text-white block uppercase tracking-wider text-[9px]">
                    Live Delivery Configuration Note
                  </strong>
                  <p className="leading-relaxed">
                    Customer confirmation emails deliver live to any external email address when a verified custom domain (e.g. <code className="text-[#8FA9C4]">orders@yourdomain.com</code>) and <code className="text-[#8FA9C4]">RESEND_API_KEY</code> are present in environment variables.
                  </p>
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdateStatusSubmit} className="bg-[#1F1E1D] border border-[#2B2A28] p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">
                  UPDATE ORDER FULFILLMENT STATUS
                </div>
                <div>
                  <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Select New Status</label>
                  <select
                    value={newSelectedStatus}
                    onChange={(e) => setNewSelectedStatus(e.target.value as OrderRecord['orderStatus'])}
                    className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:border-[#D6CCBA] focus:outline-none cursor-pointer"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PROCESSING">PROCESSING</option>
                    <option value="DISPATCHED">DISPATCHED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="DELIVERY_FAILED">DELIVERY_FAILED</option>
                    <option value="CANCELLED">CANCELLED (Restores Stock)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Administrative Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Courier booked for delivery on Thursday"
                    value={statusUpdateNote}
                    onChange={(e) => setStatusUpdateNote(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white placeholder-[#D6CCBA]/30 focus:border-[#D6CCBA] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full py-2.5 bg-[#D6CCBA] hover:bg-white text-[#161616] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStatus ? 'Updating Status...' : 'Commit Status Transition &rarr;'}
                </button>
              </form>

              {/* Phase 7 COD Reconciliation Form */}
              <form onSubmit={handleReconcileSubmit} className="bg-[#1F1E1D] border border-[#2B2A28] p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">
                  COURIER & BANK REMITTANCE RECONCILIATION
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Courier Partner</label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. DHL Express Ireland"
                      className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. IE-DHL-88992"
                      className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Settlement Status</label>
                    <select
                      value={settlementStatus}
                      onChange={(e) => setSettlementStatus(e.target.value as typeof settlementStatus)}
                      className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:outline-none cursor-pointer"
                    >
                      <option value="PENDING_COLLECTION">PENDING_COLLECTION</option>
                      <option value="COLLECTED_BY_COURIER">COLLECTED_BY_COURIER</option>
                      <option value="REMITTED_TO_BANK">REMITTED_TO_BANK</option>
                      <option value="DISCREPANCY">DISCREPANCY</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Amount Remitted (€)</label>
                    <input
                      type="number"
                      value={amountRemittedEur}
                      onChange={(e) => setAmountRemittedEur(Number(e.target.value))}
                      className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#D6CCBA]/70 block mb-1">Audit / Reconciliation Notes</label>
                  <input
                    type="text"
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="e.g. Bank statement ref IE-NOIRE-REMIT-01"
                    className="w-full bg-[#161616] border border-[#2B2A28] p-2 text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isReconciling}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isReconciling ? 'Saving...' : 'Verify & Record COD Settlement'}
                </button>
              </form>

              {/* Status History Audit Trail */}
              <div className="bg-[#1A1A1A] border border-[#2B2A28] p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60 border-b border-[#2B2A28] pb-1">
                  TIMESTAMPED AUDIT TRAIL
                </div>
                <div className="space-y-2">
                  {selectedOrder.statusHistory?.map((h, i) => (
                    <div key={i} className="text-[11px] border-b border-[#2B2A28] pb-1.5 last:border-b-0">
                      <div className="flex justify-between text-[#D6CCBA]/70">
                        <span className="font-bold text-white">{h.status}</span>
                        <span className="text-[10px]">{new Date(h.timestamp).toLocaleString('en-IE')}</span>
                      </div>
                      <div className="text-[#D6CCBA]/80 text-[10px] mt-0.5">{h.note}</div>
                      <div className="text-[#D6CCBA]/40 text-[9px]">By: {h.updatedBy}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import crypto from 'crypto';
import { getAdminDb, getAdminAuth } from './firebase-admin';
import { OrderRecord } from './orders-service';
import {
  fetchAllOrders,
  updateOrderRecord,
  reconcileCodRecord,
} from './storage-store';

export const ADMIN_ALLOWLIST = ['noire.ireland@gmail.com'];
export const ADMIN_CONFIGURED_PASSWORD = 'finalrun911';
const ADMIN_HMAC_SECRET = process.env.ADMIN_SESSION_SECRET || 'atelier_noire_hmac_secret_2026_finalrun';

export interface AdminAuthContext {
  uid: string;
  email: string;
  role: string;
}

export function createAdminSessionToken(email: string): string {
  const payload = {
    email,
    uid: 'admin_noire_ireland',
    role: 'SUPER_ADMIN',
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_HMAC_SECRET).update(body).digest('base64url');
  return `an_${body}.${sig}`;
}

export function verifyAdminSessionToken(token: string): AdminAuthContext | null {
  if (!token.startsWith('an_')) return null;
  const raw = token.slice(3);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', ADMIN_HMAC_SECRET).update(body).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!ADMIN_ALLOWLIST.includes(payload.email)) return null;
    return {
      uid: payload.uid || 'admin_noire_ireland',
      email: payload.email,
      role: payload.role || 'SUPER_ADMIN',
    };
  } catch {
    return null;
  }
}

export async function verifyAdminRequest(authHeader?: string): Promise<{ authorized: boolean; context?: AdminAuthContext; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or malformed Authorization header.' };
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return { authorized: false, error: 'Empty bearer token.' };
  }

  // 1. Check for cryptographically signed HMAC admin session token
  if (token.startsWith('an_')) {
    const session = verifyAdminSessionToken(token);
    if (!session) {
      return { authorized: false, error: 'Invalid or expired administrator token.' };
    }
    return { authorized: true, context: session };
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const email = (decodedToken.email || '').toLowerCase().trim();

    // 1. Explicit allowlist check
    const isAllowlisted = ADMIN_ALLOWLIST.includes(email);

    // 2. Custom claims check (Firebase Auth token custom claims)
    const hasAdminClaim = decodedToken.admin === true || decodedToken.role === 'admin';

    // 3. Database admins collection check
    let hasDbRole = false;
    if (!isAllowlisted && !hasAdminClaim && decodedToken.uid) {
      try {
        const db = getAdminDb();
        const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
        if (adminDoc.exists && adminDoc.data()?.active === true) {
          hasDbRole = true;
        }
      } catch {
        // Ignore fallback
      }
    }

    if (!isAllowlisted && !hasAdminClaim && !hasDbRole) {
      return {
        authorized: false,
        error: `Access denied. Email [${email || 'unregistered'}] is not on the administrator allowlist.`,
      };
    }

    return {
      authorized: true,
      context: {
        uid: decodedToken.uid,
        email,
        role: isAllowlisted || hasAdminClaim ? 'SUPER_ADMIN' : 'ADMIN',
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid administrator token.';
    return {
      authorized: false,
      error: `Unauthorized: ${msg}`,
    };
  }
}

export async function getAdminDashboardStats(): Promise<{
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
}> {
  const orders = await fetchAllOrders();

  let totalOrders = 0;
  let newOrders = 0;
  let confirmedOrders = 0;
  let processingOrders = 0;
  let dispatchedOrders = 0;
  let deliveredOrders = 0;
  let failedDeliveries = 0;
  let cancelledOrders = 0;
  let outstandingCodEur = 0;
  let collectedCodEur = 0;
  let remittedCodEur = 0;

  for (const data of orders) {
    totalOrders++;

    switch (data.orderStatus) {
      case 'NEW':
        newOrders++;
        break;
      case 'CONFIRMED':
        confirmedOrders++;
        break;
      case 'PROCESSING':
        processingOrders++;
        break;
      case 'DISPATCHED':
        dispatchedOrders++;
        break;
      case 'DELIVERED':
        deliveredOrders++;
        break;
      case 'DELIVERY_FAILED':
        failedDeliveries++;
        break;
      case 'CANCELLED':
        cancelledOrders++;
        break;
    }

    if (data.orderStatus !== 'CANCELLED') {
      const amount = data.financials?.totalEur || 0;
      if (data.paymentStatus === 'UNPAID') {
        outstandingCodEur += amount;
      } else if (data.paymentStatus === 'COLLECTED') {
        collectedCodEur += amount;
      } else if (data.paymentStatus === 'REMITTED') {
        remittedCodEur += amount;
      }
    }
  }

  return {
    totalOrders,
    newOrders,
    confirmedOrders,
    processingOrders,
    dispatchedOrders,
    deliveredOrders,
    failedDeliveries,
    cancelledOrders,
    outstandingCodEur,
    collectedCodEur,
    remittedCodEur,
  };
}

export async function listAdminOrders(filters: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  limit?: number;
}): Promise<OrderRecord[]> {
  let orders = await fetchAllOrders();

  if (filters.status && filters.status !== 'ALL') {
    orders = orders.filter((o) => o.orderStatus === filters.status);
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    orders = orders.filter((o) => o.paymentStatus === filters.paymentStatus);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().toLowerCase();
    orders = orders.filter((o) => {
      return (
        o.orderReference?.toLowerCase().includes(term) ||
        o.customer?.fullName?.toLowerCase().includes(term) ||
        o.customer?.email?.toLowerCase().includes(term) ||
        o.customer?.phone?.toLowerCase().includes(term) ||
        o.customer?.eircode?.toLowerCase().includes(term)
      );
    });
  }

  if (filters.limit) {
    orders = orders.slice(0, filters.limit);
  }

  return orders;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderRecord['orderStatus'],
  adminEmail: string,
  note?: string
): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
  return updateOrderRecord(orderId, newStatus, adminEmail, note);
}

export async function reconcileCodSettlement(
  orderId: string,
  settlementData: {
    courierName: string;
    trackingNumber: string;
    actualCollectedEur: number;
    settlementStatus: 'PENDING_COLLECTION' | 'COLLECTED_BY_COURIER' | 'REMITTED_TO_BANK' | 'DISCREPANCY';
    amountRemittedEur: number;
    remittanceDate?: string;
    reconciliationNotes?: string;
  },
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  return reconcileCodRecord(orderId, settlementData, adminEmail);
}

import fs from 'fs';
import path from 'path';
import { getAdminDb } from './firebase-admin';
import { OrderRecord } from './orders-service';

const LOCAL_DB_PATH = path.resolve(process.cwd(), '.local-store.json');

interface LocalStoreSchema {
  orders: Record<string, OrderRecord>;
  inventory: Record<string, { availableStock: number; totalStock: number }>;
  codSettlements: Record<string, any>;
  notificationJobs: Record<string, any>;
}

const DEFAULT_INVENTORY: Record<string, { availableStock: number; totalStock: number }> = {
  'carbon_S': { availableStock: 7, totalStock: 7 },
  'carbon_M': { availableStock: 14, totalStock: 14 },
  'carbon_L': { availableStock: 12, totalStock: 12 },
  'carbon_XL': { availableStock: 6, totalStock: 6 },
  'carbon_XXL': { availableStock: 2, totalStock: 2 },
  'blue-charcoal_S': { availableStock: 7, totalStock: 7 },
  'blue-charcoal_M': { availableStock: 14, totalStock: 14 },
  'blue-charcoal_L': { availableStock: 12, totalStock: 12 },
  'blue-charcoal_XL': { availableStock: 6, totalStock: 6 },
  'blue-charcoal_XXL': { availableStock: 2, totalStock: 2 },
};

function readLocalStore(): LocalStoreSchema {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error reading local store, resetting:', err);
  }
  return {
    orders: {},
    inventory: { ...DEFAULT_INVENTORY },
    codSettlements: {},
    notificationJobs: {},
  };
}

function writeLocalStore(data: LocalStoreSchema) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local store:', err);
  }
}

let isUsingFallback = false;

export async function checkIdempotentOrder(idempotencyKey?: string): Promise<OrderRecord | null> {
  if (!idempotencyKey) return null;
  const db = getAdminDb();

  if (!isUsingFallback) {
    try {
      const existingQuery = await db
        .collection('orders')
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const doc = existingQuery.docs[0];
        return { id: doc.id, ...doc.data() } as OrderRecord;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('UNAUTHENTICATED') ||
        errMsg.includes('credentials')
      ) {
        isUsingFallback = true;
      }
    }
  }

  // Resilient Local Storage fallback
  const store = readLocalStore();
  const match = Object.values(store.orders).find((o) => o.idempotencyKey === idempotencyKey);
  return match || null;
}

export async function recordNotificationJob(
  jobData: Record<string, unknown>
): Promise<string> {
  const db = getAdminDb();
  const now = new Date().toISOString();

  if (!isUsingFallback) {
    try {
      const jobRef = db.collection('notificationJobs').doc();
      await jobRef.set({
        ...jobData,
        createdAt: jobData.createdAt || now,
      });
      return jobRef.id;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('UNAUTHENTICATED') ||
        errMsg.includes('credentials')
      ) {
        isUsingFallback = true;
      }
    }
  }

  // Resilient Local Storage fallback
  const store = readLocalStore();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  store.notificationJobs[id] = {
    id,
    ...jobData,
    createdAt: jobData.createdAt || now,
  };
  writeLocalStore(store);
  return id;
}

export async function saveOrderAtomic(
  order: OrderRecord,
  settlementData: any
): Promise<{ success: boolean; error?: string }> {
  const db = getAdminDb();

  // Try live Firestore first
  if (!isUsingFallback) {
    try {
      await db.runTransaction(async (transaction: any) => {
        // Inventory checks
        for (const item of order.items) {
          const variantId = `${item.colorway}_${item.size}`;
          const invRef = db.collection('inventory').doc(variantId);
          const invDoc = await transaction.get(invRef);

          let available = DEFAULT_INVENTORY[variantId]?.availableStock ?? 5;
          let total = DEFAULT_INVENTORY[variantId]?.totalStock ?? 5;

          if (invDoc.exists) {
            const data = invDoc.data() || {};
            available = typeof data.availableStock === 'number' ? data.availableStock : available;
            total = typeof data.totalStock === 'number' ? data.totalStock : total;
          }

          if (available < item.quantity) {
            throw new Error(`Insufficient stock for ${item.colorwayName} (${item.size}). Only ${available} remaining.`);
          }

          transaction.set(
            invRef,
            {
              colorway: item.colorway,
              size: item.size,
              availableStock: available - item.quantity,
              totalStock: total,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }

        // Save order
        const orderRef = db.collection('orders').doc(order.id);
        transaction.set(orderRef, order);

        // Save settlement
        const settlementRef = db.collection('codSettlements').doc(order.id);
        transaction.set(settlementRef, settlementData);
      });

      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('UNAUTHENTICATED') ||
        errMsg.includes('credentials') ||
        errMsg.includes('could not find default credentials')
      ) {
        console.warn(
          '[Dev Notice]: Firestore Admin credentials pending in local dev environment. Operating in resilient local storage mode. In production on Vercel, set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
        );
        isUsingFallback = true;
      } else {
        return { success: false, error: errMsg };
      }
    }
  }

  // Resilient Local Storage fallback
  const store = readLocalStore();

  for (const item of order.items) {
    const variantId = `${item.colorway}_${item.size}`;
    const inv = store.inventory[variantId] || { availableStock: 5, totalStock: 5 };
    if (inv.availableStock < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for ${item.colorwayName} (${item.size}). Only ${inv.availableStock} remaining.`,
      };
    }
    inv.availableStock -= item.quantity;
    store.inventory[variantId] = inv;
  }

  store.orders[order.id] = order;
  store.codSettlements[order.id] = settlementData;
  writeLocalStore(store);

  return { success: true };
}

export async function fetchAllOrders(): Promise<OrderRecord[]> {
  const db = getAdminDb();

  if (!isUsingFallback) {
    try {
      const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
      const list: OrderRecord[] = [];
      snapshot.forEach((doc: any) => {
        list.push({ id: doc.id, ...doc.data() } as OrderRecord);
      });
      return list;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('UNAUTHENTICATED')) {
        isUsingFallback = true;
      }
    }
  }

  const store = readLocalStore();
  const list = Object.values(store.orders);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export async function updateOrderRecord(
  orderId: string,
  newStatus: OrderRecord['orderStatus'],
  adminEmail: string,
  note?: string
): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
  const db = getAdminDb();

  if (!isUsingFallback) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      let updated: OrderRecord | null = null;

      await db.runTransaction(async (transaction: any) => {
        const doc = await transaction.get(orderRef);
        if (!doc.exists) throw new Error('Order not found');
        const existing = doc.data() as OrderRecord;
        const now = new Date().toISOString();

        if (newStatus === 'CANCELLED' && existing.orderStatus !== 'CANCELLED') {
          for (const item of existing.items) {
            const variantId = `${item.colorway}_${item.size}`;
            const invRef = db.collection('inventory').doc(variantId);
            const invDoc = await transaction.get(invRef);
            if (invDoc.exists) {
              const invData = invDoc.data() || {};
              transaction.update(invRef, {
                availableStock: (invData.availableStock || 0) + item.quantity,
                updatedAt: now,
              });
            }
          }
        }

        const statusHistory = existing.statusHistory || [];
        statusHistory.push({
          status: newStatus,
          note: note || `Status updated to ${newStatus}`,
          updatedBy: adminEmail,
          timestamp: now,
        });

        transaction.update(orderRef, { orderStatus: newStatus, statusHistory, updatedAt: now });
        updated = { ...existing, id: doc.id, orderStatus: newStatus, statusHistory, updatedAt: now };
      });

      return { success: true, order: updated || undefined };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('UNAUTHENTICATED')) {
        isUsingFallback = true;
      } else {
        return { success: false, error: errMsg };
      }
    }
  }

  const store = readLocalStore();
  const existing = store.orders[orderId];
  if (!existing) return { success: false, error: 'Order not found in local store' };

  const now = new Date().toISOString();
  if (newStatus === 'CANCELLED' && existing.orderStatus !== 'CANCELLED') {
    for (const item of existing.items) {
      const variantId = `${item.colorway}_${item.size}`;
      if (store.inventory[variantId]) {
        store.inventory[variantId].availableStock += item.quantity;
      }
    }
  }

  existing.orderStatus = newStatus;
  existing.statusHistory = existing.statusHistory || [];
  existing.statusHistory.push({
    status: newStatus,
    note: note || `Status updated to ${newStatus}`,
    updatedBy: adminEmail,
    timestamp: now,
  });
  existing.updatedAt = now;

  store.orders[orderId] = existing;
  writeLocalStore(store);

  return { success: true, order: existing };
}

export async function reconcileCodRecord(
  orderId: string,
  settlementData: any,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  const db = getAdminDb();

  if (!isUsingFallback) {
    try {
      const settlementRef = db.collection('codSettlements').doc(orderId);
      const orderRef = db.collection('orders').doc(orderId);

      await db.runTransaction(async (transaction: any) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) throw new Error('Order not found');

        const orderData = orderDoc.data() as OrderRecord;
        const expected = orderData.financials?.totalEur || 0;
        const outstanding = Math.max(0, expected - settlementData.amountRemittedEur);

        let paymentStatus: OrderRecord['paymentStatus'] = 'UNPAID';
        if (settlementData.settlementStatus === 'REMITTED_TO_BANK') {
          paymentStatus = 'REMITTED';
        } else if (settlementData.settlementStatus === 'COLLECTED_BY_COURIER') {
          paymentStatus = 'COLLECTED';
        }

        const now = new Date().toISOString();
        transaction.set(
          settlementRef,
          {
            ...settlementData,
            orderId,
            orderReference: orderData.orderReference,
            expectedAmountEur: expected,
            outstandingAmountEur: outstanding,
            reconciledBy: adminEmail,
            updatedAt: now,
          },
          { merge: true }
        );

        transaction.update(orderRef, { paymentStatus, updatedAt: now });
      });

      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('UNAUTHENTICATED')) {
        isUsingFallback = true;
      } else {
        return { success: false, error: errMsg };
      }
    }
  }

  const store = readLocalStore();
  const order = store.orders[orderId];
  if (!order) return { success: false, error: 'Order not found in local store' };

  let paymentStatus: OrderRecord['paymentStatus'] = 'UNPAID';
  if (settlementData.settlementStatus === 'REMITTED_TO_BANK') {
    paymentStatus = 'REMITTED';
  } else if (settlementData.settlementStatus === 'COLLECTED_BY_COURIER') {
    paymentStatus = 'COLLECTED';
  }

  const expected = order.financials?.totalEur || 0;
  const outstanding = Math.max(0, expected - settlementData.amountRemittedEur);
  const now = new Date().toISOString();

  store.codSettlements[orderId] = {
    ...settlementData,
    orderId,
    orderReference: order.orderReference,
    expectedAmountEur: expected,
    outstandingAmountEur: outstanding,
    reconciledBy: adminEmail,
    updatedAt: now,
  };

  order.paymentStatus = paymentStatus;
  order.updatedAt = now;
  store.orders[orderId] = order;

  writeLocalStore(store);
  return { success: true };
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const db = getAdminDb();
  if (!isUsingFallback) {
    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as OrderRecord;
      }
    } catch {
      // Fallback
    }
  }

  const store = readLocalStore();
  return store.orders[orderId] || null;
}

export async function getNotificationJobsForOrder(orderId: string): Promise<any[]> {
  const db = getAdminDb();
  if (!isUsingFallback) {
    try {
      const snap = await db.collection('notificationJobs').where('orderId', '==', orderId).get();
      const list: any[] = [];
      snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
      return list;
    } catch {
      // Fallback
    }
  }

  const store = readLocalStore();
  return Object.values(store.notificationJobs).filter((j: any) => j.orderId === orderId);
}


import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getAdminDb,
  hasValidServiceAccountCredentials,
  isCredentialOrPermissionError,
} from './firebase-admin.js';
import type { OrderRecord } from './orders-service.js';

const LOCAL_DB_PATH = path.resolve(process.cwd(), '.local-store.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'atelier-noire-local-store.json');

interface LocalStoreSchema {
  orders: Record<string, OrderRecord>;
  inventory: Record<string, { availableStock: number; totalStock: number }>;
  codSettlements: Record<string, any>;
  notificationJobs: Record<string, any>;
}

export const DEFAULT_INVENTORY: Record<string, { availableStock: number; totalStock: number }> = {
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

function cloneDefaultInventory(): Record<string, { availableStock: number; totalStock: number }> {
  const cloned: Record<string, { availableStock: number; totalStock: number }> = {};
  for (const [key, value] of Object.entries(DEFAULT_INVENTORY)) {
    cloned[key] = { ...value };
  }
  return cloned;
}

function resolveReadableStorePath(): string | null {
  if (fs.existsSync(LOCAL_DB_PATH)) return LOCAL_DB_PATH;
  if (fs.existsSync(TMP_DB_PATH)) return TMP_DB_PATH;
  return null;
}

function readLocalStore(): LocalStoreSchema {
  const defaults = cloneDefaultInventory();
  try {
    const storePath = resolveReadableStorePath();
    if (storePath) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<LocalStoreSchema>;
      return {
        orders: parsed.orders || {},
        inventory: { ...defaults, ...(parsed.inventory || {}) },
        codSettlements: parsed.codSettlements || {},
        notificationJobs: parsed.notificationJobs || {},
      };
    }
  } catch (err) {
    console.warn('Error reading local store, resetting:', err);
  }
  return {
    orders: {},
    inventory: defaults,
    codSettlements: {},
    notificationJobs: {},
  };
}

function writeLocalStore(data: LocalStoreSchema) {
  const serialized = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(LOCAL_DB_PATH, serialized, 'utf-8');
  } catch {
    try {
      fs.writeFileSync(TMP_DB_PATH, serialized, 'utf-8');
    } catch (err) {
      console.error('Error writing local store:', err);
    }
  }
}

let isUsingFallback = false;

function shouldUseLocalFallback(): boolean {
  if (isUsingFallback) return true;
  if (!hasValidServiceAccountCredentials() && !process.env.K_SERVICE) {
    isUsingFallback = true;
    return true;
  }
  return false;
}

export async function getInventorySnapshot(): Promise<Record<string, number>> {
  const stock: Record<string, number> = {};
  for (const [variantId, entry] of Object.entries(DEFAULT_INVENTORY)) {
    stock[variantId] = entry.availableStock;
  }

  if (!shouldUseLocalFallback()) {
    try {
      const db = getAdminDb();
      const snapshot = await db.collection('inventory').get();
      snapshot.forEach((doc: any) => {
        const data = doc.data() || {};
        if (typeof data.availableStock === 'number') {
          stock[doc.id] = data.availableStock;
        }
      });
      return stock;
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      } else {
        throw err;
      }
    }
  }

  const store = readLocalStore();
  for (const [variantId, entry] of Object.entries(store.inventory)) {
    if (entry && typeof entry.availableStock === 'number') {
      stock[variantId] = entry.availableStock;
    }
  }
  return stock;
}

export async function checkIdempotentOrder(idempotencyKey?: string): Promise<OrderRecord | null> {
  if (!idempotencyKey) return null;

  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
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
      return null;
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      } else {
        throw err;
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
  const now = new Date().toISOString();

  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
    try {
      const jobRef = db.collection('notificationJobs').doc();
      await jobRef.set({
        ...jobData,
        createdAt: jobData.createdAt || now,
      });
      return jobRef.id;
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
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
  // Try live Firestore first when configured
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
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
      if (isCredentialOrPermissionError(err)) {
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
    const defaultEntry = DEFAULT_INVENTORY[variantId] || { availableStock: 5, totalStock: 5 };
    const inv = store.inventory[variantId]
      ? { ...store.inventory[variantId] }
      : { ...defaultEntry };
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
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
    try {
      const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
      const list: OrderRecord[] = [];
      snapshot.forEach((doc: any) => {
        list.push({ id: doc.id, ...doc.data() } as OrderRecord);
      });
      return list;
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      } else {
        throw err;
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
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
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
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      } else {
        return { success: false, error: errMsg };
      }
    }
  }

  const store = readLocalStore();
  const matchedOrder =
    store.orders[orderId] ||
    Object.values(store.orders).find((o) => o.orderReference === orderId);
  if (!matchedOrder) return { success: false, error: 'Order not found in local store' };

  const targetKey = matchedOrder.id;
  const now = new Date().toISOString();
  if (newStatus === 'CANCELLED' && matchedOrder.orderStatus !== 'CANCELLED') {
    for (const item of matchedOrder.items) {
      const variantId = `${item.colorway}_${item.size}`;
      const defaultEntry = DEFAULT_INVENTORY[variantId] || { availableStock: 0, totalStock: 0 };
      const existingInv = store.inventory[variantId] || { ...defaultEntry };
      store.inventory[variantId] = {
        ...existingInv,
        availableStock: existingInv.availableStock + item.quantity,
      };
    }
  }

  matchedOrder.orderStatus = newStatus;
  matchedOrder.statusHistory = matchedOrder.statusHistory || [];
  matchedOrder.statusHistory.push({
    status: newStatus,
    note: note || `Status updated to ${newStatus}`,
    updatedBy: adminEmail,
    timestamp: now,
  });
  matchedOrder.updatedAt = now;

  store.orders[targetKey] = matchedOrder;
  writeLocalStore(store);

  return { success: true, order: matchedOrder };
}

export async function reconcileCodRecord(
  orderId: string,
  settlementData: any,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
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
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      } else {
        return { success: false, error: errMsg };
      }
    }
  }

  const store = readLocalStore();
  const order =
    store.orders[orderId] ||
    Object.values(store.orders).find((o) => o.orderReference === orderId);
  if (!order) return { success: false, error: 'Order not found in local store' };

  const targetKey = order.id;
  let paymentStatus: OrderRecord['paymentStatus'] = 'UNPAID';
  if (settlementData.settlementStatus === 'REMITTED_TO_BANK') {
    paymentStatus = 'REMITTED';
  } else if (settlementData.settlementStatus === 'COLLECTED_BY_COURIER') {
    paymentStatus = 'COLLECTED';
  }

  const expected = order.financials?.totalEur || 0;
  const outstanding = Math.max(0, expected - settlementData.amountRemittedEur);
  const now = new Date().toISOString();

  store.codSettlements[targetKey] = {
    ...settlementData,
    orderId: targetKey,
    orderReference: order.orderReference,
    expectedAmountEur: expected,
    outstandingAmountEur: outstanding,
    reconciledBy: adminEmail,
    updatedAt: now,
  };

  order.paymentStatus = paymentStatus;
  order.updatedAt = now;
  store.orders[targetKey] = order;

  writeLocalStore(store);
  return { success: true };
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as OrderRecord;
      }
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      }
    }
  }

  const store = readLocalStore();
  return (
    store.orders[orderId] ||
    Object.values(store.orders).find((o) => o.orderReference === orderId) ||
    null
  );
}

export async function getNotificationJobsForOrder(orderId: string): Promise<any[]> {
  if (!shouldUseLocalFallback()) {
    const db = getAdminDb();
    try {
      const snap = await db.collection('notificationJobs').where('orderId', '==', orderId).get();
      const list: any[] = [];
      snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
      return list;
    } catch (err: unknown) {
      if (isCredentialOrPermissionError(err)) {
        isUsingFallback = true;
      }
    }
  }

  const store = readLocalStore();
  return Object.values(store.notificationJobs).filter((j: any) => j.orderId === orderId);
}


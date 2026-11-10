import crypto from 'crypto';
import { getAdminDb } from './firebase-admin';
import {
  validateCheckoutPayload,
  calculateAuthoritativeTotals,
  CheckoutPayload
} from './validation';
import { dispatchOrderNotifications } from './notifications';
import { OrderEmailData } from './email-templates';
import { saveOrderAtomic, checkIdempotentOrder } from './storage-store';

export interface OrderRecord {
  id: string;
  orderReference: string;
  customer: CheckoutPayload['customer'] & { country: string };
  items: Array<{
    colorway: 'carbon' | 'blue-charcoal';
    colorwayName: string;
    size: string;
    quantity: number;
    unitPriceEur: number;
    subtotalEur: number;
  }>;
  financials: {
    unitPriceEur: number;
    subtotalEur: number;
    shippingEur: number;
    totalEur: number;
    currency: string;
  };
  paymentMethod: 'COD';
  paymentStatus: 'UNPAID' | 'COLLECTED' | 'REMITTED' | 'REFUNDED';
  orderStatus: 'NEW' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED';
  statusHistory: Array<{
    status: string;
    note: string;
    updatedBy: string;
    timestamp: string;
  }>;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory fallback ledger for initial stock if Firestore collection is fresh
const INITIAL_STOCK_PER_VARIANT: Record<string, number> = {
  'carbon_S': 7,
  'carbon_M': 14,
  'carbon_L': 12,
  'carbon_XL': 6,
  'carbon_XXL': 2,
  'blue-charcoal_S': 7,
  'blue-charcoal_M': 14,
  'blue-charcoal_L': 12,
  'blue-charcoal_XL': 6,
  'blue-charcoal_XXL': 2,
};

export async function createOrder(
  payload: unknown,
  baseUrl: string
): Promise<{ success: boolean; order?: OrderRecord; error?: string; errors?: string[] }> {
  const validation = validateCheckoutPayload(payload);
  if (!validation.valid || !validation.sanitized) {
    return { success: false, errors: validation.errors };
  }

  const { customer, items, idempotencyKey } = validation.sanitized;
  const db = getAdminDb();

  // 1. Idempotency Check with resilient storage fallback
  if (idempotencyKey) {
    try {
      const existingOrder = await checkIdempotentOrder(idempotencyKey);
      if (existingOrder) {
        console.log(`[Idempotency Hit]: Returning existing order ${existingOrder.orderReference}`);
        return { success: true, order: existingOrder };
      }
    } catch {
      // Continue with new order creation
    }
  }

  // 2. Server-Side Authoritative Totals
  const totals = calculateAuthoritativeTotals(items);

  // 3. Generate Non-Guessable Reference
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const orderReference = `NOIRE-88-COD-${randomSuffix}`;

  // 4. Map Item Snapshots
  const itemsSnapshot = items.map((item) => {
    const colorwayName = item.colorway === 'blue-charcoal' ? 'Blue Charcoal' : 'Noir / Carbon';
    return {
      colorway: item.colorway,
      colorwayName,
      size: item.size,
      quantity: item.quantity,
      unitPriceEur: totals.unitPriceEur,
      subtotalEur: totals.unitPriceEur * item.quantity,
    };
  });

  const now = new Date().toISOString();
  const orderDocRef = db.collection('orders').doc();

  const newOrder: OrderRecord = {
    id: orderDocRef.id,
    orderReference,
    customer: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      streetAddress: customer.streetAddress,
      unitOrApartment: customer.unitOrApartment || '',
      city: customer.city,
      county: customer.county,
      eircode: customer.eircode,
      country: 'IE',
    },
    items: itemsSnapshot,
    financials: totals,
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    orderStatus: 'NEW',
    statusHistory: [
      {
        status: 'NEW',
        note: 'Order submitted via Atelier NOIRÉ storefront. Cash on Delivery selected.',
        updatedBy: 'CUSTOMER',
        timestamp: now,
      },
    ],
    idempotencyKey: idempotencyKey || '',
    createdAt: now,
    updatedAt: now,
  };

  // 5. Atomic Storage & Order Creation (Firestore with dev fallback)
  const settlementRecord = {
    orderId: orderDocRef.id,
    orderReference,
    expectedAmountEur: totals.totalEur,
    actualCollectedEur: 0,
    courierName: '',
    trackingNumber: '',
    collectionDate: null,
    settlementStatus: 'PENDING_COLLECTION',
    amountRemittedEur: 0,
    remittanceDate: null,
    outstandingAmountEur: totals.totalEur,
    reconciliationNotes: 'Awaiting order fulfillment and courier assignment',
    reconciledBy: '',
    createdAt: now,
    updatedAt: now,
  };

  const saveResult = await saveOrderAtomic(newOrder, settlementRecord);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error || 'Failed to record order.' };
  }

  console.log(`[Order Created]: ${newOrder.orderReference} for ${customer.fullName}`);

  // 6. Asynchronous Notification Dispatch (Resend)
  const adminDashboardUrl = `${baseUrl.replace(/\/$/, '')}/admin`;
  const emailData: OrderEmailData = {
    orderReference: newOrder.orderReference,
    customer: newOrder.customer,
    items: newOrder.items,
    financials: newOrder.financials,
    paymentMethod: newOrder.paymentMethod,
    paymentStatus: newOrder.paymentStatus,
    orderStatus: newOrder.orderStatus,
    createdAt: newOrder.createdAt,
  };

  dispatchOrderNotifications(emailData, adminDashboardUrl).catch((err) => {
    console.error('Background notification dispatch error:', err);
  });

  return { success: true, order: newOrder };
}

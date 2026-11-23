import crypto from 'crypto';
import { getAdminDb } from './firebase-admin.js';
import {
  validateCheckoutPayload,
  calculateAuthoritativeTotals,
  type CheckoutPayload,
} from './validation.js';
import { dispatchOrderNotifications } from './notifications.js';
import type { OrderEmailData } from './email-templates.js';
import {
  saveOrderAtomic,
  checkIdempotentOrder,
  attachStripeSessionToOrder,
  markOrderPaidByStripeSession,
  cancelUnpaidStripeOrderRecord,
  getOrderById,
  getOrderByStripeSessionId,
} from './storage-store.js';
import {
  resolveStripeConfig,
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  expireStripeCheckoutSession,
  extractPaymentIntentId,
  verifyStripeSessionMatchesOrder,
} from './stripe-service.js';

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
  paymentMethod: 'CARD' | 'COD';
  paymentStatus: 'AWAITING_PAYMENT' | 'PAID' | 'UNPAID' | 'COLLECTED' | 'REMITTED' | 'REFUNDED';
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  checkoutUrl?: string;
  paidConfirmationSent?: boolean;
  paidAt?: string;
  orderStatus:
    | 'NEW'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'DISPATCHED'
    | 'DELIVERED'
    | 'DELIVERY_FAILED'
    | 'CANCELLED';
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

export async function createOrder(
  payload: unknown,
  baseUrl: string
): Promise<{
  success: boolean;
  order?: OrderRecord;
  error?: string;
  errors?: string[];
  statusCode?: number;
}> {
  const validation = validateCheckoutPayload(payload);
  if (!validation.valid || !validation.sanitized) {
    return { success: false, statusCode: 400, errors: validation.errors };
  }

  const { customer, items, idempotencyKey } = validation.sanitized;
  const paymentMethod: 'CARD' | 'COD' = validation.sanitized.paymentMethod === 'COD' ? 'COD' : 'CARD';
  const db = getAdminDb();

  // 1. Idempotency Check with resilient storage fallback (ignores CANCELLED orders)
  if (idempotencyKey) {
    try {
      const existingOrder = await checkIdempotentOrder(idempotencyKey);
      if (existingOrder) {
        // If existing order was CARD with an active Stripe session, return it safely without double charging or double stock deduction
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
  const orderReference = `NOIRE-88-${paymentMethod}-${randomSuffix}`;

  const stripeConfig = resolveStripeConfig();
  const staticCheckoutUrl =
    paymentMethod === 'CARD' && stripeConfig.mode === 'payment_link'
      ? stripeConfig.url
      : undefined;

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
    paymentMethod,
    paymentStatus: paymentMethod === 'CARD' ? 'AWAITING_PAYMENT' : 'UNPAID',
    ...(staticCheckoutUrl ? { checkoutUrl: staticCheckoutUrl } : {}),
    orderStatus: 'NEW',
    statusHistory: [
      {
        status: 'NEW',
        note:
          paymentMethod === 'CARD'
            ? 'Order submitted via Atelier NOIRÉ storefront. Card / Apple Pay / Google Pay (Stripe Checkout) selected.'
            : 'Order submitted via Atelier NOIRÉ storefront. Cash on Delivery (COD) selected.',
        updatedBy: 'CUSTOMER',
        timestamp: now,
      },
    ],
    idempotencyKey: idempotencyKey || '',
    createdAt: now,
    updatedAt: now,
  };

  // 5. Atomic Inventory Deduction & Order Persistence
  const settlementRecord = {
    orderId: orderDocRef.id,
    orderReference,
    expectedAmountEur: totals.totalEur,
    actualCollectedEur: 0,
    courierName: '',
    trackingNumber: '',
    collectionDate: null,
    settlementStatus: paymentMethod === 'CARD' ? 'AWAITING_STRIPE_PAYMENT' : 'PENDING_COLLECTION',
    amountRemittedEur: 0,
    remittanceDate: null,
    outstandingAmountEur: totals.totalEur,
    reconciliationNotes:
      paymentMethod === 'CARD'
        ? 'Card / Apple Pay / Google Pay checkout initiated — awaiting Stripe payment confirmation'
        : 'Awaiting order fulfillment and courier assignment',
    reconciledBy: '',
    createdAt: now,
    updatedAt: now,
  };

  const saveResult = await saveOrderAtomic(newOrder, settlementRecord);
  if (!saveResult.success) {
    return { success: false, statusCode: 400, error: saveResult.error || 'Failed to record order.' };
  }

  let finalOrder: OrderRecord = newOrder;

  // 6. Live Stripe Checkout Session Creation for CARD orders (with atomic stock rollback on failure)
  if (paymentMethod === 'CARD' && stripeConfig.mode === 'api_key') {
    const stripeSessionResult = await createStripeCheckoutSession({
      orderId: newOrder.id,
      orderReference: newOrder.orderReference,
      customerEmail: newOrder.customer.email,
      customerName: newOrder.customer.fullName,
      items: newOrder.items,
      totalEur: newOrder.financials.totalEur,
      baseUrl,
      idempotencyKey: newOrder.idempotencyKey || newOrder.orderReference,
    });

    if (!stripeSessionResult.success || !stripeSessionResult.session?.url) {
      await cancelUnpaidStripeOrderRecord(
        newOrder.id,
        `Automatic inventory rollback — Stripe Checkout creation failed: ${stripeSessionResult.error || 'Unknown error'}`
      );
      return {
        success: false,
        statusCode: 502,
        error:
          stripeSessionResult.error ||
          'Unable to initialize Stripe Checkout session. Zero charge occurred and your inventory allocation was released.',
      };
    }

    const attachRes = await attachStripeSessionToOrder(
      newOrder.id,
      stripeSessionResult.session.id,
      stripeSessionResult.session.url
    );
    if (attachRes.success && attachRes.order) {
      finalOrder = attachRes.order;
    } else {
      finalOrder = {
        ...newOrder,
        stripeSessionId: stripeSessionResult.session.id,
        checkoutUrl: stripeSessionResult.session.url,
      };
    }
  }

  console.log(`[Order Created]: ${finalOrder.orderReference} (${paymentMethod}) for ${customer.fullName}`);

  // 7. Dispatch confirmation emails immediately ONLY for COD or manual link fallback.
  // Live Stripe Checkout CARD orders dispatch verified receipt notifications when payment completes.
  const isLiveStripeSession = paymentMethod === 'CARD' && stripeConfig.mode === 'api_key';
  if (!isLiveStripeSession) {
    const adminDashboardUrl = `${baseUrl.replace(/\/$/, '')}/admin`;
    const emailData: OrderEmailData = {
      orderReference: finalOrder.orderReference,
      customer: finalOrder.customer,
      items: finalOrder.items,
      financials: finalOrder.financials,
      paymentMethod: finalOrder.paymentMethod,
      paymentStatus: finalOrder.paymentStatus,
      orderStatus: finalOrder.orderStatus,
      createdAt: finalOrder.createdAt,
    };

    dispatchOrderNotifications(emailData, adminDashboardUrl).catch((err) => {
      console.error('Background notification dispatch error:', err);
    });
  }

  return { success: true, order: finalOrder };
}

export async function verifyAndFinalizeStripePayment(params: {
  sessionId: string;
  orderReference?: string;
  baseUrl: string;
}): Promise<{
  success: boolean;
  paid: boolean;
  alreadyPaid?: boolean;
  order?: OrderRecord;
  error?: string;
  statusCode?: number;
}> {
  const sessionId = (params.sessionId || '').trim();
  if (!sessionId) {
    return { success: false, paid: false, statusCode: 400, error: 'Missing Stripe sessionId.' };
  }

  const sessionRes = await retrieveStripeCheckoutSession(sessionId);
  if (!sessionRes.success || !sessionRes.session) {
    return {
      success: false,
      paid: false,
      statusCode: 400,
      error: sessionRes.error || 'Unable to verify Stripe Checkout session.',
    };
  }

  const session = sessionRes.session;
  const candidateRef =
    (params.orderReference || '').trim() ||
    session.metadata?.orderReference ||
    session.client_reference_id ||
    session.metadata?.orderId ||
    '';

  let order = candidateRef ? await getOrderById(candidateRef) : null;
  if (!order) {
    order = await getOrderByStripeSessionId(session.id);
  }

  if (!order) {
    return {
      success: false,
      paid: false,
      statusCode: 404,
      error: 'Matching order dossier was not found for this Stripe session.',
    };
  }

  if (order.paymentStatus === 'REFUNDED') {
    return {
      success: false,
      paid: false,
      statusCode: 409,
      order,
      error: 'This order has already been refunded and cannot be re-confirmed as paid.',
    };
  }

  const integrity = verifyStripeSessionMatchesOrder(session, order);
  if (!integrity.valid) {
    const isUnpaid = session.payment_status !== 'paid';
    return {
      success: false,
      paid: false,
      statusCode: isUnpaid ? 402 : 400,
      order,
      error: integrity.reason || 'Stripe payment verification failed.',
    };
  }

  const paymentIntentId = extractPaymentIntentId(session.payment_intent);
  const amountPaidEur = Math.round((session.amount_total || 0) / 100);

  const finalizeRes = await markOrderPaidByStripeSession(order.id, {
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amountPaidEur,
  });

  if (!finalizeRes.success || !finalizeRes.order) {
    return {
      success: false,
      paid: false,
      statusCode: 500,
      error: finalizeRes.error || 'Failed to finalize verified Stripe payment.',
    };
  }

  if (finalizeRes.shouldSendEmail) {
    const adminDashboardUrl = `${params.baseUrl.replace(/\/$/, '')}/admin`;
    const emailData: OrderEmailData = {
      orderReference: finalizeRes.order.orderReference,
      customer: finalizeRes.order.customer,
      items: finalizeRes.order.items,
      financials: finalizeRes.order.financials,
      paymentMethod: finalizeRes.order.paymentMethod,
      paymentStatus: finalizeRes.order.paymentStatus,
      orderStatus: finalizeRes.order.orderStatus,
      createdAt: finalizeRes.order.createdAt,
    };

    dispatchOrderNotifications(emailData, adminDashboardUrl).catch((err) => {
      console.error('Background paid notification dispatch error:', err);
    });
  }

  return {
    success: true,
    paid: true,
    alreadyPaid: Boolean(finalizeRes.alreadyPaid),
    order: finalizeRes.order,
  };
}

export async function cancelAndReleaseStripeOrder(params: {
  sessionId?: string;
  orderReference?: string;
  baseUrl: string;
}): Promise<{
  success: boolean;
  cancelled: boolean;
  alreadyPaid?: boolean;
  order?: OrderRecord;
  error?: string;
  statusCode?: number;
}> {
  const sessionId = (params.sessionId || '').trim();
  const orderReference = (params.orderReference || '').trim();

  let order = orderReference ? await getOrderById(orderReference) : null;
  if (!order && sessionId) {
    order = await getOrderByStripeSessionId(sessionId);
  }

  if (!order) {
    return {
      success: true,
      cancelled: false,
    };
  }

  if (order.stripeSessionId && sessionId && order.stripeSessionId !== sessionId) {
    return {
      success: false,
      cancelled: false,
      statusCode: 400,
      error: 'Stripe session does not match the specified order reference.',
    };
  }

  // Race protection: verify with Stripe first whether the customer actually completed payment
  const targetSessionId = sessionId || order.stripeSessionId || '';
  if (targetSessionId && resolveStripeConfig().mode === 'api_key') {
    const stripeCheck = await retrieveStripeCheckoutSession(targetSessionId);
    if (stripeCheck.success && stripeCheck.session?.payment_status === 'paid') {
      const verifyResult = await verifyAndFinalizeStripePayment({
        sessionId: targetSessionId,
        orderReference: order.orderReference,
        baseUrl: params.baseUrl,
      });
      return {
        success: false,
        cancelled: false,
        alreadyPaid: true,
        order: verifyResult.order,
        statusCode: 409,
        error: 'Payment was already completed in Stripe Checkout.',
      };
    }

    // Expire open Stripe session so abandoned link cannot be used after inventory release
    await expireStripeCheckoutSession(targetSessionId);
  }

  const cancelRes = await cancelUnpaidStripeOrderRecord(
    order.id,
    'Customer exited Stripe Checkout prior to payment completion — inventory released.'
  );

  if (!cancelRes.success) {
    return {
      success: false,
      cancelled: false,
      alreadyPaid: cancelRes.alreadyPaid,
      order: cancelRes.order,
      statusCode: cancelRes.alreadyPaid ? 409 : 400,
      error: cancelRes.error,
    };
  }

  return {
    success: true,
    cancelled: Boolean(cancelRes.cancelled),
    order: cancelRes.order,
  };
}

import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import {
  validateCheckoutPayload,
  calculateAuthoritativeTotals,
} from '../src/server/validation';
import {
  generateCustomerEmail,
  generateAdminEmail,
  type OrderEmailData,
} from '../src/server/email-templates';

const FIRESTORE_DATABASE_ID =
  'ai-studio-noirscrolldriven-f315def4-d182-4618-969f-6da452cde3b7';
const ADMIN_EMAIL = 'noire.ireland@gmail.com';
const DEFAULT_FROM_EMAIL = 'Atelier NOIRÉ <onboarding@resend.dev>';

const DEFAULT_INVENTORY: Record<
  string,
  { availableStock: number; totalStock: number }
> = {
  carbon_S: { availableStock: 7, totalStock: 7 },
  carbon_M: { availableStock: 14, totalStock: 14 },
  carbon_L: { availableStock: 12, totalStock: 12 },
  carbon_XL: { availableStock: 6, totalStock: 6 },
  carbon_XXL: { availableStock: 2, totalStock: 2 },
  'blue-charcoal_S': { availableStock: 7, totalStock: 7 },
  'blue-charcoal_M': { availableStock: 14, totalStock: 14 },
  'blue-charcoal_L': { availableStock: 12, totalStock: 12 },
  'blue-charcoal_XL': { availableStock: 6, totalStock: 6 },
  'blue-charcoal_XXL': { availableStock: 2, totalStock: 2 },
};

function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      'Missing Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  let privateKey = rawPrivateKey.trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

function getNamedFirestoreDb(): Firestore {
  const app = getFirebaseAdminApp();
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings may already be applied across warm serverless invocations
  }
  return db;
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

async function sendOrderEmailsSafely(
  db: Firestore,
  order: OrderEmailData,
  adminDashboardUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      '[Resend Warning]: RESEND_API_KEY is not configured; skipping order confirmation emails.'
    );
    return;
  }

  const resend = new Resend(apiKey);
  const preferredFrom =
    process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;

  // 1. Customer confirmation email
  try {
    const { subject, text, html } = generateCustomerEmail(order);
    let sendResult = await resend.emails.send({
      from: preferredFrom,
      to: [order.customer.email],
      subject,
      text,
      html,
    });

    if (sendResult.error && preferredFrom !== DEFAULT_FROM_EMAIL) {
      const msg = (sendResult.error.message || '').toLowerCase();
      if (
        sendResult.error.name === 'validation_error' ||
        msg.includes('domain') ||
        msg.includes('verify')
      ) {
        sendResult = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: [order.customer.email],
          subject,
          text,
          html,
        });
      }
    }

    if (sendResult.error) {
      console.error(
        `[Resend Customer Email Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await db
      .collection('notificationJobs')
      .doc()
      .set({
        orderId: order.orderReference,
        recipientType: 'CUSTOMER',
        recipientEmail: order.customer.email,
        subject,
        status: sendResult.error ? 'FAILED' : 'SENT',
        error: sendResult.error ? sendResult.error.message : undefined,
        sentAt: sendResult.error ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .catch((logErr) => {
        console.error('[NotificationJob Log Error - Customer]:', logErr);
      });
  } catch (err) {
    console.error(
      `[Resend Customer Email Exception] (${order.orderReference}):`,
      err
    );
  }

  // 2. Admin notification email
  try {
    const { subject, text, html } = generateAdminEmail(
      order,
      adminDashboardUrl
    );
    let sendResult = await resend.emails.send({
      from: preferredFrom,
      to: [ADMIN_EMAIL],
      subject,
      text,
      html,
    });

    if (sendResult.error && preferredFrom !== DEFAULT_FROM_EMAIL) {
      const msg = (sendResult.error.message || '').toLowerCase();
      if (
        sendResult.error.name === 'validation_error' ||
        msg.includes('domain') ||
        msg.includes('verify')
      ) {
        sendResult = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: [ADMIN_EMAIL],
          subject,
          text,
          html,
        });
      }
    }

    if (sendResult.error) {
      console.error(
        `[Resend Admin Email Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await db
      .collection('notificationJobs')
      .doc()
      .set({
        orderId: order.orderReference,
        recipientType: 'ADMIN',
        recipientEmail: ADMIN_EMAIL,
        subject,
        status: sendResult.error ? 'FAILED' : 'SENT',
        error: sendResult.error ? sendResult.error.message : undefined,
        sentAt: sendResult.error ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .catch((logErr) => {
        console.error('[NotificationJob Log Error - Admin]:', logErr);
      });
  } catch (err) {
    console.error(
      `[Resend Admin Email Exception] (${order.orderReference}):`,
      err
    );
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({
      success: false,
      error: `Method ${req.method || 'UNKNOWN'} not allowed. Use POST.`,
    });
    return;
  }

  try {
    let parsedBody: unknown = req.body;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid JSON request body.',
          errors: ['Invalid JSON request body.'],
        });
        return;
      }
    }

    const validation = validateCheckoutPayload(parsedBody);
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({
        success: false,
        error: validation.errors.join(' ') || 'Invalid order details.',
        errors: validation.errors,
      });
      return;
    }

    const { customer, items, idempotencyKey } = validation.sanitized;
    const db = getNamedFirestoreDb();

    // 1. Idempotency check in Firestore
    if (idempotencyKey) {
      const existingSnapshot = await db
        .collection('orders')
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingOrder = existingDoc.data();
        res.status(201).json({
          success: true,
          orderId: existingDoc.id,
          orderReference: existingOrder.orderReference,
          order: {
            orderReference: existingOrder.orderReference,
            customer: existingOrder.customer,
            items: existingOrder.items,
            financials: existingOrder.financials,
            paymentMethod: existingOrder.paymentMethod,
            paymentStatus: existingOrder.paymentStatus,
            orderStatus: existingOrder.orderStatus,
            createdAt: existingOrder.createdAt,
          },
        });
        return;
      }
    }

    // 2. Server-side authoritative totals (never trust client totals)
    const financials = calculateAuthoritativeTotals(items);
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderReference = `NOIRE-88-COD-${randomSuffix}`;

    const itemsSnapshot = items.map((item) => ({
      colorway: item.colorway,
      colorwayName:
        item.colorway === 'blue-charcoal' ? 'Blue Charcoal' : 'Noir / Carbon',
      size: item.size,
      quantity: item.quantity,
      unitPriceEur: financials.unitPriceEur,
      subtotalEur: financials.unitPriceEur * item.quantity,
    }));

    const now = new Date().toISOString();
    const orderDocRef = db.collection('orders').doc();

    const newOrder = {
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
      financials,
      paymentMethod: 'COD' as const,
      paymentStatus: 'UNPAID' as const,
      orderStatus: 'NEW' as const,
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

    const settlementRecord = {
      orderId: orderDocRef.id,
      orderReference,
      expectedAmountEur: financials.totalEur,
      actualCollectedEur: 0,
      courierName: '',
      trackingNumber: '',
      collectionDate: null,
      settlementStatus: 'PENDING_COLLECTION',
      amountRemittedEur: 0,
      remittanceDate: null,
      outstandingAmountEur: financials.totalEur,
      reconciliationNotes:
        'Awaiting order fulfillment and courier assignment',
      reconciledBy: '',
      createdAt: now,
      updatedAt: now,
    };

    // 3. Atomic Firestore transaction for inventory + order + COD settlement
    try {
      await db.runTransaction(async (transaction) => {
        for (const item of newOrder.items) {
          const variantId = `${item.colorway}_${item.size}`;
          const invRef = db.collection('inventory').doc(variantId);
          const invDoc = await transaction.get(invRef);

          let available = DEFAULT_INVENTORY[variantId]?.availableStock ?? 5;
          let total = DEFAULT_INVENTORY[variantId]?.totalStock ?? 5;

          if (invDoc.exists) {
            const data = invDoc.data() || {};
            available =
              typeof data.availableStock === 'number'
                ? data.availableStock
                : available;
            total =
              typeof data.totalStock === 'number' ? data.totalStock : total;
          }

          if (available < item.quantity) {
            throw new Error(
              `STOCK_INSUFFICIENT: Insufficient stock for ${item.colorwayName} (${item.size}). Only ${available} remaining.`
            );
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

        transaction.set(orderDocRef, newOrder);
        transaction.set(
          db.collection('codSettlements').doc(orderDocRef.id),
          settlementRecord
        );
      });
    } catch (txErr: unknown) {
      const txMsg = txErr instanceof Error ? txErr.message : String(txErr);
      if (txMsg.startsWith('STOCK_INSUFFICIENT:')) {
        const cleanMsg = txMsg.replace('STOCK_INSUFFICIENT:', '').trim();
        res.status(400).json({
          success: false,
          error: cleanMsg,
          errors: [cleanMsg],
        });
        return;
      }
      throw txErr;
    }

    // 4. Send Resend confirmation emails (failure never fails the saved order)
    const protoHeader = req.headers['x-forwarded-proto'];
    const protocol =
      typeof protoHeader === 'string' ? protoHeader.split(',')[0] : 'https';
    const host =
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host']
        : req.headers.host) || 'atelier-noire.com';
    const adminDashboardUrl = `${protocol}://${host}/admin`;

    await sendOrderEmailsSafely(
      db,
      {
        orderReference: newOrder.orderReference,
        customer: newOrder.customer,
        items: newOrder.items,
        financials: newOrder.financials,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        orderStatus: newOrder.orderStatus,
        createdAt: newOrder.createdAt,
      },
      adminDashboardUrl
    );

    res.status(201).json({
      success: true,
      orderId: newOrder.id,
      orderReference: newOrder.orderReference,
      order: {
        orderReference: newOrder.orderReference,
        customer: newOrder.customer,
        items: newOrder.items,
        financials: newOrder.financials,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        orderStatus: newOrder.orderStatus,
        createdAt: newOrder.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error('Unhandled checkout error in /api/orders:', err);
    const message =
      err instanceof Error ? err.message : 'Internal order placement error.';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

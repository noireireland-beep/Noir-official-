import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import apiHandler from '../../api/[...route].js';
import {
  resolveStripeConfig,
  getSafeStripeStatus,
  verifyStripeWebhookSignature,
  verifyStripeSessionMatchesOrder,
  extractPaymentIntentId,
  isValidStripeSessionId,
  sanitizeStripeBaseUrl,
} from './stripe-service.js';
import {
  saveOrderAtomic,
  attachStripeSessionToOrder,
  markOrderPaidByStripeSession,
  cancelUnpaidStripeOrderRecord,
  checkIdempotentOrder,
  getInventorySnapshot,
  getOrderByStripeSessionId,
} from './storage-store.js';
import type { OrderRecord } from './orders-service.js';

const LOCAL_STORE_PATH = path.resolve(process.cwd(), '.local-store.json');

function withIsolatedLocalStore<T>(fn: () => Promise<T>): Promise<T> {
  const hadExisting = fs.existsSync(LOCAL_STORE_PATH);
  const previousContent = hadExisting ? fs.readFileSync(LOCAL_STORE_PATH, 'utf8') : null;
  return fn().finally(() => {
    if (hadExisting && previousContent !== null) {
      fs.writeFileSync(LOCAL_STORE_PATH, previousContent, 'utf8');
    } else if (fs.existsSync(LOCAL_STORE_PATH)) {
      fs.unlinkSync(LOCAL_STORE_PATH);
    }
  });
}

function buildSampleDraftOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  const now = new Date().toISOString();
  const id = overrides.id || `ord_test_${crypto.randomBytes(4).toString('hex')}`;
  const ref = overrides.orderReference || `NOIRE-88-CARD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return {
    id,
    orderReference: ref,
    customer: {
      fullName: 'Aoife Murphy',
      email: 'aoife@example.ie',
      phone: '+353 87 123 4567',
      streetAddress: '18 Baggot Street Lower',
      unitOrApartment: '',
      city: 'Dublin',
      county: 'Dublin',
      eircode: 'D02 X285',
      country: 'IE',
    },
    items: [
      {
        colorway: 'carbon',
        colorwayName: 'Noir / Carbon',
        size: 'L',
        quantity: 1,
        unitPriceEur: 88,
        subtotalEur: 88,
      },
    ],
    financials: {
      unitPriceEur: 88,
      subtotalEur: 88,
      shippingEur: 0,
      totalEur: 88,
      currency: 'EUR',
    },
    paymentMethod: 'CARD',
    paymentStatus: 'AWAITING_PAYMENT',
    orderStatus: 'NEW',
    statusHistory: [
      {
        status: 'NEW',
        note: 'Test order initialized',
        updatedBy: 'CUSTOMER',
        timestamp: now,
      },
    ],
    idempotencyKey: `idemp_test_${id}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('1. resolveStripeConfig detects STRIPE_SECRET_KEY, sk_ in STRIPE_CHECKOUT_URL, payment links, and placeholders', () => {
  const dummyTestKey = `sk_test_${'a'.repeat(24)}`;
  const dummyLiveKey = `sk_live_${'b'.repeat(24)}`;

  const resPrimary = resolveStripeConfig({ STRIPE_SECRET_KEY: dummyTestKey });
  assert.equal(resPrimary.mode, 'api_key');
  if (resPrimary.mode === 'api_key') {
    assert.equal(resPrimary.livemode, false);
    assert.equal(resPrimary.sourceVar, 'STRIPE_SECRET_KEY');
  }

  const resFallbackKey = resolveStripeConfig({ STRIPE_CHECKOUT_URL: dummyLiveKey });
  assert.equal(resFallbackKey.mode, 'api_key');
  if (resFallbackKey.mode === 'api_key') {
    assert.equal(resFallbackKey.livemode, true);
    assert.equal(resFallbackKey.sourceVar, 'STRIPE_CHECKOUT_URL');
  }

  const resLink = resolveStripeConfig({ STRIPE_CHECKOUT_URL: 'https://buy.stripe.com/test_123456' });
  assert.equal(resLink.mode, 'payment_link');

  const resPlaceholder = resolveStripeConfig({
    STRIPE_SECRET_KEY: 'REPLACE_WITH_STRIPE_SECRET_KEY',
    STRIPE_CHECKOUT_URL: '',
  });
  assert.equal(resPlaceholder.mode, 'unconfigured');
});

test('2. Stripe helpers validate session IDs, payment intent extraction, and base URL sanitization', () => {
  assert.equal(isValidStripeSessionId('cs_test_a1B2c3D4e5F6'), true);
  assert.equal(isValidStripeSessionId('cs_live_XYZ987654'), true);
  assert.equal(isValidStripeSessionId('pi_12345'), false);
  assert.equal(isValidStripeSessionId('../bad'), false);

  assert.equal(extractPaymentIntentId('pi_123abc'), 'pi_123abc');
  assert.equal(extractPaymentIntentId({ id: 'pi_obj_456' }), 'pi_obj_456');
  assert.equal(extractPaymentIntentId(null), undefined);

  assert.equal(sanitizeStripeBaseUrl('https://www.noireofficial.ie/'), 'https://www.noireofficial.ie');
  const prevAppUrl = process.env.APP_URL;
  try {
    process.env.APP_URL = 'https://staging.noireofficial.ie/';
    assert.equal(sanitizeStripeBaseUrl('invalid-origin'), 'https://staging.noireofficial.ie');
    delete process.env.APP_URL;
    assert.equal(sanitizeStripeBaseUrl('invalid-origin'), 'https://www.noireofficial.ie');
  } finally {
    if (typeof prevAppUrl === 'string') {
      process.env.APP_URL = prevAppUrl;
    } else {
      delete process.env.APP_URL;
    }
  }
});

test('3. verifyStripeWebhookSignature enforces HMAC-SHA256, replay window, and rejects tampered payloads', () => {
  const secret = 'whsec_test_super_secret_key_12345';
  const rawBody = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const nowSec = 1700000000;
  const sigHex = crypto
    .createHmac('sha256', secret)
    .update(`${nowSec}.${rawBody}`, 'utf8')
    .digest('hex');
  const validHeader = `t=${nowSec},v1=${sigHex}`;

  assert.equal(
    verifyStripeWebhookSignature({ rawBody, signatureHeader: validHeader, webhookSecret: secret, nowSec }).valid,
    true
  );

  // Tampered body
  assert.equal(
    verifyStripeWebhookSignature({
      rawBody: rawBody + ' ',
      signatureHeader: validHeader,
      webhookSecret: secret,
      nowSec,
    }).valid,
    false
  );

  // Replay timestamp outside 300s tolerance
  assert.equal(
    verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: validHeader,
      webhookSecret: secret,
      nowSec: nowSec + 601,
    }).valid,
    false
  );

  // Missing header or placeholder secret
  assert.equal(
    verifyStripeWebhookSignature({ rawBody, signatureHeader: undefined, webhookSecret: secret, nowSec }).valid,
    false
  );
  assert.equal(
    verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: validHeader,
      webhookSecret: 'REPLACE_WITH_STRIPE_WEBHOOK_SECRET',
      nowSec,
    }).valid,
    false
  );
});

test('4. verifyStripeSessionMatchesOrder enforces paid status, EUR currency, exact amount, and metadata match', () => {
  const order = {
    id: 'ord_123',
    orderReference: 'NOIRE-88-CARD-ABC123',
    stripeSessionId: 'cs_test_session_001',
    financials: { totalEur: 88, currency: 'EUR' },
  };

  const validSession = {
    id: 'cs_test_session_001',
    url: 'https://checkout.stripe.com/c/pay/cs_test_session_001',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 8800,
    currency: 'eur',
    client_reference_id: 'NOIRE-88-CARD-ABC123',
    metadata: { orderId: 'ord_123', orderReference: 'NOIRE-88-CARD-ABC123' },
  };

  assert.equal(verifyStripeSessionMatchesOrder(validSession, order).valid, true);

  // Rejects unpaid session
  assert.equal(
    verifyStripeSessionMatchesOrder({ ...validSession, payment_status: 'unpaid' }, order).valid,
    false
  );

  // Rejects partial/tampered amount
  assert.equal(
    verifyStripeSessionMatchesOrder({ ...validSession, amount_total: 100 }, order).valid,
    false
  );

  // Rejects wrong currency
  assert.equal(
    verifyStripeSessionMatchesOrder({ ...validSession, currency: 'usd' }, order).valid,
    false
  );

  // Rejects mismatched Stripe session ID
  assert.equal(
    verifyStripeSessionMatchesOrder({ ...validSession, id: 'cs_test_wrong_session' }, order).valid,
    false
  );

  // Rejects mismatched metadata reference
  assert.equal(
    verifyStripeSessionMatchesOrder(
      {
        ...validSession,
        client_reference_id: 'NOIRE-OTHER',
        metadata: { orderId: 'ord_999', orderReference: 'NOIRE-OTHER' },
      },
      order
    ).valid,
    false
  );
});

test('5. Atomic payment finalization & double-notification prevention in storage-store', async () => {
  await withIsolatedLocalStore(async () => {
    const beforeStock = await getInventorySnapshot();
    const initialCarbonL = beforeStock['carbon_L'];

    const order = buildSampleDraftOrder();
    const saveRes = await saveOrderAtomic(order, {
      orderId: order.id,
      orderReference: order.orderReference,
      expectedAmountEur: 88,
      actualCollectedEur: 0,
      settlementStatus: 'AWAITING_STRIPE_PAYMENT',
      amountRemittedEur: 0,
      outstandingAmountEur: 88,
    });
    assert.equal(saveRes.success, true);

    const afterReserve = await getInventorySnapshot();
    assert.equal(afterReserve['carbon_L'], initialCarbonL - 1);

    const attachRes = await attachStripeSessionToOrder(
      order.id,
      'cs_test_atomic_pay_001',
      'https://checkout.stripe.com/pay/cs_test_atomic_pay_001'
    );
    assert.equal(attachRes.success, true);

    const foundBySession = await getOrderByStripeSessionId('cs_test_atomic_pay_001');
    assert.equal(foundBySession?.orderReference, order.orderReference);

    // First payment verification (e.g. from webhook)
    const payFirst = await markOrderPaidByStripeSession(order.orderReference, {
      stripeSessionId: 'cs_test_atomic_pay_001',
      stripePaymentIntentId: 'pi_test_001',
      amountPaidEur: 88,
    });
    assert.equal(payFirst.success, true);
    assert.equal(payFirst.alreadyPaid, false);
    assert.equal(payFirst.shouldSendEmail, true);
    assert.equal(payFirst.order?.paymentStatus, 'PAID');
    assert.equal(payFirst.order?.orderStatus, 'CONFIRMED');

    // Second payment verification (e.g. simultaneous customer browser return)
    const paySecond = await markOrderPaidByStripeSession(order.id, {
      stripeSessionId: 'cs_test_atomic_pay_001',
      stripePaymentIntentId: 'pi_test_001',
      amountPaidEur: 88,
    });
    assert.equal(paySecond.success, true);
    assert.equal(paySecond.alreadyPaid, true);
    assert.equal(paySecond.shouldSendEmail, false);

    // Cannot cancel a PAID order
    const cancelPaid = await cancelUnpaidStripeOrderRecord(order.id, 'Attempted cancel after pay');
    assert.equal(cancelPaid.success, false);
    assert.equal(cancelPaid.alreadyPaid, true);
  });
});

test('6. Cancelling unpaid Stripe order restores inventory and allows clean retry with idempotency check', async () => {
  await withIsolatedLocalStore(async () => {
    const beforeStock = await getInventorySnapshot();
    const initialCarbonL = beforeStock['carbon_L'];

    const idempKey = 'idemp_cancel_retry_001';
    const order = buildSampleDraftOrder({ idempotencyKey: idempKey });
    await saveOrderAtomic(order, {
      orderId: order.id,
      orderReference: order.orderReference,
      expectedAmountEur: 88,
      actualCollectedEur: 0,
      settlementStatus: 'AWAITING_STRIPE_PAYMENT',
      amountRemittedEur: 0,
      outstandingAmountEur: 88,
    });

    assert.equal((await getInventorySnapshot())['carbon_L'], initialCarbonL - 1);
    assert.equal((await checkIdempotentOrder(idempKey))?.orderReference, order.orderReference);

    // Cancel unpaid reservation
    const cancelRes = await cancelUnpaidStripeOrderRecord(order.id, 'Customer cancelled checkout');
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.cancelled, true);
    assert.equal(cancelRes.order?.orderStatus, 'CANCELLED');

    // Stock restored immediately
    assert.equal((await getInventorySnapshot())['carbon_L'], initialCarbonL);

    // Cancelled order is skipped by checkIdempotentOrder so retries succeed cleanly
    assert.equal(await checkIdempotentOrder(idempKey), null);

    // Second cancel is a safe idempotent no-op without double-restoring stock
    const cancelAgain = await cancelUnpaidStripeOrderRecord(order.id, 'Duplicate cancel');
    assert.equal(cancelAgain.success, true);
    assert.equal(cancelAgain.cancelled, false);
    assert.equal((await getInventorySnapshot())['carbon_L'], initialCarbonL);
  });
});

test('7. getSafeStripeStatus accurately reports webhookConfigured and key mode without exposing secrets', () => {
  const dummyKey = `sk_test_${'k'.repeat(24)}`;
  const dummyWhsec = `whsec_${'w'.repeat(24)}`;

  const statusReady = getSafeStripeStatus({
    STRIPE_SECRET_KEY: dummyKey,
    STRIPE_WEBHOOK_SECRET: dummyWhsec,
  });
  assert.equal(statusReady.configured, true);
  assert.equal(statusReady.mode, 'api_key');
  assert.equal(statusReady.livemode, false);
  assert.equal(statusReady.webhookConfigured, true);

  const statusMissingWh = getSafeStripeStatus({
    STRIPE_SECRET_KEY: dummyKey,
    STRIPE_WEBHOOK_SECRET: 'REPLACE_WITH_STRIPE_WEBHOOK_SECRET',
  });
  assert.equal(statusMissingWh.configured, true);
  assert.equal(statusMissingWh.webhookConfigured, false);
});

test('8. Multi-item and duplicate-variant orders aggregate stock accurately and roll back cleanly', async () => {
  await withIsolatedLocalStore(async () => {
    const beforeStock = await getInventorySnapshot();
    const initialCarbonL = beforeStock['carbon_L'];
    const initialBlueM = beforeStock['blue-charcoal_M'];

    const order = buildSampleDraftOrder({
      items: [
        { colorway: 'carbon', colorwayName: 'Noir / Carbon', size: 'L', quantity: 1, unitPriceEur: 88, subtotalEur: 88 },
        { colorway: 'carbon', colorwayName: 'Noir / Carbon', size: 'L', quantity: 2, unitPriceEur: 88, subtotalEur: 176 },
        { colorway: 'blue-charcoal', colorwayName: 'Blue Charcoal', size: 'M', quantity: 1, unitPriceEur: 88, subtotalEur: 88 },
      ],
      financials: { unitPriceEur: 88, subtotalEur: 352, shippingEur: 0, totalEur: 352, currency: 'EUR' },
    });

    const saveRes = await saveOrderAtomic(order, {
      orderId: order.id,
      orderReference: order.orderReference,
      expectedAmountEur: 352,
      actualCollectedEur: 0,
      settlementStatus: 'AWAITING_STRIPE_PAYMENT',
      amountRemittedEur: 0,
      outstandingAmountEur: 352,
    });
    assert.equal(saveRes.success, true);

    const midStock = await getInventorySnapshot();
    assert.equal(midStock['carbon_L'], initialCarbonL - 3);
    assert.equal(midStock['blue-charcoal_M'], initialBlueM - 1);

    const cancelRes = await cancelUnpaidStripeOrderRecord(order.id, 'Multi-item cancellation');
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.cancelled, true);

    const endStock = await getInventorySnapshot();
    assert.equal(endStock['carbon_L'], initialCarbonL);
    assert.equal(endStock['blue-charcoal_M'], initialBlueM);
  });
});

test('9. Vercel /api/stripe/webhook reads exact formatted raw bytes from PassThrough stream even when req.body lazy getter exists', async () => {
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const testSecret = `whsec_test_${'z'.repeat(24)}`;
  process.env.STRIPE_WEBHOOK_SECRET = testSecret;

  try {
    // Pretty-printed JSON with whitespace (matches real Stripe webhook formatting)
    const rawStripePayload = JSON.stringify(
      {
        id: 'evt_test_pretty',
        type: 'payment_intent.created',
        data: { object: { id: 'pi_ignored' } },
      },
      null,
      2
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const sigHex = crypto
      .createHmac('sha256', testSecret)
      .update(`${nowSec}.${rawStripePayload}`, 'utf8')
      .digest('hex');

    const restoredStream = new PassThrough();
    restoredStream.write(rawStripePayload);
    restoredStream.end();

    const mockReq: any = {
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: {
        'stripe-signature': `t=${nowSec},v1=${sigHex}`,
        'content-type': 'application/json',
      },
      readableEnded: true,
      read: restoredStream.read.bind(restoredStream),
    };
    // Simulate Vercel lazy req.body returning parsed JS object (would break HMAC if stringified)
    Object.defineProperty(mockReq, 'body', {
      get() {
        return JSON.parse(rawStripePayload);
      },
      configurable: true,
    });

    let statusCode = 0;
    let responseJson: any = null;
    const mockRes: any = {
      setHeader() {},
      status(code: number) {
        statusCode = code;
        return mockRes;
      },
      json(data: unknown) {
        responseJson = data;
        return mockRes;
      },
      end() {},
    };

    await apiHandler(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.deepEqual(responseJson, { received: true });
  } finally {
    if (typeof prevSecret === 'string') {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  }
});

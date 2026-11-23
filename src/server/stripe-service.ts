import crypto from 'node:crypto';
import { isPlaceholderEnvValue } from './firebase-admin.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export type StripeConfigResolution =
  | {
      mode: 'api_key';
      apiKey: string;
      livemode: boolean;
      sourceVar: 'STRIPE_SECRET_KEY' | 'STRIPE_CHECKOUT_URL';
    }
  | {
      mode: 'payment_link';
      url: string;
      sourceVar: 'STRIPE_CHECKOUT_URL';
    }
  | {
      mode: 'unconfigured';
      livemode: null;
    };

export interface StripeCheckoutLineItemInput {
  colorway: 'carbon' | 'blue-charcoal';
  colorwayName: string;
  size: string;
  quantity: number;
  unitPriceEur: number;
}

export interface CreateStripeSessionInput {
  orderId: string;
  orderReference: string;
  customerEmail: string;
  customerName: string;
  items: StripeCheckoutLineItemInput[];
  totalEur: number;
  baseUrl: string;
  idempotencyKey?: string;
}

export interface StripeCheckoutSessionObject {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | string | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required' | string;
  amount_total: number | null;
  currency: string | null;
  client_reference_id?: string | null;
  customer_email?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string>;
  livemode?: boolean;
}

function isStripeSecretKeyFormat(value: string): boolean {
  return /^(sk|rk)_(test|live)_[a-zA-Z0-9]{16,}$/.test(value);
}

export function isValidStripeSessionId(sessionId: string): boolean {
  return /^cs_(test|live)_[a-zA-Z0-9]+$/.test((sessionId || '').trim());
}

export function resolveStripeConfig(
  env: Record<string, string | undefined> = process.env
): StripeConfigResolution {
  const rawSecretKey = (env.STRIPE_SECRET_KEY || '').trim();
  if (!isPlaceholderEnvValue(rawSecretKey) && isStripeSecretKeyFormat(rawSecretKey)) {
    return {
      mode: 'api_key',
      apiKey: rawSecretKey,
      livemode: rawSecretKey.includes('_live_'),
      sourceVar: 'STRIPE_SECRET_KEY',
    };
  }

  const rawCheckoutUrlOrKey = (env.STRIPE_CHECKOUT_URL || '').trim();
  if (!isPlaceholderEnvValue(rawCheckoutUrlOrKey)) {
    if (isStripeSecretKeyFormat(rawCheckoutUrlOrKey)) {
      return {
        mode: 'api_key',
        apiKey: rawCheckoutUrlOrKey,
        livemode: rawCheckoutUrlOrKey.includes('_live_'),
        sourceVar: 'STRIPE_CHECKOUT_URL',
      };
    }

    if (/^https:\/\/.+/i.test(rawCheckoutUrlOrKey)) {
      return {
        mode: 'payment_link',
        url: rawCheckoutUrlOrKey,
        sourceVar: 'STRIPE_CHECKOUT_URL',
      };
    }
  }

  return {
    mode: 'unconfigured',
    livemode: null,
  };
}

export function getSafeStripeStatus(
  env: Record<string, string | undefined> = process.env
): {
  configured: boolean;
  mode: 'api_key' | 'payment_link' | 'unconfigured';
  livemode: boolean | null;
  webhookConfigured: boolean;
} {
  const cfg = resolveStripeConfig(env);
  const rawWebhook = (env.STRIPE_WEBHOOK_SECRET || '').trim();
  const webhookConfigured =
    !isPlaceholderEnvValue(rawWebhook) && /^whsec_[a-zA-Z0-9]+/.test(rawWebhook);

  return {
    configured: cfg.mode !== 'unconfigured',
    mode: cfg.mode,
    livemode: cfg.mode === 'api_key' ? cfg.livemode : null,
    webhookConfigured,
  };
}

export function sanitizeStripeBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[^/\s]+/i.test(candidate)) {
    return candidate;
  }
  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[^/\s]+/i.test(appUrl) && !isPlaceholderEnvValue(appUrl)) {
    return appUrl;
  }
  return 'https://www.noireofficial.ie';
}

export async function createStripeCheckoutSession(
  input: CreateStripeSessionInput
): Promise<{
  success: boolean;
  session?: StripeCheckoutSessionObject;
  error?: string;
}> {
  const config = resolveStripeConfig();
  if (config.mode !== 'api_key') {
    return {
      success: false,
      error: 'Stripe secret API key is not configured.',
    };
  }

  const computedTotalCents = input.items.reduce(
    (sum, item) => sum + Math.round(item.unitPriceEur * 100) * item.quantity,
    0
  );
  const expectedTotalCents = Math.round(input.totalEur * 100);

  if (computedTotalCents <= 0 || computedTotalCents !== expectedTotalCents) {
    return {
      success: false,
      error: 'Checkout amount integrity check failed prior to Stripe session creation.',
    };
  }

  const origin = sanitizeStripeBaseUrl(input.baseUrl);
  const encodedRef = encodeURIComponent(input.orderReference);
  const successUrl = `${origin}/?stripe_status=success&session_id={CHECKOUT_SESSION_ID}&order_ref=${encodedRef}`;
  const cancelUrl = `${origin}/?stripe_status=cancelled&session_id={CHECKOUT_SESSION_ID}&order_ref=${encodedRef}`;

  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('customer_email', input.customerEmail);
  body.set('client_reference_id', input.orderReference);
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  // 30 minutes expiry (Stripe minimum allowed) prevents indefinite stock lock on abandoned sessions
  body.set('expires_at', String(Math.floor(Date.now() / 1000) + 30 * 60));
  body.set('billing_address_collection', 'auto');

  body.set('metadata[orderId]', input.orderId);
  body.set('metadata[orderReference]', input.orderReference);
  body.set('metadata[customerName]', input.customerName.slice(0, 120));
  body.set('metadata[customerEmail]', input.customerEmail);

  body.set('payment_intent_data[description]', `Atelier NOIRÉ — ${input.orderReference}`);
  body.set('payment_intent_data[metadata][orderId]', input.orderId);
  body.set('payment_intent_data[metadata][orderReference]', input.orderReference);

  input.items.forEach((item, idx) => {
    const unitAmountCents = Math.round(item.unitPriceEur * 100);
    body.set(`line_items[${idx}][quantity]`, String(item.quantity));
    body.set(`line_items[${idx}][price_data][currency]`, 'eur');
    body.set(`line_items[${idx}][price_data][unit_amount]`, String(unitAmountCents));
    body.set(
      `line_items[${idx}][price_data][product_data][name]`,
      `Atelier NOIRÉ Archive Tracksuit — ${item.colorwayName} (Size ${item.size})`
    );
    body.set(
      `line_items[${idx}][price_data][product_data][description]`,
      '390 GSM Loopback Hoodie & 280 GSM Structured Trousers · Archival Box, Certificate of Origin & Embroidered Tote Bag'
    );
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = `an_cs_${input.orderReference}_${input.idempotencyKey}`.slice(0, 240);
  }

  try {
    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    const data = (await response.json()) as StripeCheckoutSessionObject & {
      error?: { message?: string; type?: string; code?: string };
    };

    if (!response.ok || !data?.id || !data?.url) {
      const msg = data?.error?.message || `Stripe Checkout session failed (${response.status}).`;
      return { success: false, error: msg };
    }

    if (
      data.amount_total !== expectedTotalCents ||
      (data.currency || '').toLowerCase() !== 'eur'
    ) {
      return {
        success: false,
        error: 'Stripe returned a mismatched session amount or currency.',
      };
    }

    return { success: true, session: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unable to reach Stripe Checkout API.',
    };
  }
}

export async function retrieveStripeCheckoutSession(
  sessionId: string
): Promise<{
  success: boolean;
  session?: StripeCheckoutSessionObject;
  error?: string;
}> {
  const cleanId = (sessionId || '').trim();
  if (!isValidStripeSessionId(cleanId)) {
    return { success: false, error: 'Invalid Stripe Checkout session identifier.' };
  }

  const config = resolveStripeConfig();
  if (config.mode !== 'api_key') {
    return { success: false, error: 'Stripe API key is not configured on this server.' };
  }

  try {
    const response = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(cleanId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }
    );

    const data = (await response.json()) as StripeCheckoutSessionObject & {
      error?: { message?: string };
    };

    if (!response.ok || !data?.id) {
      return {
        success: false,
        error: data?.error?.message || `Unable to retrieve Stripe session (${response.status}).`,
      };
    }

    return { success: true, session: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Stripe verification network error.',
    };
  }
}

export async function expireStripeCheckoutSession(sessionId: string): Promise<{
  success: boolean;
  expired?: boolean;
  error?: string;
}> {
  const cleanId = (sessionId || '').trim();
  if (!isValidStripeSessionId(cleanId)) {
    return { success: false, error: 'Invalid Stripe session identifier.' };
  }

  const config = resolveStripeConfig();
  if (config.mode !== 'api_key') {
    return { success: false, error: 'Stripe API key is not configured.' };
  }

  try {
    const response = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(cleanId)}/expire`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }
    );
    const data = (await response.json()) as {
      status?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      const msg = data?.error?.message || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('complete')) {
        return { success: true, expired: true };
      }
      return { success: false, error: msg || `Failed to expire session (${response.status}).` };
    }

    return { success: true, expired: data?.status === 'expired' };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to expire Stripe session.',
    };
  }
}

export function extractPaymentIntentId(
  paymentIntent: StripeCheckoutSessionObject['payment_intent']
): string | undefined {
  if (!paymentIntent) return undefined;
  if (typeof paymentIntent === 'string') return paymentIntent;
  if (typeof paymentIntent === 'object' && typeof paymentIntent.id === 'string') {
    return paymentIntent.id;
  }
  return undefined;
}

export function verifyStripeSessionMatchesOrder(
  session: StripeCheckoutSessionObject,
  order: {
    id: string;
    orderReference: string;
    stripeSessionId?: string;
    financials: { totalEur: number; currency: string };
  }
): { valid: boolean; reason?: string } {
  if (order.stripeSessionId && order.stripeSessionId !== session.id) {
    return {
      valid: false,
      reason: 'Stripe session ID does not match the recorded order session.',
    };
  }

  if (session.payment_status !== 'paid') {
    return {
      valid: false,
      reason: `Payment status is "${session.payment_status || 'unpaid'}", expected "paid".`,
    };
  }

  const expectedCents = Math.round((order.financials?.totalEur || 0) * 100);
  if (session.amount_total !== expectedCents) {
    return {
      valid: false,
      reason: `Paid amount (${session.amount_total}) does not match expected €${order.financials.totalEur}.00 (${expectedCents} cents).`,
    };
  }

  if ((session.currency || '').toLowerCase() !== 'eur') {
    return {
      valid: false,
      reason: `Unexpected currency "${session.currency}", expected "eur".`,
    };
  }

  const metaRef = session.metadata?.orderReference || session.client_reference_id;
  const metaOrderId = session.metadata?.orderId;
  if (metaRef !== order.orderReference && metaOrderId !== order.id) {
    return {
      valid: false,
      reason: 'Stripe session metadata does not reference this order.',
    };
  }

  return { valid: true };
}

export function verifyStripeWebhookSignature(params: {
  rawBody: string;
  signatureHeader?: string;
  webhookSecret?: string;
  toleranceSec?: number;
  nowSec?: number;
}): { valid: boolean; error?: string } {
  const { rawBody, signatureHeader, webhookSecret, toleranceSec = 300 } = params;
  const secret = (webhookSecret || '').trim();
  if (!secret || isPlaceholderEnvValue(secret)) {
    return { valid: false, error: 'Stripe webhook secret is not configured.' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, error: 'Missing Stripe-Signature header.' };
  }

  const parts = signatureHeader.split(',').map((s) => s.trim());
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const k = part.slice(0, eqIndex);
    const v = part.slice(eqIndex + 1);
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }

  const parsedTs = Number(timestamp);
  if (!Number.isFinite(parsedTs) || signatures.length === 0) {
    return { valid: false, error: 'Malformed Stripe-Signature header.' };
  }

  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsedTs) > toleranceSec) {
    return { valid: false, error: 'Stripe webhook timestamp outside replay tolerance.' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  for (const sig of signatures) {
    if (!/^[0-9a-f]+$/i.test(sig)) continue;
    const candidateBuf = Buffer.from(sig, 'hex');
    if (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return { valid: true };
    }
  }

  return { valid: false, error: 'Stripe webhook signature mismatch.' };
}

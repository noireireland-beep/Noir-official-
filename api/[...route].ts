import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  verifyAdminRequest,
  getAdminDashboardStats,
  listAdminOrders,
  updateOrderStatus,
  reconcileCodSettlement,
  ADMIN_ALLOWLIST,
  ADMIN_CONFIGURED_PASSWORD,
  createAdminSessionToken,
} from '../src/server/admin-service.js';
import {
  isPlaceholderEnvValue,
} from '../src/server/firebase-admin.js';
import {
  getInventorySnapshot,
  getOrderById,
  getNotificationJobsForOrder,
} from '../src/server/storage-store.js';
import { resendCustomerEmail } from '../src/server/notifications.js';
import {
  verifyAndFinalizeStripePayment,
  cancelAndReleaseStripeOrder,
} from '../src/server/orders-service.js';
import {
  getSafeStripeStatus,
  verifyStripeWebhookSignature,
} from '../src/server/stripe-service.js';

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function resolveRequestOrigin(req: VercelRequest): string {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && /^https?:\/\/[^/\s]+$/i.test(originHeader.trim())) {
    return originHeader.trim().replace(/\/+$/, '');
  }
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0].trim() : '') ||
    (typeof req.headers.host === 'string' ? req.headers.host.trim() : '') ||
    'www.noireofficial.ie';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const protocol =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : isLocalHost
      ? 'http'
      : 'https';
  return `${protocol}://${host}`;
}

function parseJsonBody(rawBody: unknown): Record<string, unknown> {
  if (!rawBody) return {};
  if (Buffer.isBuffer(rawBody)) {
    try {
      return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof rawBody === 'object') {
    return rawBody as Record<string, unknown>;
  }
  return {};
}

async function resolveRawWebhookBody(req: VercelRequest): Promise<string> {
  const reqWithRaw = req as VercelRequest & { rawBody?: unknown };
  if (typeof reqWithRaw.rawBody === 'string') {
    return reqWithRaw.rawBody;
  }
  if (Buffer.isBuffer(reqWithRaw.rawBody)) {
    return reqWithRaw.rawBody.toString('utf8');
  }

  // Read Vercel's restored PassThrough stream (req.read) BEFORE touching lazy req.body getter
  if (typeof req.read === 'function') {
    const syncChunks: Buffer[] = [];
    let chunk: unknown;
    while ((chunk = req.read()) !== null) {
      syncChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    if (syncChunks.length > 0) {
      return Buffer.concat(syncChunks).toString('utf8');
    }
  }

  if (
    !req.readableEnded &&
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    typeof req[Symbol.asyncIterator] === 'function'
  ) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length > 0) {
      return Buffer.concat(chunks).toString('utf8');
    }
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }
  return '';
}

async function resolveRequestBody(req: VercelRequest): Promise<unknown> {
  if (typeof req.body !== 'undefined') {
    return req.body;
  }
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS' ||
    req.readableEnded ||
    typeof req[Symbol.asyncIterator] !== 'function'
  ) {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function getSubPath(req: VercelRequest): string {
  const rawUrl = (req.url || '').split('?')[0];
  const isCatchAllTemplatePath = /(\[|%5B)\.\.\.route(\]|%5D)/i.test(rawUrl);
  if (rawUrl.startsWith('/api') && !isCatchAllTemplatePath) {
    return rawUrl.slice(4) || '/';
  }
  const routeParam = req.query?.['...route'] ?? req.query?.route;
  if (Array.isArray(routeParam) && routeParam.length > 0) {
    const joined = routeParam
      .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
    return joined ? `/${joined}` : '/';
  }
  if (typeof routeParam === 'string' && routeParam.trim().length > 0) {
    const normalized = routeParam.trim().replace(/^\/+/, '');
    return normalized ? `/${normalized}` : '/';
  }
  if (rawUrl.startsWith('/api')) {
    return rawUrl.slice(4) || '/';
  }
  return rawUrl || '/';
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

  const subPath = getSubPath(req);
  const method = (req.method || 'GET').toUpperCase();

  try {
    // ── GET /api/inventory ────────────────────────────────────────────────────
    if (subPath === '/inventory' && method === 'GET') {
      const stock = await getInventorySnapshot();
      res.status(200).json({ success: true, stock });
      return;
    }

    // ── GET /api/stripe/status ────────────────────────────────────────────────
    if (subPath === '/stripe/status' && method === 'GET') {
      res.status(200).json({
        success: true,
        ...getSafeStripeStatus(),
      });
      return;
    }

    // ── POST /api/stripe/verify-session ───────────────────────────────────────
    if (subPath === '/stripe/verify-session' && method === 'POST') {
      const body = parseJsonBody(await resolveRequestBody(req));
      const result = await verifyAndFinalizeStripePayment({
        sessionId: String(body.sessionId || ''),
        orderReference: typeof body.orderReference === 'string' ? body.orderReference : undefined,
        baseUrl: resolveRequestOrigin(req),
      });

      if (!result.success || !result.order) {
        res.status(result.statusCode || 400).json({
          success: false,
          paid: result.paid,
          error: result.error || 'Unable to verify Stripe payment.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        paid: true,
        alreadyPaid: Boolean(result.alreadyPaid),
        order: {
          orderReference: result.order.orderReference,
          customer: result.order.customer,
          items: result.order.items,
          financials: result.order.financials,
          paymentMethod: result.order.paymentMethod,
          paymentStatus: result.order.paymentStatus,
          stripeSessionId: result.order.stripeSessionId,
          orderStatus: result.order.orderStatus,
          createdAt: result.order.createdAt,
        },
      });
      return;
    }

    // ── POST /api/stripe/cancel-session ───────────────────────────────────────
    if (subPath === '/stripe/cancel-session' && method === 'POST') {
      const body = parseJsonBody(await resolveRequestBody(req));
      const result = await cancelAndReleaseStripeOrder({
        sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
        orderReference: typeof body.orderReference === 'string' ? body.orderReference : undefined,
        baseUrl: resolveRequestOrigin(req),
      });

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          cancelled: false,
          alreadyPaid: Boolean(result.alreadyPaid),
          order: result.order,
          error: result.error || 'Unable to cancel reservation.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        cancelled: result.cancelled,
        orderReference: result.order?.orderReference,
      });
      return;
    }

    // ── POST /api/stripe/webhook ──────────────────────────────────────────────
    if (subPath === '/stripe/webhook' && method === 'POST') {
      const rawBody = await resolveRawWebhookBody(req);

      const sigHeader =
        typeof req.headers['stripe-signature'] === 'string'
          ? req.headers['stripe-signature']
          : undefined;
      const sigCheck = verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: sigHeader,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      });

      if (!sigCheck.valid) {
        res.status(400).json({ success: false, error: sigCheck.error });
        return;
      }

      const event = parseJsonBody(rawBody) as {
        type?: string;
        data?: { object?: { id?: string; metadata?: Record<string, string>; client_reference_id?: string } };
      };
      const sessionObj = event?.data?.object;
      const sessionId = sessionObj?.id;
      const orderReference = sessionObj?.metadata?.orderReference || sessionObj?.client_reference_id;

      if (
        (event?.type === 'checkout.session.completed' ||
          event?.type === 'checkout.session.async_payment_succeeded') &&
        sessionId
      ) {
        await verifyAndFinalizeStripePayment({
          sessionId,
          orderReference,
          baseUrl: resolveRequestOrigin(req),
        });
      } else if (
        (event?.type === 'checkout.session.expired' ||
          event?.type === 'checkout.session.async_payment_failed') &&
        (sessionId || orderReference)
      ) {
        await cancelAndReleaseStripeOrder({
          sessionId,
          orderReference,
          baseUrl: resolveRequestOrigin(req),
        });
      }

      res.status(200).json({ received: true });
      return;
    }

    // ── POST /api/admin/login ─────────────────────────────────────────────────
    if (subPath === '/admin/login' && method === 'POST') {
      const body = parseJsonBody(await resolveRequestBody(req));
      const normalizedEmail = String(body.email || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '');

      if (!normalizedEmail) {
        res.status(400).json({
          success: false,
          field: 'email',
          error: 'Archive administrator email is required.',
        });
        return;
      }

      if (!ADMIN_ALLOWLIST.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
        res.status(401).json({
          success: false,
          field: 'email',
          error: 'Unrecognized administrator credentials. Access denied.',
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          success: false,
          field: 'password',
          error: 'Archive security password is required.',
        });
        return;
      }

      if (password !== ADMIN_CONFIGURED_PASSWORD) {
        res.status(401).json({
          success: false,
          field: 'password',
          error: 'Incorrect security key. Access denied.',
        });
        return;
      }

      const token = createAdminSessionToken(normalizedEmail);
      res.status(200).json({
        success: true,
        token,
        user: {
          email: normalizedEmail,
          role: 'SUPER_ADMIN',
        },
      });
      return;
    }

    // ── PROTECTED ADMIN ROUTES ────────────────────────────────────────────────
    if (subPath.startsWith('/admin/')) {
      const authHeader =
        typeof req.headers.authorization === 'string'
          ? req.headers.authorization
          : undefined;
      const authCheck = await verifyAdminRequest(authHeader);

      if (!authCheck.authorized || !authCheck.context) {
        const isUnauthenticated =
          !authHeader ||
          (authCheck.error &&
            authCheck.error.toLowerCase().includes('unauthorized'));
        res.status(isUnauthenticated ? 401 : 403).json({
          success: false,
          error: authCheck.error || 'Administrator authorization required.',
        });
        return;
      }

      // GET /api/admin/stats
      if (subPath === '/admin/stats' && method === 'GET') {
        const stats = await getAdminDashboardStats();
        res.status(200).json({ success: true, stats });
        return;
      }

      // GET /api/admin/orders
      if (subPath === '/admin/orders' && method === 'GET') {
        const status =
          typeof req.query?.status === 'string' ? req.query.status : undefined;
        const paymentStatus =
          typeof req.query?.paymentStatus === 'string'
            ? req.query.paymentStatus
            : undefined;
        const search =
          typeof req.query?.search === 'string' ? req.query.search : undefined;
        const orders = await listAdminOrders({
          status,
          paymentStatus,
          search,
        });
        res.status(200).json({ success: true, orders });
        return;
      }

      // GET /api/admin/email-status
      if (subPath === '/admin/email-status' && method === 'GET') {
        const hasApiKey = !isPlaceholderEnvValue(process.env.RESEND_API_KEY);
        const fromEmail = !isPlaceholderEnvValue(process.env.RESEND_FROM_EMAIL)
          ? process.env.RESEND_FROM_EMAIL!.trim()
          : 'Atelier NOIRÉ <onboarding@resend.dev>';
        const isCustomDomain =
          fromEmail !== 'Atelier NOIRÉ <onboarding@resend.dev>' &&
          !fromEmail.includes('@resend.dev');

        res.status(200).json({
          success: true,
          hasApiKey,
          fromEmail,
          isCustomDomain,
          mode: hasApiKey
            ? isCustomDomain
              ? 'LIVE_CUSTOM_DOMAIN'
              : 'LIVE_SANDBOX'
            : 'SIMULATION_LOGGED',
        });
        return;
      }

      // PATCH /api/admin/orders/:id/status
      const statusMatch = subPath.match(/^\/admin\/orders\/([^/]+)\/status$/);
      if (statusMatch && method === 'PATCH') {
        const orderId = decodeURIComponent(statusMatch[1]);
        const body = parseJsonBody(await resolveRequestBody(req));
        const status = body.status as string | undefined;
        const note = typeof body.note === 'string' ? body.note : undefined;

        if (!status) {
          res
            .status(400)
            .json({ success: false, error: 'Missing status parameter.' });
          return;
        }

        const result = await updateOrderStatus(
          orderId,
          status as Parameters<typeof updateOrderStatus>[1],
          authCheck.context.email,
          note
        );
        if (!result.success) {
          res.status(400).json({ success: false, error: result.error });
          return;
        }
        res.status(200).json({ success: true, order: result.order });
        return;
      }

      // POST /api/admin/orders/:id/reconcile
      const reconcileMatch = subPath.match(
        /^\/admin\/orders\/([^/]+)\/reconcile$/
      );
      if (reconcileMatch && method === 'POST') {
        const orderId = decodeURIComponent(reconcileMatch[1]);
        const body = parseJsonBody(await resolveRequestBody(req));

        const result = await reconcileCodSettlement(
          orderId,
          {
            courierName: String(body.courierName || ''),
            trackingNumber: String(body.trackingNumber || ''),
            actualCollectedEur: Number(body.actualCollectedEur) || 0,
            settlementStatus: String(
              body.settlementStatus || 'PENDING_COLLECTION'
            ) as Parameters<typeof reconcileCodSettlement>[1]['settlementStatus'],
            amountRemittedEur: Number(body.amountRemittedEur) || 0,
            remittanceDate:
              typeof body.remittanceDate === 'string'
                ? body.remittanceDate
                : undefined,
            reconciliationNotes:
              typeof body.reconciliationNotes === 'string'
                ? body.reconciliationNotes
                : undefined,
          },
          authCheck.context.email
        );

        if (!result.success) {
          res.status(400).json({ success: false, error: result.error });
          return;
        }
        res.status(200).json({
          success: true,
          message: 'COD reconciliation recorded successfully.',
        });
        return;
      }

      // POST /api/admin/orders/:id/resend-email OR /api/admin/resend-email
      const resendMatch = subPath.match(
        /^\/admin\/orders\/([^/]+)\/resend-email$/
      );
      if ((resendMatch || subPath === '/admin/resend-email') && method === 'POST') {
        const body = parseJsonBody(await resolveRequestBody(req));
        const orderId = resendMatch
          ? decodeURIComponent(resendMatch[1])
          : String(body.orderId || req.query?.id || req.query?.orderId || '');

        if (!orderId) {
          res.status(400).json({ success: false, error: 'Missing orderId parameter.' });
          return;
        }

        const order = await getOrderById(orderId);
        if (!order) {
          res.status(404).json({ success: false, error: 'Order not found.' });
          return;
        }

        const result = await resendCustomerEmail({
          orderReference: order.orderReference,
          customer: order.customer,
          items: order.items,
          financials: order.financials,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          createdAt: order.createdAt,
        });
        const jobs = await getNotificationJobsForOrder(order.orderReference);

        res.status(200).json({
          success: result.success,
          status: result.status,
          recipient: result.recipient,
          error: result.error,
          jobs,
        });
        return;
      }
    }

    res.status(404).json({
      success: false,
      error: `API endpoint ${method} ${subPath} not found.`,
    });
  } catch (err: unknown) {
    console.error(`Unhandled error in /api${subPath}:`, err);
    const message =
      err instanceof Error ? err.message : 'Internal server error.';
    res.status(500).json({ success: false, error: message });
  }
}

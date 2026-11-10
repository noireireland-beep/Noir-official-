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
} from '../src/server/admin-service';
import { getAdminDb } from '../src/server/firebase-admin';

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function parseJsonBody(rawBody: unknown): Record<string, unknown> {
  if (!rawBody) return {};
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

function getSubPath(req: VercelRequest): string {
  const rawUrl = (req.url || '').split('?')[0];
  if (rawUrl.startsWith('/api')) {
    return rawUrl.slice(4) || '/';
  }
  const routeParam = req.query?.route;
  if (Array.isArray(routeParam)) {
    return '/' + routeParam.join('/');
  }
  if (typeof routeParam === 'string' && routeParam.length > 0) {
    return '/' + routeParam;
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
      const db = getAdminDb();
      const snapshot = await db.collection('inventory').get();
      const stock: Record<string, number> = {};
      snapshot.forEach((doc) => {
        stock[doc.id] = (doc.data().availableStock as number) ?? 0;
      });
      res.status(200).json({ success: true, stock });
      return;
    }

    // ── POST /api/admin/login ─────────────────────────────────────────────────
    if (subPath === '/admin/login' && method === 'POST') {
      const body = parseJsonBody(req.body);
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
        const hasApiKey = Boolean(
          process.env.RESEND_API_KEY &&
            process.env.RESEND_API_KEY.trim().length > 0
        );
        const fromEmail =
          process.env.RESEND_FROM_EMAIL ||
          'Atelier NOIRÉ <onboarding@resend.dev>';
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
        const body = parseJsonBody(req.body);
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
        const body = parseJsonBody(req.body);

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

      // POST /api/admin/orders/:id/resend-email
      const resendMatch = subPath.match(
        /^\/admin\/orders\/([^/]+)\/resend-email$/
      );
      if (resendMatch && method === 'POST') {
        const orderId = decodeURIComponent(resendMatch[1]);
        const { getOrderById, getNotificationJobsForOrder } = await import(
          '../src/server/storage-store'
        );
        const { resendCustomerEmail } = await import(
          '../src/server/notifications'
        );

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

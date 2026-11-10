import { Router, Request, Response } from 'express';
import { createOrder } from './orders-service';
import {
  verifyAdminRequest,
  getAdminDashboardStats,
  listAdminOrders,
  updateOrderStatus,
  reconcileCodSettlement,
  ADMIN_ALLOWLIST,
  ADMIN_CONFIGURED_PASSWORD,
  createAdminSessionToken,
} from './admin-service';
import { getAdminDb } from './firebase-admin';
import { createRateLimiter } from './rate-limiter';

export const apiRouter = Router();

// Rate Limiter for customer checkout (max 10 orders per 10 minutes per IP)
const orderRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Order submission limit reached. Please wait a few moments before placing another order.',
});

// Rate Limiter for administrative endpoints (max 100 requests per minute per IP)
const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Administrator request limit reached. Please wait a moment.',
});

// ── CUSTOMER ENDPOINTS ────────────────────────────────────────────────────────

// Live stock availability
apiRouter.get('/inventory', async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('inventory').get();
    const stock: Record<string, number> = {};

    snapshot.forEach((doc: any) => {
      stock[doc.id] = doc.data().availableStock ?? 0;
    });

    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve inventory.' });
  }
});

// Checkout Order Placement (Protected with rate limiting & server validation)
apiRouter.post('/orders', orderRateLimiter, async (req: Request, res: Response) => {
  try {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const result = await createOrder(req.body, baseUrl);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Order placement failed.',
        errors: result.errors,
      });
      return;
    }

    res.status(201).json({
      success: true,
      order: {
        orderReference: result.order?.orderReference,
        customer: result.order?.customer,
        items: result.order?.items,
        financials: result.order?.financials,
        paymentMethod: result.order?.paymentMethod,
        paymentStatus: result.order?.paymentStatus,
        orderStatus: result.order?.orderStatus,
        createdAt: result.order?.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error('Unhandled checkout error in /api/orders:', err);
    res.status(500).json({ success: false, error: 'Internal order placement server error.' });
  }
});

// ── PROTECTED ADMIN ENDPOINTS ─────────────────────────────────────────────────

// Admin Authorization Middleware (strictly checks token, email allowlist, and custom claims)
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const authCheck = await verifyAdminRequest(authHeader);

  if (!authCheck.authorized || !authCheck.context) {
    const isUnauthenticated = !authHeader || (authCheck.error && authCheck.error.toLowerCase().includes('unauthorized'));
    res.status(isUnauthenticated ? 401 : 403).json({
      success: false,
      error: authCheck.error || 'Administrator authorization required.',
    });
    return;
  }

  (req as Request & { adminContext: typeof authCheck.context }).adminContext = authCheck.context;
  next();
}

// Attach rate limiter to all admin routes
apiRouter.use('/admin', adminRateLimiter);

// Admin Authentication (Verifies allowlist & configured password, returns HMAC session token)
apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    res.status(400).json({
      success: false,
      field: 'email',
      error: 'Archive administrator email is required.',
    });
    return;
  }

  if (!ADMIN_ALLOWLIST.map(e => e.toLowerCase()).includes(normalizedEmail)) {
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
  res.json({
    success: true,
    token,
    user: {
      email: normalizedEmail,
      role: 'SUPER_ADMIN',
    },
  });
});

// Admin Stats
apiRouter.get('/admin/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminDashboardStats();
    res.json({ success: true, stats });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to calculate admin stats.' });
  }
});

// Admin Orders List
apiRouter.get('/admin/orders', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus, search } = req.query;
    const orders = await listAdminOrders({
      status: typeof status === 'string' ? status : undefined,
      paymentStatus: typeof paymentStatus === 'string' ? paymentStatus : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    res.json({ success: true, orders });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to retrieve orders.' });
  }
});

// Admin Update Order Status
apiRouter.patch('/admin/orders/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminEmail = (req as Request & { adminContext: { email: string } }).adminContext.email;

    if (!status) {
      res.status(400).json({ success: false, error: 'Missing status parameter.' });
      return;
    }

    const result = await updateOrderStatus(id, status, adminEmail, note);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, order: result.order });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to update order status.' });
  }
});

// Admin COD Reconciliation
apiRouter.post('/admin/orders/:id/reconcile', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as Request & { adminContext: { email: string } }).adminContext.email;
    const {
      courierName,
      trackingNumber,
      actualCollectedEur,
      settlementStatus,
      amountRemittedEur,
      remittanceDate,
      reconciliationNotes,
    } = req.body;

    const result = await reconcileCodSettlement(
      id,
      {
        courierName: courierName || '',
        trackingNumber: trackingNumber || '',
        actualCollectedEur: Number(actualCollectedEur) || 0,
        settlementStatus,
        amountRemittedEur: Number(amountRemittedEur) || 0,
        remittanceDate,
        reconciliationNotes,
      },
      adminEmail
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: 'COD reconciliation recorded successfully.' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to record COD reconciliation.' });
  }
});

// Admin Email Service Health & Environment Status
apiRouter.get('/admin/email-status', requireAdmin, async (_req: Request, res: Response) => {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Atelier NOIRÉ <onboarding@resend.dev>';
  const isCustomDomain = fromEmail !== 'Atelier NOIRÉ <onboarding@resend.dev>' && !fromEmail.includes('@resend.dev');

  res.json({
    success: true,
    hasApiKey,
    fromEmail,
    isCustomDomain,
    mode: hasApiKey ? (isCustomDomain ? 'LIVE_CUSTOM_DOMAIN' : 'LIVE_SANDBOX') : 'SIMULATION_LOGGED',
  });
});

// Admin Resend Customer Email
apiRouter.post('/admin/orders/:id/resend-email', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getOrderById, getNotificationJobsForOrder } = await import('./storage-store');
    const { resendCustomerEmail } = await import('./notifications');

    const order = await getOrderById(id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found.' });
      return;
    }

    const emailData = {
      orderReference: order.orderReference,
      customer: order.customer,
      items: order.items,
      financials: order.financials,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt,
    };

    const result = await resendCustomerEmail(emailData);
    const jobs = await getNotificationJobsForOrder(order.orderReference);

    res.json({
      success: result.success,
      status: result.status,
      recipient: result.recipient,
      error: result.error,
      jobs,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: `Failed to resend confirmation: ${errorMsg}` });
  }
});


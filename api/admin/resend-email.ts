import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest } from '../../src/server/admin-service.js';
import { getOrderById, getNotificationJobsForOrder } from '../../src/server/storage-store.js';
import { resendCustomerEmail } from '../../src/server/notifications.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false }> {
  let raw: unknown = req.body;
  if (typeof raw === 'undefined' && !req.readableEnded && typeof req[Symbol.asyncIterator] === 'function') {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    raw = Buffer.concat(buffers).toString('utf8');
  }
  if (Buffer.isBuffer(raw)) {
    raw = raw.toString('utf8');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      return { ok: true, data: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {} };
    } catch {
      return { ok: false };
    }
  }
  if (raw && typeof raw === 'object') {
    return { ok: true, data: raw as Record<string, unknown> };
  }
  return { ok: true, data: {} };
}

export default async function handler(
  req: IncomingMessage & { body?: unknown; headers: Record<string, string | string[] | undefined>; url?: string; method?: string },
  res: ServerResponse
): Promise<void> {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  try {
    const authHeader = req.headers['authorization'] as string | undefined;
    const authCheck = await verifyAdminRequest(authHeader);

    if (!authCheck.authorized || !authCheck.context) {
      const isUnauthenticated =
        !authHeader ||
        Boolean(authCheck.error && authCheck.error.toLowerCase().includes('unauthorized'));
      res.statusCode = isUnauthenticated ? 401 : 403;
      res.end(JSON.stringify({ success: false, error: authCheck.error || 'Unauthorized' }));
      return;
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
      return;
    }

    const body = bodyResult.data;
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const orderId = String(body.orderId || parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('orderId') || '');

    if (!orderId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing orderId parameter.' }));
      return;
    }

    const order = await getOrderById(orderId);
    if (!order) {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: 'Order not found.' }));
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

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: result.success,
        status: result.status,
        recipient: result.recipient,
        error: result.error,
        jobs,
      })
    );
  } catch (err: unknown) {
    console.error('Unhandled error in /api/admin/resend-email:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal error resending email.',
      })
    );
  }
}

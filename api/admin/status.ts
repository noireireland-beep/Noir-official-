import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest, updateOrderStatus } from '../../src/server/admin-service.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, POST, OPTIONS');
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

export default async function handler(req: IncomingMessage & { body?: unknown; headers: Record<string, string | string[] | undefined>; url?: string }, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
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
      res.end(JSON.stringify({ success: false, error: 'Malformed JSON' }));
      return;
    }

    const parsedBody = bodyResult.data as { status?: string; note?: string; orderId?: string };
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const orderId = parsedBody?.orderId || parsedUrl.searchParams.get('id') || '';

    if (!orderId || !parsedBody?.status) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing orderId or status' }));
      return;
    }

    const result = await updateOrderStatus(orderId, parsedBody.status as any, authCheck.context.email, parsedBody.note);

    if (!result.success) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: result.error }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, order: result.order }));
  } catch (err: unknown) {
    console.error('Unhandled error in /api/admin/status:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Failed to update status' }));
  }
}

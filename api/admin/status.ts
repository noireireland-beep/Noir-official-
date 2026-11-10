import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest, updateOrderStatus } from '../../src/server/admin-service';

export default async function handler(req: IncomingMessage & { body?: unknown; headers: Record<string, string | string[] | undefined>; url?: string }, res: ServerResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const authHeader = req.headers['authorization'] as string | undefined;
  const authCheck = await verifyAdminRequest(authHeader);

  res.setHeader('Content-Type', 'application/json');
  if (!authCheck.authorized || !authCheck.context) {
    res.statusCode = 403;
    res.end(JSON.stringify({ success: false, error: authCheck.error || 'Unauthorized' }));
    return;
  }

  let body = req.body as { status?: string; note?: string; orderId?: string } | undefined;
  if (!body) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const raw = Buffer.concat(buffers).toString();
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Malformed JSON' }));
      return;
    }
  }

  const parsedUrl = new URL(req.url || '', 'http://localhost');
  const orderId = body?.orderId || parsedUrl.searchParams.get('id') || '';

  if (!orderId || !body?.status) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: 'Missing orderId or status' }));
    return;
  }

  const result = await updateOrderStatus(orderId, body.status as any, authCheck.context.email, body.note);

  if (!result.success) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: result.error }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, order: result.order }));
}

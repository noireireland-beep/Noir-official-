import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest, reconcileCodSettlement } from '../../src/server/admin-service';

export default async function handler(req: IncomingMessage & { body?: unknown; headers: Record<string, string | string[] | undefined>; url?: string }, res: ServerResponse) {
  if (req.method !== 'POST') {
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

  let body = req.body as any;
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

  if (!orderId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: 'Missing orderId' }));
    return;
  }

  const result = await reconcileCodSettlement(
    orderId,
    {
      courierName: body.courierName || '',
      trackingNumber: body.trackingNumber || '',
      actualCollectedEur: Number(body.actualCollectedEur) || 0,
      settlementStatus: body.settlementStatus,
      amountRemittedEur: Number(body.amountRemittedEur) || 0,
      remittanceDate: body.remittanceDate,
      reconciliationNotes: body.reconciliationNotes,
    },
    authCheck.context.email
  );

  if (!result.success) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: result.error }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, message: 'Reconciliation recorded' }));
}

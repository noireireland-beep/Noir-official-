import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest, listAdminOrders } from '../../src/server/admin-service';

export default async function handler(req: IncomingMessage & { headers: Record<string, string | string[] | undefined>; url?: string }, res: ServerResponse) {
  const authHeader = req.headers['authorization'] as string | undefined;
  const authCheck = await verifyAdminRequest(authHeader);

  res.setHeader('Content-Type', 'application/json');
  if (!authCheck.authorized) {
    res.statusCode = 403;
    res.end(JSON.stringify({ success: false, error: authCheck.error || 'Unauthorized' }));
    return;
  }

  try {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const status = parsedUrl.searchParams.get('status') || undefined;
    const paymentStatus = parsedUrl.searchParams.get('paymentStatus') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;

    const orders = await listAdminOrders({ status, paymentStatus, search });
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, orders }));
  } catch (err: unknown) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Failed to retrieve orders' }));
  }
}

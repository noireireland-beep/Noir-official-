import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { verifyAdminRequest, listAdminOrders } from '../../src/server/admin-service.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default async function handler(
  req: IncomingMessage & { headers: Record<string, string | string[] | undefined>; url?: string; method?: string },
  res: ServerResponse
) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const authHeader = req.headers['authorization'] as string | undefined;
    const authCheck = await verifyAdminRequest(authHeader);

    if (!authCheck.authorized) {
      const isUnauthenticated =
        !authHeader ||
        Boolean(authCheck.error && authCheck.error.toLowerCase().includes('unauthorized'));
      res.statusCode = isUnauthenticated ? 401 : 403;
      res.end(JSON.stringify({ success: false, error: authCheck.error || 'Unauthorized' }));
      return;
    }

    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const status = parsedUrl.searchParams.get('status') || undefined;
    const paymentStatus = parsedUrl.searchParams.get('paymentStatus') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;

    const orders = await listAdminOrders({ status, paymentStatus, search });
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, orders }));
  } catch (err: unknown) {
    console.error('Unhandled error in /api/admin/orders:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve orders',
      })
    );
  }
}

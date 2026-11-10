import type { IncomingMessage, ServerResponse } from 'http';
import { verifyAdminRequest, getAdminDashboardStats } from '../../src/server/admin-service';

export default async function handler(req: IncomingMessage & { headers: Record<string, string | string[] | undefined> }, res: ServerResponse) {
  const authHeader = req.headers['authorization'] as string | undefined;
  const authCheck = await verifyAdminRequest(authHeader);

  res.setHeader('Content-Type', 'application/json');
  if (!authCheck.authorized) {
    res.statusCode = 403;
    res.end(JSON.stringify({ success: false, error: authCheck.error || 'Unauthorized' }));
    return;
  }

  try {
    const stats = await getAdminDashboardStats();
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, stats }));
  } catch (err: unknown) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Failed to calculate stats' }));
  }
}

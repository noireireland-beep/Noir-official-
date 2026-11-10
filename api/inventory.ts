import type { IncomingMessage, ServerResponse } from 'http';
import { getAdminDb } from '../src/server/firebase-admin';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('inventory').get();
    const stock: Record<string, number> = {};

    snapshot.forEach((doc: any) => {
      stock[doc.id] = doc.data().availableStock ?? 0;
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, stock }));
  } catch (err: unknown) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Failed to retrieve inventory' }));
  }
}

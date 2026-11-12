import type { IncomingMessage, ServerResponse } from 'http';
import { getInventorySnapshot } from '../src/server/storage-store.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const stock = await getInventorySnapshot();

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, stock }));
  } catch (err: unknown) {
    console.error('Unhandled error in /api/inventory:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Failed to retrieve inventory' }));
  }
}

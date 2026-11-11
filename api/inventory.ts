import type { IncomingMessage, ServerResponse } from 'http';
import { getInventorySnapshot } from '../src/server/storage-store';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const stock = await getInventorySnapshot();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, stock }));
  } catch (err: unknown) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Failed to retrieve inventory' }));
  }
}

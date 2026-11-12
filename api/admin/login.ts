import type { IncomingMessage, ServerResponse } from 'http';
import {
  ADMIN_ALLOWLIST,
  ADMIN_CONFIGURED_PASSWORD,
  createAdminSessionToken,
} from '../../src/server/admin-service.js';

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
  req: IncomingMessage & { body?: unknown; headers: Record<string, string | string[] | undefined>; method?: string },
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
    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
      return;
    }

    const body = bodyResult.data;
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!normalizedEmail) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          success: false,
          field: 'email',
          error: 'Archive administrator email is required.',
        })
      );
      return;
    }

    if (!ADMIN_ALLOWLIST.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          success: false,
          field: 'email',
          error: 'Unrecognized administrator credentials. Access denied.',
        })
      );
      return;
    }

    if (!password) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          success: false,
          field: 'password',
          error: 'Archive security password is required.',
        })
      );
      return;
    }

    if (password !== ADMIN_CONFIGURED_PASSWORD) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          success: false,
          field: 'password',
          error: 'Incorrect security key. Access denied.',
        })
      );
      return;
    }

    const token = createAdminSessionToken(normalizedEmail);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        token,
        user: {
          email: normalizedEmail,
          role: 'SUPER_ADMIN',
        },
      })
    );
  } catch (err: unknown) {
    console.error('Unhandled error in /api/admin/login:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal login error.',
      })
    );
  }
}

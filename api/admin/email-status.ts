import type { IncomingMessage, ServerResponse } from 'http';
import { verifyAdminRequest } from '../../src/server/admin-service.js';
import { isPlaceholderEnvValue } from '../../src/server/firebase-admin.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default async function handler(
  req: IncomingMessage & { headers: Record<string, string | string[] | undefined>; method?: string },
  res: ServerResponse
): Promise<void> {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
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

    const hasApiKey = !isPlaceholderEnvValue(process.env.RESEND_API_KEY);
    const fromEmail = !isPlaceholderEnvValue(process.env.RESEND_FROM_EMAIL)
      ? process.env.RESEND_FROM_EMAIL!.trim()
      : 'Atelier NOIRÉ <onboarding@resend.dev>';
    const isCustomDomain =
      fromEmail !== 'Atelier NOIRÉ <onboarding@resend.dev>' &&
      !fromEmail.includes('@resend.dev');

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        hasApiKey,
        fromEmail,
        isCustomDomain,
        mode: hasApiKey
          ? isCustomDomain
            ? 'LIVE_CUSTOM_DOMAIN'
            : 'LIVE_SANDBOX'
          : 'SIMULATION_LOGGED',
      })
    );
  } catch (err: unknown) {
    console.error('Unhandled error in /api/admin/email-status:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal error checking email status.',
      })
    );
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createOrder } from '../src/server/orders-service.js';

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function resolveRequestOrigin(req: VercelRequest): string {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && /^https?:\/\/[^/\s]+$/i.test(originHeader.trim())) {
    return originHeader.trim().replace(/\/+$/, '');
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0].trim() : '') ||
    (typeof req.headers.host === 'string' ? req.headers.host.trim() : '') ||
    'www.noireofficial.ie';

  const forwardedProto = req.headers['x-forwarded-proto'];
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const protocol =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : isLocalHost
      ? 'http'
      : 'https';

  return `${protocol}://${host}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({
      success: false,
      error: `Method ${req.method || 'UNKNOWN'} not allowed. Use POST.`,
    });
    return;
  }

  try {
    let parsedBody: unknown = req.body;
    if (Buffer.isBuffer(parsedBody)) {
      parsedBody = parsedBody.toString('utf8');
    }
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = parsedBody ? JSON.parse(parsedBody) : {};
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid JSON request body.',
          errors: ['Invalid JSON request body.'],
        });
        return;
      }
    }

    const baseUrl = resolveRequestOrigin(req);
    const result = await createOrder(parsedBody, baseUrl);

    if (!result.success || !result.order) {
      const errorList = result.errors?.length
        ? result.errors
        : [result.error || 'Order placement failed.'];
      res.status(result.statusCode || 400).json({
        success: false,
        error: result.error || errorList.join(' '),
        errors: errorList,
      });
      return;
    }

    const order = result.order;
    res.status(201).json({
      success: true,
      orderId: order.id,
      orderReference: order.orderReference,
      stripeSessionId: order.stripeSessionId,
      checkoutUrl: order.checkoutUrl,
      order: {
        orderReference: order.orderReference,
        customer: order.customer,
        items: order.items,
        financials: order.financials,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        stripeSessionId: order.stripeSessionId,
        checkoutUrl: order.checkoutUrl,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error('Unhandled checkout error in /api/orders:', err);
    const message =
      err instanceof Error ? err.message : 'Internal order placement error.';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

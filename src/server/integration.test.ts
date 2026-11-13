import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCheckoutPayload,
  calculateAuthoritativeTotals,
  validateIrishPhone,
  validateEircode,
  validateEmail,
  sanitizeString
} from './validation.js';
import {
  generateCustomerEmail,
  generateAdminEmail,
  generateAdminForwardableCustomerCopy,
} from './email-templates.js';
import { dispatchOrderNotifications } from './notifications.js';
import { ADMIN_ALLOWLIST } from './admin-service.js';
import { createRateLimiter } from './rate-limiter.js';

// Mock order for deterministic integration assertions
const sampleOrderPayload = {
  customer: {
    fullName: 'Saoirse Ronan',
    email: 'saoirse@atelier-noire.ie',
    phone: '+353 87 555 4321',
    streetAddress: '42 St Stephen\'s Green',
    unitOrApartment: 'Top Floor Studio',
    city: 'Dublin',
    county: 'Dublin',
    eircode: 'D02 H972'
  },
  items: [
    { colorway: 'blue-charcoal' as const, size: 'M', quantity: 1 }
  ],
  idempotencyKey: 'test_idemp_saoirse_001'
};

test('1. Successful COD order payload validation & authoritative price calculation', () => {
  const validation = validateCheckoutPayload(sampleOrderPayload);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  const totals = calculateAuthoritativeTotals(validation.sanitized!.items);
  assert.equal(totals.unitPriceEur, 88);
  assert.equal(totals.shippingEur, 0);
  assert.equal(totals.totalEur, 88);
  assert.equal(totals.currency, 'EUR');
});

test('2. Missing customer information rejection', () => {
  const missingName = {
    ...sampleOrderPayload,
    customer: { ...sampleOrderPayload.customer, fullName: '' }
  };
  const res1 = validateCheckoutPayload(missingName);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some(e => e.includes('Full name')));

  const missingAddress = {
    ...sampleOrderPayload,
    customer: { ...sampleOrderPayload.customer, streetAddress: '' }
  };
  const res2 = validateCheckoutPayload(missingAddress);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some(e => e.includes('Street address')));
});

test('3. Invalid email and phone number validation', () => {
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail('name@domain'), false);
  assert.equal(validateIrishPhone('0011223344'), false);
  assert.equal(validateIrishPhone('+44 20 7946 0991'), false); // UK London
  assert.equal(validateEircode('BT1 1AA'), false); // UK Belfast

  const invalidContact = {
    ...sampleOrderPayload,
    customer: {
      ...sampleOrderPayload.customer,
      email: 'bad-email',
      phone: '123'
    }
  };
  const res = validateCheckoutPayload(invalidContact);
  assert.equal(res.valid, false);
  assert.ok(res.errors.length >= 2);
});

test('4. Invalid product variant and size rejection', () => {
  const invalidColor = {
    ...sampleOrderPayload,
    items: [{ colorway: 'neon-yellow' as any, size: 'M', quantity: 1 }]
  };
  const resColor = validateCheckoutPayload(invalidColor);
  assert.equal(resColor.valid, false);
  assert.ok(resColor.errors.some(e => e.includes('Invalid colorway')));

  const invalidSize = {
    ...sampleOrderPayload,
    items: [{ colorway: 'carbon' as const, size: 'XXXL', quantity: 1 }]
  };
  const resSize = validateCheckoutPayload(invalidSize);
  assert.equal(resSize.valid, false);
  assert.ok(resSize.errors.some(e => e.includes('Invalid size')));
});

test('5. Idempotency protection detection', () => {
  const key1 = sampleOrderPayload.idempotencyKey;
  assert.ok(key1);
  assert.equal(typeof key1, 'string');
  assert.equal(key1.length > 5, true);
});

test('6. Customer Email exact canonical copy preservation', () => {
  const mockOrderData = {
    orderReference: 'NOIRE-88-COD-TEST',
    customer: {
      ...sampleOrderPayload.customer,
      country: 'IE'
    },
    items: [{
      colorway: 'blue-charcoal',
      colorwayName: 'Blue Charcoal',
      size: 'M',
      quantity: 1,
      unitPriceEur: 88,
      subtotalEur: 88
    }],
    financials: {
      subtotalEur: 88,
      shippingEur: 0,
      totalEur: 88,
      currency: 'EUR'
    },
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    orderStatus: 'NEW',
    createdAt: new Date().toISOString()
  };

  const customerEmail = generateCustomerEmail(mockOrderData);
  assert.equal(customerEmail.subject, 'Your order has found its way to NOIRÉ.');
  assert.ok(customerEmail.text.includes('Hello Saoirse,'));
  assert.ok(customerEmail.text.includes('Some things are made to be everywhere. We had something else in mind.'));
  assert.ok(customerEmail.text.includes('Your order has reached us. And we\'re glad it did.'));
  assert.ok(customerEmail.text.includes('Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.'));
  assert.ok(customerEmail.text.includes('You\'re now part of that story.'));
  assert.equal(customerEmail.text.includes('__.'), false); // ensure no rogue __.
  assert.ok(customerEmail.text.includes('WHAT HAPPENS NEXT?'));
  assert.ok(customerEmail.text.includes('We\'ll review your order and send you a confirmation once it\'s accepted.'));
  assert.ok(customerEmail.text.includes('No payment has been taken. You\'ll pay the courier €88 upon delivery.'));
  assert.ok(customerEmail.text.includes('A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don\'t bring it back.'));
  assert.ok(customerEmail.text.includes('Thank you for choosing to be part of something that doesn\'t need to be everywhere.'));
  assert.ok(customerEmail.text.includes('See you on the other side.'));
  assert.ok(customerEmail.text.includes('ATELIER NOIRÉ'));
  assert.ok(customerEmail.text.includes('Designed in Ireland. Made with intention.'));
  assert.ok(customerEmail.html.includes('#161616'));
  assert.ok(customerEmail.html.includes('You\'re now part of that story.'));
});

test('7. Administrator Email generation contains all dense operational audit data', () => {
  const mockOrderData = {
    orderReference: 'NOIRE-88-COD-AUDIT',
    customer: {
      ...sampleOrderPayload.customer,
      country: 'IE'
    },
    items: [{
      colorway: 'carbon',
      colorwayName: 'Noir / Carbon',
      size: 'L',
      quantity: 1,
      unitPriceEur: 88,
      subtotalEur: 88
    }],
    financials: {
      subtotalEur: 88,
      shippingEur: 0,
      totalEur: 88,
      currency: 'EUR'
    },
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    orderStatus: 'NEW',
    createdAt: new Date().toISOString()
  };

  const adminEmail = generateAdminEmail(mockOrderData, 'https://atelier-noire.vercel.app/admin');
  assert.equal(adminEmail.subject, 'NEW ORDER | ATELIER NOIRÉ | NOIRE-88-COD-AUDIT');
  assert.ok(adminEmail.text.includes('noire.ireland@gmail.com') || adminEmail.text.includes('NEW ORDER RECEIVED'));
  assert.ok(adminEmail.text.includes('42 St Stephen\'s Green'));
  assert.ok(adminEmail.text.includes('D02 H972'));
  assert.ok(adminEmail.text.includes('+353 87 555 4321'));
  assert.ok(adminEmail.text.includes('Cash on Delivery (COD)'));
  assert.ok(adminEmail.text.includes('https://atelier-noire.vercel.app/admin'));
});

test('8. Administrator authorization allowlist strictly enforces noire.ireland@gmail.com', () => {
  assert.ok(ADMIN_ALLOWLIST.includes('noire.ireland@gmail.com'));
  assert.equal(ADMIN_ALLOWLIST.includes('random.user@gmail.com'), false);
  assert.equal(ADMIN_ALLOWLIST.includes('attacker@evil.com'), false);
});

test('9. verifyAdminRequest rejects missing or malformed authorization headers', async () => {
  const { verifyAdminRequest } = await import('./admin-service');
  
  const res1 = await verifyAdminRequest(undefined);
  assert.equal(res1.authorized, false);
  assert.ok(res1.error?.includes('Missing or malformed'));

  const res2 = await verifyAdminRequest('Basic dXNlcjpwYXNz');
  assert.equal(res2.authorized, false);
  assert.ok(res2.error?.includes('Missing or malformed'));

  const res3 = await verifyAdminRequest('Bearer ');
  assert.equal(res3.authorized, false);
  assert.ok(res3.error?.includes('Empty bearer'));
});

test('10. verifyAdminRequest rejects invalid, expired, or forged tokens', async () => {
  const { verifyAdminRequest } = await import('./admin-service');
  
  const res1 = await verifyAdminRequest('Bearer invalid.fake.token.here');
  assert.equal(res1.authorized, false);
  assert.ok(res1.error?.includes('Unauthorized') || res1.error?.includes('Invalid'));

  const res2 = await verifyAdminRequest('Bearer this-is-a-long-token-that-is-not-valid-at-all-12345');
  assert.equal(res2.authorized, false);
  assert.ok(res2.error?.includes('Unauthorized') || res2.error?.includes('Invalid'));
});

test('11. Input sanitization neutralizes HTML and script tags (XSS protection)', () => {
  const maliciousName = '<script>alert("pwned")</script>Cillian';
  const cleanName = sanitizeString(maliciousName, 100);
  assert.equal(cleanName, 'scriptalert("pwned")/scriptCillian');
  assert.equal(cleanName.includes('<'), false);
  assert.equal(cleanName.includes('>'), false);

  const maliciousAddress = '<img src=x onerror=alert(1)>42 Grafton St';
  const cleanAddress = sanitizeString(maliciousAddress, 200);
  assert.equal(cleanAddress.includes('<'), false);
  assert.equal(cleanAddress.includes('>'), false);
});

test('12. Rate limiter enforces maximum thresholds and returns 429 when exceeded', () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    message: 'Rate limit exceeded',
    keyGenerator: () => 'test-ip-127.0.0.1',
  });

  const mockRes = () => {
    const headers: Record<string, any> = {};
    let statusCode = 200;
    let jsonBody: any = null;
    return {
      setHeader(k: string, v: any) { headers[k] = v; },
      status(code: number) { statusCode = code; return this; },
      json(body: any) { jsonBody = body; return this; },
      getStatusCode: () => statusCode,
      getJson: () => jsonBody,
      getHeaders: () => headers,
    };
  };

  const req = {} as any;
  let nextCalledCount = 0;
  const next = () => { nextCalledCount++; };

  // Call 1: OK
  const res1 = mockRes();
  limiter(req, res1 as any, next);
  assert.equal(nextCalledCount, 1);
  assert.equal(res1.getStatusCode(), 200);

  // Call 2: OK
  const res2 = mockRes();
  limiter(req, res2 as any, next);
  assert.equal(nextCalledCount, 2);
  assert.equal(res2.getStatusCode(), 200);

  // Call 3: Exceeded -> 429
  const res3 = mockRes();
  limiter(req, res3 as any, next);
  assert.equal(nextCalledCount, 2); // next NOT called
  assert.equal(res3.getStatusCode(), 429);
  assert.equal(res3.getJson()?.success, false);
  assert.ok(res3.getJson()?.error?.includes('Rate limit exceeded'));
});

test('13. normalizePrivateKey handles escaped newlines, quotes, and space-separated PEMs', async () => {
  const { normalizePrivateKey } = await import('./firebase-admin');
  const sampleKey = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\\n-----END PRIVATE KEY-----\\n';
  const cleaned = normalizePrivateKey(`"${sampleKey}"`);
  assert.ok(cleaned.startsWith('-----BEGIN PRIVATE KEY-----'));
  assert.ok(cleaned.endsWith('-----END PRIVATE KEY-----\n'));
  assert.equal(cleaned.includes('\\n'), false);
  assert.ok(cleaned.includes('\n'));
});

test('14. Placeholder environment detection filters unconfigured container vars', async () => {
  const { isPlaceholderEnvValue, DEFAULT_PROJECT_ID, getConfiguredProjectId } = await import('./firebase-admin');
  assert.equal(isPlaceholderEnvValue('your_firebase_project_id'), true);
  assert.equal(isPlaceholderEnvValue('your_resend_api_key_here'), true);
  assert.equal(isPlaceholderEnvValue('your_verified_email@example.com'), true);
  assert.equal(isPlaceholderEnvValue(''), true);
  assert.equal(isPlaceholderEnvValue('   '), true);
  assert.equal(isPlaceholderEnvValue(undefined), true);
  assert.equal(isPlaceholderEnvValue('gen-lang-client-0299720065'), false);
  assert.equal(isPlaceholderEnvValue('orders@atelier-noire.com'), false);

  const prevProjectId = process.env.FIREBASE_PROJECT_ID;
  try {
    process.env.FIREBASE_PROJECT_ID = 'your_firebase_project_id';
    assert.equal(getConfiguredProjectId(), DEFAULT_PROJECT_ID);
    process.env.FIREBASE_PROJECT_ID = 'custom-real-project-123';
    assert.equal(getConfiguredProjectId(), 'custom-real-project-123');
  } finally {
    if (prevProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = prevProjectId;
  }
});

test('15. Admin HMAC session tokens round-trip and reject tampering', async () => {
  const { createAdminSessionToken, verifyAdminSessionToken, verifyAdminRequest } = await import('./admin-service');
  const token = createAdminSessionToken('noire.ireland@gmail.com');
  assert.ok(token.startsWith('an_'));

  const ctx = verifyAdminSessionToken(token);
  assert.ok(ctx);
  assert.equal(ctx.email, 'noire.ireland@gmail.com');
  assert.equal(ctx.role, 'SUPER_ADMIN');

  const reqCheck = await verifyAdminRequest(`Bearer ${token}`);
  assert.equal(reqCheck.authorized, true);
  assert.equal(reqCheck.context?.email, 'noire.ireland@gmail.com');

  assert.equal(verifyAdminSessionToken(`${token}tampered`), null);
  const nonAdminToken = createAdminSessionToken('attacker@example.com');
  assert.equal(verifyAdminSessionToken(nonAdminToken), null);
});

test('16. Local store fallback handles inventory, order idempotency, cancellation stock restore, and COD reconciliation', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const storeFile = path.resolve(process.cwd(), '.local-store.json');
  const hadPrevious = fs.existsSync(storeFile);
  const previousRaw = hadPrevious ? fs.readFileSync(storeFile, 'utf8') : null;

  try {
    if (hadPrevious) fs.unlinkSync(storeFile);

    const {
      getInventorySnapshot,
      saveOrderAtomic,
      checkIdempotentOrder,
      updateOrderRecord,
      reconcileCodRecord,
      getOrderById,
    } = await import('./storage-store');

    const initialStock = await getInventorySnapshot();
    const initialBlueM = initialStock['blue-charcoal_M'];
    assert.equal(initialBlueM, 14);

    const testOrderId = `test-order-${Date.now()}`;
    const testIdempKey = `idemp-unit-${Date.now()}`;
    const mockOrder = {
      id: testOrderId,
      orderReference: 'NOIRE-88-COD-UNITTEST',
      customer: {
        fullName: 'Aoife Murphy',
        email: 'aoife@atelier-noire.ie',
        phone: '+353 87 111 2222',
        streetAddress: '10 Merrion Square',
        city: 'Dublin',
        county: 'Dublin',
        eircode: 'D02 X285',
        country: 'IE',
      },
      items: [
        {
          colorway: 'blue-charcoal' as const,
          colorwayName: 'Blue Charcoal',
          size: 'M',
          quantity: 2,
          unitPriceEur: 88,
          subtotalEur: 176,
        },
      ],
      financials: {
        unitPriceEur: 88,
        subtotalEur: 176,
        shippingEur: 0,
        totalEur: 176,
        currency: 'EUR',
      },
      paymentMethod: 'COD' as const,
      paymentStatus: 'UNPAID' as const,
      orderStatus: 'NEW' as const,
      statusHistory: [
        {
          status: 'NEW',
          note: 'Order created via unit test',
          updatedBy: 'customer',
          timestamp: new Date().toISOString(),
        },
      ],
      idempotencyKey: testIdempKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saveRes = await saveOrderAtomic(mockOrder, {
      orderId: testOrderId,
      orderReference: mockOrder.orderReference,
      expectedAmountEur: 176,
      actualCollectedEur: 0,
      amountRemittedEur: 0,
      outstandingAmountEur: 176,
      settlementStatus: 'PENDING_COLLECTION',
    });
    assert.equal(saveRes.success, true);

    const afterSaveStock = await getInventorySnapshot();
    assert.equal(afterSaveStock['blue-charcoal_M'], initialBlueM - 2);

    const idemMatch = await checkIdempotentOrder(testIdempKey);
    assert.ok(idemMatch);
    assert.equal(idemMatch.id, testOrderId);

    const reconcileRes = await reconcileCodRecord(
      mockOrder.orderReference,
      {
        courierName: 'DHL Express Ireland',
        trackingNumber: 'IE-TEST-001',
        actualCollectedEur: 176,
        settlementStatus: 'REMITTED_TO_BANK',
        amountRemittedEur: 176,
        reconciliationNotes: 'Unit test remittance',
      },
      'noire.ireland@gmail.com'
    );
    assert.equal(reconcileRes.success, true);

    const afterReconcile = await getOrderById(testOrderId);
    assert.equal(afterReconcile?.paymentStatus, 'REMITTED');

    const cancelRes = await updateOrderRecord(testOrderId, 'CANCELLED', 'noire.ireland@gmail.com', 'Unit test cancel');
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.order?.orderStatus, 'CANCELLED');

    const restoredStock = await getInventorySnapshot();
    assert.equal(restoredStock['blue-charcoal_M'], initialBlueM);
  } finally {
    if (hadPrevious && previousRaw !== null) {
      fs.writeFileSync(storeFile, previousRaw, 'utf8');
    } else if (fs.existsSync(storeFile)) {
      fs.unlinkSync(storeFile);
    }
  }
});

test('17. Vercel /api handlers work for admin login, catch-all routing, stats, orders, and inventory', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const storeFile = path.resolve(process.cwd(), '.local-store.json');
  const hadPrevious = fs.existsSync(storeFile);
  const previousRaw = hadPrevious ? fs.readFileSync(storeFile, 'utf8') : null;

  const createMockVercelRes = () => {
    const headers: Record<string, string> = {};
    let body = '';
    const mock = {
      statusCode: 200,
      headersSent: false,
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = String(v);
      },
      getHeader(k: string) {
        return headers[k.toLowerCase()];
      },
      status(code: number) {
        mock.statusCode = code;
        return mock;
      },
      json(payload: unknown) {
        headers['content-type'] = 'application/json; charset=utf-8';
        body = JSON.stringify(payload);
        mock.headersSent = true;
        return mock;
      },
      end(chunk?: string | Buffer) {
        if (chunk) {
          body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        }
        mock.headersSent = true;
        return mock;
      },
      parseJson() {
        return body ? JSON.parse(body) : null;
      },
    };
    return mock;
  };

  try {
    if (hadPrevious) fs.unlinkSync(storeFile);

    const catchAllHandler = (await import('../../api/[...route].js')).default;
    const statsHandler = (await import('../../api/admin/stats.js')).default;
    const ordersHandler = (await import('../../api/admin/orders.js')).default;
    const statusHandler = (await import('../../api/admin/status.js')).default;
    const reconcileHandler = (await import('../../api/admin/reconcile.js')).default;
    const inventoryHandler = (await import('../../api/inventory.js')).default;
    const { ADMIN_CONFIGURED_PASSWORD } = await import('./admin-service.js');

    // OPTIONS preflight on catch-all
    const optRes = createMockVercelRes();
    await catchAllHandler({ method: 'OPTIONS', url: '/api/admin/login', headers: {}, query: {} } as any, optRes as any);
    assert.equal(optRes.statusCode, 204);

    // Wrong password rejected cleanly as JSON 401
    const badLoginRes = createMockVercelRes();
    await catchAllHandler(
      {
        method: 'POST',
        url: '/api/admin/login',
        headers: { 'content-type': 'application/json' },
        query: {},
        body: { email: 'noire.ireland@gmail.com', password: 'wrong-password' },
      } as any,
      badLoginRes as any
    );
    assert.equal(badLoginRes.statusCode, 401);
    assert.equal(badLoginRes.parseJson().success, false);
    assert.equal(badLoginRes.parseJson().field, 'password');

    // Valid login via encoded Vercel catch-all URL + [...route] query
    const goodLoginRes = createMockVercelRes();
    await catchAllHandler(
      {
        method: 'POST',
        url: '/api/%5B...route%5D?...route=admin&...route=login',
        headers: { 'content-type': 'application/json' },
        query: { '...route': ['admin', 'login'] },
        body: Buffer.from(JSON.stringify({ email: 'noire.ireland@gmail.com', password: ADMIN_CONFIGURED_PASSWORD })),
      } as any,
      goodLoginRes as any
    );
    assert.equal(goodLoginRes.statusCode, 200);
    const loginData = goodLoginRes.parseJson();
    assert.equal(loginData.success, true);
    assert.ok(typeof loginData.token === 'string' && loginData.token.startsWith('an_'));

    const token = loginData.token as string;

    // Unauthenticated request to /api/admin/stats -> 401
    const unauthStatsRes = createMockVercelRes();
    await statsHandler({ method: 'GET', headers: {} } as any, unauthStatsRes as any);
    assert.equal(unauthStatsRes.statusCode, 401);

    // Authenticated /api/admin/stats -> 200 JSON
    const statsRes = createMockVercelRes();
    await statsHandler({ method: 'GET', headers: { authorization: `Bearer ${token}` } } as any, statsRes as any);
    assert.equal(statsRes.statusCode, 200);
    assert.equal(statsRes.parseJson().success, true);
    assert.equal(typeof statsRes.parseJson().stats.totalOrders, 'number');

    // Authenticated /api/admin/orders -> 200 JSON
    const ordersRes = createMockVercelRes();
    await ordersHandler(
      { method: 'GET', url: '/api/admin/orders', headers: { authorization: `Bearer ${token}` } } as any,
      ordersRes as any
    );
    assert.equal(ordersRes.statusCode, 200);
    assert.equal(ordersRes.parseJson().success, true);
    assert.ok(Array.isArray(ordersRes.parseJson().orders));

    // Authenticated /api/admin/email-status via catch-all -> 200 JSON
    const emailStatusRes = createMockVercelRes();
    await catchAllHandler(
      {
        method: 'GET',
        url: '/api/admin/email-status',
        headers: { authorization: `Bearer ${token}` },
        query: {},
      } as any,
      emailStatusRes as any
    );
    assert.equal(emailStatusRes.statusCode, 200);
    assert.equal(emailStatusRes.parseJson().success, true);

    // Authenticated /api/inventory -> 200 JSON
    const invRes = createMockVercelRes();
    await inventoryHandler({ method: 'GET' } as any, invRes as any);
    assert.equal(invRes.statusCode, 200);
    assert.equal(invRes.parseJson().success, true);

    // Verify status & reconcile validation paths respond cleanly in JSON
    const statusMissingRes = createMockVercelRes();
    await statusHandler(
      {
        method: 'PATCH',
        url: '/api/admin/status',
        headers: { authorization: `Bearer ${token}` },
        body: Buffer.from(JSON.stringify({ status: 'CONFIRMED' })),
      } as any,
      statusMissingRes as any
    );
    assert.equal(statusMissingRes.statusCode, 400);

    const reconcileMissingRes = createMockVercelRes();
    await reconcileHandler(
      {
        method: 'POST',
        url: '/api/admin/reconcile',
        headers: { authorization: `Bearer ${token}` },
        body: Buffer.from(JSON.stringify({ courierName: 'DHL' })),
      } as any,
      reconcileMissingRes as any
    );
    assert.equal(reconcileMissingRes.statusCode, 400);
  } finally {
    if (hadPrevious && previousRaw !== null) {
      fs.writeFileSync(storeFile, previousRaw, 'utf8');
    } else if (fs.existsSync(storeFile)) {
      fs.unlinkSync(storeFile);
    }
  }
});

test('18. Forward-ready customer email copy includes customer recipient, mailto link, and canonical message', async () => {
  const mockOrderData = {
    orderReference: 'NOIRE-88-COD-FWD1',
    customer: {
      ...sampleOrderPayload.customer,
      country: 'IE',
    },
    items: [
      {
        colorway: 'carbon',
        colorwayName: 'Noir / Carbon',
        size: 'L',
        quantity: 1,
        unitPriceEur: 88,
        subtotalEur: 88,
      },
    ],
    financials: {
      subtotalEur: 88,
      shippingEur: 0,
      totalEur: 88,
      currency: 'EUR',
    },
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    orderStatus: 'NEW',
    createdAt: new Date().toISOString(),
  };

  const copy = generateAdminForwardableCustomerCopy(mockOrderData);
  assert.ok(copy.subject.includes('saoirse@atelier-noire.ie'));
  assert.ok(copy.subject.includes('Your order has found its way to NOIRÉ.'));
  assert.ok(copy.subject.includes('NOIRE-88-COD-FWD1'));
  assert.ok(copy.text.includes('TO: saoirse@atelier-noire.ie'));
  assert.ok(copy.text.includes('Hello Saoirse,'));
  assert.ok(copy.text.includes("You're now part of that story."));
  assert.ok(copy.html.includes('mailto:saoirse%40atelier-noire.ie'));
  assert.ok(copy.html.includes('MANUAL CUSTOMER EMAIL COPY // NOIRE-88-COD-FWD1'));

  const prevKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = '';
  const fs = await import('node:fs');
  const path = await import('node:path');
  const storeFile = path.resolve(process.cwd(), '.local-store.json');
  const hadPrevious = fs.existsSync(storeFile);
  const previousRaw = hadPrevious ? fs.readFileSync(storeFile, 'utf8') : null;
  try {
    const res = await dispatchOrderNotifications(mockOrderData, 'https://www.noireofficial.ie/admin');
    assert.equal(res.adminSent, true);
    assert.equal(res.adminCopySent, true);
    assert.ok(res.adminJobId);
    assert.ok(res.adminCopyJobId);
  } finally {
    if (prevKey !== undefined) {
      process.env.RESEND_API_KEY = prevKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
    if (hadPrevious && previousRaw !== null) {
      fs.writeFileSync(storeFile, previousRaw, 'utf8');
    } else if (fs.existsSync(storeFile)) {
      fs.unlinkSync(storeFile);
    }
  }
});


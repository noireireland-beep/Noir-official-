import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const DEFAULT_PROJECT_ID = 'gen-lang-client-0299720065';
const FIRESTORE_DATABASE_ID =
  'ai-studio-noirscrolldriven-f315def4-d182-4618-969f-6da452cde3b7';
const ADMIN_EMAIL = 'noire.ireland@gmail.com';
const DEFAULT_FROM_EMAIL = 'Atelier NOIRÉ <onboarding@resend.dev>';
const LOCAL_DB_PATH = path.resolve(process.cwd(), '.local-store.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'atelier-noire-local-store.json');

const VALID_COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down',
  'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim',
  'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
  'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
] as const;

const VALID_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
const VALID_COLORWAYS = ['carbon', 'blue-charcoal'] as const;
const UNIT_PRICE_EUR = 88;

const DEFAULT_INVENTORY: Record<
  string,
  { availableStock: number; totalStock: number }
> = {
  carbon_S: { availableStock: 7, totalStock: 7 },
  carbon_M: { availableStock: 14, totalStock: 14 },
  carbon_L: { availableStock: 12, totalStock: 12 },
  carbon_XL: { availableStock: 6, totalStock: 6 },
  carbon_XXL: { availableStock: 2, totalStock: 2 },
  'blue-charcoal_S': { availableStock: 7, totalStock: 7 },
  'blue-charcoal_M': { availableStock: 14, totalStock: 14 },
  'blue-charcoal_L': { availableStock: 12, totalStock: 12 },
  'blue-charcoal_XL': { availableStock: 6, totalStock: 6 },
  'blue-charcoal_XXL': { availableStock: 2, totalStock: 2 },
};

interface CheckoutPayload {
  customer: {
    fullName: string;
    email: string;
    phone: string;
    streetAddress: string;
    unitOrApartment?: string;
    city: string;
    county: string;
    eircode: string;
  };
  items: Array<{
    colorway: 'carbon' | 'blue-charcoal';
    size: string;
    quantity: number;
  }>;
  idempotencyKey?: string;
}

interface OrderEmailData {
  orderReference: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    streetAddress: string;
    unitOrApartment?: string;
    city: string;
    county: string;
    eircode: string;
    country: string;
  };
  items: Array<{
    colorway: string;
    colorwayName: string;
    size: string;
    quantity: number;
    unitPriceEur: number;
    subtotalEur: number;
  }>;
  financials: {
    subtotalEur: number;
    shippingEur: number;
    totalEur: number;
    currency: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

function validateEircode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().replace(/\s+/g, '').toUpperCase();
  const eircodeRegex = /^(D6W|[AC-FHKNPRTV-Y][0-9]{2})[0-9AC-FHKNPRTV-Y]{4}$/;
  return eircodeRegex.test(clean);
}

function validateIrishPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.trim().replace(/[\s\-().]/g, '');
  const irishPhoneRegex = /^(\+353|00353|0)[1-9][0-9]{7,9}$/;
  return irishPhoneRegex.test(clean);
}

function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

function sanitizeString(val: string, maxLength: number): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLength);
}

function validateCheckoutPayload(payload: unknown): {
  valid: boolean;
  errors: string[];
  sanitized?: CheckoutPayload;
} {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Invalid request payload.'] };
  }

  const data = payload as Partial<CheckoutPayload>;

  if (!data.customer || typeof data.customer !== 'object') {
    return { valid: false, errors: ['Customer information is required.'] };
  }

  const {
    fullName,
    email,
    phone,
    streetAddress,
    unitOrApartment,
    city,
    county,
    eircode,
  } = data.customer;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }

  if (!email || !validateEmail(email)) {
    errors.push('Valid email address is required for dispatch tracking.');
  }

  if (!phone || !validateIrishPhone(phone)) {
    errors.push(
      'Valid Irish phone number is required (e.g. +353 87 123 4567 or 087 123 4567) so courier can contact you for delivery.'
    );
  }

  if (
    !streetAddress ||
    typeof streetAddress !== 'string' ||
    streetAddress.trim().length < 4
  ) {
    errors.push('Street address is required.');
  }

  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    errors.push('Town or City is required.');
  }

  if (!county || typeof county !== 'string') {
    errors.push('County is required.');
  } else {
    const matchedCounty = VALID_COUNTIES.find(
      (c) => c.toLowerCase() === county.trim().toLowerCase()
    );
    if (!matchedCounty) {
      errors.push(
        'Invalid Irish county. Must be one of the 32 counties (e.g. Dublin, Cork, Galway).'
      );
    }
  }

  if (!eircode || !validateEircode(eircode)) {
    errors.push('Valid Irish Eircode is required (e.g. D02 X285).');
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Acquisition cart cannot be empty.');
  } else {
    data.items.forEach((item, index) => {
      if (!VALID_COLORWAYS.includes(item.colorway)) {
        errors.push(
          `Item ${index + 1}: Invalid colorway "${item.colorway}". Allowed: Noir / Carbon, Blue Charcoal.`
        );
      }
      if (!VALID_SIZES.includes(item.size as (typeof VALID_SIZES)[number])) {
        errors.push(
          `Item ${index + 1}: Invalid size "${item.size}". Allowed: S, M, L, XL, XXL.`
        );
      } else if (item.size === 'S') {
        errors.push(
          `Item ${index + 1}: Size S is archive closed and no longer available.`
        );
      }
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 5
      ) {
        errors.push(
          `Item ${index + 1}: Quantity must be an integer between 1 and 5 per order.`
        );
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const cleanEircode = eircode!.trim().toUpperCase().replace(/\s+/g, '');
  const formattedEircode =
    cleanEircode.length === 7
      ? `${cleanEircode.slice(0, 3)} ${cleanEircode.slice(3)}`
      : cleanEircode;

  const matchedCounty =
    VALID_COUNTIES.find(
      (c) => c.toLowerCase() === county!.trim().toLowerCase()
    ) || county!.trim();

  const sanitized: CheckoutPayload = {
    customer: {
      fullName: sanitizeString(fullName!, 100),
      email: email!.trim().toLowerCase().slice(0, 150),
      phone: sanitizeString(phone!, 30),
      streetAddress: sanitizeString(streetAddress!, 200),
      unitOrApartment: unitOrApartment
        ? sanitizeString(unitOrApartment, 50)
        : undefined,
      city: sanitizeString(city!, 100),
      county: matchedCounty,
      eircode: formattedEircode,
    },
    items: (data.items || []).map((item) => ({
      colorway: item.colorway,
      size: item.size.trim().toUpperCase(),
      quantity: Math.floor(item.quantity),
    })),
    idempotencyKey: data.idempotencyKey?.trim(),
  };

  return { valid: true, errors: [], sanitized };
}

function calculateAuthoritativeTotals(items: Array<{ quantity: number }>): {
  unitPriceEur: number;
  subtotalEur: number;
  shippingEur: number;
  totalEur: number;
  currency: string;
} {
  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotalEur = totalUnits * UNIT_PRICE_EUR;
  const shippingEur = 0;
  const totalEur = subtotalEur + shippingEur;

  return {
    unitPriceEur: UNIT_PRICE_EUR,
    subtotalEur,
    shippingEur,
    totalEur,
    currency: 'EUR',
  };
}

function isPlaceholderValue(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith('your_') ||
    lower.startsWith('your-') ||
    lower.startsWith('replace_with') ||
    lower.startsWith('placeholder') ||
    lower === 'changeme' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('example.com') ||
    lower.includes('your_firebase') ||
    lower.includes('your-firebase') ||
    lower.includes('your_resend') ||
    lower.includes('your-resend')
  );
}

function isCredentialOrPermissionError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('permission_denied') ||
    msg.includes('permission denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('credentials') ||
    msg.includes('default credentials') ||
    msg.includes('missing firebase admin') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('private_key')
  );
}

interface LocalStoreSchema {
  orders: Record<string, any>;
  inventory: Record<string, { availableStock: number; totalStock: number }>;
  codSettlements: Record<string, any>;
  notificationJobs: Record<string, any>;
}

function cloneDefaultInventory(): Record<string, { availableStock: number; totalStock: number }> {
  const cloned: Record<string, { availableStock: number; totalStock: number }> = {};
  for (const [key, value] of Object.entries(DEFAULT_INVENTORY)) {
    cloned[key] = { ...value };
  }
  return cloned;
}

function readLocalStore(): LocalStoreSchema {
  const defaults = cloneDefaultInventory();
  try {
    const storePath = fs.existsSync(LOCAL_DB_PATH)
      ? LOCAL_DB_PATH
      : fs.existsSync(TMP_DB_PATH)
      ? TMP_DB_PATH
      : null;
    if (storePath) {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Partial<LocalStoreSchema>;
      return {
        orders: parsed.orders || {},
        inventory: { ...defaults, ...(parsed.inventory || {}) },
        codSettlements: parsed.codSettlements || {},
        notificationJobs: parsed.notificationJobs || {},
      };
    }
  } catch (err) {
    console.warn('Error reading local store in /api/orders, resetting:', err);
  }
  return {
    orders: {},
    inventory: defaults,
    codSettlements: {},
    notificationJobs: {},
  };
}

function writeLocalStore(data: LocalStoreSchema): void {
  const serialized = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(LOCAL_DB_PATH, serialized, 'utf8');
  } catch {
    try {
      fs.writeFileSync(TMP_DB_PATH, serialized, 'utf8');
    } catch (err) {
      console.error('Error writing local store in /api/orders:', err);
    }
  }
}

function normalizePrivateKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let k = rawKey.trim();

  while (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }

  k = k.replace(/\\"/g, '"').replace(/\\'/g, "'");
  k = k.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '');

  if (!k.includes('-----BEGIN')) {
    const cleanBase64 = k.replace(/[\s\r\n]/g, '');
    const chunked = cleanBase64.match(/.{1,64}/g)?.join('\n') || cleanBase64;
    k = `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----\n`;
  } else {
    const headerMatch = k.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----/);
    const footerMatch = k.match(/-----END (?:RSA )?PRIVATE KEY-----/);
    if (headerMatch && footerMatch) {
      const header = headerMatch[0];
      const footer = footerMatch[0];
      const startIdx = k.indexOf(header) + header.length;
      const endIdx = k.indexOf(footer);
      const innerBase64 = k.slice(startIdx, endIdx).replace(/[\s\r\n]/g, '');
      const chunked = innerBase64.match(/.{1,64}/g)?.join('\n') || innerBase64;
      k = `${header}\n${chunked}\n${footer}\n`;
    }
  }

  return k;
}

function hasValidFirebaseCredentials(): boolean {
  if (!isPlaceholderValue(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) {
    try {
      let saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY!.trim();
      while (
        (saRaw.startsWith('"') && saRaw.endsWith('"')) ||
        (saRaw.startsWith("'") && saRaw.endsWith("'"))
      ) {
        saRaw = saRaw.slice(1, -1).trim();
      }
      const sa = JSON.parse(saRaw);
      if (sa && typeof sa.client_email === 'string' && typeof sa.private_key === 'string') {
        crypto.createPrivateKey(normalizePrivateKey(sa.private_key));
        return true;
      }
    } catch {
      // Try individual credentials below
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!isPlaceholderValue(clientEmail) && !isPlaceholderValue(rawPrivateKey)) {
    try {
      crypto.createPrivateKey(normalizePrivateKey(rawPrivateKey!));
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const projectId = !isPlaceholderValue(process.env.FIREBASE_PROJECT_ID)
    ? process.env.FIREBASE_PROJECT_ID!.trim()
    : DEFAULT_PROJECT_ID;

  if (!isPlaceholderValue(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) {
    let saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY!.trim();
    while (
      (saRaw.startsWith('"') && saRaw.endsWith('"')) ||
      (saRaw.startsWith("'") && saRaw.endsWith("'"))
    ) {
      saRaw = saRaw.slice(1, -1).trim();
    }
    const serviceAccount = JSON.parse(saRaw);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
      crypto.createPrivateKey(serviceAccount.private_key);
    }
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: !isPlaceholderValue(serviceAccount.project_id)
        ? serviceAccount.project_id
        : projectId,
    });
  }

  const clientEmail = !isPlaceholderValue(process.env.FIREBASE_CLIENT_EMAIL)
    ? process.env.FIREBASE_CLIENT_EMAIL!.trim()
    : '';
  const rawPrivateKey = !isPlaceholderValue(process.env.FIREBASE_PRIVATE_KEY)
    ? process.env.FIREBASE_PRIVATE_KEY
    : '';

  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      'Missing Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);
  crypto.createPrivateKey(privateKey);

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

function getNamedFirestoreDb(): Firestore {
  const app = getFirebaseAdminApp();
  const dbId = !isPlaceholderValue(process.env.FIRESTORE_DATABASE_ID)
    ? process.env.FIRESTORE_DATABASE_ID!.trim()
    : FIRESTORE_DATABASE_ID;
  const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings may already be applied across warm serverless invocations
  }
  return db;
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateCustomerEmail(order: OrderEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const rawFirstName = order.customer.fullName.trim().split(' ')[0] || 'Collector';
  const safeFirstName = escapeHtml(rawFirstName);
  const safeFullName = escapeHtml(order.customer.fullName);
  const safeStreet = escapeHtml(order.customer.streetAddress);
  const safeUnit = order.customer.unitOrApartment ? escapeHtml(order.customer.unitOrApartment) : '';
  const safeCity = escapeHtml(order.customer.city);
  const safeCounty = escapeHtml(order.customer.county);
  const safeEircode = escapeHtml(order.customer.eircode);
  const safeOrderRef = escapeHtml(order.orderReference);
  const totalStr = order.financials.totalEur.toString();
  const subject = 'Your order has found its way to NOIRÉ.';

  const text = `Hello ${rawFirstName},

Some things are made to be everywhere. We had something else in mind.

Your order has reached us. And we're glad it did.

Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.

You're now part of that story.

WHAT HAPPENS NEXT?

We'll review your order and send you a confirmation once it's accepted.

No payment has been taken. You'll pay the courier €${totalStr} upon delivery.

A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.

Thank you for choosing to be part of something that doesn't need to be everywhere.

See you on the other side.

ATELIER NOIRÉ
Designed in Ireland. Made with intention.

--------------------------------------------------
ALLOCATION DOSSIER: ${order.orderReference}
PAYMENT METHOD: Cash on Delivery (COD)
TOTAL PAYABLE UPON DELIVERY: €${totalStr}.00

GARMENTS:
${order.items.map((item) => `• ${item.quantity}× Atelier NOIRÉ Archive Tracksuit — ${item.colorwayName} (Size ${item.size}) : €${item.subtotalEur}.00`).join('\n')}

DESTINATION:
${order.customer.fullName}
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#111111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#D6CCBA; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111; margin:0; padding:24px 12px;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:#161616; border:1px solid #2B2A28; border-top:2px solid #D6CCBA; border-collapse:collapse; text-align:left;">
          <tr>
            <td style="padding:26px 28px 22px 28px; border-bottom:1px solid #262523;">
              <div style="font-family:Georgia, 'Times New Roman', serif; font-size:16px; letter-spacing:0.32em; text-transform:uppercase; color:#FFFFFF; font-weight:400; line-height:1.2;">
                NOIR&Eacute;
              </div>
              <div style="margin-top:6px; font-size:10px; letter-spacing:0.24em; text-transform:uppercase; color:#9E9689; line-height:1.4;">
                ATELIER NOIR&Eacute; &middot; ARCHIVE DROP
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px 28px;">
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 20px 0; font-weight:400; line-height:1.7;">
                Hello ${safeFirstName},
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Some things are made to be everywhere. We had something else in mind.
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Your order has reached us. And we're glad it did.
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.
              </p>
              <p style="font-size:15px; color:#FFFFFF; margin:0; font-weight:400; line-height:1.75;">
                You're now part of that story.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 24px 0;">
                <tr>
                  <td style="border-top:1px solid #262523; height:1px; font-size:1px; line-height:1px;">&nbsp;</td>
                </tr>
              </table>
              <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#FFFFFF; margin:0 0 16px 0; font-weight:600; line-height:1.4;">
                WHAT HAPPENS NEXT?
              </div>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                We'll review your order and send you a confirmation once it's accepted.
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                No payment has been taken. You'll pay the courier <span style="color:#FFFFFF; font-weight:400;">&euro;${totalStr}</span> upon delivery.
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.
              </p>
              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Thank you for choosing to be part of something that doesn't need to be everywhere.
              </p>
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 28px 0; font-weight:400; line-height:1.75;">
                See you on the other side.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1B1A19; border:1px solid #2B2A28; border-collapse:collapse; margin:0;">
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#8FA9C4; margin:0 0 14px 0; font-family:'Courier New', Courier, monospace; line-height:1.4;">
                      ALLOCATION RECORD // ${safeOrderRef}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6;">
                      ${order.items
                        .map(
                          (item) => `
                        <tr>
                          <td style="padding:9px 16px 9px 0; color:#E8E2D7; border-bottom:1px solid #262523; vertical-align:top;">
                            ${item.quantity}&times; Atelier NOIR&Eacute; Tracksuit &mdash; ${escapeHtml(item.colorwayName)} (Size ${escapeHtml(item.size)})
                          </td>
                          <td style="padding:9px 0; text-align:right; color:#FFFFFF; font-weight:700; border-bottom:1px solid #262523; white-space:nowrap; vertical-align:top;">
                            &euro;${item.subtotalEur}.00
                          </td>
                        </tr>
                      `
                        )
                        .join('')}
                      <tr>
                        <td style="padding:10px 12px 4px 0; color:#9A948A;">Insured Courier (Ireland)</td>
                        <td style="padding:10px 0 4px 0; text-align:right; color:#D6CCBA; white-space:nowrap;">FREE</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 12px 12px 0; color:#9A948A;">Payment Method</td>
                        <td style="padding:4px 0 12px 0; text-align:right; color:#D6CCBA;">Cash on Delivery (COD)</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 16px 2px 0; color:#FFFFFF; font-weight:700; font-size:13px; border-top:1px solid #3A3936;">Total Due to Courier</td>
                        <td style="padding:12px 0 2px 0; text-align:right; color:#FFFFFF; font-weight:700; font-size:14px; border-top:1px solid #3A3936; white-space:nowrap;">&euro;${totalStr}.00</td>
                      </tr>
                    </table>
                    <div style="margin-top:16px; padding-top:14px; border-top:1px dashed #2E2D2A; font-family:'Courier New', Courier, monospace; font-size:11.5px; color:#BEB7AB; line-height:1.65;">
                      <span style="color:#8E887E; text-transform:uppercase; font-size:9.5px; letter-spacing:0.16em; display:block; margin-bottom:5px;">Courier Destination</span>
                      ${safeFullName}<br>
                      ${safeStreet}${safeUnit ? `, ${safeUnit}` : ''}<br>
                      ${safeCity}, Co. ${safeCounty}, ${safeEircode} &middot; Ireland
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 26px 28px; border-top:1px solid #262523;">
              <div style="font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#D6CCBA; font-weight:600; margin:0 0 4px 0; line-height:1.5;">
                ATELIER NOIR&Eacute;
              </div>
              <div style="font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#88847C; margin:0; line-height:1.5;">
                Designed in Ireland. Made with intention.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function generateAdminEmail(
  order: OrderEmailData,
  adminDashboardUrl: string
): { subject: string; text: string; html: string } {
  const subject = `NEW ORDER | ATELIER NOIRÉ | ${order.orderReference}`;
  const customerSubject = 'Your order has found its way to NOIRÉ.';
  const mailtoHref = `mailto:${encodeURIComponent(order.customer.email)}?subject=${encodeURIComponent(customerSubject)}`;

  const safeFullName = escapeHtml(order.customer.fullName);
  const safeEmail = escapeHtml(order.customer.email);
  const safePhone = escapeHtml(order.customer.phone);
  const safeStreet = escapeHtml(order.customer.streetAddress);
  const safeUnit = order.customer.unitOrApartment ? escapeHtml(order.customer.unitOrApartment) : '';
  const safeCity = escapeHtml(order.customer.city);
  const safeCounty = escapeHtml(order.customer.county);
  const safeEircode = escapeHtml(order.customer.eircode);
  const safeOrderRef = escapeHtml(order.orderReference);

  const text = `NEW ORDER RECEIVED — ATELIER NOIRÉ ARCHIVE DROP

Reference: ${order.orderReference}
Date: ${order.createdAt}
Payment Method: Cash on Delivery (COD)
Payment Status: UNPAID
Order Status: NEW

CUSTOMER DETAILS:
Name: ${order.customer.fullName}
Email: ${order.customer.email}
Phone: ${order.customer.phone}

MANUAL CUSTOMER EMAIL (FORWARD SEPARATELY):
Send To: ${order.customer.email}
Email Subject: ${customerSubject}
Note: Open the separate email titled "${customerSubject}" in your inbox and forward it directly to ${order.customer.email}.

DELIVERY ADDRESS:
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland

ITEMS ALLOCATED:
${order.items.map((i) => `- ${i.quantity}× Tracksuit [${i.colorwayName} / Size ${i.size}] @ €${i.unitPriceEur} = €${i.subtotalEur}`).join('\n')}

Subtotal: €${order.financials.subtotalEur}.00
Shipping: €${order.financials.shippingEur}.00 (Free)
TOTAL PAYABLE BY COURIER: €${order.financials.totalEur}.00

Review and manage this order in the admin dashboard:
${adminDashboardUrl}
`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:20px 10px; background-color:#0D0D0D; color:#F0F2F4; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
  <div style="max-width:620px; margin:0 auto; background-color:#161616; border:1px solid #333333; padding:28px 24px;">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #FF0800; padding-bottom:12px; margin-bottom:20px;">
      <div>
        <span style="background-color:#FF0800; color:#FFFFFF; font-size:10px; font-weight:bold; padding:2px 8px; letter-spacing:0.15em; text-transform:uppercase;">NEW ORDER</span>
        <h2 style="margin:6px 0 0 0; font-size:18px; color:#FFFFFF; letter-spacing:0.05em;">${safeOrderRef}</h2>
      </div>
      <div style="text-align:right; font-size:11px; color:#888888;">
        ${new Date(order.createdAt).toUTCString()}
      </div>
    </div>
    <div style="background-color:#1F1E1D; border:1px solid #2B2A28; padding:16px; margin-bottom:16px;">
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Customer:</td>
          <td style="color:#FFFFFF; font-weight:bold; padding:4px 0;">${safeFullName}</td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Email:</td>
          <td style="padding:4px 0;"><a href="mailto:${safeEmail}" style="color:#D6CCBA;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Phone:</td>
          <td style="padding:4px 0;"><a href="tel:${safePhone}" style="color:#8FA9C4; font-weight:bold;">${safePhone}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0; vertical-align:top;">Address:</td>
          <td style="color:#FFFFFF; padding:4px 0; line-height:1.4;">
            ${safeStreet}${safeUnit ? `, ${safeUnit}` : ''}<br>
            ${safeCity}, Co. ${safeCounty}<br>
            <strong style="color:#D6CCBA;">${safeEircode}</strong> &middot; Ireland
          </td>
        </tr>
      </table>
    </div>
    <div style="background-color:#1A1D21; border:1px solid #8FA9C4; padding:14px 16px; margin-bottom:20px;">
      <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#8FA9C4; margin-bottom:8px; font-weight:bold;">
        MANUAL CUSTOMER EMAIL FORWARDING DETAILS
      </div>
      <table style="width:100%; font-size:12.5px; border-collapse:collapse;">
        <tr>
          <td style="color:#9BA3AD; padding:3px 12px 3px 0; white-space:nowrap;">Send To:</td>
          <td style="padding:3px 0;"><a href="${mailtoHref}" style="color:#FFFFFF; font-weight:bold; text-decoration:underline;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="color:#9BA3AD; padding:3px 12px 3px 0; white-space:nowrap;">Email Subject:</td>
          <td style="color:#D6CCBA; font-weight:bold; padding:3px 0;">${customerSubject}</td>
        </tr>
      </table>
      <div style="margin-top:8px; font-size:11px; color:#A8B0BA; line-height:1.5;">
        Open the separate clean customer email in your inbox (&ldquo;${customerSubject}&rdquo;) and forward it directly to <strong style="color:#FFFFFF;">${safeEmail}</strong>.
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#888888; margin-bottom:8px;">ITEMS ORDERED</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${order.items
          .map(
            (item) => `
          <tr style="border-bottom:1px solid #222222;">
            <td style="padding:8px 12px 8px 0; color:#FFFFFF;">
              <strong>${item.quantity}&times;</strong> Tracksuit &mdash; ${escapeHtml(item.colorwayName)} (Size <strong>${escapeHtml(item.size)}</strong>)
            </td>
            <td style="padding:8px 0; text-align:right; color:#FFFFFF; font-weight:bold; white-space:nowrap;">
              &euro;${item.subtotalEur}.00
            </td>
          </tr>
        `
          )
          .join('')}
        <tr>
          <td style="padding:8px 12px 8px 0; color:#888888;">Delivery (Insured Courier Ireland)</td>
          <td style="padding:8px 0; text-align:right; color:#D6CCBA;">FREE</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0; color:#888888;">Payment Method</td>
          <td style="padding:8px 0; text-align:right; color:#FF0800; font-weight:bold;">CASH ON DELIVERY (UNPAID)</td>
        </tr>
        <tr style="border-top:1px solid #444444;">
          <td style="padding:12px 12px 12px 0; font-size:15px; font-weight:bold; color:#FFFFFF;">Total COD Collection:</td>
          <td style="padding:12px 0; text-align:right; font-size:16px; font-weight:bold; color:#FFFFFF; white-space:nowrap;">&euro;${order.financials.totalEur}.00</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center; padding:16px 0;">
      <a href="${adminDashboardUrl}" style="display:inline-block; background-color:#D6CCBA; color:#111111; text-decoration:none; padding:12px 24px; font-size:12px; font-weight:bold; letter-spacing:0.18em; text-transform:uppercase;">
        Open Admin Dashboard &rarr;
      </a>
    </div>
    <div style="font-size:11px; color:#555555; text-align:center; margin-top:20px; border-top:1px solid #222222; padding-top:12px;">
      Atelier NOIRÉ Order Management System &middot; noire.ireland@gmail.com
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordNotificationJobSafely(
  db: Firestore | null,
  jobData: Record<string, unknown>
): Promise<void> {
  if (db) {
    try {
      await db.collection('notificationJobs').doc().set(jobData);
      return;
    } catch (err) {
      if (!isCredentialOrPermissionError(err)) {
        console.error('[NotificationJob Log Error]:', err);
        return;
      }
    }
  }

  const store = readLocalStore();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  store.notificationJobs[id] = { id, ...jobData };
  writeLocalStore(store);
}

async function sendViaResendWithFallback(
  resend: Resend,
  preferredFrom: string,
  to: string,
  subject: string,
  text: string,
  html: string
) {
  let sendResult = await resend.emails.send({
    from: preferredFrom,
    to: [to],
    subject,
    text,
    html,
  });

  if (sendResult.error && preferredFrom !== DEFAULT_FROM_EMAIL) {
    const msg = (sendResult.error.message || '').toLowerCase();
    if (
      sendResult.error.name === 'validation_error' ||
      msg.includes('domain') ||
      msg.includes('verify')
    ) {
      sendResult = await resend.emails.send({
        from: DEFAULT_FROM_EMAIL,
        to: [to],
        subject,
        text,
        html,
      });
    }
  }

  return sendResult;
}

async function sendOrderEmailsSafely(
  db: Firestore | null,
  order: OrderEmailData,
  adminDashboardUrl: string
): Promise<void> {
  const rawApiKey = process.env.RESEND_API_KEY;
  const apiKey = !isPlaceholderValue(rawApiKey) ? rawApiKey!.trim() : '';

  if (!apiKey) {
    const customerEmail = generateCustomerEmail(order);
    const adminEmail = generateAdminEmail(order, adminDashboardUrl);
    const now = new Date().toISOString();

    await recordNotificationJobSafely(db, {
      orderId: order.orderReference,
      recipientType: 'ADMIN',
      recipientEmail: ADMIN_EMAIL,
      subject: adminEmail.subject,
      status: 'SENT',
      simulation: true,
      notes: 'RESEND_API_KEY pending in env. Admin alert logged successfully.',
      sentAt: now,
      createdAt: now,
    });

    await recordNotificationJobSafely(db, {
      orderId: order.orderReference,
      recipientType: 'ADMIN_CUSTOMER_COPY',
      recipientEmail: ADMIN_EMAIL,
      intendedCustomerEmail: order.customer.email,
      subject: customerEmail.subject,
      status: 'SENT',
      simulation: true,
      notes: 'RESEND_API_KEY pending in env. Clean customer email copy logged successfully.',
      sentAt: now,
      createdAt: now,
    });

    await recordNotificationJobSafely(db, {
      orderId: order.orderReference,
      recipientType: 'CUSTOMER',
      recipientEmail: order.customer.email,
      subject: customerEmail.subject,
      status: 'SENT',
      simulation: true,
      notes: 'RESEND_API_KEY pending in env. Email payload generated and logged successfully.',
      sentAt: now,
      createdAt: now,
    });
    return;
  }

  const resend = new Resend(apiKey);
  const rawFrom = process.env.RESEND_FROM_EMAIL;
  const preferredFrom = !isPlaceholderValue(rawFrom)
    ? rawFrom!.trim()
    : DEFAULT_FROM_EMAIL;
  const hasCustomDomain = !preferredFrom.includes('@resend.dev');

  // 1. Admin Order Alert
  try {
    const { subject, text, html } = generateAdminEmail(order, adminDashboardUrl);
    const sendResult = await sendViaResendWithFallback(
      resend,
      preferredFrom,
      ADMIN_EMAIL,
      subject,
      text,
      html
    );

    if (sendResult.error) {
      console.error(
        `[Resend Admin Email Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await recordNotificationJobSafely(db, {
      orderId: order.orderReference,
      recipientType: 'ADMIN',
      recipientEmail: ADMIN_EMAIL,
      subject,
      status: sendResult.error ? 'FAILED' : 'SENT',
      error: sendResult.error ? sendResult.error.message : undefined,
      sentAt: sendResult.error ? undefined : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[Resend Admin Email Exception] (${order.orderReference}):`,
      err
    );
  }

  // 2. Clean Customer Email Copy Sent to Admin for Direct Manual Forwarding
  try {
    await sleep(600);
    const { subject, text, html } = generateCustomerEmail(order);
    const sendResult = await sendViaResendWithFallback(
      resend,
      preferredFrom,
      ADMIN_EMAIL,
      subject,
      text,
      html
    );

    if (sendResult.error) {
      console.error(
        `[Resend Admin Customer Copy Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await recordNotificationJobSafely(db, {
      orderId: order.orderReference,
      recipientType: 'ADMIN_CUSTOMER_COPY',
      recipientEmail: ADMIN_EMAIL,
      intendedCustomerEmail: order.customer.email,
      subject,
      status: sendResult.error ? 'FAILED' : 'SENT',
      error: sendResult.error ? sendResult.error.message : undefined,
      sentAt: sendResult.error ? undefined : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[Resend Admin Customer Copy Exception] (${order.orderReference}):`,
      err
    );
  }

  // 3. Direct Customer Email (only if custom domain configured or customer is admin)
  try {
    const { subject, text, html } = generateCustomerEmail(order);
    if (hasCustomDomain || order.customer.email.toLowerCase() === ADMIN_EMAIL) {
      await sleep(600);
      const sendResult = await sendViaResendWithFallback(
        resend,
        preferredFrom,
        order.customer.email,
        subject,
        text,
        html
      );

      if (sendResult.error) {
        console.error(
          `[Resend Customer Email Error] (${order.orderReference}):`,
          sendResult.error
        );
      }

      await recordNotificationJobSafely(db, {
        orderId: order.orderReference,
        recipientType: 'CUSTOMER',
        recipientEmail: order.customer.email,
        subject,
        status: sendResult.error ? 'FAILED' : 'SENT',
        error: sendResult.error ? sendResult.error.message : undefined,
        sentAt: sendResult.error ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    } else {
      await recordNotificationJobSafely(db, {
        orderId: order.orderReference,
        recipientType: 'CUSTOMER',
        recipientEmail: order.customer.email,
        subject,
        status: 'QUEUED_PENDING_DOMAIN',
        notes: `Forward-ready copy delivered to ${ADMIN_EMAIL} for manual forwarding.`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(
      `[Resend Customer Email Exception] (${order.orderReference}):`,
      err
    );
  }
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
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid JSON request body.',
          errors: ['Invalid JSON request body.'],
        });
        return;
      }
    }

    const validation = validateCheckoutPayload(parsedBody);
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({
        success: false,
        error: validation.errors.join(' ') || 'Invalid order details.',
        errors: validation.errors,
      });
      return;
    }

    const { customer, items, idempotencyKey } = validation.sanitized;
    let useLocalFallback = !hasValidFirebaseCredentials() && !process.env.K_SERVICE;
    let db: Firestore | null = null;

    if (!useLocalFallback) {
      try {
        db = getNamedFirestoreDb();
        if (idempotencyKey) {
          const existingSnapshot = await db
            .collection('orders')
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();

          if (!existingSnapshot.empty) {
            const existingDoc = existingSnapshot.docs[0];
            const existingOrder = existingDoc.data();
            res.status(201).json({
              success: true,
              orderId: existingDoc.id,
              orderReference: existingOrder.orderReference,
              order: {
                orderReference: existingOrder.orderReference,
                customer: existingOrder.customer,
                items: existingOrder.items,
                financials: existingOrder.financials,
                paymentMethod: existingOrder.paymentMethod,
                paymentStatus: existingOrder.paymentStatus,
                orderStatus: existingOrder.orderStatus,
                createdAt: existingOrder.createdAt,
              },
            });
            return;
          }
        }
      } catch (initOrIdempErr: unknown) {
        if (isCredentialOrPermissionError(initOrIdempErr)) {
          useLocalFallback = true;
          db = null;
        } else {
          throw initOrIdempErr;
        }
      }
    }

    if (useLocalFallback && idempotencyKey) {
      const store = readLocalStore();
      const existingOrder = Object.values(store.orders).find(
        (o: any) => o.idempotencyKey === idempotencyKey
      );
      if (existingOrder) {
        res.status(201).json({
          success: true,
          orderId: existingOrder.id,
          orderReference: existingOrder.orderReference,
          order: {
            orderReference: existingOrder.orderReference,
            customer: existingOrder.customer,
            items: existingOrder.items,
            financials: existingOrder.financials,
            paymentMethod: existingOrder.paymentMethod,
            paymentStatus: existingOrder.paymentStatus,
            orderStatus: existingOrder.orderStatus,
            createdAt: existingOrder.createdAt,
          },
        });
        return;
      }
    }

    const financials = calculateAuthoritativeTotals(items);
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderReference = `NOIRE-88-COD-${randomSuffix}`;

    const itemsSnapshot = items.map((item) => ({
      colorway: item.colorway,
      colorwayName:
        item.colorway === 'blue-charcoal' ? 'Blue Charcoal' : 'Noir / Carbon',
      size: item.size,
      quantity: item.quantity,
      unitPriceEur: financials.unitPriceEur,
      subtotalEur: financials.unitPriceEur * item.quantity,
    }));

    const now = new Date().toISOString();
    const orderDocRef = db ? db.collection('orders').doc() : null;
    const orderId =
      orderDocRef?.id ||
      `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const newOrder = {
      id: orderId,
      orderReference,
      customer: {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        streetAddress: customer.streetAddress,
        unitOrApartment: customer.unitOrApartment || '',
        city: customer.city,
        county: customer.county,
        eircode: customer.eircode,
        country: 'IE',
      },
      items: itemsSnapshot,
      financials,
      paymentMethod: 'COD' as const,
      paymentStatus: 'UNPAID' as const,
      orderStatus: 'NEW' as const,
      statusHistory: [
        {
          status: 'NEW',
          note: 'Order submitted via Atelier NOIRÉ storefront. Cash on Delivery selected.',
          updatedBy: 'CUSTOMER',
          timestamp: now,
        },
      ],
      idempotencyKey: idempotencyKey || '',
      createdAt: now,
      updatedAt: now,
    };

    const settlementRecord = {
      orderId,
      orderReference,
      expectedAmountEur: financials.totalEur,
      actualCollectedEur: 0,
      courierName: '',
      trackingNumber: '',
      collectionDate: null,
      settlementStatus: 'PENDING_COLLECTION',
      amountRemittedEur: 0,
      remittanceDate: null,
      outstandingAmountEur: financials.totalEur,
      reconciliationNotes:
        'Awaiting order fulfillment and courier assignment',
      reconciledBy: '',
      createdAt: now,
      updatedAt: now,
    };

    if (!useLocalFallback && db && orderDocRef) {
      try {
        await db.runTransaction(async (transaction) => {
          for (const item of newOrder.items) {
            const variantId = `${item.colorway}_${item.size}`;
            const invRef = db!.collection('inventory').doc(variantId);
            const invDoc = await transaction.get(invRef);

            let available = DEFAULT_INVENTORY[variantId]?.availableStock ?? 5;
            let total = DEFAULT_INVENTORY[variantId]?.totalStock ?? 5;

            if (invDoc.exists) {
              const data = invDoc.data() || {};
              available =
                typeof data.availableStock === 'number'
                  ? data.availableStock
                  : available;
              total =
                typeof data.totalStock === 'number' ? data.totalStock : total;
            }

            if (available < item.quantity) {
              throw new Error(
                `STOCK_INSUFFICIENT: Insufficient stock for ${item.colorwayName} (${item.size}). Only ${available} remaining.`
              );
            }

            transaction.set(
              invRef,
              {
                colorway: item.colorway,
                size: item.size,
                availableStock: available - item.quantity,
                totalStock: total,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }

          transaction.set(orderDocRef, newOrder);
          transaction.set(
            db!.collection('codSettlements').doc(orderId),
            settlementRecord
          );
        });
      } catch (txErr: unknown) {
        const txMsg = txErr instanceof Error ? txErr.message : String(txErr);
        if (txMsg.startsWith('STOCK_INSUFFICIENT:')) {
          const cleanMsg = txMsg.replace('STOCK_INSUFFICIENT:', '').trim();
          res.status(400).json({
            success: false,
            error: cleanMsg,
            errors: [cleanMsg],
          });
          return;
        }
        if (isCredentialOrPermissionError(txErr)) {
          useLocalFallback = true;
          db = null;
        } else {
          throw txErr;
        }
      }
    }

    if (useLocalFallback) {
      const store = readLocalStore();
      for (const item of newOrder.items) {
        const variantId = `${item.colorway}_${item.size}`;
        const defaultEntry = DEFAULT_INVENTORY[variantId] || {
          availableStock: 5,
          totalStock: 5,
        };
        const inv = store.inventory[variantId]
          ? { ...store.inventory[variantId] }
          : { ...defaultEntry };

        if (inv.availableStock < item.quantity) {
          const stockMsg = `Insufficient stock for ${item.colorwayName} (${item.size}). Only ${inv.availableStock} remaining.`;
          res.status(400).json({
            success: false,
            error: stockMsg,
            errors: [stockMsg],
          });
          return;
        }
        inv.availableStock -= item.quantity;
        store.inventory[variantId] = inv;
      }

      store.orders[newOrder.id] = newOrder;
      store.codSettlements[newOrder.id] = settlementRecord;
      writeLocalStore(store);
    }

    const protoHeader = req.headers['x-forwarded-proto'];
    const protocol =
      typeof protoHeader === 'string' ? protoHeader.split(',')[0] : 'https';
    const host =
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host']
        : req.headers.host) || 'www.noireofficial.ie';
    const adminDashboardUrl = `${protocol}://${host}/admin`;

    await sendOrderEmailsSafely(
      db,
      {
        orderReference: newOrder.orderReference,
        customer: newOrder.customer,
        items: newOrder.items,
        financials: newOrder.financials,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        orderStatus: newOrder.orderStatus,
        createdAt: newOrder.createdAt,
      },
      adminDashboardUrl
    );

    res.status(201).json({
      success: true,
      orderId: newOrder.id,
      orderReference: newOrder.orderReference,
      order: {
        orderReference: newOrder.orderReference,
        customer: newOrder.customer,
        items: newOrder.items,
        financials: newOrder.financials,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        orderStatus: newOrder.orderStatus,
        createdAt: newOrder.createdAt,
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

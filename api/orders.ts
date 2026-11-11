import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const FIRESTORE_DATABASE_ID =
  'ai-studio-noirscrolldriven-f315def4-d182-4618-969f-6da452cde3b7';
const ADMIN_EMAIL = 'noire.ireland@gmail.com';
const DEFAULT_FROM_EMAIL = 'Atelier NOIRÉ <onboarding@resend.dev>';

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

function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      'Missing Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);

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
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);
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

function generateCustomerEmail(order: OrderEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = order.customer.fullName.trim().split(' ')[0] || 'Collector';
  const totalStr = order.financials.totalEur.toString();
  const subject = 'Your order has found its way to NOIRÉ.';

  const text = `Hello ${firstName},

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
${order.items.map((item) => `• ${item.quantity}× Atelier NOIRÉ Archive Tracksuit — ${item.colorwayName} (Size ${item.size}) : €${item.subtotalEur}`).join('\n')}

DESTINATION:
${order.customer.fullName}
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:32px 12px; background-color:#111111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#D6CCBA; line-height:1.7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; width:100%; background-color:#161616; border:1px solid #2B2A28; text-align:left;">
          <tr>
            <td style="padding:36px 36px 20px 36px; border-bottom:1px solid #2B2A28;">
              <span style="font-size:11px; letter-spacing:0.26em; text-transform:uppercase; color:#D6CCBA; display:inline-block;">
                ATELIER NOIRÉ &middot; ARCHIVE DROP
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px 36px;">
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 24px 0; font-weight:400; line-height:1.7;">
                Hello ${firstName},
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Some things are made to be everywhere. We had something else in mind.
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Your order has reached us. And we're glad it did.
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.
              </p>
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 36px 0; font-weight:400; line-height:1.7;">
                You're now part of that story.
              </p>
              <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#FFFFFF; margin:0 0 16px 0; font-weight:600;">
                WHAT HAPPENS NEXT?
              </div>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 20px 0; font-weight:300; line-height:1.7;">
                We'll review your order and send you a confirmation once it's accepted.
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                No payment has been taken. You'll pay the courier &euro;${totalStr} upon delivery.
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.
              </p>
              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Thank you for choosing to be part of something that doesn't need to be everywhere.
              </p>
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 36px 0; font-weight:400; line-height:1.7;">
                See you on the other side.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1B1A19; border:1px solid #2B2A28; margin:0 0 36px 0;">
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#8FA9C4; margin-bottom:14px; font-family:'Courier New', Courier, monospace;">
                      ALLOCATION RECORD // ${order.orderReference}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6;">
                      ${order.items
                        .map(
                          (item) => `
                        <tr>
                          <td style="padding:6px 0; color:#E0D8CB; border-bottom:1px solid #262523;">
                            ${item.quantity}&times; Atelier NOIR&Eacute; Tracksuit &mdash; ${item.colorwayName} (Size ${item.size})
                          </td>
                          <td style="padding:6px 0; text-align:right; color:#FFFFFF; font-weight:bold; border-bottom:1px solid #262523; white-space:nowrap;">
                            &euro;${item.subtotalEur}.00
                          </td>
                        </tr>
                      `
                        )
                        .join('')}
                      <tr>
                        <td style="padding:6px 0; color:#88847C;">Insured Courier Delivery (Ireland)</td>
                        <td style="padding:6px 0; text-align:right; color:#D6CCBA;">FREE</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:#88847C;">Payment Method</td>
                        <td style="padding:6px 0; text-align:right; color:#D6CCBA;">Cash on Delivery (COD)</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0 0; color:#FFFFFF; font-weight:bold; font-size:13px; border-top:1px solid #3A3936;">Total Due to Courier</td>
                        <td style="padding:10px 0 0 0; text-align:right; color:#FFFFFF; font-weight:bold; font-size:14px; border-top:1px solid #3A3936;">&euro;${totalStr}.00</td>
                      </tr>
                    </table>
                    <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #2B2A28; font-family:'Courier New', Courier, monospace; font-size:11px; color:#AFA99E; line-height:1.5;">
                      <span style="color:#88847C; text-transform:uppercase; font-size:9px; letter-spacing:0.14em; display:block; margin-bottom:3px;">Courier Destination:</span>
                      ${order.customer.fullName}<br>
                      ${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}<br>
                      ${order.customer.city}, Co. ${order.customer.county}, ${order.customer.eircode} &middot; Ireland
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px 36px 36px; border-top:1px solid #2B2A28; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#88847C; line-height:1.8;">
              <strong style="color:#D6CCBA; font-weight:600;">ATELIER NOIRÉ</strong><br>
              Designed in Ireland. Made with intention.
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
        <h2 style="margin:6px 0 0 0; font-size:18px; color:#FFFFFF; letter-spacing:0.05em;">${order.orderReference}</h2>
      </div>
      <div style="text-align:right; font-size:11px; color:#888888;">
        ${new Date(order.createdAt).toUTCString()}
      </div>
    </div>
    <div style="background-color:#1F1E1D; border:1px solid #2B2A28; padding:16px; margin-bottom:20px;">
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr>
          <td style="color:#888888; padding:4px 0;">Customer:</td>
          <td style="color:#FFFFFF; font-weight:bold; padding:4px 0;">${order.customer.fullName}</td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0;">Email:</td>
          <td style="padding:4px 0;"><a href="mailto:${order.customer.email}" style="color:#D6CCBA;">${order.customer.email}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0;">Phone:</td>
          <td style="padding:4px 0;"><a href="tel:${order.customer.phone}" style="color:#8FA9C4; font-weight:bold;">${order.customer.phone}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0; vertical-align:top;">Address:</td>
          <td style="color:#FFFFFF; padding:4px 0; line-height:1.4;">
            ${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}<br>
            ${order.customer.city}, Co. ${order.customer.county}<br>
            <strong style="color:#D6CCBA;">${order.customer.eircode}</strong> &middot; Ireland
          </td>
        </tr>
      </table>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#888888; margin-bottom:8px;">ITEMS ORDERED</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${order.items
          .map(
            (item) => `
          <tr style="border-bottom:1px solid #222222;">
            <td style="padding:8px 0; color:#FFFFFF;">
              <strong>${item.quantity}&times;</strong> Tracksuit &mdash; ${item.colorwayName} (Size <strong>${item.size}</strong>)
            </td>
            <td style="padding:8px 0; text-align:right; color:#FFFFFF; font-weight:bold;">
              &euro;${item.subtotalEur}.00
            </td>
          </tr>
        `
          )
          .join('')}
        <tr>
          <td style="padding:8px 0; color:#888888;">Delivery (Insured Courier Ireland)</td>
          <td style="padding:8px 0; text-align:right; color:#D6CCBA;">FREE</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#888888;">Payment Method</td>
          <td style="padding:8px 0; text-align:right; color:#FF0800; font-weight:bold;">CASH ON DELIVERY (UNPAID)</td>
        </tr>
        <tr style="border-top:1px solid #444444;">
          <td style="padding:12px 0; font-size:15px; font-weight:bold; color:#FFFFFF;">Total COD Collection:</td>
          <td style="padding:12px 0; text-align:right; font-size:16px; font-weight:bold; color:#FFFFFF;">&euro;${order.financials.totalEur}.00</td>
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

async function sendOrderEmailsSafely(
  db: Firestore,
  order: OrderEmailData,
  adminDashboardUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      '[Resend Warning]: RESEND_API_KEY is not configured; skipping order confirmation emails.'
    );
    return;
  }

  const resend = new Resend(apiKey);
  const preferredFrom =
    process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;

  try {
    const { subject, text, html } = generateCustomerEmail(order);
    let sendResult = await resend.emails.send({
      from: preferredFrom,
      to: [order.customer.email],
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
          to: [order.customer.email],
          subject,
          text,
          html,
        });
      }
    }

    if (sendResult.error) {
      console.error(
        `[Resend Customer Email Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await db
      .collection('notificationJobs')
      .doc()
      .set({
        orderId: order.orderReference,
        recipientType: 'CUSTOMER',
        recipientEmail: order.customer.email,
        subject,
        status: sendResult.error ? 'FAILED' : 'SENT',
        error: sendResult.error ? sendResult.error.message : undefined,
        sentAt: sendResult.error ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .catch((logErr) => {
        console.error('[NotificationJob Log Error - Customer]:', logErr);
      });
  } catch (err) {
    console.error(
      `[Resend Customer Email Exception] (${order.orderReference}):`,
      err
    );
  }

  try {
    const { subject, text, html } = generateAdminEmail(
      order,
      adminDashboardUrl
    );
    let sendResult = await resend.emails.send({
      from: preferredFrom,
      to: [ADMIN_EMAIL],
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
          to: [ADMIN_EMAIL],
          subject,
          text,
          html,
        });
      }
    }

    if (sendResult.error) {
      console.error(
        `[Resend Admin Email Error] (${order.orderReference}):`,
        sendResult.error
      );
    }

    await db
      .collection('notificationJobs')
      .doc()
      .set({
        orderId: order.orderReference,
        recipientType: 'ADMIN',
        recipientEmail: ADMIN_EMAIL,
        subject,
        status: sendResult.error ? 'FAILED' : 'SENT',
        error: sendResult.error ? sendResult.error.message : undefined,
        sentAt: sendResult.error ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .catch((logErr) => {
        console.error('[NotificationJob Log Error - Admin]:', logErr);
      });
  } catch (err) {
    console.error(
      `[Resend Admin Email Exception] (${order.orderReference}):`,
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
    const db = getNamedFirestoreDb();

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
    const orderDocRef = db.collection('orders').doc();

    const newOrder = {
      id: orderDocRef.id,
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
      orderId: orderDocRef.id,
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

    try {
      await db.runTransaction(async (transaction) => {
        for (const item of newOrder.items) {
          const variantId = `${item.colorway}_${item.size}`;
          const invRef = db.collection('inventory').doc(variantId);
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
          db.collection('codSettlements').doc(orderDocRef.id),
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
      throw txErr;
    }

    const protoHeader = req.headers['x-forwarded-proto'];
    const protocol =
      typeof protoHeader === 'string' ? protoHeader.split(',')[0] : 'https';
    const host =
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host']
        : req.headers.host) || 'atelier-noire.com';
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

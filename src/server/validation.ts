export const VALID_COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down',
  'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim',
  'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
  'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
] as const;

export const VALID_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const VALID_COLORWAYS = ['carbon', 'blue-charcoal'] as const;
export const UNIT_PRICE_EUR = 88;

export interface CheckoutPayload {
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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: CheckoutPayload;
}

/**
 * Validates Irish Eircode format
 * Format: 3 alphanumerics routing key + optional space + 4 alphanumerics unique identifier
 * Excludes characters B, G, I, J, L, M, O, Q, S, U, Z in actual postal standard, but flexible regex handles all valid codes
 */
export function validateEircode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().replace(/\s+/g, '').toUpperCase();
  // Official Irish Eircode standard:
  // Routing key (3 chars): Letter from [AC-FHKNPRTV-Y] + 2 digits, OR special Dublin routing 'D6W'
  // Unique identifier (4 chars): 4 alphanumeric characters from [0-9AC-FHKNPRTV-Y]
  const eircodeRegex = /^(D6W|[AC-FHKNPRTV-Y][0-9]{2})[0-9AC-FHKNPRTV-Y]{4}$/;
  return eircodeRegex.test(clean);
}

/**
 * Validates Irish phone number
 * Supports: +353 8x xxx xxxx, 08x xxx xxxx, 00353 8x..., landlines (01, 021, etc.)
 */
export function validateIrishPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  // Matches +353..., 00353..., or 08.../01... with 9 to 13 digits
  const irishPhoneRegex = /^(\+353|00353|0)[1-9][0-9]{7,9}$/;
  return irishPhoneRegex.test(clean);
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Strips HTML angle brackets and ASCII control characters to prevent stored XSS and injection
 */
export function sanitizeString(val: string, maxLength: number): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLength);
}

export function validateCheckoutPayload(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Invalid request payload.'] };
  }

  const data = payload as Partial<CheckoutPayload>;

  // Customer validation
  if (!data.customer || typeof data.customer !== 'object') {
    return { valid: false, errors: ['Customer information is required.'] };
  }

  const { fullName, email, phone, streetAddress, unitOrApartment, city, county, eircode } = data.customer;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }

  if (!email || !validateEmail(email)) {
    errors.push('Valid email address is required for dispatch tracking.');
  }

  if (!phone || !validateIrishPhone(phone)) {
    errors.push('Valid Irish phone number is required (e.g. +353 87 123 4567 or 087 123 4567) so courier can contact you for delivery.');
  }

  if (!streetAddress || typeof streetAddress !== 'string' || streetAddress.trim().length < 4) {
    errors.push('Street address is required.');
  }

  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    errors.push('Town or City is required.');
  }

  if (!county || typeof county !== 'string') {
    errors.push('County is required.');
  } else {
    const matchedCounty = VALID_COUNTIES.find(c => c.toLowerCase() === county.trim().toLowerCase());
    if (!matchedCounty) {
      errors.push(`Invalid Irish county. Must be one of the 32 counties (e.g. Dublin, Cork, Galway).`);
    }
  }

  if (!eircode || !validateEircode(eircode)) {
    errors.push('Valid Irish Eircode is required (e.g. D02 X285).');
  }

  // Items validation
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Acquisition cart cannot be empty.');
  } else {
    data.items.forEach((item, index) => {
      if (!VALID_COLORWAYS.includes(item.colorway)) {
        errors.push(`Item ${index + 1}: Invalid colorway "${item.colorway}". Allowed: Noir / Carbon, Blue Charcoal.`);
      }
      if (!VALID_SIZES.includes(item.size as typeof VALID_SIZES[number])) {
        errors.push(`Item ${index + 1}: Invalid size "${item.size}". Allowed: S, M, L, XL, XXL.`);
      } else if (item.size === 'S') {
        errors.push(`Item ${index + 1}: Size S is archive closed and no longer available.`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 5) {
        errors.push(`Item ${index + 1}: Quantity must be an integer between 1 and 5 per order.`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize
  const cleanEircode = eircode.trim().toUpperCase().replace(/\s+/g, '');
  const formattedEircode = cleanEircode.length === 7 
    ? `${cleanEircode.slice(0, 3)} ${cleanEircode.slice(3)}` 
    : cleanEircode;

  const matchedCounty = VALID_COUNTIES.find(c => c.toLowerCase() === county.trim().toLowerCase()) || county.trim();

  const sanitized: CheckoutPayload = {
    customer: {
      fullName: sanitizeString(fullName, 100),
      email: email.trim().toLowerCase().slice(0, 150),
      phone: sanitizeString(phone, 30),
      streetAddress: sanitizeString(streetAddress, 200),
      unitOrApartment: unitOrApartment ? sanitizeString(unitOrApartment, 50) : undefined,
      city: sanitizeString(city, 100),
      county: matchedCounty,
      eircode: formattedEircode,
    },
    items: (data.items || []).map(item => ({
      colorway: item.colorway,
      size: item.size.trim().toUpperCase(),
      quantity: Math.floor(item.quantity)
    })),
    idempotencyKey: data.idempotencyKey?.trim()
  };

  return { valid: true, errors: [], sanitized };
}

/**
 * Server-side authoritative calculation
 * Never trusts prices or subtotals sent by client
 */
export function calculateAuthoritativeTotals(items: Array<{ quantity: number }>): {
  unitPriceEur: number;
  subtotalEur: number;
  shippingEur: number;
  totalEur: number;
  currency: string;
} {
  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotalEur = totalUnits * UNIT_PRICE_EUR;
  const shippingEur = 0; // Free delivery all over Ireland
  const totalEur = subtotalEur + shippingEur;

  return {
    unitPriceEur: UNIT_PRICE_EUR,
    subtotalEur,
    shippingEur,
    totalEur,
    currency: 'EUR'
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEircode,
  validateIrishPhone,
  validateEmail,
  validateCheckoutPayload,
  calculateAuthoritativeTotals,
  VALID_COUNTIES
} from './validation';

test('validateEircode correctly checks Irish Eircodes', () => {
  assert.equal(validateEircode('D02 X285'), true);
  assert.equal(validateEircode('D02X285'), true);
  assert.equal(validateEircode('T12 A3NC'), true);
  assert.equal(validateEircode('A65 F4E2'), true);
  // Invalid
  assert.equal(validateEircode('12345'), false);
  assert.equal(validateEircode('SW1A 1AA'), false); // UK postcode
  assert.equal(validateEircode(''), false);
});

test('validateIrishPhone accepts valid mobile and landline formats', () => {
  assert.equal(validateIrishPhone('+353 87 123 4567'), true);
  assert.equal(validateIrishPhone('0871234567'), true);
  assert.equal(validateIrishPhone('+353859876543'), true);
  assert.equal(validateIrishPhone('012345678'), true); // Dublin landline
  // Invalid
  assert.equal(validateIrishPhone('12345'), false);
  assert.equal(validateIrishPhone('+1 555 123 4567'), false); // US number
  assert.equal(validateIrishPhone(''), false);
});

test('validateEmail validates RFC compliant email addresses', () => {
  assert.equal(validateEmail('noire.ireland@gmail.com'), true);
  assert.equal(validateEmail('collector@domain.ie'), true);
  assert.equal(validateEmail('invalid-email'), false);
  assert.equal(validateEmail('test@'), false);
});

test('calculateAuthoritativeTotals enforces 88€ per unit with free shipping', () => {
  const oneItem = calculateAuthoritativeTotals([{ quantity: 1 }]);
  assert.equal(oneItem.subtotalEur, 88);
  assert.equal(oneItem.shippingEur, 0);
  assert.equal(oneItem.totalEur, 88);

  const threeItems = calculateAuthoritativeTotals([{ quantity: 2 }, { quantity: 1 }]);
  assert.equal(threeItems.subtotalEur, 264);
  assert.equal(threeItems.shippingEur, 0);
  assert.equal(threeItems.totalEur, 264);
});

test('validateCheckoutPayload validates full customer and item specifications', () => {
  const validPayload = {
    customer: {
      fullName: 'Cillian Murphy',
      email: 'cillian@atelier-noire.ie',
      phone: '+353 87 999 8888',
      streetAddress: '14 Grafton Street',
      unitOrApartment: 'Apt 2B',
      city: 'Dublin',
      county: 'Dublin',
      eircode: 'D02 X285'
    },
    items: [
      { colorway: 'blue-charcoal', size: 'L', quantity: 1 }
    ],
    idempotencyKey: 'test-key-123'
  };

  const result = validateCheckoutPayload(validPayload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.sanitized?.customer.eircode, 'D02 X285');
  assert.equal(result.sanitized?.customer.county, 'Dublin');

  // Reject invalid county
  const invalidCountyPayload = {
    ...validPayload,
    customer: { ...validPayload.customer, county: 'Atlantis' }
  };
  const invalidCountyResult = validateCheckoutPayload(invalidCountyPayload);
  assert.equal(invalidCountyResult.valid, false);
  assert.ok(invalidCountyResult.errors.some(e => e.includes('Invalid Irish county')));

  // Reject invalid size
  const invalidSizePayload = {
    ...validPayload,
    items: [{ colorway: 'carbon', size: 'XXXXXL', quantity: 1 }]
  };
  const invalidSizeResult = validateCheckoutPayload(invalidSizePayload);
  assert.equal(invalidSizeResult.valid, false);
  assert.ok(invalidSizeResult.errors.some(e => e.includes('Invalid size')));
});

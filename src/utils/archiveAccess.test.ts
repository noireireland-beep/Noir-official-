import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVE_ACCESS_PASSKEY,
  validatePasskeyAttempt,
  computePreloadPercent,
} from './archiveAccess.js';

test('ARCHIVE_ACCESS_PASSKEY matches configured passkey', () => {
  assert.equal(ARCHIVE_ACCESS_PASSKEY, 'shrek0shamrock67');
});

test('validatePasskeyAttempt rejects empty or whitespace-only inputs', () => {
  const emptyRes = validatePasskeyAttempt('');
  assert.equal(emptyRes.valid, false);
  assert.equal(emptyRes.error, 'Please enter the archive passkey.');

  const blankRes = validatePasskeyAttempt('   ');
  assert.equal(blankRes.valid, false);
  assert.equal(blankRes.error, 'Please enter the archive passkey.');
});

test('validatePasskeyAttempt enforces exact passkey match and rejects incorrect values', () => {
  assert.equal(validatePasskeyAttempt('wrongpassword').valid, false);
  assert.equal(validatePasskeyAttempt('SHREK0SHAMROCK67').valid, false);
  assert.equal(validatePasskeyAttempt('shrek0shamrock67 ').valid, false);

  const wrongRes = validatePasskeyAttempt('hunter2');
  assert.equal(wrongRes.valid, false);
  assert.equal(wrongRes.error, 'Incorrect passkey. Access denied.');

  const okRes = validatePasskeyAttempt('shrek0shamrock67');
  assert.equal(okRes.valid, true);
  assert.equal(okRes.error, undefined);
});

test('computePreloadPercent calculates monotonic background loading percentages', () => {
  assert.equal(computePreloadPercent(0, 35, false), 0);
  assert.equal(computePreloadPercent(18, 36, false), 49);
  assert.equal(computePreloadPercent(36, 36, false), 98);
  assert.equal(computePreloadPercent(36, 36, true), 100);
  assert.equal(computePreloadPercent(5, 0, false), 0);
});

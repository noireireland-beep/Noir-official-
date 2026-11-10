import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVE_SPECS,
  COLORWAYS,
  CATALOGUE_GALLERY,
  recommendSize,
  calculateRemainingSets,
  validateReservation,
  SIZE_SPECIFICATIONS,
  CUSTOMER_CARE_DETAILS
} from './archive-data';

test('ARCHIVE_SPECS confirms 88 edition sets and exact fabric GSM', () => {
  assert.equal(ARCHIVE_SPECS.totalEdition, 88);
  assert.equal(ARCHIVE_SPECS.topGsm, 390);
  assert.equal(ARCHIVE_SPECS.bottomGsm, 280);
  assert.equal(ARCHIVE_SPECS.priceEur, 88);
});

test('COLORWAYS defines Carbon and Blue Charcoal palettes according to art direction', () => {
  assert.equal(COLORWAYS.carbon.palette.dominant, '#161616');
  assert.equal(COLORWAYS.carbon.palette.surfaces, '#2B2A28');
  assert.equal(COLORWAYS.carbon.palette.accent, '#D6CCBA');

  assert.equal(COLORWAYS['blue-charcoal'].palette.dominant, '#14191F');
  assert.equal(COLORWAYS['blue-charcoal'].palette.surfaces, '#263443');
  assert.equal(COLORWAYS['blue-charcoal'].palette.accent, '#8FA9C4');
});

test('CATALOGUE_GALLERY provides authentic photos for Carbon and Blue Charcoal with prompt titles', () => {
  const carbonPhotos = CATALOGUE_GALLERY.carbon;
  assert.equal(carbonPhotos.length, 8);
  assert.equal(carbonPhotos[0].title, 'top view');
  assert.equal(carbonPhotos[1].title, 'horizontal crop');
  assert.equal(carbonPhotos[2].title, 'back view M hoodie with XL trousers');
  assert.equal(carbonPhotos[3].title, 'chest embroidery- 20k stitches');
  assert.equal(carbonPhotos[4].title, 'close up, virgin cotton-viscose');
  assert.equal(carbonPhotos[5].title, 'hood embroidery');
  assert.equal(carbonPhotos[6].title, 'hood embroidery');
  assert.equal(carbonPhotos[7].title, 'Handcrafted totebag');

  const bluePhotos = CATALOGUE_GALLERY['blue-charcoal'];
  assert.equal(bluePhotos.length, 9);
  assert.equal(bluePhotos[0].title, 'front view');
  assert.equal(bluePhotos[1].title, '1/3rd');
  assert.equal(bluePhotos[2].title, 'full silhouette');
  assert.equal(bluePhotos[3].title, 'rear perspective');
  assert.equal(bluePhotos[4].title, 'chest embroidery');
  assert.equal(bluePhotos[5].title, 'close up, virgin cotton viscose - ethically dyed');
  assert.equal(bluePhotos[6].title, 'hood embroidery');
  assert.equal(bluePhotos[7].title, 'hood embroidery');
  assert.equal(bluePhotos[8].title, 'Handcrafted totebag');
});

test('recommendSize returns correct size boundaries', () => {
  assert.equal(recommendSize(85), 'S');
  assert.equal(recommendSize(92), 'S');
  assert.equal(recommendSize(98), 'M');
  assert.equal(recommendSize(104), 'L');
  assert.equal(recommendSize(110), 'XL');
  assert.equal(recommendSize(120), 'XXL');
});

test('calculateRemainingSets calculates remaining units correctly', () => {
  const result = calculateRemainingSets();
  assert.equal(result.totalAvailable, 23);
  assert.ok(result.percentSold > 70);
});

test('validateReservation handles valid and invalid sizes', () => {
  assert.equal(validateReservation('carbon', 'M').valid, true);
  assert.equal(validateReservation('carbon', 'INVALID').valid, false);
  assert.equal(validateReservation('carbon', 'S').valid, false);
  assert.ok(validateReservation('carbon', 'S').error?.includes('archive closed'));
});

test('SIZE_SPECIFICATIONS contains verified measurements for all sizes with S marked closed', () => {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  sizes.forEach((sz) => {
    assert.ok(SIZE_SPECIFICATIONS[sz], `Missing specification for size ${sz}`);
    assert.ok(SIZE_SPECIFICATIONS[sz].hoodieChestPitToPitCm > 50);
    assert.ok(SIZE_SPECIFICATIONS[sz].hoodieLengthCm >= 67);
    assert.ok(SIZE_SPECIFICATIONS[sz].trouserInseamCm >= 75);
  });
  assert.equal(SIZE_SPECIFICATIONS.S.status, 'closed');
  assert.equal(SIZE_SPECIFICATIONS.M.status, 'available');
  assert.equal(SIZE_SPECIFICATIONS.L.status, 'available');
});

test('CUSTOMER_CARE_DETAILS specifies 14-day statutory rights and Irish COD delivery', () => {
  assert.equal(CUSTOMER_CARE_DETAILS.statutoryCancellationDays, 14);
  assert.equal(CUSTOMER_CARE_DETAILS.shippingCost, 'Complimentary (100% Free)');
  assert.equal(CUSTOMER_CARE_DETAILS.conciergeEmail, 'noire.ireland@gmail.com');
  assert.ok(CUSTOMER_CARE_DETAILS.missingInformationNotes.length >= 3);
});



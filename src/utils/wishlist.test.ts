import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WISHLIST_STORAGE_KEY,
  getVariantId,
  isVariantWishlisted,
  toggleWishlistVariant,
  removeWishlistVariant,
  loadWishlist,
  saveWishlist,
  type WishlistItem,
} from './wishlist';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('toggleWishlistVariant adds and removes specific colorway+size variants', () => {
  let list: WishlistItem[] = [];

  const first = toggleWishlistVariant(list, 'carbon', 'L', 1000);
  assert.equal(first.saved, true);
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].id, getVariantId('carbon', 'L'));
  assert.equal(isVariantWishlisted(first.items, 'carbon', 'L'), true);
  assert.equal(isVariantWishlisted(first.items, 'blue-charcoal', 'L'), false);

  const second = toggleWishlistVariant(first.items, 'blue-charcoal', 'M', 2000);
  assert.equal(second.saved, true);
  assert.equal(second.items.length, 2);

  const removed = toggleWishlistVariant(second.items, 'carbon', 'L', 3000);
  assert.equal(removed.saved, false);
  assert.equal(removed.items.length, 1);
  assert.equal(removed.items[0].id, 'blue-charcoal:M');
});

test('removeWishlistVariant removes by variant id', () => {
  const initial: WishlistItem[] = [
    { id: 'carbon:M', colorway: 'carbon', size: 'M', savedAt: 1 },
    { id: 'blue-charcoal:XL', colorway: 'blue-charcoal', size: 'XL', savedAt: 2 },
  ];
  const next = removeWishlistVariant(initial, 'carbon:M');
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'blue-charcoal:XL');
});

test('saveWishlist and loadWishlist persist across sessions and ignore malformed data', () => {
  const storage = createMemoryStorage();
  const sample: WishlistItem[] = [
    { id: 'carbon:L', colorway: 'carbon', size: 'L', savedAt: 1700000000000 },
  ];

  assert.equal(saveWishlist(sample, storage), true);
  const loaded = loadWishlist(storage);
  assert.deepEqual(loaded, sample);

  // Corrupted JSON fallback
  storage.setItem(WISHLIST_STORAGE_KEY, '{not-valid-json');
  assert.deepEqual(loadWishlist(storage), []);

  // Invalid entries filtered out
  storage.setItem(
    WISHLIST_STORAGE_KEY,
    JSON.stringify([
      { id: 'carbon:M', colorway: 'carbon', size: 'M', savedAt: 123 },
      { id: 'fake:Z', colorway: 'neon', size: 'Z', savedAt: 456 },
    ])
  );
  const filtered = loadWishlist(storage);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'carbon:M');
});

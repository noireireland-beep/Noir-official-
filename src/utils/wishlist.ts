export type WishlistColorway = 'carbon' | 'blue-charcoal';

export interface WishlistItem {
  id: string;
  colorway: WishlistColorway;
  size: string;
  savedAt: number;
}

export const WISHLIST_STORAGE_KEY = 'noire_archive_wishlist_v1';

const VALID_COLORWAYS = new Set<string>(['carbon', 'blue-charcoal']);
const VALID_SIZES = new Set<string>(['S', 'M', 'L', 'XL', 'XXL']);

export function getVariantId(colorway: WishlistColorway, size: string): string {
  return `${colorway}:${size}`;
}

export function isVariantWishlisted(
  items: WishlistItem[],
  colorway: WishlistColorway,
  size: string
): boolean {
  const targetId = getVariantId(colorway, size);
  return items.some((item) => item.id === targetId);
}

export function toggleWishlistVariant(
  items: WishlistItem[],
  colorway: WishlistColorway,
  size: string,
  now: number = Date.now()
): { items: WishlistItem[]; saved: boolean } {
  const id = getVariantId(colorway, size);
  const exists = items.some((item) => item.id === id);

  if (exists) {
    return {
      items: items.filter((item) => item.id !== id),
      saved: false,
    };
  }

  return {
    items: [{ id, colorway, size, savedAt: now }, ...items],
    saved: true,
  };
}

export function removeWishlistVariant(
  items: WishlistItem[],
  id: string
): WishlistItem[] {
  return items.filter((item) => item.id !== id);
}

export function loadWishlist(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): WishlistItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is WishlistItem =>
        Boolean(entry) &&
        typeof entry.id === 'string' &&
        VALID_COLORWAYS.has(entry.colorway) &&
        typeof entry.size === 'string' &&
        VALID_SIZES.has(entry.size) &&
        typeof entry.savedAt === 'number'
    );
  } catch {
    return [];
  }
}

export function saveWishlist(
  items: WishlistItem[],
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

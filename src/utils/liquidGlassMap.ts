/**
 * Generates a valid, deterministic PNG normal/displacement map for SVG
 * <feDisplacementMap> Apple Liquid Glass chromatic rim refraction.
 *
 * Red channel encodes X displacement (128 = neutral),
 * Green channel encodes Y displacement (128 = neutral).
 * The central plateau remains neutral so inner bar typography stays sharp,
 * while the rounded capsule bezel rim smoothly curves outward.
 */

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? bytes[i + 1] : 0;
    const b2 = hasB2 ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;

    out += BASE64_ALPHABET[(triplet >>> 18) & 0x3f];
    out += BASE64_ALPHABET[(triplet >>> 12) & 0x3f];
    out += hasB1 ? BASE64_ALPHABET[(triplet >>> 6) & 0x3f] : '=';
    out += hasB2 ? BASE64_ALPHABET[triplet & 0x3f] : '=';
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    s1 = (s1 + bytes[i]) % MOD;
    s2 = (s2 + s1) % MOD;
  }
  return ((s2 << 16) | s1) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  return chunk;
}

export interface CapsuleNormalSample {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function sampleCapsuleBezelNormal(
  x: number,
  y: number,
  width: number,
  height: number
): CapsuleNormalSample {
  const aspect = width / height;
  const spineHalfLength = Math.max(0, aspect - 1.0);
  const u = (((x + 0.5) / width) * 2 - 1) * aspect;
  const v = ((y + 0.5) / height) * 2 - 1;

  const clampedX = Math.max(-spineHalfLength, Math.min(spineHalfLength, u));
  const dx = u - clampedX;
  const dy = v;
  const dist = Math.hypot(dx, dy);

  let nx = 0;
  let ny = 0;
  let strength = 0;

  // Keep central plateau completely flat (dist < 0.56) so text stays crisp;
  // smoothly ramp optical bezel curve across the outer perimeter (0.56..1.0).
  if (dist > 1e-5 && dist >= 0.56) {
    const t = Math.min(1, (dist - 0.56) / 0.44);
    strength = t * t * (3 - 2 * t);
    nx = dx / dist;
    ny = dy / dist;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(128 + nx * strength * 127))),
    g: Math.max(0, Math.min(255, Math.round(128 + ny * strength * 127))),
    b: 128,
    a: 255,
  };
}

export function buildCapsuleDisplacementPngDataUrl(
  width = 72,
  height = 24
): string {
  const stride = 1 + width * 4;
  const raw = new Uint8Array(stride * height);

  if (raw.length > 65535) {
    throw new Error('Displacement map exceeds single deflate store block size');
  }

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // PNG filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const sample = sampleCapsuleBezelNormal(x, y, width, height);
      const idx = rowStart + 1 + x * 4;
      raw[idx] = sample.r;
      raw[idx + 1] = sample.g;
      raw[idx + 2] = sample.b;
      raw[idx + 3] = sample.a;
    }
  }

  // Wrap raw scanlines in valid zlib (CMF=0x78, FLG=0x01) + single uncompressed deflate store block
  const zlibPayload = new Uint8Array(2 + 5 + raw.length + 4);
  const zlibView = new DataView(zlibPayload.buffer);
  zlibPayload[0] = 0x78;
  zlibPayload[1] = 0x01;
  zlibPayload[2] = 0x01; // BFINAL=1, BTYPE=00 (stored)
  zlibView.setUint16(3, raw.length, true);
  zlibView.setUint16(5, raw.length ^ 0xffff, true);
  zlibPayload.set(raw, 7);
  zlibView.setUint32(7 + raw.length, adler32(raw), false);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', zlibPayload);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return `data:image/png;base64,${encodeBase64(png)}`;
}

export const LIQUID_GLASS_DISPLACEMENT_MAP = buildCapsuleDisplacementPngDataUrl(72, 24);

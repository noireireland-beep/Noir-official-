import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  LIQUID_GLASS_DISPLACEMENT_MAP,
  buildCapsuleDisplacementPngDataUrl,
  sampleCapsuleBezelNormal,
} from './liquidGlassMap';

test('LIQUID_GLASS_DISPLACEMENT_MAP is a properly padded, valid PNG data URI', () => {
  const prefix = 'data:image/png;base64,';
  assert.ok(LIQUID_GLASS_DISPLACEMENT_MAP.startsWith(prefix));

  const b64 = LIQUID_GLASS_DISPLACEMENT_MAP.slice(prefix.length);
  assert.equal(b64.length % 4, 0);

  const bytes = Buffer.from(b64, 'base64');
  // PNG 8-byte signature
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

  // Parse chunks: IHDR -> IDAT -> IEND
  let offset = 8;
  const chunks: Array<{ type: string; data: Buffer }> = [];
  while (offset < bytes.length) {
    const len = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + len);
    const actualCrc = zlib.crc32(bytes.subarray(offset + 4, offset + 8 + len));
    assert.equal(actualCrc >>> 0, expectedCrc >>> 0, `CRC mismatch in chunk ${type}`);
    chunks.push({ type, data });
    offset += 12 + len;
  }

  assert.deepEqual(
    chunks.map((c) => c.type),
    ['IHDR', 'IDAT', 'IEND']
  );

  const width = chunks[0].data.readUInt32BE(0);
  const height = chunks[0].data.readUInt32BE(4);
  assert.equal(width, 72);
  assert.equal(height, 24);

  const inflated = zlib.inflateSync(chunks[1].data);
  assert.equal(inflated.length, height * (1 + width * 4));
});

test('capsule normal map keeps center neutral and bends rim edges outward', () => {
  const center = sampleCapsuleBezelNormal(36, 12, 72, 24);
  assert.equal(center.r, 128);
  assert.equal(center.g, 128);

  const topEdge = sampleCapsuleBezelNormal(36, 0, 72, 24);
  assert.equal(topEdge.r, 128);
  assert.ok(topEdge.g < 64, `expected top edge Y normal < 64, got ${topEdge.g}`);

  const bottomEdge = sampleCapsuleBezelNormal(36, 23, 72, 24);
  assert.equal(bottomEdge.r, 128);
  assert.ok(bottomEdge.g > 192, `expected bottom edge Y normal > 192, got ${bottomEdge.g}`);

  const leftEdge = sampleCapsuleBezelNormal(0, 12, 72, 24);
  assert.ok(leftEdge.r < 64, `expected left edge X normal < 64, got ${leftEdge.r}`);

  const rightEdge = sampleCapsuleBezelNormal(71, 12, 72, 24);
  assert.ok(rightEdge.r > 192, `expected right edge X normal > 192, got ${rightEdge.r}`);
});

test('buildCapsuleDisplacementPngDataUrl guards against oversize single-block payloads', () => {
  assert.throws(() => buildCapsuleDisplacementPngDataUrl(200, 100));
});

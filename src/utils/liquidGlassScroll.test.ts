import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLiquidGlassMetrics } from './liquidGlassScroll';

test('computeLiquidGlassMetrics returns baseline clear optical values at scroll start', () => {
  const start = computeLiquidGlassMetrics({ scrollY: 0, maxScroll: 1000 });
  assert.equal(start.progress, 0);
  assert.equal(start.blurPx, 12);
  assert.equal(start.stdDeviation, 1.2);
  assert.equal(start.displacementScale, -14);
  assert.equal(start.transformScale, 1);
});

test('computeLiquidGlassMetrics monotonically increases blur radius and scale intensity on scroll', () => {
  const start = computeLiquidGlassMetrics({ scrollY: 0, maxScroll: 1000 });
  const mid = computeLiquidGlassMetrics({ scrollY: 500, maxScroll: 1000 });
  const end = computeLiquidGlassMetrics({ scrollY: 1000, maxScroll: 1000 });

  assert.ok(mid.blurPx > start.blurPx);
  assert.ok(end.blurPx >= mid.blurPx);
  assert.ok(mid.transformScale > start.transformScale);
  assert.ok(end.transformScale >= mid.transformScale);
  assert.ok(Math.abs(mid.displacementScale) > Math.abs(start.displacementScale));
  assert.ok(Math.abs(end.displacementScale) >= Math.abs(mid.displacementScale));
  assert.ok(end.stdDeviation > start.stdDeviation);
});

test('computeLiquidGlassMetrics merges external story progress and clamps bounds', () => {
  const story = computeLiquidGlassMetrics({
    scrollY: 0,
    maxScroll: 0,
    externalProgress: 0.75,
  });
  assert.equal(story.progress, 0.75);
  assert.ok(story.blurPx > 20);
  assert.ok(story.transformScale > 1.03);

  const clampedHigh = computeLiquidGlassMetrics({
    scrollY: 5000,
    maxScroll: 1000,
    externalProgress: 2.5,
  });
  assert.equal(clampedHigh.progress, 1);
  assert.equal(clampedHigh.blurPx, 28);
  assert.equal(clampedHigh.transformScale, 1.045);

  const clampedLow = computeLiquidGlassMetrics({
    scrollY: -200,
    maxScroll: 1000,
    externalProgress: -0.5,
  });
  assert.equal(clampedLow.progress, 0);
});

/**
 * Pure scroll-triggered optical math for `.noire-liquid-glass`.
 * Computes compositor transform scale, backdrop blur radius,
 * and SVG displacement scale across scroll & storytelling progress.
 */

export interface LiquidGlassScrollInput {
  scrollY?: number;
  maxScroll?: number;
  externalProgress?: number;
  baseFrost?: number;
  baseSaturation?: number;
}

export interface LiquidGlassScrollMetrics {
  progress: number;
  blurPx: number;
  stdDeviation: number;
  displacementScale: number;
  transformScale: number;
  frostOpacity: number;
  saturation: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function computeLiquidGlassMetrics(
  input: LiquidGlassScrollInput = {}
): LiquidGlassScrollMetrics {
  const {
    scrollY = 0,
    maxScroll = 1,
    externalProgress,
    baseFrost = 0.14,
    baseSaturation = 1.12,
  } = input;

  const normalizedScroll = maxScroll > 0 ? clamp(scrollY / maxScroll, 0, 1) : 0;
  const externalClamped =
    typeof externalProgress === 'number' && Number.isFinite(externalProgress)
      ? clamp(externalProgress, 0, 1)
      : 0;

  const progress = clamp(Math.max(normalizedScroll, externalClamped), 0, 1);
  // Smooth ease-out curve so early scroll across sections gives crisp optical response
  const eased = progress * (2 - progress);

  const blurPx = Number((12 + 16 * eased).toFixed(2));
  const stdDeviation = Number((1.2 + 3.0 * eased).toFixed(2));
  const displacementScale = Number((-14 - 20 * eased).toFixed(2));
  const transformScale = Number((1 + 0.045 * eased).toFixed(4));
  const frostOpacity = Number(clamp(baseFrost + 0.06 * eased, 0.06, 0.28).toFixed(3));
  const saturation = Number(clamp(baseSaturation + 0.12 * eased, 1.04, 1.35).toFixed(3));

  return {
    progress,
    blurPx,
    stdDeviation,
    displacementScale,
    transformScale,
    frostOpacity,
    saturation,
  };
}

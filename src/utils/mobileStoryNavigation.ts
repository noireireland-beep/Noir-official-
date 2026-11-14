export interface StoryChapter {
  id: string;
  index: number;
  code: string;
  label: string;
  time: number;
  minProgress: number;
  maxProgress: number;
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  { id: 'opening', index: 0, code: '00', label: 'ARCHIVE DROP', time: 0, minProgress: 0, maxProgress: 0.05 },
  { id: 'studio', index: 1, code: '01', label: 'STUDIO RECORD', time: 1.25, minProgress: 0.05, maxProgress: 0.21 },
  { id: 'craft', index: 2, code: '02', label: '88 SETS · PATIENCE', time: 2.75, minProgress: 0.21, maxProgress: 0.36 },
  { id: 'manifesto', index: 3, code: '03', label: 'THIS IS NOT ORDINARY', time: 4.35, minProgress: 0.36, maxProgress: 0.45 },
  { id: 'provenance', index: 4, code: '04', label: 'PROVENANCE · 88/8B', time: 5.25, minProgress: 0.45, maxProgress: 0.56 },
  { id: 'valuation', index: 5, code: '05', label: 'ALL FOR 88€', time: 6.35, minProgress: 0.56, maxProgress: 0.72 },
  { id: 'totebag', index: 6, code: '06', label: 'NATURAL TOTEBAG', time: 8.15, minProgress: 0.72, maxProgress: 0.87 },
  { id: 'finale', index: 7, code: '07', label: 'OWN YOUR DIFFERENCE', time: 9.65, minProgress: 0.87, maxProgress: 1.01 },
] as const;

export const TOTAL_STORY_CHAPTERS = STORY_CHAPTERS.length - 1;
export const STORY_REPLAY_SLIDE_INDEX = 1;
export const STORY_REPLAY_PROGRESS = 0.078;

export interface StoryProgressState {
  chapter: StoryChapter;
  progress: number;
  percent: number;
  isStoryActive: boolean;
}

export function getStoryChapterForProgress(rawProgress: number): StoryProgressState {
  const safeProgress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(1, rawProgress))
    : 0;

  const matched =
    STORY_CHAPTERS.find(
      (ch) => safeProgress >= ch.minProgress && safeProgress < ch.maxProgress
    ) || STORY_CHAPTERS[STORY_CHAPTERS.length - 1];

  return {
    chapter: matched,
    progress: safeProgress,
    percent: Math.round(safeProgress * 100),
    isStoryActive: safeProgress > 0.045,
  };
}

export function getStoryProgressStateForSlide(slideIndex: number): StoryProgressState {
  const safeIndex = Number.isFinite(slideIndex)
    ? Math.max(0, Math.min(STORY_CHAPTERS.length - 1, Math.round(slideIndex)))
    : 0;
  const chapter = STORY_CHAPTERS[safeIndex];
  const percent = Math.round((safeIndex / TOTAL_STORY_CHAPTERS) * 100);

  return {
    chapter,
    progress: safeIndex / TOTAL_STORY_CHAPTERS,
    percent,
    isStoryActive: safeIndex > 0,
  };
}

export function stepStorySlide(params: {
  currentStep: number;
  direction: 1 | -1;
}): { nextStep: number; shouldExitToArchive: boolean; changed: boolean } {
  const { currentStep, direction } = params;
  const maxStep = STORY_CHAPTERS.length - 1;
  const clamped = Math.max(0, Math.min(maxStep, Math.round(currentStep)));

  if (direction === 1 && clamped >= maxStep) {
    return { nextStep: maxStep, shouldExitToArchive: true, changed: false };
  }

  if (direction === -1 && clamped <= 0) {
    return { nextStep: 0, shouldExitToArchive: false, changed: false };
  }

  const nextStep = clamped + direction;
  return {
    nextStep,
    shouldExitToArchive: false,
    changed: nextStep !== clamped,
  };
}

export interface WheelStepEvaluation {
  shouldTrigger: boolean;
  isInertialTail: boolean;
}

/**
 * Evaluates whether an incoming wheel event on the discrete mobile story stage
 * should advance/retreat a slide.
 * Allows rapid multi-scrolls (2x/3x quick wheel clicks or violent flicks >= 120ms apart)
 * while suppressing low-amplitude decaying trackpad inertia tails.
 */
export function evaluateWheelStoryStep(params: {
  deltaY: number;
  nowMs: number;
  lastStepTimeMs: number;
  lastStepDeltaAbs: number;
  lastDirection: 1 | -1 | 0;
  minIntervalMs?: number;
}): WheelStepEvaluation {
  const {
    deltaY,
    nowMs,
    lastStepTimeMs,
    lastStepDeltaAbs,
    lastDirection,
    minIntervalMs = 135,
  } = params;

  const absDelta = Math.abs(deltaY);
  if (!Number.isFinite(deltaY) || absDelta < 8) {
    return { shouldTrigger: false, isInertialTail: false };
  }

  const direction: 1 | -1 = deltaY > 0 ? 1 : -1;
  const elapsed = nowMs - lastStepTimeMs;
  const isDirectionChange = lastDirection !== 0 && direction !== lastDirection;

  // Immediate reversal always feels responsive
  if (isDirectionChange && elapsed >= 80) {
    return { shouldTrigger: true, isInertialTail: false };
  }

  // Within minimum debounce window of a notch/event burst, absorb as same gesture
  if (elapsed < minIntervalMs) {
    return { shouldTrigger: false, isInertialTail: true };
  }

  // Trackpad inertial tail filter: small decaying deltas shortly after a large flick
  const isDecayingTail =
    elapsed < 420 &&
    absDelta < 34 &&
    lastStepDeltaAbs >= 50 &&
    absDelta <= lastStepDeltaAbs * 0.6;

  if (isDecayingTail) {
    return { shouldTrigger: false, isInertialTail: true };
  }

  return { shouldTrigger: true, isInertialTail: false };
}

export function computeArchiveTargetScrollY(params: {
  ledgerTop: number;
  currentScrollY: number;
  headerHeight?: number;
}): number {
  const { ledgerTop, currentScrollY, headerHeight = 72 } = params;
  if (!Number.isFinite(ledgerTop) || !Number.isFinite(currentScrollY)) {
    return 0;
  }
  return Math.max(0, Math.round(ledgerTop + currentScrollY - headerHeight));
}

export function computeStoryReplayScrollY(params: {
  storyStart?: number;
  storyEnd?: number;
  replayProgress?: number;
}): number {
  const {
    storyStart = 0,
    storyEnd = 0,
    replayProgress = STORY_REPLAY_PROGRESS,
  } = params;

  if (!Number.isFinite(storyStart) || !Number.isFinite(storyEnd) || storyEnd <= storyStart) {
    return 0;
  }

  const clampedProgress = Math.max(0, Math.min(1, replayProgress));
  return Math.max(0, Math.round(storyStart + (storyEnd - storyStart) * clampedProgress));
}

export function computeActiveSlideFromScroll(params: {
  scrollLeft: number;
  slideOffsets: readonly number[];
}): number {
  const { scrollLeft, slideOffsets } = params;
  if (!slideOffsets.length || !Number.isFinite(scrollLeft)) {
    return 0;
  }

  let closestIndex = 0;
  let smallestDistance = Math.abs(scrollLeft - slideOffsets[0]);

  for (let i = 1; i < slideOffsets.length; i++) {
    const dist = Math.abs(scrollLeft - slideOffsets[i]);
    if (dist < smallestDistance) {
      smallestDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

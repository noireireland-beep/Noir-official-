import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORY_CHAPTERS,
  STORY_REPLAY_PROGRESS,
  TOTAL_STORY_CHAPTERS,
  getStoryChapterForProgress,
  getStoryProgressStateForSlide,
  stepStorySlide,
  evaluateWheelStoryStep,
  computeArchiveTargetScrollY,
  computeStoryReplayScrollY,
  computeActiveSlideFromScroll,
} from './mobileStoryNavigation';

test('getStoryChapterForProgress maps progress bounds and clamps invalid inputs', () => {
  const start = getStoryChapterForProgress(-0.5);
  assert.equal(start.chapter.id, 'opening');
  assert.equal(start.percent, 0);
  assert.equal(start.isStoryActive, false);

  const chapter1 = getStoryChapterForProgress(0.08);
  assert.equal(chapter1.chapter.code, '01');
  assert.equal(chapter1.chapter.label, 'STUDIO RECORD');
  assert.equal(chapter1.isStoryActive, true);

  const manifesto = getStoryChapterForProgress(0.4);
  assert.equal(manifesto.chapter.code, '03');
  assert.equal(manifesto.chapter.label, 'THIS IS NOT ORDINARY');

  const finale = getStoryChapterForProgress(0.95);
  assert.equal(finale.chapter.code, '07');
  assert.equal(finale.isStoryActive, true);

  const end = getStoryChapterForProgress(1.4);
  assert.equal(end.percent, 100);
  assert.equal(end.isStoryActive, true);

  const nanInput = getStoryChapterForProgress(Number.NaN);
  assert.equal(nanInput.chapter.id, 'opening');
});

test('stepStorySlide advances strictly one slide per gesture and signals exit at finale', () => {
  const s1 = stepStorySlide({ currentStep: 0, direction: 1 });
  assert.deepEqual(s1, { nextStep: 1, shouldExitToArchive: false, changed: true });

  const s0Back = stepStorySlide({ currentStep: 0, direction: -1 });
  assert.deepEqual(s0Back, { nextStep: 0, shouldExitToArchive: false, changed: false });

  const lastIndex = STORY_CHAPTERS.length - 1;
  const exitStep = stepStorySlide({ currentStep: lastIndex, direction: 1 });
  assert.deepEqual(exitStep, { nextStep: lastIndex, shouldExitToArchive: true, changed: false });

  const backFromFinale = stepStorySlide({ currentStep: lastIndex, direction: -1 });
  assert.deepEqual(backFromFinale, { nextStep: lastIndex - 1, shouldExitToArchive: false, changed: true });
});

test('evaluateWheelStoryStep supports rapid 2x/3x violent scrolls while suppressing trackpad inertia tails', () => {
  // Initial scroll triggers immediately
  const first = evaluateWheelStoryStep({
    deltaY: 160,
    nowMs: 1000,
    lastStepTimeMs: 0,
    lastStepDeltaAbs: 0,
    lastDirection: 0,
  });
  assert.equal(first.shouldTrigger, true);

  // Same-burst micro event at +40ms is absorbed
  const burst = evaluateWheelStoryStep({
    deltaY: 120,
    nowMs: 1040,
    lastStepTimeMs: 1000,
    lastStepDeltaAbs: 160,
    lastDirection: 1,
  });
  assert.equal(burst.shouldTrigger, false);

  // Decaying trackpad tail at +200ms is filtered out
  const tail = evaluateWheelStoryStep({
    deltaY: 16,
    nowMs: 1200,
    lastStepTimeMs: 1000,
    lastStepDeltaAbs: 160,
    lastDirection: 1,
  });
  assert.equal(tail.shouldTrigger, false);
  assert.equal(tail.isInertialTail, true);

  // Second rapid scroll at +180ms with strong delta triggers immediately
  const second = evaluateWheelStoryStep({
    deltaY: 140,
    nowMs: 1180,
    lastStepTimeMs: 1000,
    lastStepDeltaAbs: 160,
    lastDirection: 1,
  });
  assert.equal(second.shouldTrigger, true);

  // Third rapid scroll at +360ms also triggers immediately
  const third = evaluateWheelStoryStep({
    deltaY: 120,
    nowMs: 1360,
    lastStepTimeMs: 1180,
    lastStepDeltaAbs: 140,
    lastDirection: 1,
  });
  assert.equal(third.shouldTrigger, true);

  // Quick direction reversal triggers promptly
  const reverse = evaluateWheelStoryStep({
    deltaY: -60,
    nowMs: 1455,
    lastStepTimeMs: 1360,
    lastStepDeltaAbs: 120,
    lastDirection: 1,
  });
  assert.equal(reverse.shouldTrigger, true);
});

test('getStoryProgressStateForSlide derives discrete chapter metadata and percentage', () => {
  const opening = getStoryProgressStateForSlide(0);
  assert.equal(opening.isStoryActive, false);
  assert.equal(opening.percent, 0);

  const slide1 = getStoryProgressStateForSlide(1);
  assert.equal(slide1.isStoryActive, true);
  assert.equal(slide1.chapter.code, '01');

  const last = getStoryProgressStateForSlide(TOTAL_STORY_CHAPTERS);
  assert.equal(last.percent, 100);
  assert.equal(last.chapter.id, 'finale');
});

test('computeArchiveTargetScrollY lands cleanly below fixed mobile header without overshooting', () => {
  const target = computeArchiveTargetScrollY({
    ledgerTop: 1200,
    currentScrollY: 3200,
    headerHeight: 72,
  });
  assert.equal(target, 4328);

  const clamped = computeArchiveTargetScrollY({
    ledgerTop: 10,
    currentScrollY: 0,
    headerHeight: 72,
  });
  assert.equal(clamped, 0);
});

test('computeStoryReplayScrollY targets Chapter 01 entrance or safely falls back to top', () => {
  const replayY = computeStoryReplayScrollY({
    storyStart: 0,
    storyEnd: 7000,
    replayProgress: STORY_REPLAY_PROGRESS,
  });
  assert.equal(replayY, Math.round(7000 * STORY_REPLAY_PROGRESS));

  assert.equal(computeStoryReplayScrollY({ storyStart: 0, storyEnd: 0 }), 0);
  assert.equal(computeStoryReplayScrollY({ storyStart: 500, storyEnd: 200 }), 0);
});

test('computeActiveSlideFromScroll identifies nearest horizontal catalogue card', () => {
  const offsets = [0, 320, 640, 960, 1280];
  assert.equal(computeActiveSlideFromScroll({ scrollLeft: 0, slideOffsets: offsets }), 0);
  assert.equal(computeActiveSlideFromScroll({ scrollLeft: 305, slideOffsets: offsets }), 1);
  assert.equal(computeActiveSlideFromScroll({ scrollLeft: 810, slideOffsets: offsets }), 3);
  assert.equal(computeActiveSlideFromScroll({ scrollLeft: 1260, slideOffsets: offsets }), 4);
  assert.equal(computeActiveSlideFromScroll({ scrollLeft: 200, slideOffsets: [] }), 0);
});

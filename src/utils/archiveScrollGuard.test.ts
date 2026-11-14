import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_ARCHIVE_GUARD_STATE,
  computeArchiveLandmarks,
  evaluateArchiveScrollGuard,
} from './archiveScrollGuard';

const SAMPLE_LANDMARKS = computeArchiveLandmarks({
  ledgerTopRect: 7560,
  purchasingTopRect: 8760,
  purchasingBottomRect: 9080,
  currentScrollY: 0,
  viewportHeight: 900,
  headerHeight: 80,
});

test('computeArchiveLandmarks aligns archiveStartY under header and frames purchasing box', () => {
  assert.equal(SAMPLE_LANDMARKS.archiveStartY, 7480);
  assert.ok(SAMPLE_LANDMARKS.purchasingTargetY >= SAMPLE_LANDMARKS.archiveStartY);
  assert.ok(SAMPLE_LANDMARKS.purchasingTargetY < 8760);
  assert.ok(SAMPLE_LANDMARKS.purchasingExitY > SAMPLE_LANDMARKS.purchasingTargetY);
});

test('slow normal downward scroll crosses into #ledger without interruption', () => {
  const decision = evaluateArchiveScrollGuard({
    prevY: 7420,
    currentY: 7460,
    projectedTargetY: 7490,
    velocityPx: 8,
    landmarks: SAMPLE_LANDMARKS,
    state: INITIAL_ARCHIVE_GUARD_STATE,
  });

  assert.equal(decision.shouldCatch, false);
  assert.equal(decision.reason, 'none');
});

test('fast downward scroll or momentum overshoot from Hero catches cleanly at archiveStartY', () => {
  const decision = evaluateArchiveScrollGuard({
    prevY: 7380,
    currentY: 7540,
    projectedTargetY: 9800,
    velocityPx: 75,
    landmarks: SAMPLE_LANDMARKS,
    state: INITIAL_ARCHIVE_GUARD_STATE,
  });

  assert.equal(decision.shouldCatch, true);
  assert.equal(decision.reason, 'archive-entry');
  assert.equal(decision.targetY, SAMPLE_LANDMARKS.archiveStartY);
  assert.equal(decision.nextState.caughtEntry, true);
});

test('massive single-frame jump past entire #ledger still catches at archiveStartY', () => {
  const decision = evaluateArchiveScrollGuard({
    prevY: 1200,
    currentY: 9600,
    projectedTargetY: 9600,
    velocityPx: 12,
    landmarks: SAMPLE_LANDMARKS,
    state: INITIAL_ARCHIVE_GUARD_STATE,
  });

  assert.equal(decision.shouldCatch, true);
  assert.equal(decision.reason, 'archive-entry');
  assert.equal(decision.targetY, SAMPLE_LANDMARKS.archiveStartY);
});

test('violent downward scroll inside #ledger trying to skip purchasing box catches at purchasingTargetY', () => {
  const afterEntryState = {
    ...INITIAL_ARCHIVE_GUARD_STATE,
    caughtEntry: true,
  };

  const decision = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.archiveStartY + 200,
    currentY: SAMPLE_LANDMARKS.purchasingTargetY + 35,
    projectedTargetY: SAMPLE_LANDMARKS.purchasingExitY + 1200,
    velocityPx: 55,
    landmarks: SAMPLE_LANDMARKS,
    state: afterEntryState,
  });

  assert.equal(decision.shouldCatch, true);
  assert.equal(decision.reason, 'purchasing-exit');
  assert.equal(decision.targetY, SAMPLE_LANDMARKS.purchasingTargetY);
  assert.equal(decision.nextState.caughtPurchasing, true);
});

test('violent downward scroll inside #ledger never slips past purchasingTargetY across small frame steps', () => {
  const step1 = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.purchasingTargetY - 80,
    currentY: SAMPLE_LANDMARKS.purchasingTargetY - 30,
    projectedTargetY: SAMPLE_LANDMARKS.purchasingExitY + 900,
    velocityPx: 50,
    landmarks: SAMPLE_LANDMARKS,
    state: { ...INITIAL_ARCHIVE_GUARD_STATE, caughtEntry: true },
  });
  assert.equal(step1.shouldCatch, false);

  const step2 = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.purchasingTargetY - 30,
    currentY: SAMPLE_LANDMARKS.purchasingTargetY + 20,
    projectedTargetY: SAMPLE_LANDMARKS.purchasingExitY + 900,
    velocityPx: 50,
    landmarks: SAMPLE_LANDMARKS,
    state: step1.nextState,
  });
  assert.equal(step2.shouldCatch, true);
  assert.equal(step2.reason, 'purchasing-exit');
  assert.equal(step2.targetY, SAMPLE_LANDMARKS.purchasingTargetY);
});

test('once purchasing box catch is consumed, subsequent downward scrolling passes freely to lower sections', () => {
  const consumedState = {
    caughtEntry: true,
    caughtPurchasing: true,
    caughtReturn: false,
  };

  const decision = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.purchasingTargetY,
    currentY: SAMPLE_LANDMARKS.purchasingExitY + 200,
    projectedTargetY: SAMPLE_LANDMARKS.purchasingExitY + 800,
    velocityPx: 60,
    landmarks: SAMPLE_LANDMARKS,
    state: consumedState,
  });

  assert.equal(decision.shouldCatch, false);
  assert.equal(decision.reason, 'none');
});

test('fast upward scroll from Footer/Polaroid catches cleanly at purchasingTargetY', () => {
  const belowState = {
    caughtEntry: false,
    caughtPurchasing: false,
    caughtReturn: false,
  };

  const decision = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.purchasingExitY + 500,
    currentY: SAMPLE_LANDMARKS.purchasingExitY + 50,
    projectedTargetY: 4000,
    velocityPx: -68,
    landmarks: SAMPLE_LANDMARKS,
    state: belowState,
  });

  assert.equal(decision.shouldCatch, true);
  assert.equal(decision.reason, 'purchasing-return');
  assert.equal(decision.targetY, SAMPLE_LANDMARKS.purchasingTargetY);
  assert.equal(decision.nextState.caughtReturn, true);
});

test('scrolling well back into Hero resets all catch flags cleanly', () => {
  const usedState = {
    caughtEntry: true,
    caughtPurchasing: true,
    caughtReturn: true,
  };

  const decision = evaluateArchiveScrollGuard({
    prevY: SAMPLE_LANDMARKS.archiveStartY - 280,
    currentY: SAMPLE_LANDMARKS.archiveStartY - 400,
    velocityPx: -20,
    landmarks: SAMPLE_LANDMARKS,
    state: usedState,
  });

  assert.equal(decision.shouldCatch, false);
  assert.deepEqual(decision.nextState, INITIAL_ARCHIVE_GUARD_STATE);
});

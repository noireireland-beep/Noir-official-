/**
 * Pure scroll-guard logic that prevents high-velocity scrolls from
 * overshooting the Garment Archive catalogue and Purchasing section,
 * while keeping normal/slow scrolling completely fluid and never trapping users.
 */

export interface ArchiveLandmarks {
  archiveStartY: number;
  purchasingTargetY: number;
  purchasingExitY: number;
}

export interface ArchiveGuardState {
  caughtEntry: boolean;
  caughtPurchasing: boolean;
  caughtReturn: boolean;
}

export interface ArchiveGuardDecision {
  shouldCatch: boolean;
  targetY: number;
  reason: 'none' | 'archive-entry' | 'purchasing-exit' | 'purchasing-return';
  nextState: ArchiveGuardState;
}

export const INITIAL_ARCHIVE_GUARD_STATE: ArchiveGuardState = {
  caughtEntry: false,
  caughtPurchasing: false,
  caughtReturn: false,
};

export const ARCHIVE_GUARD_THRESHOLDS = {
  /** Lenis velocity (px/frame) or equivalent px/16ms considered a fast scroll */
  fastVelocityPx: 26,
  /** Faster downward velocity inside #ledger required to arrest a purchasing-box overshoot */
  fastPurchasingVelocityPx: 34,
  /** Single-tick jump distance (e.g. scrollbar drag or massive wheel burst) */
  largeJumpPx: 240,
  /** Entry hysteresis buffer above #ledger top */
  entryLeadPx: 40,
  /** Margin above #ledger entry at which flags reset when scrolling back into Hero */
  heroResetBufferPx: 260,
  /** Margin below purchasing box exit before resetting downward-entry flags */
  belowArchiveResetPx: 300,
} as const;

export function computeArchiveLandmarks(params: {
  ledgerTopRect: number;
  purchasingTopRect: number;
  purchasingBottomRect: number;
  currentScrollY: number;
  viewportHeight: number;
  headerHeight?: number;
}): ArchiveLandmarks {
  const {
    ledgerTopRect,
    purchasingTopRect,
    purchasingBottomRect,
    currentScrollY,
    viewportHeight,
    headerHeight = 76,
  } = params;

  const safeScrollY = Number.isFinite(currentScrollY) ? currentScrollY : 0;
  const safeViewportH = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 844;
  const safeHeader = Number.isFinite(headerHeight) && headerHeight >= 0 ? headerHeight : 76;

  const absLedgerTop = ledgerTopRect + safeScrollY;
  const absPurchasingTop = purchasingTopRect + safeScrollY;
  const absPurchasingBottom = purchasingBottomRect + safeScrollY;
  const boxHeight = Math.max(120, absPurchasingBottom - absPurchasingTop);

  const archiveStartY = Math.max(0, Math.round(absLedgerTop - safeHeader));

  // Frame #purchasing-box cleanly in viewport so user can immediately interact with Size & Acquire CTA.
  // Ensure top is below fixed header and bottom is inside the viewport.
  const desiredTopPadding = Math.max(
    safeHeader + 24,
    Math.round((safeViewportH - Math.min(boxHeight, safeViewportH * 0.72)) * 0.45)
  );
  const minForBottomVisibility = absPurchasingBottom - safeViewportH + 24;
  const maxForHeaderClearance = absPurchasingTop - (safeHeader + 16);

  let purchasingTargetY = Math.round(absPurchasingTop - desiredTopPadding);
  if (minForBottomVisibility > purchasingTargetY) {
    purchasingTargetY = Math.round(
      Math.min(maxForHeaderClearance, minForBottomVisibility)
    );
  }
  purchasingTargetY = Math.max(archiveStartY, purchasingTargetY);

  const purchasingExitY = Math.max(
    purchasingTargetY + 120,
    Math.round(absPurchasingBottom - safeHeader)
  );

  return {
    archiveStartY,
    purchasingTargetY,
    purchasingExitY,
  };
}

export function evaluateArchiveScrollGuard(params: {
  prevY: number;
  currentY: number;
  projectedTargetY?: number;
  velocityPx: number;
  landmarks: ArchiveLandmarks;
  state: ArchiveGuardState;
  isProgrammatic?: boolean;
}): ArchiveGuardDecision {
  const {
    prevY,
    currentY,
    projectedTargetY = currentY,
    velocityPx,
    landmarks,
    state,
    isProgrammatic = false,
  } = params;

  if (
    isProgrammatic ||
    !Number.isFinite(prevY) ||
    !Number.isFinite(currentY) ||
    landmarks.archiveStartY <= 0
  ) {
    return {
      shouldCatch: false,
      targetY: currentY,
      reason: 'none',
      nextState: state,
    };
  }

  const nextState: ArchiveGuardState = { ...state };
  const deltaY = currentY - prevY;
  const absDelta = Math.abs(deltaY);
  const absVelocity = Math.abs(Number.isFinite(velocityPx) ? velocityPx : 0);
  const effectiveTarget = Math.max(currentY, Number.isFinite(projectedTargetY) ? projectedTargetY : currentY);

  // Reset flags cleanly when far above #ledger (inside Hero) or well below #purchasing-box
  if (currentY < landmarks.archiveStartY - ARCHIVE_GUARD_THRESHOLDS.heroResetBufferPx) {
    nextState.caughtEntry = false;
    nextState.caughtPurchasing = false;
    nextState.caughtReturn = false;
    return {
      shouldCatch: false,
      targetY: currentY,
      reason: 'none',
      nextState,
    };
  }

  if (currentY > landmarks.purchasingExitY + ARCHIVE_GUARD_THRESHOLDS.belowArchiveResetPx) {
    nextState.caughtEntry = false;
    nextState.caughtPurchasing = false;
  }

  const isScrollingDown = deltaY > 0.5 || velocityPx > 2;
  const isScrollingUp = deltaY < -0.5 || velocityPx < -2;

  const isFastScroll =
    absVelocity >= ARCHIVE_GUARD_THRESHOLDS.fastVelocityPx ||
    absDelta >= ARCHIVE_GUARD_THRESHOLDS.largeJumpPx;

  const isFastPurchasingScroll =
    absVelocity >= ARCHIVE_GUARD_THRESHOLDS.fastPurchasingVelocityPx ||
    absDelta >= ARCHIVE_GUARD_THRESHOLDS.largeJumpPx;

  // 1. DOWNWARD: Crossing from Hero into / past #ledger (Product Catalogue entry)
  if (
    isScrollingDown &&
    !nextState.caughtEntry &&
    prevY < landmarks.archiveStartY - ARCHIVE_GUARD_THRESHOLDS.entryLeadPx &&
    currentY >= landmarks.archiveStartY - ARCHIVE_GUARD_THRESHOLDS.entryLeadPx
  ) {
    const projectedOvershoot = effectiveTarget > landmarks.archiveStartY + 260;
    const directOvershoot = currentY > landmarks.archiveStartY + 140;

    if (isFastScroll || projectedOvershoot || directOvershoot) {
      nextState.caughtEntry = true;
      return {
        shouldCatch: true,
        targetY: landmarks.archiveStartY,
        reason: 'archive-entry',
        nextState,
      };
    }
  }

  // 2. DOWNWARD: Trying to blow straight past #purchasing-box at high speed
  const purchasingTriggerY = landmarks.purchasingTargetY - 24;
  if (
    isScrollingDown &&
    !nextState.caughtPurchasing &&
    prevY < purchasingTriggerY &&
    currentY >= purchasingTriggerY
  ) {
    const blownPastBox =
      currentY > landmarks.purchasingExitY - 40 ||
      effectiveTarget > landmarks.purchasingExitY + 140;

    if (isFastPurchasingScroll || blownPastBox) {
      nextState.caughtEntry = true;
      nextState.caughtPurchasing = true;
      return {
        shouldCatch: true,
        targetY: landmarks.purchasingTargetY,
        reason: 'purchasing-exit',
        nextState,
      };
    }
  }

  // 3. UPWARD: Returning quickly from lower sections (Polaroid / Redemption / Footer)
  //    Catch right on #purchasing-box so acquisition CTA is immediately accessible
  if (
    isScrollingUp &&
    !nextState.caughtReturn &&
    prevY > landmarks.purchasingExitY + 120 &&
    currentY <= landmarks.purchasingExitY + 120
  ) {
    const projectedUpOvershoot =
      Number.isFinite(projectedTargetY) && projectedTargetY < landmarks.archiveStartY - 120;
    const directUpOvershoot = currentY < landmarks.purchasingTargetY - 100;

    if (isFastScroll || projectedUpOvershoot || directUpOvershoot) {
      nextState.caughtReturn = true;
      nextState.caughtPurchasing = true;
      return {
        shouldCatch: true,
        targetY: landmarks.purchasingTargetY,
        reason: 'purchasing-return',
        nextState,
      };
    }
  }

  return {
    shouldCatch: false,
    targetY: currentY,
    reason: 'none',
    nextState,
  };
}

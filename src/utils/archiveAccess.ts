export const ARCHIVE_ACCESS_PASSKEY = 'shrek0shamrock67';

export interface PasskeyValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePasskeyAttempt(input: string): PasskeyValidationResult {
  if (!input || input.trim().length === 0) {
    return {
      valid: false,
      error: 'Please enter the archive passkey.',
    };
  }

  if (input !== ARCHIVE_ACCESS_PASSKEY) {
    return {
      valid: false,
      error: 'Incorrect passkey. Access denied.',
    };
  }

  return { valid: true };
}

export function computePreloadPercent(
  completed: number,
  total: number,
  allComplete: boolean
): number {
  if (allComplete) return 100;
  if (total <= 0) return 0;
  const clamped = Math.max(0, Math.min(total, completed));
  return Math.min(99, Math.round((clamped / total) * 98));
}

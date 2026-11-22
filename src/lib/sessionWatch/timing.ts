/**
 * The timing rules of the portal's signing out soon banner (suite spec 0016, AC-12, AC-12a,
 * AC-12b). Pure, so they are tested on their own; `watch.ts` owns the timers that use them.
 * Times called "server" are on welinc-auth's clock: the browser's clock plus the clock gap.
 */

/** Real input sends an activity ping at most once a minute per tab (AC-12a). */
export const ACTIVITY_GAP_MS = 60_000;
/** The cutoff check runs this long before the cutoff (AC-12b). */
export const WARNING_MS = 120_000;
/** A cutoff this much past the warning point counts as moved, not as clock noise. */
export const CUTOFF_SLACK_MS = 5_000;
/** The banner speaks the time left once when it opens, and again at this point (AC-12). */
export const ANNOUNCE_AGAIN_MS = 30_000;
/** A failed check retries at 5, 15 and 30 s, then waits for the cutoff itself (AC-12b). */
const RETRY_STEPS_MS = [5_000, 15_000, 30_000];

/** The cutoffs one launcher answer gives, in milliseconds, with the clock gap. */
export type HeldCutoffs = {
  /** The earlier of the idle and the 12 hour cutoff, on the server's clock. */
  cutoff: number;
  /** The 12 hour cutoff, on the server's clock. */
  absolute: number;
  /** `serverTime` minus the browser's clock when the answer arrived. */
  gap: number;
};

/**
 * The cutoffs in a launcher answer, or null when it has none (an older welinc-auth) or they
 * don't parse. `receivedAt` is the browser's clock when the answer arrived.
 */
export function readCutoffs(body: object, receivedAt: number): HeldCutoffs | null {
  const answer = body as { sessionExpiresAt?: unknown; sessionAbsoluteExpiresAt?: unknown; serverTime?: unknown };
  const cutoff = Date.parse(String(answer.sessionExpiresAt ?? ''));
  const absolute = Date.parse(String(answer.sessionAbsoluteExpiresAt ?? ''));
  const server = Date.parse(String(answer.serverTime ?? ''));
  if (![cutoff, absolute, server].every(Number.isFinite)) return null;
  return { cutoff, absolute, gap: server - receivedAt };
}

/** True when the cutoff is the 12 hour end, which nothing extends (the two within 1 s). */
export function isMaxAge(held: Pick<HeldCutoffs, 'cutoff' | 'absolute'>): boolean {
  return held.cutoff >= held.absolute - 1000;
}

/** How long to wait before the activity ping for input seen at `now`; 0 sends it now. */
export function activityDelayMs(lastPingAt: number, now: number): number {
  return Math.max(0, lastPingAt + ACTIVITY_GAP_MS - now);
}

/** When to check the cutoff: 120 s before it, or now. */
export function checkDelayMs(cutoff: number, serverNow: number): number {
  return Math.max(0, cutoff - serverNow - WARNING_MS);
}

/**
 * What a fresh cutoff means: past its time, leave; moved past the warning point (work in another
 * tab or system), reschedule quietly; otherwise the banner shows.
 */
export function afterCheck(cutoff: number, serverNow: number): 'leave' | 'reschedule' | 'warn' {
  if (cutoff <= serverNow) return 'leave';
  return cutoff - serverNow > WARNING_MS + CUTOFF_SLACK_MS ? 'reschedule' : 'warn';
}

/**
 * The wait before retry `attempt` (0 based) of a failed check, or null once the three retries
 * are used. A 429's `Retry-After` (seconds) stretches the step, never shortens it.
 */
export function retryDelayMs(attempt: number, retryAfterSeconds: number | null): number | null {
  const step = RETRY_STEPS_MS[attempt];
  if (step === undefined) return null;
  return retryAfterSeconds !== null && retryAfterSeconds > 0 ? Math.max(step, retryAfterSeconds * 1000) : step;
}

/** "1:05", "0:09": the banner's countdown. Never below 0:00. */
export function countdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** What a screen reader hears: whole minutes while a minute or more is left, else the seconds. */
export function spokenTimeLeft(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  if (seconds > ANNOUNCE_AGAIN_MS / 1000 && seconds >= 60) {
    const minutes = Math.round(seconds / 60);
    return `Signing out in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  return `Signing out in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../api';
import type { LauncherAnswer } from '../auth';
import { notifyError } from '../notify';
import {
  activityDelayMs,
  afterCheck,
  checkDelayMs,
  isMaxAge,
  readCutoffs,
  retryDelayMs,
  type HeldCutoffs,
} from './timing';

/*
  Suite spec 0016, AC-12a and AC-12b: the portal's session watch. It holds the latest cutoffs
  from any launcher answer (in memory only, never in storage), sends activity pings on real
  input, checks `/auth/sso` 120 s before the cutoff, shows the signing out soon banner, and
  leaves for `/login?reason=idle|maxage` only when the server agrees. It runs only while the
  signed in launcher or Admin is on screen (`useSessionWatch`).
*/

/** The banner's state: the cutoff on the server's clock, the 12 hour case, Stay signed in running. */
export type SigningOut = { cutoff: number; cannotExtend: boolean; busy: boolean };

type Check =
  | { kind: 'ok'; held: HeldCutoffs }
  | { kind: 'ended' }
  | { kind: 'no-access' }
  | { kind: 'failed'; retryAfter: number | null };

/** What travels on `welinc-session` besides the plain `'signed-out'` string `session.ts` sends. */
type WatchMessage =
  | { type: 'cutoffs'; cutoff: number; absolute: number; gap: number }
  | { type: 'stay' }
  | { type: 'ended'; reason: 'idle' | 'maxage' };

const SESSION_CHANNEL = 'welinc-session';
/** Real input only: never pointer moves, scrolls by script or background checks. */
const INPUT_EVENTS = ['keydown', 'pointerdown', 'touchstart', 'wheel'] as const;

let held: HeldCutoffs | null = null;
let banner: SigningOut | null = null;
let active = false;
let leaving = false;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setTimeout> | null = null;
let lastPingAt = 0;
let retryAttempt = 0;
let checking: Promise<Check['kind']> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
/** Suite spec 0019, AC-20: the latest launcher answer, in memory only (the system switcher). */
let answer: LauncherAnswer | null = null;
const answerListeners = new Set<() => void>();

// ---------------------------------------------------------------------------------------------
// The store

function setBanner(next: SigningOut | null) {
  banner = next;
  for (const listener of listeners) listener();
}

/** Keeps an answer that carries a user and its systems; anything else is ignored. */
function rememberAnswer(data: object) {
  const next = data as Partial<LauncherAnswer>;
  if (!next.user || !Array.isArray(next.systems)) return;
  answer = next as LauncherAnswer;
  for (const listener of answerListeners) listener();
}

/** The latest launcher answer this tab saw, or null before any (Admin after a reload asks once). */
export function currentAnswer(): LauncherAnswer | null {
  return answer;
}

/** The latest launcher answer for React (the system switcher's systems, urls and roles). */
export function useHeldAnswer(): LauncherAnswer | null {
  return useSyncExternalStore((listener) => {
    answerListeners.add(listener);
    return () => answerListeners.delete(listener);
  }, currentAnswer);
}

/** The browser's clock moved onto welinc-auth's, with the gap from the latest answer. */
export function serverNow(): number {
  return Date.now() + (held?.gap ?? 0);
}

/** The held clock gap: welinc-auth's clock minus the browser's. */
export function clockGap(): number {
  return held?.gap ?? 0;
}

/** True once any launcher answer gave this tab its cutoffs. */
export function hasCutoffs(): boolean {
  return held !== null;
}

/**
 * Every launcher answer comes through here (`/auth/sso`, the login answer, the code step answer):
 * the latest cutoffs and clock gap replace the held ones, and a running watch plans again.
 */
export function holdCutoffs(data: object, receivedAt: number = Date.now()): void {
  rememberAnswer(data);
  const next = readCutoffs(data, receivedAt);
  if (!next) return;
  held = next;
  plan();
}

/** The banner now: null while nothing is about to end. */
export function currentSigningOut(): SigningOut | null {
  return banner;
}

/** The banner for React. */
export function useSigningOut(): SigningOut | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, currentSigningOut);
}

// ---------------------------------------------------------------------------------------------
// Planning and checking

function clearCheck() {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = null;
}

function later(ms: number) {
  clearCheck();
  checkTimer = setTimeout(() => void check(), Math.max(0, ms));
}

/**
 * Plans the next check from the held cutoff: 120 s before it, or, with the banner open, the last
 * check at the cutoff itself. A cutoff that moved past the warning point closes the banner.
 */
function plan() {
  clearCheck();
  if (!active || leaving || !held) return;
  const now = serverNow();
  if (banner) {
    if (afterCheck(held.cutoff, now) === 'reschedule') setBanner(null);
    else {
      setBanner({ ...banner, cutoff: held.cutoff, cannotExtend: banner.cannotExtend || isMaxAge(held) });
      later(held.cutoff - now);
      return;
    }
  }
  later(checkDelayMs(held.cutoff, now));
}

/** One `/auth/sso` call, reduced to what the watch needs (never counts as activity). */
async function fetchCutoffs(): Promise<Check> {
  try {
    const { data } = await api.get<object>('/auth/sso');
    rememberAnswer(data);
    const next = readCutoffs(data, Date.now());
    return next ? { kind: 'ok', held: next } : { kind: 'failed', retryAfter: null };
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: { code?: unknown }; headers?: Record<string, unknown> } } | null)
      ?.response;
    if (response?.status === 401) return { kind: 'ended' };
    if (response?.status === 403 && response.data?.code === 'NO_SYSTEM_ACCESS') return { kind: 'no-access' };
    const retryAfter = Number(response?.headers?.['retry-after']);
    return { kind: 'failed', retryAfter: response?.status === 429 && Number.isFinite(retryAfter) ? retryAfter : null };
  }
}

/** Runs one check, or joins the one already running. Answers how it went. */
function check(): Promise<Check['kind']> {
  if (checking) return checking;
  clearCheck();
  checking = runCheck().finally(() => {
    checking = null;
  });
  return checking;
}

async function runCheck(): Promise<Check['kind']> {
  const result = await fetchCutoffs();
  if (leaving || !active) return result.kind;
  if (result.kind === 'ended') {
    leave(held && isMaxAge(held) ? 'maxage' : 'idle');
    return result.kind;
  }
  if (result.kind === 'no-access') {
    leaveTo('/login?error=NO_SYSTEM_ACCESS');
    return result.kind;
  }
  if (result.kind === 'failed') {
    afterFailedCheck(result.retryAfter);
    return result.kind;
  }
  retryAttempt = 0;
  held = result.held;
  post({ type: 'cutoffs', ...held });
  const now = serverNow();
  const next = afterCheck(held.cutoff, now);
  if (next === 'leave') leave(isMaxAge(held) ? 'maxage' : 'idle');
  else if (next === 'reschedule') {
    setBanner(null);
    plan();
  } else {
    setBanner({
      cutoff: held.cutoff,
      cannotExtend: (banner?.cannotExtend ?? false) || isMaxAge(held),
      busy: banner?.busy ?? false,
    });
    // The last check, at the cutoff: work elsewhere meanwhile still keeps the session
    later(held.cutoff - now);
  }
  return result.kind;
}

/**
 * A check that failed (not 401 or 403) keeps the held cutoff and still shows the banner. It
 * retries at 5, 15 and 30 s (later after a 429's `Retry-After`), never past the cutoff, and at
 * the cutoff a failed check leaves.
 */
function afterFailedCheck(retryAfter: number | null) {
  const step = retryDelayMs(retryAttempt, retryAfter);
  retryAttempt += 1;
  if (!held) {
    // Admin's first look, before any answer: just retry, there is no cutoff to count to
    if (step !== null) later(step);
    return;
  }
  const untilCutoff = held.cutoff - serverNow();
  if (untilCutoff <= 0) return leave(isMaxAge(held) ? 'maxage' : 'idle');
  if (!banner) setBanner({ cutoff: held.cutoff, cannotExtend: isMaxAge(held), busy: false });
  later(step === null ? untilCutoff : Math.min(step, untilCutoff));
}

// ---------------------------------------------------------------------------------------------
// Stay signed in and the activity pinger

function sendActivity(): Promise<'ok' | 'ended' | 'ignored'> {
  lastPingAt = Date.now();
  // A JSON body, or the CSRF guard answers 403. A 429 or a network error is ignored, no retry.
  return api
    .post('/auth/session/activity', {})
    .then(() => 'ok' as const)
    .catch((error: { response?: { status?: number } }) => (error.response?.status === 401 ? 'ended' : 'ignored'));
}

/**
 * **Stay signed in**: an activity ping, then a fresh check. When the check finds the cutoff
 * didn't move, it is the 12 hour end: the banner says so and loses its action.
 */
export async function staySignedIn(): Promise<void> {
  if (!banner || banner.busy || banner.cannotExtend) return;
  setBanner({ ...banner, busy: true });
  const ping = await sendActivity();
  if (ping === 'ended') return leave('idle');
  if (ping === 'ok') post({ type: 'stay' });
  // A check that started before the ping can't show its effect: wait it out, then check afresh
  if (checking) await checking;
  if (leaving) return;
  const outcome = await check();
  if (leaving || !banner) return;
  setBanner({ ...banner, busy: false, cannotExtend: banner.cannotExtend || outcome === 'ok' });
  if (outcome === 'failed') notifyError("Couldn't reach the sign in service. Try again.");
}

async function pingNow() {
  pingTimer = null;
  if (!active || leaving) return;
  if ((await sendActivity()) === 'ended') return leave('idle');
  // While the banner shows, every ping is followed by one check; input alone never closes it
  if (banner && !banner.busy) void check();
}

/** Real input: a ping now on the first input, then at most once a minute (one trailing ping). */
function onInput(event: Event) {
  if (!event.isTrusted || !active || leaving || pingTimer) return;
  const delay = activityDelayMs(lastPingAt, Date.now());
  if (delay === 0) void pingNow();
  else pingTimer = setTimeout(() => void pingNow(), delay);
}

// ---------------------------------------------------------------------------------------------
// Leaving and the other tabs

function leave(reason: 'idle' | 'maxage') {
  leaveTo(`/login?reason=${reason}`, { type: 'ended', reason });
}

function leaveTo(url: string, message?: WatchMessage) {
  if (leaving) return;
  leaving = true;
  stopTimers();
  if (message) post(message);
  window.location.assign(url);
}

function post(message: WatchMessage) {
  try {
    channel?.postMessage(message);
  } catch {
    // A closed channel: other tabs catch up on their own checks
  }
}

function onMessage(event: MessageEvent) {
  const message = event.data as WatchMessage | string | null;
  if (!message || typeof message !== 'object' || leaving) return;
  if (message.type === 'cutoffs') {
    held = { cutoff: message.cutoff, absolute: message.absolute, gap: message.gap };
    plan();
  } else if (message.type === 'stay') {
    if (active && banner && !banner.busy) void check();
  } else if (message.type === 'ended' && active) {
    leaveTo(`/login?reason=${message.reason}`);
  }
}

function openChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.addEventListener('message', onMessage);
}

function stopTimers() {
  clearCheck();
  if (pingTimer) clearTimeout(pingTimer);
  pingTimer = null;
}

// ---------------------------------------------------------------------------------------------
// Start and stop

/** Starts the watch; with no cutoffs yet (Admin after a reload or a pasted link), asks `/auth/sso` once. */
export function startSessionWatch(): void {
  if (active) return;
  active = true;
  openChannel();
  if (typeof window !== 'undefined') {
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { capture: true, passive: true });
  }
  if (held) plan();
  else void check();
}

/** Stops the watch and closes the banner (the form, a sign out). The held cutoffs stay. */
export function stopSessionWatch(): void {
  if (!active) return;
  active = false;
  stopTimers();
  if (typeof window !== 'undefined') {
    for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput, { capture: true });
  }
  setBanner(null);
}

/** Runs the watch while `on` is true (the signed in launcher, Admin). */
export function useSessionWatch(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    startSessionWatch();
    return stopSessionWatch;
  }, [on]);
}

/** Tests only: back to a fresh tab. */
export function resetSessionWatchForTests(): void {
  stopSessionWatch();
  channel?.close();
  channel = null;
  held = null;
  banner = null;
  answer = null;
  leaving = false;
  lastPingAt = 0;
  retryAttempt = 0;
  checking = null;
}

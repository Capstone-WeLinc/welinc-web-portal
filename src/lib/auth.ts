import { API_BASE_URL } from './api';

/**
 * The portal's side of the web login (spec 0001 section 7, spec 0003 AC-36). The portal holds no
 * token and stores nothing about the session: welinc-auth's HttpOnly `welinc_sso` cookie is the
 * session, and the portal only asks `/auth/sso` and posts `/auth/login`.
 */

/** One launcher card (spec 0007, AC-1). */
export type LauncherSystem = {
  system: string;
  name: string;
  description: string;
  url: string;
  roles: { code: string; name: string }[];
};

/** A system the person holds only through its phone app (suite spec 0014, AC-4). */
export type MobileSystem = {
  system: string;
  name: string;
  description: string;
  roles: { code: string; name: string }[];
  app: { clientId: string; released: boolean };
};

/** What `/auth/login` and `/auth/sso` answer: who signed in, and the systems they hold. */
export type LauncherAnswer = {
  user: { id: string; name: string; email: string; picture: string | null };
  /** The systems the person can open on the web. */
  systems: LauncherSystem[];
  /** Held only through a phone app (suite spec 0014); missing from an older welinc-auth. */
  mobileSystems?: MobileSystem[];
};

/** The phone only systems, empty when the answer has none. */
export const mobileSystemsOf = (answer: LauncherAnswer): MobileSystem[] => answer.mobileSystems ?? [];

/** A message shown above the form, from the address the portal was opened with. */
export type Notice = { tone: 'info' | 'error'; message: string };

const SYSTEM_NAMES: Record<string, string> = { VRMS: 'VRMS', VMMS: 'VMMS', BMS: 'BMS' };

/** The plain message for each error code and reason the apps send here (AC-36). */
export function noticeFor(params: URLSearchParams): Notice | null {
  const reason = params.get('reason');
  if (reason === 'logout') return { tone: 'info', message: 'You signed out.' };
  if (reason === 'ended') return { tone: 'info', message: 'Your session ended. Sign in again.' };
  if (reason === 'idle') {
    return { tone: 'info', message: 'You were signed out after 30 minutes without activity.' };
  }
  if (reason === 'maxage') {
    return { tone: 'info', message: 'Your session reached its 12 hour limit. Sign in again to keep working.' };
  }
  switch (params.get('error')) {
    case 'LOGIN_REQUEST_EXPIRED':
      return { tone: 'error', message: 'Your sign in took too long and expired. Sign in again.' };
    case 'LOGIN_STATE_INVALID':
      return {
        tone: 'error',
        message: "We couldn't finish signing you in. This happens when sign in was opened twice. Sign in again.",
      };
    case 'LOGIN_FAILED':
      return { tone: 'error', message: "We couldn't sign you in just now. Sign in again." };
    case 'APP_NOT_ALLOWED':
      // Suite spec 0014, AC-7: shown on the form only when the session has gone meanwhile
      return { tone: 'error', message: 'Your role in this system uses the WeLinc mobile app, not the web.' };
    case 'NO_SYSTEM_ACCESS': {
      const system = SYSTEM_NAMES[params.get('system') ?? ''];
      return {
        tone: 'error',
        message: system
          ? `Your account has no access to ${system}. Ask your admin for a role there.`
          : 'Your account has no access to any WeLinc system. Ask your admin for a role.',
      };
    }
    default:
      return null;
  }
}

/** A login request id from `/auth/authorize`: 43 base64url characters. */
export function loginRequest(params: URLSearchParams): string | null {
  const id = params.get('request');
  return id && /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
}

/** How the portal starts, from the address alone (spec 0007, AC-11, AC-12): checked in this order. */
export type Start =
  | { kind: 'form' }
  | { kind: 'request'; request: string }
  | { kind: 'direct' };

export function startFor(params: URLSearchParams): Start {
  // A logout, idle or age cutoff always shows the form and never asks /auth/sso (AC-11)
  if (params.has('reason')) return { kind: 'form' };
  const request = loginRequest(params);
  if (request) return { kind: 'request', request };
  return { kind: 'direct' };
}

/** What `/auth/sso` said, reduced to what the screen choice needs. */
export type SsoResult =
  | { kind: 'live'; answer: LauncherAnswer }
  | { kind: 'ended' }
  | { kind: 'no-access'; email: string | null }
  | { kind: 'failed' };

/** Turns an `/auth/sso` failure (an Axios error or anything else) into a result. */
export function ssoFailure(error: unknown): SsoResult {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status === 401) return { kind: 'ended' };
  const data = response?.data as { code?: string; user?: { email?: unknown } } | undefined;
  if (response?.status === 403 && data?.code === 'NO_SYSTEM_ACCESS') {
    const email = data.user?.email;
    return { kind: 'no-access', email: typeof email === 'string' ? email : null };
  }
  return { kind: 'failed' };
}

/** The screen the portal shows. `go` leaves the portal with `location.replace`. */
export type Screen =
  | { kind: 'checking' }
  | { kind: 'form' }
  | { kind: 'go'; url: string }
  | { kind: 'launcher'; answer: LauncherAnswer }
  | { kind: 'phone-only'; answer: LauncherAnswer }
  | { kind: 'app-not-allowed'; answer: LauncherAnswer; system: string | null }
  | { kind: 'no-access'; email: string | null }
  | { kind: 'error' };

/**
 * The launcher for an answer, or straight on when there is one system and no error to read.
 * Never forwards on its own while an `error` is in the address, so a failing app can't loop
 * (AC-13, AC-14).
 */
export function screenForAnswer(params: URLSearchParams, answer: LauncherAnswer): Screen {
  // Suite spec 0014, AC-7: a system's callback sent a phone app role here
  if (params.get('error') === 'APP_NOT_ALLOWED') {
    return { kind: 'app-not-allowed', answer, system: params.get('system') };
  }
  // AC-5: no web system but a phone app; never forwarded anywhere
  if (answer.systems.length === 0 && mobileSystemsOf(answer).length > 0) {
    return { kind: 'phone-only', answer };
  }
  // Suite spec 0013, AC-14: back to the admin page whose session ended
  const back = returnPath(params);
  if (back) return { kind: 'go', url: back };
  // One system and no error: straight in, unless they administer it. An admin lands on the launcher
  // so they can reach Admin from its card; a one system admin would otherwise never see it.
  if (answer.systems.length === 1 && !params.has('error') && !administers(answer.systems[0])) {
    return { kind: 'go', url: answer.systems[0].url };
  }
  return { kind: 'launcher', answer };
}

/**
 * Whether the person holds their admin role in this system. Every system's catalog names its admin
 * role `ADMIN` (welinc-auth `prisma/catalog/`), and the launcher answer carries role codes only.
 */
export function administers(system: LauncherSystem): boolean {
  return system.roles.some((role) => role.code === 'ADMIN');
}

/**
 * Suite spec 0013, AC-14: the sign in address for an admin page whose session is gone. `ended`
 * says so on the form; a first visit with no session just shows the form.
 */
export function signInAgainHref(path: string, ended: boolean): string {
  const next = `next=${encodeURIComponent(path)}`;
  return `/login?${ended ? `reason=ended&${next}` : next}`;
}

/** The `next` page to return to after sign in: only a page of this portal's admin section. */
export function returnPath(params: URLSearchParams): string | null {
  const next = params.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  const url = new URL(next, 'https://portal.invalid');
  if (url.origin !== 'https://portal.invalid') return null;
  if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return null;
  return url.pathname + url.search;
}

/** The screen for a direct visit once `/auth/sso` answered (AC-13). */
export function screenForSso(params: URLSearchParams, result: SsoResult): Screen {
  switch (result.kind) {
    case 'live':
      return screenForAnswer(params, result.answer);
    case 'ended':
      return { kind: 'form' };
    case 'no-access':
      return { kind: 'no-access', email: result.email };
    case 'failed':
      return { kind: 'error' };
  }
}

/** Where `/auth/authorize/resume` continues an app initiated login (AC-12). */
export function resumeAddress(request: string): string {
  return `${API_BASE_URL}/auth/authorize/resume?request=${encodeURIComponent(request)}`;
}

/** The "You're here" system: `from` only when it names one of the user's systems (AC-16). */
export function currentSystem(params: URLSearchParams, answer: LauncherAnswer): string | null {
  const from = params.get('from');
  return from && answer.systems.some((s) => s.system === from) ? from : null;
}

/**
 * The `/auth/login` answer when a code is needed: an unverified email (suite spec 0009, AC-7), or
 * an admin confirming their sign in (suite spec 0013, AC-5). No session yet, a ticket for the code
 * step instead, finished the same way. The ticket stays in component state, never in the URL or
 * browser storage (AC-25).
 */
export type EmailStep = {
  status: 'EMAIL_VERIFICATION_REQUIRED' | 'SIGN_IN_CODE_REQUIRED';
  challengeId: string;
  email: string;
  resendAfter: number;
};

export function isEmailStep(data: unknown): data is EmailStep {
  const step = data as Partial<EmailStep> | null;
  return (
    (step?.status === 'EMAIL_VERIFICATION_REQUIRED' || step?.status === 'SIGN_IN_CODE_REQUIRED') &&
    typeof step.challengeId === 'string' &&
    typeof step.email === 'string'
  );
}

/** Shown back on the password step when the ticket or code has died (AC-25). */
export const CODE_EXPIRED_MESSAGE = 'That code expired. Sign in again to get a new one.';

/** The sign in form, the code step and the no access screen word these the same way. */
export const NO_ACCESS_MESSAGE = 'Your account has no access to any WeLinc system. Ask your admin for a role.';
export const INACTIVE_MESSAGE = 'This account is deactivated. Ask your admin to turn it back on.';
export const RATE_LIMITED_MESSAGE = 'Too many tries from this network. Wait a minute and try again.';
const UNREACHABLE_MESSAGE = 'Unable to reach the sign in service. Check your connection and try again.';

/**
 * Suite spec 0015: a lock runs out on its own, so say when. `lockedUntil` is the ISO time from
 * the 403 `ACCOUNT_LOCKED` body; without it (an older auth) the wording stays general.
 */
export function lockedMessage(lockedUntil?: unknown): string {
  const until = typeof lockedUntil === 'string' ? new Date(lockedUntil) : null;
  const when =
    until && !Number.isNaN(until.getTime())
      ? `at ${until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : 'in a few minutes';
  return `Too many wrong passwords. Try again ${when}, or reset your password.`;
}

type ErrorBody = {
  code?: string;
  message?: unknown;
  remainingAttempts?: number;
  isLocked?: boolean;
  lockedUntil?: unknown;
};

/** The message for a failed `/auth/login` (an Axios error or anything). */
export function loginFailure(error: unknown): string {
  const response = (
    error as { response?: { status?: number; data?: unknown; headers?: Record<string, unknown> } } | null
  )?.response;
  if (!response) return UNREACHABLE_MESSAGE;
  const data = (response.data ?? {}) as ErrorBody;
  if (data.code === 'NO_SYSTEM_ACCESS') return NO_ACCESS_MESSAGE;
  if (data.code === 'ACCOUNT_INACTIVE') return INACTIVE_MESSAGE;
  if (data.isLocked || data.code === 'ACCOUNT_LOCKED') return lockedMessage(data.lockedUntil);
  // Spec 0009 AC-5: an account that needs a sign in code (admins) gets 5 a rolling hour. This is
  // about the account, not the network, so say so and say how long (the Retry-After seconds).
  if (data.code === 'CODE_SEND_LIMIT') return codeSendLimitMessage(response.headers?.['retry-after']);
  if (response.status === 429) return RATE_LIMITED_MESSAGE;
  if (data.remainingAttempts !== undefined) return wrongPasswordMessage(Number(data.remainingAttempts));
  if (response.status === 401) return 'Incorrect email or password.';
  if (response.status === 400) {
    const msg = data.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return typeof msg === 'string' && msg ? msg : 'Check your email and password, then try again.';
  }
  return 'Something went wrong on our side. Try again in a minute.';
}

/**
 * A wrong password on the sign in form (suite spec 0015). The usual wording, with a warning only
 * on the last try before the 15 minute lock, as most sign in pages do.
 */
export function wrongPasswordMessage(left: number): string {
  if (left === 1) return 'Incorrect email or password. One more wrong try locks your account for 15 minutes.';
  return 'Incorrect email or password.';
}

/** The sign in form's message when the account's hourly sign in codes are used up. */
export function codeSendLimitMessage(retryAfter: unknown): string {
  const seconds = Number(retryAfter);
  return `This account was sent too many sign in codes. Try again in ${minutes(Number.isFinite(seconds) && seconds > 0 ? seconds : 60)}.`;
}

/** What the code step does with a failed verify or resend (AC-25). */
export type CodeFailure = { kind: 'expired' } | { kind: 'message'; message: string; clearCode: boolean };

const minutes = (seconds: number) => {
  const n = Math.max(1, Math.ceil(seconds / 60));
  return `${n} minute${n === 1 ? '' : 's'}`;
};

/** Turns a failed `/auth/login/verify-email` or resend (an Axios error or anything) into a failure. */
export function codeFailure(error: unknown): CodeFailure {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: unknown;
        headers?: Record<string, unknown>;
      };
    } | null
  )?.response;
  const data = response?.data as
    | { code?: string; attemptsLeft?: number; isLocked?: boolean; lockedUntil?: unknown }
    | undefined;
  switch (data?.code) {
    case 'INVALID_CODE': {
      const left = data.attemptsLeft ?? 0;
      return {
        kind: 'message',
        message: `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
        clearCode: true,
      };
    }
    case 'CODE_EXPIRED':
      return { kind: 'expired' };
    case 'MAIL_FAILED':
      return {
        kind: 'message',
        message: "We couldn't send your code. Try again in a minute.",
        clearCode: false,
      };
    case 'CODE_SEND_LIMIT': {
      const retryAfter = Number(response?.headers?.['retry-after']);
      return {
        kind: 'message',
        message: `Too many codes sent. Try again in ${minutes(Number.isFinite(retryAfter) ? retryAfter : 60)}.`,
        clearCode: false,
      };
    }
    case 'RATE_LIMITED':
      return { kind: 'message', message: RATE_LIMITED_MESSAGE, clearCode: false };
    case 'ACCOUNT_INACTIVE':
      return { kind: 'message', message: INACTIVE_MESSAGE, clearCode: false };
    case 'NO_SYSTEM_ACCESS':
      return {
        kind: 'message',
        message: NO_ACCESS_MESSAGE,
        clearCode: false,
      };
  }
  if (data?.isLocked) {
    return {
      kind: 'message',
      message: lockedMessage(data.lockedUntil),
      clearCode: false,
    };
  }
  if (response?.status === 401) return { kind: 'expired' };
  return {
    kind: 'message',
    message: UNREACHABLE_MESSAGE,
    clearCode: false,
  };
}

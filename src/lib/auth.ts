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

/** What `/auth/login` and `/auth/sso` answer: who signed in, and the systems they hold. */
export type LauncherAnswer = {
  user: { id: string; name: string; email: string; picture: string | null };
  systems: LauncherSystem[];
};

/** A message shown above the form, from the address the portal was opened with. */
export type Notice = { tone: 'info' | 'error'; message: string };

const SYSTEM_NAMES: Record<string, string> = { VRMS: 'VRMS', VMMS: 'VMMS', BMS: 'BMS' };

/** The plain message for each error code and reason the apps send here (AC-36). */
export function noticeFor(params: URLSearchParams): Notice | null {
  const reason = params.get('reason');
  if (reason === 'logout') return { tone: 'info', message: 'You signed out.' };
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
  | { kind: 'no-access'; email: string | null }
  | { kind: 'error' };

/**
 * The launcher for an answer, or straight on when there is one system and no error to read.
 * Never forwards on its own while an `error` is in the address, so a failing app can't loop
 * (AC-13, AC-14).
 */
export function screenForAnswer(params: URLSearchParams, answer: LauncherAnswer): Screen {
  if (answer.systems.length === 1 && !params.has('error')) {
    return { kind: 'go', url: answer.systems[0].url };
  }
  return { kind: 'launcher', answer };
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
 * The `/auth/login` answer for an unverified email (suite spec 0009, AC-7): no session yet, a
 * ticket for the code step instead. The ticket stays in component state, never in the URL or
 * browser storage (AC-25).
 */
export type EmailStep = {
  status: 'EMAIL_VERIFICATION_REQUIRED';
  challengeId: string;
  email: string;
  resendAfter: number;
};

export function isEmailStep(data: unknown): data is EmailStep {
  const step = data as Partial<EmailStep> | null;
  return (
    step?.status === 'EMAIL_VERIFICATION_REQUIRED' &&
    typeof step.challengeId === 'string' &&
    typeof step.email === 'string'
  );
}

/** Shown back on the password step when the ticket or code has died (AC-25). */
export const CODE_EXPIRED_MESSAGE = 'That code expired. Sign in again to get a new one.';

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
  const data = response?.data as { code?: string; attemptsLeft?: number; isLocked?: boolean } | undefined;
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
      return {
        kind: 'message',
        message: 'Too many tries from this network. Wait a minute and try again.',
        clearCode: false,
      };
    case 'NO_SYSTEM_ACCESS':
      return {
        kind: 'message',
        message: 'Your account has no assigned subsystem access. Contact your administrator.',
        clearCode: false,
      };
  }
  if (data?.isLocked) {
    return {
      kind: 'message',
      message: 'Your account is locked. Contact your Admin to unlock.',
      clearCode: false,
    };
  }
  if (response?.status === 401) return { kind: 'expired' };
  return {
    kind: 'message',
    message: 'Unable to reach the sign in service. Check your connection and try again.',
    clearCode: false,
  };
}

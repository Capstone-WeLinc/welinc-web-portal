import { API_BASE_URL } from './api';

/**
 * The portal's side of the web login (spec 0001 section 7, spec 0003 AC-36). The portal holds no
 * token and stores nothing about the session: welinc-auth's HttpOnly `welinc_sso` cookie is the
 * session, and the portal only asks `/auth/sso` and posts `/auth/login`.
 */

/** What `/auth/login` and `/auth/sso` answer: who signed in, and where they go. */
export type SsoAnswer = {
  user: { id: string; name: string; email: string };
  system: string;
  url: string;
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

/**
 * After a logout, an idle cutoff or the 12 hour limit the form always shows (AC-36): the portal never skips ahead
 * through `/auth/sso` then. Neither does it with an error to show.
 */
export function mayContinueSession(params: URLSearchParams): boolean {
  return !params.has('reason') && !params.has('error');
}

/** A login request id from `/auth/authorize`: 43 base64url characters. */
export function loginRequest(params: URLSearchParams): string | null {
  const id = params.get('request');
  return id && /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
}

/** Where the browser goes once signed in: back into the code flow, or the system's address. */
export function nextAddress(request: string | null, answer: SsoAnswer): string {
  return request
    ? `${API_BASE_URL}/auth/authorize/resume?request=${encodeURIComponent(request)}`
    : answer.url;
}

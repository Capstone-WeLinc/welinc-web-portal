import axios from 'axios';

/** The gateway address, checked before dev or build starts (env.schema.ts, spec 0010). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * The portal's one API client. It carries no token (spec 0003, AC-36): every call sends the
 * `welinc_sso` cookie instead, which welinc-auth sets HttpOnly on `/auth`.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Suite spec 0013, AC-14: welinc-auth answers 401 `NOT_SIGNED_IN` when the portal session behind an
 * admin call has ended. The admin section registers here while it is open, so any call (not just
 * the first `/auth/admin/me`) sends the person to sign in instead of showing a plain error.
 */
let sessionEnded: (() => void) | null = null;

export function onSessionEnded(handler: (() => void) | null) {
  sessionEnded = handler;
}

/** The response hook below on its own, so it can be tested without a request. */
export function noticeSessionEnd(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)?.response;
  if (response?.status === 401 && response.data?.code === 'NOT_SIGNED_IN') sessionEnded?.();
}

api.interceptors.response.use(undefined, (error: unknown) => {
  noticeSessionEnd(error);
  return Promise.reject(error);
});

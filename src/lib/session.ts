import { api } from './api';
import { ssoFailure, type LauncherAnswer, type SsoResult } from './auth';

/** Asks welinc-auth for the SSO session and the launcher answer. Never counts as activity. */
export function checkSso(): Promise<SsoResult> {
  return api
    .get<LauncherAnswer>('/auth/sso')
    .then(({ data }): SsoResult => ({ kind: 'live', answer: data }))
    .catch(ssoFailure);
}

/**
 * Sign out everywhere (spec 0007, AC-17): ends the shared session with the SSO cookie, then shows
 * the form with "You signed out." Throws when welinc-auth refuses or can't be reached.
 */
export async function signOutEverywhere(): Promise<void> {
  await api.post('/auth/logout', {});
  window.location.assign('/login?reason=logout');
}

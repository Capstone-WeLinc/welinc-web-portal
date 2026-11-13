import { api } from './api';
import { ssoFailure, type LauncherAnswer, type SsoResult } from './auth';

/** Asks welinc-auth for the SSO session and the launcher answer. Never counts as activity. */
export function checkSso(): Promise<SsoResult> {
  return api
    .get<LauncherAnswer>('/auth/sso')
    .then(({ data }): SsoResult => ({ kind: 'live', answer: data }))
    .catch(ssoFailure);
}

const SESSION_CHANNEL = 'welinc-session';
const SIGNED_OUT = 'signed-out';

/**
 * The form after a sign out, in this tab and (through a BroadcastChannel, which stores nothing) in
 * every other portal tab, so none keeps showing a session that already ended. Tabs of the systems
 * live on other origins and find out on their next call to their own backend.
 */
export function goToSignedOut(): void {
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage(SIGNED_OUT);
    channel.close();
  } catch {
    // No BroadcastChannel (very old browsers): other tabs catch up on their next check
  }
  window.location.assign('/login?reason=logout');
}

/** Calls `onSignedOut` when another portal tab signs out; returns the unsubscribe. */
export function onSignedOutElsewhere(onSignedOut: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    if (event.data === SIGNED_OUT) onSignedOut();
  };
  return () => channel.close();
}

/**
 * Sign out everywhere (spec 0007, AC-17): ends the shared session with the SSO cookie, then shows
 * the form with "You signed out." Throws when welinc-auth refuses or can't be reached.
 */
export async function signOutEverywhere(): Promise<void> {
  await api.post('/auth/logout', {});
  goToSignedOut();
}

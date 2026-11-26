// VRMS spec 0025, AC-7a: who is looking at the crash screen. One in memory flag, never stored in
// localStorage, sessionStorage or the address. It is set beside the Sentry role tag but before the
// monitoringOn check, so admins get the details with Sentry off too. Unknown means staff.

/** The app name on the admin crash screen's App line. */
export const APP_NAME = 'web-portal';

/** The release on the App line: the deploy's commit, "local" for a build without one. */
export const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || 'local';

let viewerId: string | null = null;
let viewerIsAdmin = false;

/** Read by the crash screen once, when it first draws. */
export function crashViewerIsAdmin(): boolean {
  return viewerIsAdmin;
}

/** A session answer named this person, or `null` on sign out; anyone new starts as staff. */
export function noteCrashViewer(id: string | null): void {
  if (id === null || id !== viewerId) viewerIsAdmin = false;
  viewerId = id;
}

/** Every `/auth/admin/me` answer overwrites the standing, so a demotion turns it off. */
export function setCrashViewerStanding(id: string, isAdmin: boolean): void {
  viewerId = id;
  viewerIsAdmin = isAdmin;
}

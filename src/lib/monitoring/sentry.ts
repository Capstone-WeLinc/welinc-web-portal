import * as Sentry from '@sentry/react';
import { apiOrigin, beforeBreadcrumb, createBeforeSend, IGNORE_ERRORS, portalRoleTag } from './filters';
import { noteCrashViewer, setCrashViewerStanding } from './standing';

// VRMS spec 0025, Browser setup (the same as welinc-web-vrms). With VITE_SENTRY_DSN blank nothing
// starts and nothing is sent (AC-14); every other call here is then a harmless no op.

const DSN = import.meta.env.VITE_SENTRY_DSN;

/** True when Sentry was started for this page load; the crash screen shows a code only then. */
export const monitoringOn = Boolean(DSN);

/** Called once from main.tsx, before createRoot. */
export function initMonitoring(): void {
  if (!DSN) return;
  const origin = apiOrigin(import.meta.env.VITE_API_BASE_URL);
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || undefined,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    // AC-4: through our gateway, never a sentry.io host from the browser
    tunnel: import.meta.env.VITE_SENTRY_TUNNEL || undefined,
    initialScope: { tags: { system: 'portal' } },
    // AC-6: collect nothing personal; beforeSend's allowlist is the second line of defence
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    // No spans are sent; the integration is what adds sentry-trace and baggage to API calls (AC-9)
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0,
    tracePropagationTargets: origin ? [origin] : [],
    maxBreadcrumbs: 20,
    ignoreErrors: IGNORE_ERRORS,
    // Console breadcrumbs are dropped here; fetch and XHR keep method, path and status
    beforeBreadcrumb,
    beforeSend: createBeforeSend(),
  });
}

/**
 * AC-1 and AC-3: the signed in person as an id only, from the SSO answer. The role tag comes later
 * from the admin standing (`setMonitoringStanding`); `null` clears both on sign out.
 */
export function setMonitoringUser(user: { id: string } | null): void {
  // AC-7a: a sign out or a different person drops the admin crash screen, with Sentry off too
  noteCrashViewer(user?.id ?? null);
  if (!monitoringOn) return;
  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag('role', undefined);
    return;
  }
  Sentry.setUser({ id: user.id });
}

/** The `role` tag from `GET /auth/admin/me`: suite_admin, system_admin or user. */
export function setMonitoringStanding(me: {
  user: { id: string };
  suiteAdmin: boolean;
  adminOf: readonly string[];
}): void {
  // AC-7a: before the off switch, so admins get the details with Sentry off too
  setCrashViewerStanding(me.user.id, me.suiteAdmin || me.adminOf.length > 0);
  if (!monitoringOn) return;
  Sentry.setUser({ id: me.user.id });
  Sentry.setTag('role', portalRoleTag(me));
}

/** Reports a render crash once, with the component stack; the event id backs the reference code. */
export function reportRenderCrash(error: unknown, componentStack: string | null | undefined): string | undefined {
  if (!monitoringOn) return undefined;
  return Sentry.captureException(error, { contexts: { react: { componentStack: componentStack ?? '' } } });
}

/** createRoot's handlers for what no boundary caught (React 19). */
export const rootErrorHandlers = {
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
  // The boundary already reported it
  onCaughtError: (error: unknown) => console.error(error),
};

import { API_BASE_URL } from './api';
import { administers, type LauncherAnswer } from './auth';

// Display rules for the launcher (spec 0007, AC-15, AC-17), kept pure so they are easy to test.

/**
 * By the browser's local hour: "Good morning" from 5 to 11, "Good afternoon" from 12 to 17, else
 * "Good evening". The small hours (0 to 4) still count as the night before, as people say it.
 */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function words(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/** The first word of the name. */
export function firstName(name: string): string {
  return words(name)[0] ?? '';
}

/** The first letters of the first and last words, upper case. */
export function initialsOf(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * The picture address, only for the one form welinc-auth stores (`/uploads/...`), loaded from
 * welinc-auth. Anything else (an outside address) shows initials instead.
 */
export function pictureUrl(picture: string | null): string | null {
  return picture && picture.startsWith('/uploads/') ? `${API_BASE_URL}${picture}` : null;
}

/** "VMMS is on the WeLinc mobile app", or "coming to" while the app hasn't shipped (suite spec 0014, AC-7). */
export function appLine(system: { system: string; app: { released: boolean } }): string {
  return system.app.released
    ? `${system.system} is on the WeLinc mobile app`
    : `${system.system} is coming to the WeLinc mobile app`;
}

/**
 * The systems one sign out ends on this browser: the web systems, then the phone only ones, each
 * once. The shared session covers all of them.
 */
export function signedInSystems(answer: Pick<LauncherAnswer, 'systems' | 'mobileSystems'>): string[] {
  return [...new Set([...answer.systems, ...(answer.mobileSystems ?? [])].map((s) => s.system))];
}

/**
 * The Sign out dialog's line (spec 0007, AC-17): names only the person's own systems; with none
 * known (the no access page, Admin) it just says to sign in again.
 */
export function signOutLine(systems?: readonly string[]): string {
  if (!systems || systems.length === 0) return "You'll need to sign in again.";
  const list = systems.length === 1 ? systems[0] : `${systems.slice(0, -1).join(', ')} and ${systems[systems.length - 1]}`;
  return `You'll be signed out of ${list} on this browser, and need to sign in again to use ${systems.length === 1 ? 'it' : 'them'}.`;
}

/**
 * Suite spec 0019, AC-2, AC-20: the role chip on a system's card. An admin of the system sees
 * Admin only; anyone else their real role names there (Operations, Chief Mechanic, Mechanic).
 */
export function roleTag(system: LauncherAnswer['systems'][number]): string {
  if (administers(system)) return 'Admin';
  return system.roles.map((role) => role.name).join(', ');
}

/** Suite spec 0019, AC-2: systems always show in this order, whatever order welinc-auth answers. */
export const SYSTEM_ORDER = ['BMS', 'VMMS', 'VRMS'] as const;

const rank = (system: string) => {
  const i = (SYSTEM_ORDER as readonly string[]).indexOf(system);
  return i === -1 ? SYSTEM_ORDER.length : i;
};

/** The systems in BMS, VMMS, VRMS order; an unknown code goes last, keeping welinc-auth's order. */
export function orderedSystems<T extends { system: string }>(systems: readonly T[]): T[] {
  return [...systems].sort((a, b) => rank(a.system) - rank(b.system));
}

/** Today on the launcher band, "Tuesday, November 24", in the browser's locale and time zone. */
export function todayLabel(now: Date): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Suite spec 0019, AC-3: how Suite management shows on the launcher. Nothing for someone who
 * administers nothing; a large card for a suite admin with no system; else the strip. `system` is
 * where a system admin's links point (the first they administer, in BMS, VMMS, VRMS order).
 */
export type SuiteEntry =
  | { kind: 'none' }
  | { kind: 'card' | 'strip'; suiteAdmin: boolean; system: string | null; line: string };

export function suiteEntryFor(answer: Pick<LauncherAnswer, 'systems' | 'suiteAdmin'>): SuiteEntry {
  const suiteAdmin = answer.suiteAdmin === true;
  const adminOf = orderedSystems(answer.systems.filter(administers)).map((s) => s.system);
  if (!suiteAdmin && adminOf.length === 0) return { kind: 'none' };
  if (suiteAdmin && answer.systems.length === 0) {
    return {
      kind: 'card',
      suiteAdmin,
      system: null,
      line: `Users and permissions across ${SYSTEM_ORDER.slice(0, -1).join(', ')} and ${SYSTEM_ORDER.at(-1)}. You have no role in a system yet.`,
    };
  }
  return {
    kind: 'strip',
    suiteAdmin,
    system: suiteAdmin ? null : adminOf[0],
    line: suiteAdmin ? 'Users and permissions in every system' : `Users and permissions in ${adminOf.join(', ')}`,
  };
}

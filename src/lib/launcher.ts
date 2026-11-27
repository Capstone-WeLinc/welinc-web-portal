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
 * Suite spec 0019, AC-2, AC-20: the role on a system's tile and switcher card. `Admin` when any role
 * there is `ADMIN` (a temporary one included), else the first role's name in catalog order (the
 * answer already lists them that way), temporary roles shown by name like any other.
 */
export function roleTag(system: LauncherAnswer['systems'][number]): string {
  if (administers(system)) return 'Admin';
  return system.roles[0]?.name ?? '';
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

/** "For VRMS", "For VMMS and VRMS", "For BMS, VMMS and VRMS" (suite spec 0019, AC-3). */
export function coversLine(systems: readonly string[]): string {
  if (systems.length <= 1) return `For ${systems[0] ?? ''}`;
  return `For ${systems.slice(0, -1).join(', ')} and ${systems[systems.length - 1]}`;
}

/**
 * Suite spec 0019, AC-3: the Suite management tile, for anyone who administers something. It covers
 * every system for a suite admin, else only the systems where they hold `ADMIN`, in BMS, VMMS, VRMS
 * order; never one where they hold another role only.
 */
export function suiteTileFor(answer: Pick<LauncherAnswer, 'systems' | 'suiteAdmin'>): { covers: string[] } | null {
  if (answer.suiteAdmin === true) return { covers: [...SYSTEM_ORDER] };
  const covers = orderedSystems(answer.systems.filter(administers)).map((s) => s.system);
  return covers.length > 0 ? { covers } : null;
}

/** AC-1: the band's account circle, the initials, or the email's first letter when there is no name. */
export function accountInitials(user: Pick<LauncherAnswer['user'], 'name' | 'email'>): string {
  if (user.name.trim()) return initialsOf(user.name);
  return (user.email.trim()[0] ?? '?').toUpperCase();
}

/**
 * Suite spec 0019, AC-2 (P5): the tile a key press opens, as its index in the shown order, or null.
 * Only a plain digit 1 to 9 that isn't repeating counts; a press while typing in a field, with a
 * modifier held, or while a menu or dialog is open does nothing (the caller checks those last two
 * against the page). A digit with no tile is null too.
 */
export function keyTarget(
  event: Pick<KeyboardEvent, 'key' | 'repeat' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  tiles: number,
): number | null {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  if (!/^[1-9]$/.test(event.key)) return null;
  const index = Number(event.key) - 1;
  return index < tiles ? index : null;
}

/**
 * VRMS spec 0027, AC-13: the system the address asks the launcher to open (`?open=VMMS`), read
 * once before `from`. A system the person can open is returned to start its handoff; one they
 * can't gives `denied` (the launcher shows as usual with an error toast); no `open` gives null.
 */
export function openRequest<T extends { system: string }>(
  params: URLSearchParams,
  systems: readonly T[],
): { system: T } | { denied: string } | null {
  const asked = params.get('open');
  if (!asked) return null;
  const system = systems.find((candidate) => candidate.system === asked);
  return system ? { system } : { denied: asked };
}

/** AC-13: the address without `open` and `from`, once the launcher has read them. */
export function withoutLaunchParams(search: string): string {
  const rest = new URLSearchParams(search);
  rest.delete('open');
  rest.delete('from');
  const query = rest.toString();
  return query ? `?${query}` : '';
}

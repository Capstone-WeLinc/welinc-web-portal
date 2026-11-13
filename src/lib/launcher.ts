import { API_BASE_URL } from './api';

// Display rules for the launcher (spec 0007, AC-15, AC-17), kept pure so they are easy to test.

/** "Good morning" before 12, "Good afternoon" before 18, else "Good evening" (browser local hour). */
export function greetingFor(hour: number): string {
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

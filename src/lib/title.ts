import { useEffect } from 'react';

// Suite spec 0019, AC-28: every route names itself in the tab, the most specific part first, then
// "WeLinc" ("People · Suite management · WeLinc").

export const SUITE_MANAGEMENT = 'Suite management';

/** AC-13: the sign in names the whole workspace, as its title on the page does. */
export const SIGN_IN_TITLE = 'Sign in · WeLinc Logistics Operations Workspace';

/** The tab title for `parts`, most specific first; empty parts are left out. */
export function pageTitle(...parts: (string | null | undefined)[]): string {
  return [...parts.map((p) => p?.trim()).filter(Boolean), 'WeLinc'].join(' · ');
}

/**
 * Sets the tab title while the screen shows. `null` leaves it to a screen inside this one: React
 * runs a child's effect before its parent's, so only the most specific screen passes a title.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = title;
  }, [title]);
}

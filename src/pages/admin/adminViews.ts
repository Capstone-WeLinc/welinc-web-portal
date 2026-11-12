import type { AdminMe } from '@/lib/admin';

/** The `/admin` views (suite spec 0013, AC-23), in sidebar order. */
export type AdminView = {
  path: string;
  label: string;
  /** Only suite admins see it. */
  suiteOnly: boolean;
};

export const ADMIN_VIEWS: readonly AdminView[] = [
  { path: 'overview', label: 'Overview', suiteOnly: true },
  { path: 'people', label: 'People', suiteOnly: false },
  { path: 'deletion-requests', label: 'Deletion requests', suiteOnly: false },
  { path: 'activity', label: 'Activity', suiteOnly: false },
  { path: 'temporary-access', label: 'Temporary access', suiteOnly: false },
  { path: 'suite-admins', label: 'Suite admins', suiteOnly: true },
  { path: 'permissions', label: 'Permissions', suiteOnly: false },
];

export function viewsFor(me: AdminMe): AdminView[] {
  return ADMIN_VIEWS.filter((view) => me.suiteAdmin || !view.suiteOnly);
}

/** Where `/admin` lands: Overview for a suite admin, People for a system admin (AC-23). */
export function landingView(me: AdminMe): string {
  return me.suiteAdmin ? 'overview' : 'people';
}

/**
 * The address of a view, keeping the chosen `?system=` (or `all`) so switching views keeps the
 * system. Every other query (`q`, `status`, `cursor`) belongs to one view and is dropped.
 */
export function viewHref(path: string, search: string): string {
  const system = new URLSearchParams(search).get('system');
  return system ? `/admin/${path}?${new URLSearchParams({ system })}` : `/admin/${path}`;
}

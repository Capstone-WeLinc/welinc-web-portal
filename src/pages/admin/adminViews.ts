import {
  Activity,
  IdCard,
  Timer,
  LayoutDashboard,
  ShieldCheck,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminMe } from '@/lib/admin';

/** Every `/admin` view. `AdminPage` switches on it, so a new one fails the build until it renders. */
export type AdminViewPath =
  | 'overview'
  | 'people'
  | 'deletion-requests'
  | 'activity'
  | 'temporary-access'
  | 'suite-admins'
  | 'roles';

/** The `/admin` views (suite spec 0013, AC-23), in sidebar order, grouped by task. */
export type AdminView = {
  path: AdminViewPath;
  label: string;
  /** The phone bottom bar's label, short enough for a fifth of 375px. */
  short: string;
  /** Only suite admins see it. */
  suiteOnly: boolean;
  /** The same icon in the sidebar and the launcher's Admin card shortcuts. */
  icon: LucideIcon;
  /** The sidebar group it sits under; `null` sits on top with no label. */
  group: AdminViewGroup | null;
};

export type AdminViewGroup = 'Accounts' | 'Access' | 'Audit';

export const ADMIN_VIEWS: readonly AdminView[] = [
  { path: 'overview', label: 'Overview', short: 'Overview', suiteOnly: true, icon: LayoutDashboard, group: null },
  { path: 'people', label: 'People', short: 'People', suiteOnly: false, icon: Users, group: 'Accounts' },
  { path: 'deletion-requests', label: 'Deletion requests', short: 'Deletions', suiteOnly: false, icon: UserX, group: 'Accounts' },
  { path: 'suite-admins', label: 'Suite admins', short: 'Suite', suiteOnly: true, icon: ShieldCheck, group: 'Accounts' },
  // Suite spec 0018, AC-1: the Roles page took the Permissions page's place (/admin/permissions redirects)
  { path: 'roles', label: 'Roles', short: 'Roles', suiteOnly: false, icon: IdCard, group: 'Access' },
  { path: 'temporary-access', label: 'Temporary access', short: 'Temporary', suiteOnly: false, icon: Timer, group: 'Access' },
  { path: 'activity', label: 'Activity', short: 'Activity', suiteOnly: false, icon: Activity, group: 'Audit' },
];

/** One view by path; every path is in `ADMIN_VIEWS`. */
export function adminView(path: AdminViewPath): AdminView {
  return ADMIN_VIEWS.find((view) => view.path === path)!;
}

/** design.md: on phones, a bottom tab bar for at most this many views, a sheet menu past it. */
export const BOTTOM_BAR_MAX = 5;

export function viewsFor(me: AdminMe): AdminView[] {
  return ADMIN_VIEWS.filter((view) => me.suiteAdmin || !view.suiteOnly);
}

/** Where `/admin` lands: Overview for a suite admin, People for a system admin (AC-23). */
export function landingView(me: AdminMe): AdminViewPath {
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

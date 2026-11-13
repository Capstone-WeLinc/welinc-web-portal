import {
  History,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
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
  | 'permissions';

/** The `/admin` views (suite spec 0013, AC-23), in sidebar order. */
export type AdminView = {
  path: AdminViewPath;
  label: string;
  /** Only suite admins see it. */
  suiteOnly: boolean;
  /** The same icon in the sidebar and the launcher's Admin card shortcuts. */
  icon: LucideIcon;
};

export const ADMIN_VIEWS: readonly AdminView[] = [
  { path: 'overview', label: 'Overview', suiteOnly: true, icon: LayoutDashboard },
  { path: 'people', label: 'People', suiteOnly: false, icon: Users },
  { path: 'deletion-requests', label: 'Deletion requests', suiteOnly: false, icon: UserX },
  { path: 'activity', label: 'Activity', suiteOnly: false, icon: History },
  { path: 'temporary-access', label: 'Temporary access', suiteOnly: false, icon: KeyRound },
  { path: 'suite-admins', label: 'Suite admins', suiteOnly: true, icon: ShieldCheck },
  { path: 'permissions', label: 'Permissions', suiteOnly: false, icon: SlidersHorizontal },
];

/** One view by path; every path is in `ADMIN_VIEWS`. */
export function adminView(path: AdminViewPath): AdminView {
  return ADMIN_VIEWS.find((view) => view.path === path)!;
}

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

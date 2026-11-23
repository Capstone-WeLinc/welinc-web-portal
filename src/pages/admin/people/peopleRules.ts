import type { AdminMe, SystemCode } from '@/lib/admin';
import type { CatalogSystem, ManagedPerson, PeopleGroup, PeopleSort, PersonDetail } from '@/lib/adminApi';
import { formatDate, formatDateTime } from '@/lib/format';
import { SYSTEMS } from '../useAdminSystem';
import { roleNames } from '../useCatalogs';
import { roleName } from './personStatus';

/*
  Suite spec 0017: the display rules of the People page, kept pure so they are tested on their
  own. The person is shown whole: every rule reads the person's roles in every system plus the
  viewer's standing (`me`), never a system picked first. The server still enforces every rule.
*/

export const PEOPLE_GROUPS: readonly { group: PeopleGroup; label: string }[] = [
  { group: 'attention', label: 'Needs attention' },
  { group: 'active', label: 'Active' },
  { group: 'inactive', label: 'Inactive' },
];

export const PEOPLE_SORTS: readonly { sort: PeopleSort; label: string }[] = [
  { sort: 'name', label: 'Name, A to Z' },
  { sort: 'lastSignedIn', label: 'Last signed in' },
  { sort: 'newest', label: 'Newest first' },
];

/** The People list asks 25 a page (AC-5, AC-20). */
export const PEOPLE_PAGE_SIZE = 25;

/** AC-3: an unknown `?sort` falls back to Name. */
export function parseSort(raw: string | null): PeopleSort {
  return PEOPLE_SORTS.find((s) => s.sort === raw)?.sort ?? 'name';
}

export function sortLabel(sort: PeopleSort): string {
  return PEOPLE_SORTS.find((s) => s.sort === sort)!.label;
}

/** The systems the viewer admins, in VRMS, VMMS, BMS order (a suite admin: all three). */
export function viewerSystems(me: AdminMe): SystemCode[] {
  return me.suiteAdmin ? [...SYSTEMS] : SYSTEMS.filter((s) => me.adminOf.includes(s));
}

export function viewerAdmins(me: AdminMe, system: SystemCode): boolean {
  return me.suiteAdmin || me.adminOf.includes(system);
}

/**
 * AC-3: the system filter's choices after All. A suite admin gets all three, an admin of two or
 * more systems gets theirs, an admin of one system gets no filter (an empty list).
 */
export function filterChoices(me: AdminMe): SystemCode[] {
  const systems = viewerSystems(me);
  return systems.length >= 2 ? systems : [];
}

/** AC-3: `?system` sets the list filter; one the viewer can't pick falls back to All (null). */
export function parseListSystem(me: AdminMe, raw: string | null): SystemCode | null {
  return filterChoices(me).find((s) => s === raw) ?? null;
}

/** Every system the person is in, in VRMS, VMMS, BMS order (from `roles` and `otherSystems`). */
export function personSystems(person: Pick<ManagedPerson, 'roles' | 'otherSystems'>): SystemCode[] {
  const inSystem = new Set<SystemCode>([...person.roles.map((r) => r.system), ...person.otherSystems]);
  return SYSTEMS.filter((s) => inSystem.has(s));
}

/** AC-6: a code chip per system, filled where the viewer admins it (suite admin: all). */
export function systemChips(person: ManagedPerson, me: AdminMe): { system: SystemCode; filled: boolean }[] {
  return personSystems(person).map((system) => ({ system, filled: viewerAdmins(me, system) }));
}

/** Role labels of one system, in the catalog's order of the person's roles. */
export function roleLabels(person: Pick<ManagedPerson, 'roles'>, system: SystemCode, catalog: CatalogSystem[] | null): string[] {
  const names = roleNames(catalog, system);
  return person.roles.filter((r) => r.system === system).map((r) => roleName(r.role, names));
}

/** "VMMS or BMS", "VRMS, VMMS or BMS". */
export function orList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

export type PillTone = 'error' | 'warning' | 'muted' | 'navy' | 'success';

/**
 * AC-7: one pill, the first that applies: Deleted (with the restore date), Pending deletion,
 * Inactive, Locked, Pending (setup pending), Active. Email not verified shows Active.
 */
export function personPill(
  person: Pick<ManagedPerson, 'isActive' | 'isLocked' | 'passwordSet' | 'pendingDeletion' | 'deletedAt'> & {
    restorableUntil?: string | null;
  },
): { label: string; tone: PillTone } {
  if (person.deletedAt) {
    return {
      label: person.restorableUntil ? `Deleted, restorable until ${formatDate(person.restorableUntil)}` : 'Deleted',
      tone: 'error',
    };
  }
  if (person.pendingDeletion) return { label: 'Pending deletion', tone: 'warning' };
  if (!person.isActive) return { label: 'Inactive', tone: 'muted' };
  if (person.isLocked) return { label: 'Locked', tone: 'error' };
  if (!person.passwordSet) return { label: 'Pending', tone: 'navy' };
  return { label: 'Active', tone: 'success' };
}

/** AC-7: "[Role] in [first system], plus [n] more system(s)", or no access at all. */
export function roleLine(person: Pick<ManagedPerson, 'roles' | 'otherSystems'>, catalog: CatalogSystem[] | null): string {
  const systems = personSystems(person);
  if (systems.length === 0) return 'No access to any system';
  const [first, ...rest] = systems;
  const labels = roleLabels(person, first, catalog);
  const role = labels.length > 0 ? labels.join(' and ') : 'A role';
  if (rest.length === 0) return `${role} in ${first}`;
  return `${role} in ${first}, plus ${rest.length} more system${rest.length === 1 ? '' : 's'}`;
}

export type AccessSummaryRow = { system: SystemCode; roles: string[]; temporaryUntil: string | null };

/** When a system's temporary access ends: the latest end of its temporary roles, else null. */
export function temporaryUntilIn(person: Pick<ManagedPerson, 'roles'>, system: SystemCode): string | null {
  const ends = person.roles
    .filter((r) => r.system === system && r.temporaryUntil)
    .map((r) => r.temporaryUntil as string)
    .sort();
  return ends.length > 0 ? ends[ends.length - 1] : null;
}

/** AC-10: the Overview's Access card, one row per system the person is in, plus the rest. */
export function accessSummary(
  person: Pick<ManagedPerson, 'roles' | 'otherSystems'>,
  catalog: CatalogSystem[] | null,
): { rows: AccessSummaryRow[]; noAccess: SystemCode[] } {
  const systems = personSystems(person);
  return {
    rows: systems.map((system) => ({
      system,
      roles: roleLabels(person, system, catalog),
      temporaryUntil: temporaryUntilIn(person, system),
    })),
    noAccess: SYSTEMS.filter((s) => !systems.includes(s)),
  };
}

/**
 * AC-16: the one system an account wide action sends, never picked by the viewer: the first
 * system (VRMS, VMMS, BMS) the person is in and the viewer admins; for a suite admin, the first
 * system the person is in. Null when there is none (a person with no role).
 */
export function actionSystem(person: Pick<ManagedPerson, 'roles' | 'otherSystems'>, me: AdminMe): SystemCode | null {
  return personSystems(person).find((s) => viewerAdmins(me, s)) ?? null;
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", then the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `on ${formatDate(iso)}`;
}

/**
 * AC-4: a row's sub line. Sorted by last sign in, when they last signed in; by newest, when the
 * account was made; otherwise the role (with a system filter, the role there; in All, the roles
 * in the viewer's systems, each label once).
 */
export function subLine(
  person: ManagedPerson,
  { sort, system, me, catalog, now }: {
    sort: PeopleSort;
    system: SystemCode | null;
    me: AdminMe;
    catalog: CatalogSystem[] | null;
    now?: number;
  },
): string {
  if (sort === 'lastSignedIn') {
    return person.lastSignedInAt ? `Signed in ${relativeTime(person.lastSignedInAt, now)}` : 'Never signed in';
  }
  if (sort === 'newest') return `Added ${formatDate(person.createdAt)}`;
  const systems = system ? [system] : viewerSystems(me);
  const labels = [...new Set(systems.flatMap((s) => roleLabels(person, s, catalog)))];
  if (labels.length > 0) return labels.join(', ');
  return personSystems(person).length > 0 ? 'No role in your systems' : 'No access to any system';
}

/** "Until 2026-11-24 18:00" for a temporary row (AC-10, AC-12). */
export function untilLabel(iso: string): string {
  return `Until ${formatDateTime(iso)}`;
}

/** AC-11: the Sign in card's rows. */
export function signInFacts(person: PersonDetail, now = Date.now()): { label: string; value: string; tone: 'ok' | 'bad' | 'note' }[] {
  const pending = person.isActive && !person.isLocked && !person.passwordSet;
  if (pending) {
    const rows: { label: string; value: string; tone: 'ok' | 'bad' | 'note' }[] = [
      { label: 'Password', value: 'Not set yet', tone: 'note' },
      { label: 'Email', value: 'Not verified', tone: 'note' },
    ];
    if (person.setupCodeExpiresAt) {
      const expired = new Date(person.setupCodeExpiresAt).getTime() <= now;
      rows.push({
        label: 'Setup code',
        value: expired ? 'Expired' : `Ends ${formatDateTime(person.setupCodeExpiresAt)}`,
        tone: expired ? 'bad' : 'note',
      });
    }
    return rows;
  }
  return [
    {
      label: 'Password',
      value: person.isLocked ? 'Locked' : person.passwordSet ? 'Set' : 'Not set yet',
      tone: person.isLocked ? 'bad' : person.passwordSet ? 'ok' : 'note',
    },
    { label: 'Email', value: person.emailVerified ? 'Verified' : 'Not verified', tone: person.emailVerified ? 'ok' : 'note' },
    {
      label: 'Signed in devices',
      value: person.sessionCount > 0 ? String(person.sessionCount) : 'None',
      tone: 'ok',
    },
    {
      label: 'Wrong passwords, last 30 days',
      value: String(person.failedSignIns30d),
      tone: person.failedSignIns30d > 0 ? 'bad' : 'ok',
    },
  ];
}

/** AC-11: a Pending person (setup not done, account active and not locked). */
export function isPending(person: Pick<ManagedPerson, 'isActive' | 'isLocked' | 'passwordSet'>): boolean {
  return person.isActive && !person.isLocked && !person.passwordSet;
}

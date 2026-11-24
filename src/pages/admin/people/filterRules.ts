import type { AdminMe, SystemCode } from '@/lib/admin';
import type { CatalogSystem, FacetStatus } from '@/lib/adminApi';
import { SYSTEMS } from '../useAdminSystem';
import { viewerSystems } from './peopleRules';

/*
  Suite spec 0019, AC-21 (board `Filter18`): the People filter's rules, kept pure so they are
  tested on their own. The picks live in the address as `status=` and `access=` (AC-21a's
  values); the popover edits a draft of them and applies it on Show.
*/

/** The status chips, in the board's order. "Pending" is setup pending. */
export const STATUS_CHIPS: readonly { value: FacetStatus; label: string }[] = [
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'SETUP_PENDING', label: 'Pending' },
  { value: 'ACTIVE_GROUP', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

/** A system's pick: the whole system, or some of its role codes (never empty, never all). */
export type SystemPick = 'all' | string[];

export type FilterPicks = {
  status: FacetStatus[];
  /** Systems that are not off. A missing system is off. */
  access: Partial<Record<SystemCode, SystemPick>>;
};

export const NO_PICKS: FilterPicks = { status: [], access: {} };

export type RowState = 'off' | 'all' | 'some';

export function rowState(picks: FilterPicks, system: SystemCode): RowState {
  const pick = picks.access[system];
  if (!pick) return 'off';
  return pick === 'all' ? 'all' : 'some';
}

/** The role codes of one system, in catalog order. */
function catalogRoles(catalog: CatalogSystem[] | null, system: SystemCode): string[] {
  return catalog?.find((s) => s.code === system)?.roles.map((r) => r.code) ?? [];
}

/**
 * The systems the popover offers, in VRMS, VMMS, BMS order: the ones the viewer admins, or only
 * the `?system` scope when the address carries one (AC-21, `?system`).
 */
export function filterSystems(me: AdminMe, scope: SystemCode | null): SystemCode[] {
  const mine = viewerSystems(me);
  return scope ? mine.filter((s) => s === scope) : mine;
}

/**
 * Reads `status=` and `access=` from the address. Drops status values that aren't chips, and
 * access items whose system isn't offered or whose role the catalog doesn't list (AC-21, stale
 * address values). With no catalog yet, role items can't be checked: `rolesPending` says so and
 * the caller waits before any call.
 */
export function parsePicks(
  raw: { status: string | null; access: string | null },
  offered: SystemCode[],
  catalog: CatalogSystem[] | null,
): { picks: FilterPicks; rolesPending: boolean } {
  const status = STATUS_CHIPS.map((c) => c.value).filter((v) => (raw.status ?? '').split(',').includes(v));
  const items = (raw.access ?? '').split(',').filter(Boolean);
  const whole = new Set<SystemCode>();
  const roles = new Map<SystemCode, Set<string>>();
  let rolesPending = false;
  for (const item of items) {
    const [code, role, extra] = item.split(':');
    const system = offered.find((s) => s === code);
    if (!system || extra !== undefined) continue;
    if (role === undefined) {
      whole.add(system);
      continue;
    }
    if (!catalog) {
      rolesPending = true;
      continue;
    }
    if (!catalogRoles(catalog, system).includes(role)) continue;
    roles.set(system, (roles.get(system) ?? new Set()).add(role));
  }
  const access: FilterPicks['access'] = {};
  for (const system of offered) {
    if (whole.has(system)) access[system] = 'all';
    else if (roles.has(system)) access[system] = settle(catalog, system, [...roles.get(system)!]);
  }
  return { picks: { status, access }, rolesPending };
}

/** Roles in catalog order; every role ticked turns back into the whole system (AC-21). */
function settle(catalog: CatalogSystem[] | null, system: SystemCode, picked: string[]): SystemPick {
  const all = catalogRoles(catalog, system);
  const ordered = all.filter((r) => picked.includes(r));
  return all.length > 0 && ordered.length === all.length ? 'all' : ordered;
}

/** The address values: `ATTENTION,LOCKED` and `VRMS,VMMS:MECHANIC`, or null when empty. */
export function picksToParams(picks: FilterPicks): { status: string | null; access: string | null } {
  const items = SYSTEMS.flatMap((system) => {
    const pick = picks.access[system];
    if (!pick) return [];
    return pick === 'all' ? [system] : pick.map((role) => `${system}:${role}`);
  });
  return {
    status: picks.status.length > 0 ? picks.status.join(',') : null,
    access: items.length > 0 ? items.join(',') : null,
  };
}

export function samePicks(a: FilterPicks, b: FilterPicks): boolean {
  const x = picksToParams(a);
  const y = picksToParams(b);
  return x.status === y.status && x.access === y.access;
}

/**
 * "N filters on" and the Filter button's badge (AC-21, the draft): each ticked status chip, plus
 * each system that is not off. Roles never count on their own.
 */
export function filterCount(picks: FilterPicks): number {
  return picks.status.length + Object.keys(picks.access).length;
}

export function toggleStatus(picks: FilterPicks, value: FacetStatus): FilterPicks {
  const on = picks.status.includes(value);
  const status = STATUS_CHIPS.map((c) => c.value).filter((v) => (v === value ? !on : picks.status.includes(v)));
  return { ...picks, status };
}

/** The row's box: off picks the whole system; whole or some turns it off. */
export function toggleSystem(picks: FilterPicks, system: SystemCode): FilterPicks {
  const access = { ...picks.access };
  if (access[system]) delete access[system];
  else access[system] = 'all';
  return { ...picks, access };
}

/**
 * A role chip. From the whole system, ticking a role narrows to that role (the board: chips show
 * unticked while the box picks everyone). Ticking the last missing role turns back into the whole
 * system; unticking the last role turns the system off.
 */
export function toggleRole(
  picks: FilterPicks,
  system: SystemCode,
  role: string,
  catalog: CatalogSystem[] | null,
): FilterPicks {
  const current = picks.access[system];
  const ticked = Array.isArray(current) ? current : [];
  const next = ticked.includes(role) ? ticked.filter((r) => r !== role) : [...ticked, role];
  const access = { ...picks.access };
  if (next.length === 0) delete access[system];
  else access[system] = settle(catalog, system, next);
  return { ...picks, access };
}

export function roleTicked(picks: FilterPicks, system: SystemCode, role: string): boolean {
  const pick = picks.access[system];
  return Array.isArray(pick) && pick.includes(role);
}

/**
 * A system row's pill (AC-21): "Everyone" (whole), the role's name (one role), "N roles" (some),
 * or the system's count when off (null while the counts load or failed: a dash).
 */
export function rowPill(
  picks: FilterPicks,
  system: SystemCode,
  catalog: CatalogSystem[] | null,
  count: number | null,
): string {
  const pick = picks.access[system];
  if (pick === 'all') return 'Everyone';
  if (Array.isArray(pick)) {
    if (pick.length === 1) return catalog?.find((s) => s.code === system)?.roles.find((r) => r.code === pick[0])?.name ?? pick[0];
    return `${pick.length} roles`;
  }
  return count === null ? '–' : String(count);
}

/**
 * Add a user's preselected system (AC-21, `?system`): the scope when the address has one, else
 * the one system when `access` is exactly one whole system, else none.
 */
export function addSystem(scope: SystemCode | null, picks: FilterPicks): SystemCode | null {
  if (scope) return scope;
  const entries = Object.entries(picks.access);
  return entries.length === 1 && entries[0][1] === 'all' ? (entries[0][0] as SystemCode) : null;
}

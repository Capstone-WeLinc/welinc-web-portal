import type { AdminMe, SystemCode } from '@/lib/admin';
import type { PermissionMatrix, RoleSummary, RolesData } from '@/lib/adminApi';
import type { DraftChange } from '@/lib/drafts/drafts';
import { cellId, shownValue, type MatrixDraft } from '../permissions/matrixDraft';

// Suite spec 0018, child 0001 (board Roles9): the Roles page's pure rules. Values come from
// `GET /auth/admin/roles/:system` (umbrella spec, Value sourcing).

/** AC-1, AC-2: the order systems are offered in. */
export const ROLE_SYSTEMS: readonly SystemCode[] = ['VRMS', 'VMMS', 'BMS'];

/** The systems this viewer may open: every one for a suite admin, else the ones they admin. */
export function roleSystems(me: AdminMe): SystemCode[] {
  return ROLE_SYSTEMS.filter((s) => me.suiteAdmin || me.adminOf.includes(s));
}

/** A system from the address, when the viewer may open it (any case), else null. */
export function parseRoleSystem(me: AdminMe, value: string | null | undefined): SystemCode | null {
  const upper = value?.toUpperCase();
  return roleSystems(me).find((s) => s === upper) ?? null;
}

export function rolesHref(system: SystemCode, role?: string): string {
  return role ? `/admin/roles/${system}/${role}` : `/admin/roles/${system}`;
}

/** AC-2: "8 people", "1 person", "No one yet". */
export function peopleWords(count: number): string {
  if (count === 0) return 'No one yet';
  return count === 1 ? '1 person' : `${count} people`;
}

/** AC-2: "11 roles". */
export function roleCountWords(count: number): string {
  return count === 1 ? '1 role' : `${count} roles`;
}

/** AC-2: a search matches the name or the description, ignoring case. */
export function matchRoles(roles: RoleSummary[], q: string): RoleSummary[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return roles;
  return roles.filter(
    (r) => r.name.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle),
  );
}

/** The number of permission keys in the system (umbrella Value sourcing: Permissions total). */
export function permissionTotal(data: RolesData): number {
  return data.groups.reduce((sum, g) => sum + g.permissions.length, 0);
}

/** AC-3: a role's saved allowed keys (locked Always on cells count, Always off don't). */
export function allowedCount(data: RolesData, role: string): number {
  return data.cells[role]?.length ?? 0;
}

/** AC-3: the one line help under the description. */
export function roleHelp(role: RoleSummary, data: RolesData): string {
  if (!data.supportsCustomRoles) {
    return `${data.system} sets what each role can do in its own app. You can give these roles to people here.`;
  }
  return role.builtIn
    ? `Comes with ${data.system}. You can change its permissions, not delete it.`
    : 'Made by a suite admin. You can rename or delete it.';
}

/**
 * The page's data in the matrix shape the draft rules (`matrixDraft.ts`) and the save already use,
 * so a draft keyed `role|key` works on the Roles page unchanged.
 */
export function toMatrix(data: RolesData): PermissionMatrix {
  return {
    system: data.system,
    version: data.version,
    roles: data.roles.map((r) => ({ code: r.code, name: r.name })),
    permissions: data.groups.flatMap((g) =>
      g.permissions.map((p) => ({
        key: p.key,
        label: p.label,
        group: g.name,
        description: p.description,
        lockedRoles: p.lockedRoles,
      })),
    ),
    grants: data.cells,
    canEdit: data.canEdit,
  };
}

/** AC-4: a group's "allowed/total" and its folded preview, from the shown values (draft first). */
export function groupSummary(
  matrix: PermissionMatrix,
  draft: MatrixDraft,
  role: string,
  permissions: { key: string; label: string }[],
): { allowed: number; total: number; preview: string } {
  const on = permissions.filter((p) => shownValue(matrix, draft, role, p.key)).map((p) => p.label);
  return { allowed: on.length, total: permissions.length, preview: previewOf(on) };
}

/** "See every ticket, Assign mechanics and 6 more"; "None" when nothing is on. */
export function previewOf(labels: string[]): string {
  if (labels.length === 0) return 'None';
  if (labels.length <= 2) return labels.join(' and ');
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`;
}

/** The draft entries of one role: its bubble count (AC-7). */
export function draftCount(draft: MatrixDraft, role: string): number {
  return Object.keys(draft).filter((id) => id.startsWith(`${role}|`)).length;
}

/** Names joined for a sentence: "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---- saving (child 0001, AC-7 to AC-12) -------------------------------------------------------

/** What a read of the role data did to the draft. */
export type DraftCheck = {
  kept: MatrixDraft;
  /** Entries on a role that is no longer live, by role code. */
  deleted: Record<string, number>;
  /** Entries on a cell that is locked now (`role|key`). */
  locked: string[];
};

/**
 * AC-11: run on every read (load, after a save, after a conflict). Keeps the entries whose saved
 * value still differs from the draft (their `from` still matches the server), drops entries on a
 * role that isn't live, on a key that is gone, and on a cell that is locked now.
 */
export function checkDraft(data: RolesData, draft: MatrixDraft): DraftCheck {
  const live = new Set(data.roles.map((r) => r.code));
  const permissions = new Map(data.groups.flatMap((g) => g.permissions).map((p) => [p.key, p]));
  const out: DraftCheck = { kept: {}, deleted: {}, locked: [] };
  for (const [id, to] of Object.entries(draft)) {
    const [role, key] = id.split('|');
    if (!live.has(role)) {
      out.deleted[role] = (out.deleted[role] ?? 0) + 1;
      continue;
    }
    const permission = permissions.get(key);
    if (!permission) continue;
    if (permission.lockedRoles.includes(role)) {
      out.locked.push(id);
      continue;
    }
    if ((data.cells[role]?.includes(key) ?? false) !== to) out.kept[id] = to;
  }
  return out;
}

export const deletedCount = (check: DraftCheck) => Object.values(check.deleted).reduce((sum, n) => sum + n, 0);

/** AC-12: the draft as stored, each entry with the saved value it started from. */
export function storedChanges(draft: MatrixDraft): DraftChange<boolean>[] {
  return Object.entries(draft).map(([key, to]) => ({ key, from: !to, to }));
}

export function draftFromStored(changes: DraftChange<boolean>[]): MatrixDraft {
  const draft: MatrixDraft = {};
  for (const c of changes) if (typeof c.to === 'boolean') draft[c.key] = c.to;
  return draft;
}

/**
 * AC-12: the server value a stored entry is checked against. An entry on a role that is no longer
 * live counts as fitting, so the read rule (AC-11) drops just it with its own toast instead of
 * clearing the whole draft.
 */
export function storedCurrent(data: RolesData, id: string, change: DraftChange<boolean>): boolean | undefined {
  const [role, key] = id.split('|');
  if (!data.roles.some((r) => r.code === role)) return change.from;
  if (!data.groups.some((g) => g.permissions.some((p) => p.key === key))) return undefined;
  return data.cells[role]?.includes(key) ?? false;
}

/**
 * AC-10: Reset to defaults on a built in role. Every unlocked cell is set to its catalog default
 * (`defaultRoles`): a saved value that differs becomes a draft entry, a draft entry away from the
 * default goes. `changed` is false when the role already shows its defaults.
 */
export function resetToDefaults(
  data: RolesData,
  draft: MatrixDraft,
  role: string,
): { draft: MatrixDraft; changed: boolean } {
  const next = { ...draft };
  let changed = false;
  for (const p of data.groups.flatMap((g) => g.permissions)) {
    if (p.lockedRoles.includes(role)) continue;
    const id = cellId(role, p.key);
    const saved = data.cells[role]?.includes(p.key) ?? false;
    const target = p.defaultRoles.includes(role);
    const shown = draft[id] ?? saved;
    if (shown !== target) changed = true;
    if (saved === target) delete next[id];
    else next[id] = target;
  }
  return { draft: next, changed };
}

/** AC-7: the bar's sub line, "Chief mechanic and Parts clerk · affects 8 people". */
export function barSubline(touched: RoleSummary[]): string | undefined {
  if (touched.length === 0) return undefined;
  const people = touched.reduce((sum, r) => sum + r.peopleCount, 0);
  const reach = people > 0 ? `affects ${people === 1 ? '1 person' : `${people} people`}` : 'no one holds it yet';
  return `${joinNames(touched.map((r) => r.name))} · ${reach}`;
}

/** A person's first name for the faces line. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * AC-8, AC-9: "Ramon, Alfredo and 6 more" from up to three holders read for the role and its
 * `peopleCount`. Up to three people are all named; more name the first two. Null when no names
 * came back (the read failed), so the caller words it with the count instead.
 */
export function holderNames(names: string[], count: number): string | null {
  if (names.length === 0 || count === 0) return null;
  const firsts = names.map(firstName);
  if (count <= 3 && firsts.length >= count) return joinNames(firsts.slice(0, count));
  const shown = firsts.slice(0, 2);
  return `${shown.join(', ')} and ${count - shown.length} more`;
}

/** AC-8: the line at the bottom of the change list for one role. */
export function reachLine(role: RoleSummary, names: string[], system: SystemCode): string {
  if (role.peopleCount === 0) return `No one holds ${role.name} yet`;
  const who = holderNames(names, role.peopleCount);
  const subject = who ?? (role.peopleCount === 1 ? '1 person' : `${role.peopleCount} people`);
  const verb = role.peopleCount === 1 ? 'gets' : 'get';
  return `${subject} ${verb} this the next time they open ${system}`;
}

/** Keys that let a role manage the team or change settings (umbrella security model). */
export const POWER_KEYS = ['team.manage', 'settings.manage'] as const;

/** AC-9: a custom role that would hold `team.manage` or `settings.manage` after the save. */
export function holdsPowerAfter(data: RolesData, draft: MatrixDraft, role: RoleSummary): boolean {
  if (role.builtIn) return false;
  return POWER_KEYS.some((key) => draft[cellId(role.code, key)] ?? data.cells[role.code]?.includes(key) ?? false);
}

const changeWords = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

/** AC-11, AC-12: the page's toasts and messages, in one place so the tests read the same words. */
export const rolesCopy = {
  saved: (n: number, system: SystemCode) => `Saved ${changeWords(n)} to ${system} roles.`,
  stale: (system: SystemCode) =>
    `Someone saved ${system} roles while you were editing. Your changes that still apply are kept. Check them and save again.`,
  deleted: (n: number) =>
    n === 1
      ? '1 change to a role that was deleted was removed from your draft.'
      : `${n} changes to a role that was deleted were removed from your draft.`,
  unknownRole: (names: string[]) =>
    `${joinNames(names)} ${names.length === 1 ? 'was' : 'were'} deleted, so ${names.length === 1 ? 'its' : 'their'} changes were removed from your draft.`,
  locked: (items: string[]) =>
    `${joinNames(items)} can't be changed any more, so ${items.length === 1 ? 'it was' : 'they were'} removed from your draft.`,
  draftOutOfDate: (system: SystemCode) => `Your saved draft for ${system} roles was out of date, so it was cleared.`,
  /** AC-12: what the leaving toast names: the one role, or "[system] roles". */
  draftName: (touched: RoleSummary[], system: SystemCode) =>
    touched.length === 1 ? touched[0].name : `${system} roles`,
};

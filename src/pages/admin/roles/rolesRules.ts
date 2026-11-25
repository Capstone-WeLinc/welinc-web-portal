import type { AdminMe, SystemCode } from '@/lib/admin';
import type { ManagedPerson, PermissionMatrix, RoleHistoryItem, RoleSummary, RolesData } from '@/lib/adminApi';
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

// ---- the permission filter (AC-5) -------------------------------------------------------------

type Group = RolesData['groups'][number];

/** AC-5: the groups and rows whose label or description holds the text, ignoring case. */
export function filterGroups(groups: Group[], q: string): Group[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((g) => ({
      ...g,
      permissions: g.permissions.filter(
        (p) => p.label.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle),
      ),
    }))
    .filter((g) => g.permissions.length > 0);
}

// ---- People and Add people (AC-13, AC-14) -----------------------------------------------------

/** The person's role row in this system with this code: "Since" and "Until" read from it. */
export function heldRole(person: ManagedPerson, system: SystemCode, code: string) {
  return person.roles.find((r) => r.system === system && r.role === code) ?? null;
}

/** AC-14: a candidate's role in the system now, and whether it is temporary (can't be moved). */
export function candidateRole(
  person: ManagedPerson,
  system: SystemCode,
  roles: RoleSummary[],
): { name: string; temporaryUntil: string | null } {
  const own = person.roles.filter((r) => r.system === system);
  const temporary = own.find((r) => r.temporaryUntil);
  const names = own.map((r) => roles.find((x) => x.code === r.role)?.name ?? titleCase(r.role));
  return { name: joinNames(names), temporaryUntil: temporary?.temporaryUntil ?? null };
}

/** "CHIEF_MECHANIC" as "Chief mechanic", for a code the page has no name for. */
export function titleCase(code: string): string {
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** AC-14: "3 people now have Chief mechanic.", "1 person now has Chief mechanic." */
export function movedWords(n: number, role: string): string {
  return n === 1 ? `1 person now has ${role}.` : `${n} people now have ${role}.`;
}

// ---- History (AC-15) --------------------------------------------------------------------------

/** AC-15: what happened, in words after the actor's name. */
export function historyWords(item: RoleHistoryItem): string {
  switch (item.kind) {
    case 'PERMISSION': {
      const label = `“${item.label ?? item.key ?? ''}”`;
      if (item.after === true) return `added ${label}`;
      if (item.before === true) return `removed ${label}`;
      return `listed ${label} as off`;
    }
    case 'CREATED':
      return item.fromValue ? `created the role from ${item.fromValue}` : 'created the role';
    case 'RENAMED':
      return `renamed it from ${item.fromValue ?? ''} to ${item.toValue ?? ''}`;
    case 'DESCRIBED':
      return 'changed the description';
    case 'DELETED':
      return 'deleted the role';
  }
}

// ---- the spreadsheet (AC-16) ------------------------------------------------------------------

/** One CSV cell: always quoted; a leading `=`, `+`, `-` or `@` gets a `'` so it stays text. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * AC-16: every role by every permission from the saved data (never the draft). Columns Group,
 * Permission, Description, then one per live role in list order; a last row "People".
 */
export function rolesCsv(data: RolesData): string {
  const header = ['Group', 'Permission', 'Description', ...data.roles.map((r) => (r.builtIn ? r.name : `${r.name} (custom)`))];
  const rows = data.groups.flatMap((g) =>
    g.permissions.map((p) => [
      g.name,
      p.label,
      p.description,
      ...data.roles.map((r) => (data.cells[r.code]?.includes(p.key) ? 'Yes' : 'No')),
    ]),
  );
  const people = ['People', '', '', ...data.roles.map((r) => String(r.peopleCount))];
  return [header, ...rows, people].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** AC-16: `welinc-vrms-roles-2026-11-25.csv`, on the viewer's local date. */
export function csvFileName(system: SystemCode, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `welinc-${system.toLowerCase()}-roles-${day}.csv`;
}

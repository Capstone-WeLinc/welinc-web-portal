import type { AdminMe, SystemCode } from '@/lib/admin';
import type { PermissionMatrix, RoleSummary, RolesData } from '@/lib/adminApi';
import { shownValue, type MatrixDraft } from '../permissions/matrixDraft';

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

/** After a reload, keep only the draft entries that still change something (AC-11's rule). */
export function keepLiveDraft(matrix: PermissionMatrix, draft: MatrixDraft): MatrixDraft {
  const live = new Set(matrix.roles.map((r) => r.code));
  const keys = new Set(matrix.permissions.map((p) => p.key));
  const kept: MatrixDraft = {};
  for (const [id, value] of Object.entries(draft)) {
    const [role, key] = id.split('|');
    if (!live.has(role) || !keys.has(key)) continue;
    if ((matrix.grants[role]?.includes(key) ?? false) !== value) kept[id] = value;
  }
  return kept;
}

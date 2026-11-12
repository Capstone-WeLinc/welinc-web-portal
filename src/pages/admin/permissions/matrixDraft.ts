import type { MatrixCellChange, MatrixPermission, PermissionMatrix } from '@/lib/adminApi';

// Suite spec 0013, AC-27: the matrix editor's rules. A draft holds only the cells the suite admin
// flipped; the save sends exactly those, and welinc-auth checks everything again.

/** Cells flipped in the editor, by `role|key`, with the value they would get. */
export type MatrixDraft = Record<string, boolean>;

/** AC-27: a note of 5 to 500 characters whenever a save takes a right away. */
export const NOTE_MIN = 5;
export const NOTE_MAX = 500;

export const cellId = (role: string, key: string) => `${role}|${key}`;

export function isAllowed(matrix: PermissionMatrix, role: string, key: string): boolean {
  return matrix.grants[role]?.includes(key) ?? false;
}

export function isLocked(permission: MatrixPermission, role: string): boolean {
  return permission.lockedRoles.includes(role);
}

/** The value a cell shows: the draft's when flipped, else the saved one. */
export function shownValue(matrix: PermissionMatrix, draft: MatrixDraft, role: string, key: string): boolean {
  return draft[cellId(role, key)] ?? isAllowed(matrix, role, key);
}

/** Flip one cell; flipping it back to the saved value drops it from the draft. */
export function toggle(matrix: PermissionMatrix, draft: MatrixDraft, role: string, key: string): MatrixDraft {
  const id = cellId(role, key);
  const next = !shownValue(matrix, draft, role, key);
  const copy = { ...draft };
  if (next === isAllowed(matrix, role, key)) delete copy[id];
  else copy[id] = next;
  return copy;
}

/** The changes a save sends, in matrix order (role order, then key order). */
export function pendingChanges(matrix: PermissionMatrix, draft: MatrixDraft): MatrixCellChange[] {
  const out: MatrixCellChange[] = [];
  for (const role of matrix.roles) {
    for (const p of matrix.permissions) {
      const value = draft[cellId(role.code, p.key)];
      if (value !== undefined) out.push({ role: role.code, key: p.key, allowed: value });
    }
  }
  return out;
}

export function takesAway(changes: MatrixCellChange[]): boolean {
  return changes.some((c) => !c.allowed);
}

/** The note's problem, or null when it may be sent (optional unless a right is taken away). */
export function noteProblem(note: string, required: boolean): string | null {
  const length = note.trim().length;
  if (length === 0 && !required) return null;
  if (length < NOTE_MIN || length > NOTE_MAX) {
    return required
      ? `You're taking a right away, so say why in ${NOTE_MIN} to ${NOTE_MAX} characters. Other admins read it.`
      : `Keep the note to ${NOTE_MIN} to ${NOTE_MAX} characters, or leave it empty.`;
  }
  return null;
}

/** Permissions grouped by their `group`, in catalog order. */
export function groupsOf(matrix: PermissionMatrix): { group: string; permissions: MatrixPermission[] }[] {
  const groups: { group: string; permissions: MatrixPermission[] }[] = [];
  for (const p of matrix.permissions) {
    const last = groups[groups.length - 1];
    if (last?.group === p.group) last.permissions.push(p);
    else groups.push({ group: p.group, permissions: [p] });
  }
  return groups;
}

/** One history row as a sentence part: "On", "Off", "Added (on)", "Removed". */
export function historyValue(before: boolean | null, after: boolean | null): string {
  if (after === null) return 'Removed';
  if (before === null) return after ? 'Added, on' : 'Added, off';
  return after ? 'Turned on' : 'Turned off';
}

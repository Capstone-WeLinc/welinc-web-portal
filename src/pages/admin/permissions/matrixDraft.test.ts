import { describe, expect, it } from 'vitest';
import type { PermissionMatrix } from '@/lib/adminApi';
import { groupsOf, historyValue, noteProblem, pendingChanges, shownValue, takesAway, toggle } from './matrixDraft';

const matrix: PermissionMatrix = {
  system: 'VRMS',
  version: 3,
  roles: [
    { code: 'ADMIN', name: 'Admin' },
    { code: 'MECHANIC', name: 'Mechanic' },
  ],
  permissions: [
    { key: 'ticket.view', label: 'See tickets', group: 'Tickets', description: '', lockedRoles: [] },
    { key: 'ticket.edit', label: 'Edit tickets', group: 'Tickets', description: '', lockedRoles: [] },
    { key: 'team.manage', label: 'Manage the team', group: 'Admin', description: '', lockedRoles: ['ADMIN'] },
  ],
  grants: { ADMIN: ['ticket.view', 'ticket.edit', 'team.manage'], MECHANIC: ['ticket.view'] },
  canEdit: true,
};

describe('matrix draft (suite spec 0013, AC-27)', () => {
  it('flips a cell, and flipping it back leaves no change', () => {
    const once = toggle(matrix, {}, 'MECHANIC', 'ticket.edit');
    expect(shownValue(matrix, once, 'MECHANIC', 'ticket.edit')).toBe(true);
    expect(pendingChanges(matrix, once)).toEqual([{ role: 'MECHANIC', key: 'ticket.edit', allowed: true }]);
    expect(pendingChanges(matrix, toggle(matrix, once, 'MECHANIC', 'ticket.edit'))).toEqual([]);
  });

  it('lists changes in role order, then key order', () => {
    let draft = toggle(matrix, {}, 'MECHANIC', 'ticket.view');
    draft = toggle(matrix, draft, 'ADMIN', 'ticket.edit');
    expect(pendingChanges(matrix, draft).map((c) => `${c.role} ${c.key}`)).toEqual([
      'ADMIN ticket.edit',
      'MECHANIC ticket.view',
    ]);
    expect(takesAway(pendingChanges(matrix, draft))).toBe(true);
  });

  it('needs a 5 to 500 character note only when a right is taken away', () => {
    expect(noteProblem('', false)).toBeNull();
    expect(noteProblem('', true)).toMatch(/taking a right away/);
    expect(noteProblem('meh', false)).toMatch(/or leave it empty/);
    expect(noteProblem('  Chiefs only read  ', true)).toBeNull();
    expect(noteProblem('x'.repeat(501), true)).not.toBeNull();
  });

  it('groups permissions in catalog order', () => {
    expect(groupsOf(matrix).map((g) => [g.group, g.permissions.length])).toEqual([
      ['Tickets', 2],
      ['Admin', 1],
    ]);
  });

  it('words a history row', () => {
    expect(historyValue(false, true)).toBe('Turned on');
    expect(historyValue(true, false)).toBe('Turned off');
    expect(historyValue(null, true)).toBe('Added, on');
    expect(historyValue(true, null)).toBe('Removed');
  });
});

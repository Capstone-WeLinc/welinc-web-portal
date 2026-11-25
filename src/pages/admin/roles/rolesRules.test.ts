import { describe, expect, it } from 'vitest';
import type { AdminMe } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import {
  allowedCount,
  draftCount,
  groupSummary,
  joinNames,
  keepLiveDraft,
  matchRoles,
  parseRoleSystem,
  peopleWords,
  permissionTotal,
  previewOf,
  roleHelp,
  roleSystems,
  toMatrix,
} from './rolesRules';

// covers: suite spec 0018, child 0001 AC-1 (systems and order), AC-2 (words, search), AC-3
// (counts, help line), AC-4 (group summary and preview), AC-7 (draft bubble), AC-11 (draft kept)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Leonora Castillo', email: 'suite.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const role = (code: string, name: string, over: Partial<RoleSummary> = {}): RoleSummary => ({
  code,
  name,
  description: `${name} does the work`,
  builtIn: true,
  isSystemAdmin: false,
  copiedFrom: null,
  peopleCount: 0,
  lastChanged: null,
  ...over,
});

const data: RolesData = {
  system: 'VRMS',
  supportsCustomRoles: true,
  canEdit: true,
  version: 4,
  roles: [role('ADMIN', 'Admin'), role('MECHANIC', 'Mechanic', { description: 'Works repair tickets' })],
  groups: [
    {
      name: 'Tickets',
      permissions: [
        { key: 'ticket.view', label: 'See tickets', description: '', lockedRoles: [], defaultRoles: [] },
        { key: 'ticket.assign', label: 'Assign mechanics', description: '', lockedRoles: [], defaultRoles: [] },
        { key: 'ticket.costs', label: 'See costs', description: '', lockedRoles: [], defaultRoles: [] },
        { key: 'ticket.edit', label: 'Edit tickets', description: '', lockedRoles: [], defaultRoles: [] },
      ],
    },
    {
      name: 'Admin',
      permissions: [{ key: 'team.manage', label: 'Manage the team', description: '', lockedRoles: ['ADMIN'], defaultRoles: ['ADMIN'] }],
    },
  ],
  cells: { ADMIN: ['ticket.view', 'ticket.assign', 'ticket.costs', 'ticket.edit', 'team.manage'], MECHANIC: ['ticket.view'] },
};

describe('roleSystems and parseRoleSystem (AC-1, AC-2)', () => {
  it('offers every system to a suite admin and only their own to a system admin, in VRMS, VMMS, BMS order', () => {
    expect(roleSystems(me({ suiteAdmin: true }))).toEqual(['VRMS', 'VMMS', 'BMS']);
    expect(roleSystems(me({ adminOf: ['BMS', 'VRMS'] }))).toEqual(['VRMS', 'BMS']);
  });

  it('reads a system from the address in any case, and refuses one the viewer cannot open', () => {
    expect(parseRoleSystem(me({ adminOf: ['VRMS'] }), 'vrms')).toBe('VRMS');
    expect(parseRoleSystem(me({ adminOf: ['VRMS'] }), 'BMS')).toBeNull();
    expect(parseRoleSystem(me({ suiteAdmin: true }), undefined)).toBeNull();
  });
});

describe('list words and search (AC-2)', () => {
  it('says the people in words', () => {
    expect([0, 1, 8].map(peopleWords)).toEqual(['No one yet', '1 person', '8 people']);
  });

  it('matches a name or a description, ignoring case', () => {
    expect(matchRoles(data.roles, 'MECH').map((r) => r.code)).toEqual(['MECHANIC']);
    expect(matchRoles(data.roles, 'repair').map((r) => r.code)).toEqual(['MECHANIC']);
    expect(matchRoles(data.roles, '  ')).toHaveLength(2);
  });
});

describe('the role header (AC-3)', () => {
  it('counts saved keys out of every key', () => {
    expect(permissionTotal(data)).toBe(5);
    expect(allowedCount(data, 'MECHANIC')).toBe(1);
    expect(allowedCount(data, 'GONE')).toBe(0);
  });

  it('writes the help line for a built in role, a custom role and a system without permissions', () => {
    expect(roleHelp(data.roles[0], data)).toBe('Comes with VRMS. You can change its permissions, not delete it.');
    expect(roleHelp(role('C_NIGHT', 'Night shift lead', { builtIn: false }), data)).toBe(
      'Made by a suite admin. You can rename or delete it.',
    );
    expect(roleHelp(data.roles[0], { ...data, system: 'VMMS', supportsCustomRoles: false })).toBe(
      'VMMS sets what each role can do in its own app. You can give these roles to people here.',
    );
  });
});

describe('group summary (AC-4)', () => {
  const matrix = toMatrix(data);
  const tickets = data.groups[0].permissions;

  it('counts and previews the shown values, the draft first', () => {
    expect(groupSummary(matrix, {}, 'ADMIN', tickets)).toEqual({
      allowed: 4,
      total: 4,
      preview: 'See tickets, Assign mechanics and 2 more',
    });
    expect(groupSummary(matrix, { 'MECHANIC|ticket.view': false }, 'MECHANIC', tickets).preview).toBe('None');
    expect(groupSummary(matrix, { 'MECHANIC|ticket.costs': true }, 'MECHANIC', tickets)).toMatchObject({
      allowed: 2,
      preview: 'See tickets and See costs',
    });
  });

  it('previews one, two or many labels', () => {
    expect(previewOf(['A'])).toBe('A');
    expect(previewOf(['A', 'B'])).toBe('A and B');
    expect(previewOf(['A', 'B', 'C'])).toBe('A, B and 1 more');
  });

  it('keeps the catalog group on each key in the matrix shape', () => {
    expect(matrix.permissions.map((p) => p.group)).toEqual(['Tickets', 'Tickets', 'Tickets', 'Tickets', 'Admin']);
    expect(matrix.grants).toBe(data.cells);
  });
});

describe('drafts (AC-7, AC-11)', () => {
  it('counts one role’s entries for its bubble', () => {
    expect(draftCount({ 'MECHANIC|ticket.view': false, 'MECHANIC|ticket.edit': true, 'ADMIN|ticket.edit': false }, 'MECHANIC')).toBe(2);
  });

  it('keeps only entries that still change a live role after a read', () => {
    const kept = keepLiveDraft(toMatrix(data), {
      'MECHANIC|ticket.edit': true, // still a change
      'MECHANIC|ticket.view': true, // the server already has it on
      'C_GONE|ticket.view': true, // the role was deleted
      'MECHANIC|ticket.left': true, // the key left the catalog
    });
    expect(kept).toEqual({ 'MECHANIC|ticket.edit': true });
  });

  it('joins names for a sentence', () => {
    expect(joinNames(['Chief mechanic'])).toBe('Chief mechanic');
    expect(joinNames(['Chief mechanic', 'Parts clerk'])).toBe('Chief mechanic and Parts clerk');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

import { describe, expect, it } from 'vitest';
import type { AdminMe } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import {
  customRoleCopy,
  allowedCount,
  barSubline,
  checkDraft,
  deletedCount,
  draftFromStored,
  holderNames,
  holdsPowerAfter,
  reachLine,
  resetToDefaults,
  rolesCopy,
  storedChanges,
  storedCurrent,
  draftCount,
  groupSummary,
  joinNames,
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
// (counts, help line), AC-4 (group summary and preview), AC-7 (draft bubble, sub line), AC-8 (faces line), AC-9 (power
// warning), AC-10 (Reset to defaults), AC-11 (draft checked on every read), AC-12 (stored draft)

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
  graceCount: 0,
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
      'Made by a suite admin. You can rename or delete it. Works in the browser. The mobile app is for Mechanics and Chief mechanics.',
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

  it('keeps entries that still change a live role after a read, and names what it drops', () => {
    const locked: RolesData = {
      ...data,
      groups: data.groups.map((g) => ({
        ...g,
        permissions: g.permissions.map((p) => (p.key === 'ticket.assign' ? { ...p, lockedRoles: ['MECHANIC'] } : p)),
      })),
    };
    const check = checkDraft(locked, {
      'MECHANIC|ticket.edit': true, // still a change
      'MECHANIC|ticket.view': true, // the server already has it on
      'C_GONE|ticket.view': true, // the role was deleted
      'C_GONE|ticket.edit': true,
      'MECHANIC|ticket.left': true, // the key left the catalog
      'MECHANIC|ticket.assign': true, // locked now
    });
    expect(check.kept).toEqual({ 'MECHANIC|ticket.edit': true });
    expect(check.deleted).toEqual({ C_GONE: 2 });
    expect(deletedCount(check)).toBe(2);
    expect(check.locked).toEqual(['MECHANIC|ticket.assign']);
  });

  it('stores each entry with the value it started from and reads it back', () => {
    const draft = { 'MECHANIC|ticket.edit': true, 'MECHANIC|ticket.view': false };
    const stored = storedChanges(draft);
    expect(stored).toEqual([
      { key: 'MECHANIC|ticket.edit', from: false, to: true },
      { key: 'MECHANIC|ticket.view', from: true, to: false },
    ]);
    expect(draftFromStored(stored)).toEqual(draft);
  });

  it('checks a stored entry against the server, letting a deleted role through for the read rule', () => {
    const change = { key: 'MECHANIC|ticket.edit', from: false, to: true };
    expect(storedCurrent(data, change.key, change)).toBe(false);
    expect(storedCurrent(data, 'MECHANIC|ticket.view', { ...change, key: 'MECHANIC|ticket.view' })).toBe(true);
    const gone = { key: 'C_GONE|ticket.view', from: false, to: true };
    expect(storedCurrent(data, gone.key, gone)).toBe(false);
    expect(storedCurrent(data, 'MECHANIC|ticket.left', change)).toBeUndefined();
  });

  it('joins names for a sentence', () => {
    expect(joinNames(['Chief mechanic'])).toBe('Chief mechanic');
    expect(joinNames(['Chief mechanic', 'Parts clerk'])).toBe('Chief mechanic and Parts clerk');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('Reset to defaults (AC-10)', () => {
  const withDefaults: RolesData = {
    ...data,
    groups: data.groups.map((g) => ({
      ...g,
      permissions: g.permissions.map((p) =>
        p.key === 'ticket.view' || p.key === 'ticket.costs' ? { ...p, defaultRoles: ['MECHANIC'] } : p,
      ),
    })),
  };

  it('stages every unlocked cell that differs from its default, and drops draft entries away from it', () => {
    // MECHANIC has ticket.view and ticket.edit saved; its defaults are ticket.view and ticket.costs
    const saved: RolesData = { ...withDefaults, cells: { ...withDefaults.cells, MECHANIC: ['ticket.view', 'ticket.edit'] } };
    const { draft, changed } = resetToDefaults(saved, { 'MECHANIC|ticket.assign': true }, 'MECHANIC');
    expect(changed).toBe(true);
    expect(draft).toEqual({ 'MECHANIC|ticket.costs': true, 'MECHANIC|ticket.edit': false });
  });

  it('says nothing differs once the role shows its defaults', () => {
    const first = resetToDefaults(withDefaults, {}, 'MECHANIC');
    expect(resetToDefaults(withDefaults, first.draft, 'MECHANIC').changed).toBe(false);
  });
});

describe('save bar and review words (AC-7 to AC-9, AC-11, AC-12)', () => {
  it('words the sub line with the people it affects', () => {
    expect(barSubline([])).toBeUndefined();
    expect(barSubline([role('A', 'Chief mechanic', { peopleCount: 8 })])).toBe('Chief mechanic · affects 8 people');
    expect(barSubline([role('A', 'Chief mechanic', { peopleCount: 1 }), role('B', 'Parts clerk')])).toBe(
      'Chief mechanic and Parts clerk · affects 1 person',
    );
    expect(barSubline([role('B', 'Parts clerk')])).toBe('Parts clerk · no one holds it yet');
  });

  it('names up to three holders, else the first two and how many more', () => {
    expect(holderNames(['Ramon Villanueva', 'Alfredo Bautista', 'Danilo Santos'], 8)).toBe('Ramon, Alfredo and 6 more');
    expect(holderNames(['Ramon Villanueva', 'Alfredo Bautista', 'Danilo Santos'], 3)).toBe('Ramon, Alfredo and Danilo');
    expect(holderNames(['Ramon Villanueva'], 1)).toBe('Ramon');
    expect(holderNames([], 4)).toBeNull();
  });

  it('words who gets the change, or that no one holds the role', () => {
    const chief = role('C', 'Chief mechanic', { peopleCount: 8 });
    expect(reachLine(chief, ['Ramon V', 'Alfredo B', 'Danilo S'], 'VRMS')).toBe(
      'Ramon, Alfredo and 6 more get this the next time they open VRMS',
    );
    expect(reachLine(role('M', 'Mechanic', { peopleCount: 1 }), ['Joel M'], 'VRMS')).toBe(
      'Joel gets this the next time they open VRMS',
    );
    expect(reachLine(chief, [], 'VRMS')).toBe('8 people get this the next time they open VRMS');
    expect(reachLine(role('P', 'Parts clerk'), [], 'VRMS')).toBe('No one holds Parts clerk yet');
  });

  it('warns only for a custom role that would manage the team or settings', () => {
    const powered: RolesData = { ...data, cells: { ...data.cells, C_LEAD: ['ticket.view'] } };
    const lead = role('C_LEAD', 'Night shift lead', { builtIn: false });
    expect(holdsPowerAfter(powered, {}, lead)).toBe(false);
    expect(holdsPowerAfter(powered, { 'C_LEAD|team.manage': true }, lead)).toBe(true);
    expect(holdsPowerAfter({ ...powered, cells: { C_LEAD: ['settings.manage'] } }, { 'C_LEAD|settings.manage': false }, lead)).toBe(false);
    expect(holdsPowerAfter(powered, { 'ADMIN|team.manage': true }, role('ADMIN', 'Admin'))).toBe(false);
  });

  it('uses the spec’s toast words', () => {
    expect(rolesCopy.saved(1, 'VRMS')).toBe('Saved 1 change to VRMS roles.');
    expect(rolesCopy.saved(3, 'VRMS')).toBe('Saved 3 changes to VRMS roles.');
    expect(rolesCopy.deleted(2)).toBe('2 changes to a role that was deleted were removed from your draft.');
    expect(rolesCopy.draftOutOfDate('VRMS')).toBe('Your saved draft for VRMS roles was out of date, so it was cleared.');
    expect(rolesCopy.draftName([role('C', 'Chief mechanic')], 'VRMS')).toBe('Chief mechanic');
    expect(rolesCopy.draftName([role('C', 'Chief mechanic'), role('M', 'Mechanic')], 'VRMS')).toBe('VRMS roles');
  });
});

describe('customRoleCopy.graceHolders (AC-25)', () => {
  it('words one person and several people the way the spec does', () => {
    expect(customRoleCopy.graceHolders(1)).toBe(
      '1 person waiting for deletion keeps it until their deletion completes; if they are restored, they come back without it.',
    );
    expect(customRoleCopy.graceHolders(3)).toBe(
      '3 people waiting for deletion keep it until their deletion completes; if one is restored, they come back without it.',
    );
  });
});

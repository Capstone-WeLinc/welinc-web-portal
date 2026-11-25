import { describe, expect, it } from 'vitest';
import type { ManagedPerson, RoleHistoryItem, RoleSummary, RolesData } from '@/lib/adminApi';
import {
  candidateRole,
  csvCell,
  csvFileName,
  filterGroups,
  heldRole,
  historyWords,
  movedWords,
  rolesCsv,
  titleCase,
} from './rolesRules';

// covers: suite spec 0018, child 0001 AC-5 (Find a permission), AC-13 (Since and Until), AC-14
// (candidate roles, moved toast), AC-15 (history words), AC-16 (the spreadsheet)

const role = (code: string, name: string, over: Partial<RoleSummary> = {}): RoleSummary => ({
  code,
  name,
  description: '',
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
  roles: [role('ADMIN', 'Admin', { peopleCount: 1 }), role('C_QA', '=SUM(1)', { builtIn: false, peopleCount: 3 })],
  groups: [
    {
      name: 'Costs',
      permissions: [
        { key: 'cost.view', label: 'See costs', description: 'Read parts and labor costs', lockedRoles: [], defaultRoles: [] },
        { key: 'cost.receipt', label: 'Add receipts', description: 'Attach a receipt to the costs of a ticket', lockedRoles: [], defaultRoles: [] },
      ],
    },
    {
      name: 'Tickets',
      permissions: [{ key: 'ticket.view', label: 'See every ticket', description: 'Say "all"', lockedRoles: [], defaultRoles: [] }],
    },
  ],
  cells: { ADMIN: ['cost.view', 'ticket.view'], C_QA: ['cost.receipt'] },
};

const person = (roles: ManagedPerson['roles']): ManagedPerson => ({
  id: 'p1',
  name: 'Ramon Dela Cruz',
  email: 'ramon@welinc.com',
  emailVerified: true,
  passwordSet: true,
  contact: null,
  profilePicture: null,
  isActive: true,
  isLocked: false,
  lockedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  roles,
  otherSystems: [],
});

describe('filterGroups (AC-5)', () => {
  it('keeps rows whose label or description holds the text, ignoring case, and drops empty groups', () => {
    const shown = filterGroups(data.groups, 'COST');
    expect(shown.map((g) => g.name)).toEqual(['Costs']);
    expect(shown[0].permissions.map((p) => p.key)).toEqual(['cost.view', 'cost.receipt']);
  });

  it('returns every group for blank text and none for no match', () => {
    expect(filterGroups(data.groups, '  ')).toBe(data.groups);
    expect(filterGroups(data.groups, 'payroll')).toEqual([]);
  });
});

describe('People and Add people (AC-13, AC-14)', () => {
  it('finds the role row with its dates', () => {
    const p = person([{ system: 'VRMS', role: 'ADMIN', createdAt: '2026-03-02T00:00:00.000Z', temporaryUntil: null }]);
    expect(heldRole(p, 'VRMS', 'ADMIN')?.createdAt).toBe('2026-03-02T00:00:00.000Z');
    expect(heldRole(p, 'BMS', 'ADMIN')).toBeNull();
  });

  it('names the current role and flags a temporary one', () => {
    const p = person([
      { system: 'VRMS', role: 'PARTS_CLERK', temporaryUntil: '2026-12-01T00:00:00.000Z' },
      { system: 'BMS', role: 'ADMIN' },
    ]);
    expect(candidateRole(p, 'VRMS', data.roles)).toEqual({ name: 'Parts clerk', temporaryUntil: '2026-12-01T00:00:00.000Z' });
    expect(candidateRole(person([{ system: 'VRMS', role: 'ADMIN' }]), 'VRMS', data.roles)).toEqual({
      name: 'Admin',
      temporaryUntil: null,
    });
  });

  it('words codes and the moved toast', () => {
    expect(titleCase('CHIEF_MECHANIC')).toBe('Chief mechanic');
    expect(movedWords(1, 'Admin')).toBe('1 person now has Admin.');
    expect(movedWords(3, 'Admin')).toBe('3 people now have Admin.');
  });
});

describe('historyWords (AC-15)', () => {
  const item = (over: Partial<RoleHistoryItem>): RoleHistoryItem => ({
    id: 'h',
    at: '2026-11-25T00:00:00.000Z',
    actorName: 'Leonora',
    kind: 'PERMISSION',
    ...over,
  });

  it('says what happened to a permission', () => {
    expect(historyWords(item({ label: 'Use AI diagnosis', before: false, after: true }))).toBe('added “Use AI diagnosis”');
    expect(historyWords(item({ label: 'Encode costs', before: true, after: false }))).toBe('removed “Encode costs”');
    expect(historyWords(item({ label: 'Encode costs', before: null, after: false }))).toBe('listed “Encode costs” as off');
  });

  it('says what happened to the role', () => {
    expect(historyWords(item({ kind: 'CREATED', fromValue: 'Chief mechanic' }))).toBe('created the role from Chief mechanic');
    expect(historyWords(item({ kind: 'RENAMED', fromValue: 'Parts clerk', toValue: 'Parts and costs clerk' }))).toBe(
      'renamed it from Parts clerk to Parts and costs clerk',
    );
    expect(historyWords(item({ kind: 'DESCRIBED' }))).toBe('changed the description');
    expect(historyWords(item({ kind: 'DELETED' }))).toBe('deleted the role');
  });
});

describe('the spreadsheet (AC-16)', () => {
  it('quotes every cell, doubles quotes and keeps formulas as text', () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(['=SUM(1)', '+1', '-1', '@x'].map(csvCell)).toEqual(['"\'=SUM(1)"', '"\'+1"', '"\'-1"', '"\'@x"']);
  });

  it('has one row per permission, a People row, and one column per role with custom ones marked', () => {
    const lines = rolesCsv(data).split('\r\n');
    expect(lines[0]).toBe('"Group","Permission","Description","Admin","\'=SUM(1) (custom)"');
    expect(lines[1]).toBe('"Costs","See costs","Read parts and labor costs","Yes","No"');
    expect(lines[3]).toBe('"Tickets","See every ticket","Say ""all""","Yes","No"');
    expect(lines[4]).toBe('"People","","","1","3"');
    expect(lines).toHaveLength(5);
  });

  it('names the file by the system and the local date', () => {
    expect(csvFileName('VRMS', new Date(2026, 10, 5, 23, 30))).toBe('welinc-vrms-roles-2026-11-05.csv');
  });
});

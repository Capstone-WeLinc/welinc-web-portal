import { describe, expect, it, vi } from 'vitest';
import type { AdminMe } from '@/lib/admin';
import type { CatalogSystem, ManagedPerson, PersonDetail } from '@/lib/adminApi';
import {
  accessRows,
  accessSummary,
  actionSystem,
  filterChoices,
  isPending,
  orList,
  parseListSystem,
  parseSort,
  personPill,
  personSystems,
  relativeTime,
  roleLine,
  signInFacts,
  sortLabel,
  subLine,
  systemChips,
  temporaryUntilIn,
  untilLabel,
  viewerAdmins,
  viewerSystems,
} from './peopleRules';

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));

// covers: suite spec 0017 AC-3 (filters), AC-4 (sort and sub line), AC-6 (chips), AC-7 (pill and
// role line), AC-10 (access summary), AC-11 (sign in card), AC-12 (access rows), AC-16 (system sent)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Felicidad Roxas', email: 'multi.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const suite = me({ suiteAdmin: true });
const vrmsAndVmms = me({ adminOf: ['VRMS', 'VMMS'] });
const vrmsOnly = me({ adminOf: ['VRMS'] });

const catalog: CatalogSystem[] = [
  {
    code: 'VRMS',
    name: 'Vehicle Repair Management System',
    maxRolesPerUser: 1,
    roles: [
      { code: 'ADMIN', name: 'Admin', description: '', isSystemAdmin: true },
      { code: 'CHIEF_MECHANIC', name: 'Chief Mechanic', description: '', isSystemAdmin: false },
      { code: 'MECHANIC', name: 'Mechanic', description: '', isSystemAdmin: false },
    ],
  },
  {
    code: 'VMMS',
    name: 'Vehicle Maintenance Management System',
    maxRolesPerUser: 1,
    roles: [{ code: 'OPERATIONS', name: 'Operations', description: '', isSystemAdmin: false }],
  },
  {
    code: 'BMS',
    name: 'Booking Management System',
    maxRolesPerUser: 1,
    roles: [{ code: 'OPERATIONS', name: 'Operations', description: '', isSystemAdmin: false }],
  },
];

const person = (over: Partial<ManagedPerson> = {}): ManagedPerson => ({
  id: 'p1',
  name: 'Corazon Villareal',
  email: 'multi.lead@welinc.com',
  emailVerified: true,
  passwordSet: true,
  contact: null,
  profilePicture: null,
  isActive: true,
  isLocked: false,
  lockedAt: null,
  createdAt: '2026-11-14T07:15:00.000Z',
  updatedAt: '2026-11-14T07:15:00.000Z',
  roles: [
    { role: 'CHIEF_MECHANIC', system: 'VRMS' },
    { role: 'OPERATIONS', system: 'VMMS' },
    { role: 'OPERATIONS', system: 'BMS' },
  ],
  otherSystems: [],
  lastSignedInAt: '2026-11-22T01:33:00.000Z',
  ...over,
});

const detail = (over: Partial<PersonDetail> = {}): PersonDetail => ({
  ...person(),
  lastSignedInAt: '2026-11-22T01:33:00.000Z',
  pendingDeletion: false,
  suiteAdmin: false,
  deletedAt: null,
  addedBy: null,
  failedSignIns30d: 0,
  sessionCount: 0,
  setupCodeExpiresAt: null,
  restorableUntil: null,
  ...over,
});

describe('the list filters (AC-3)', () => {
  it('gives a suite admin all three systems and a two system admin theirs', () => {
    expect(filterChoices(suite)).toEqual(['VRMS', 'VMMS', 'BMS']);
    expect(filterChoices(vrmsAndVmms)).toEqual(['VRMS', 'VMMS']);
  });

  it('gives an admin of one system no filter at all', () => {
    expect(filterChoices(vrmsOnly)).toEqual([]);
  });

  it('keeps the systems in VRMS, VMMS, BMS order whatever order adminOf comes in', () => {
    expect(viewerSystems(me({ adminOf: ['BMS', 'VRMS'] }))).toEqual(['VRMS', 'BMS']);
  });

  it('lets a suite admin who also holds an admin role stay the whole suite', () => {
    expect(viewerSystems(me({ suiteAdmin: true, adminOf: ['VRMS'] }))).toEqual(['VRMS', 'VMMS', 'BMS']);
  });

  it('falls back to All for a system the viewer cannot pick', () => {
    expect(parseListSystem(vrmsAndVmms, 'BMS')).toBeNull();
    expect(parseListSystem(vrmsAndVmms, 'nonsense')).toBeNull();
    expect(parseListSystem(vrmsAndVmms, null)).toBeNull();
    expect(parseListSystem(vrmsAndVmms, 'VMMS')).toBe('VMMS');
  });

  it('never picks a system for an admin of one system, even their own', () => {
    expect(parseListSystem(vrmsOnly, 'VRMS')).toBeNull();
  });

  it('says whether the viewer admins a system', () => {
    expect(viewerAdmins(suite, 'BMS')).toBe(true);
    expect(viewerAdmins(vrmsAndVmms, 'BMS')).toBe(false);
    expect(viewerAdmins(vrmsAndVmms, 'VMMS')).toBe(true);
  });
});

describe('the sorts (AC-3, AC-4)', () => {
  it('falls back to Name for an unknown or missing sort', () => {
    expect(parseSort('lastSignedIn')).toBe('lastSignedIn');
    expect(parseSort('newest')).toBe('newest');
    expect(parseSort('oldest')).toBe('name');
    expect(parseSort(null)).toBe('name');
  });

  it('labels each sort the way the list shows it', () => {
    expect(sortLabel('name')).toBe('Name, A to Z');
    expect(sortLabel('lastSignedIn')).toBe('Last signed in');
    expect(sortLabel('newest')).toBe('Newest first');
  });
});

describe('systems and chips (AC-6)', () => {
  it('lists the systems from roles and otherSystems once each, in order', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS' }], otherSystems: ['VMMS', 'BMS'] });
    expect(personSystems(p)).toEqual(['VMMS', 'BMS']);
  });

  it('fills the chips for systems the viewer admins and outlines the rest', () => {
    expect(systemChips(person(), vrmsAndVmms)).toEqual([
      { system: 'VRMS', filled: true },
      { system: 'VMMS', filled: true },
      { system: 'BMS', filled: false },
    ]);
  });

  it('fills every chip for a suite admin', () => {
    expect(systemChips(person(), suite).every((c) => c.filled)).toBe(true);
  });

  it('builds chips for a person who is only in a system through otherSystems', () => {
    const p = person({ roles: [], otherSystems: ['BMS'] });
    expect(systemChips(p, vrmsOnly)).toEqual([{ system: 'BMS', filled: false }]);
  });
});

describe('the status pill (AC-7)', () => {
  const base = { isActive: true, isLocked: false, passwordSet: true, pendingDeletion: false, deletedAt: null };

  it('is Active for a normal person, and for one whose email is not verified', () => {
    expect(personPill(base)).toEqual({ label: 'Active', tone: 'success' });
    expect(personPill({ ...base })).toEqual({ label: 'Active', tone: 'success' });
  });

  it('shows Pending for a person who has not set a password yet', () => {
    expect(personPill({ ...base, passwordSet: false })).toEqual({ label: 'Pending', tone: 'navy' });
  });

  it('shows Locked, Inactive and Pending deletion', () => {
    expect(personPill({ ...base, isLocked: true })).toEqual({ label: 'Locked', tone: 'error' });
    expect(personPill({ ...base, isActive: false })).toEqual({ label: 'Inactive', tone: 'muted' });
    expect(personPill({ ...base, pendingDeletion: true })).toEqual({ label: 'Pending deletion', tone: 'warning' });
  });

  it('picks the first that applies: deleted, then pending deletion, then inactive, then locked, then pending', () => {
    const all = { isActive: false, isLocked: true, passwordSet: false, pendingDeletion: true, deletedAt: '2026-11-23T10:00:00.000Z' };
    expect(personPill(all).label).toBe('Deleted');
    expect(personPill({ ...all, deletedAt: null }).label).toBe('Pending deletion');
    expect(personPill({ ...all, deletedAt: null, pendingDeletion: false }).label).toBe('Inactive');
    expect(personPill({ ...all, deletedAt: null, pendingDeletion: false, isActive: true }).label).toBe('Locked');
    expect(personPill({ ...all, deletedAt: null, pendingDeletion: false, isActive: true, isLocked: false }).label).toBe('Pending');
  });

  it('puts the restore date in the Deleted pill, read in Manila time', () => {
    const pill = personPill({ ...base, deletedAt: '2026-11-23T10:00:00.000Z', restorableUntil: '2026-12-23T17:30:00.000Z' });
    expect(pill).toEqual({ label: 'Deleted, restorable until 2026-12-24', tone: 'error' });
  });
});

describe('the role line (AC-7)', () => {
  it('names the first system and counts the others', () => {
    expect(roleLine(person(), catalog)).toBe('Chief Mechanic in VRMS, plus 2 more systems');
  });

  it('says "1 more system" in the singular', () => {
    const p = person({ roles: person().roles.slice(0, 2) });
    expect(roleLine(p, catalog)).toBe('Chief Mechanic in VRMS, plus 1 more system');
  });

  it('shows just the role for a person in one system', () => {
    const p = person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }] });
    expect(roleLine(p, catalog)).toBe('Mechanic in VRMS');
  });

  it('says there is no access for a person with no role', () => {
    expect(roleLine(person({ roles: [], otherSystems: [] }), catalog)).toBe('No access to any system');
  });

  it('falls back to a readable label when the catalog has not loaded', () => {
    expect(roleLine(person({ roles: [{ role: 'CHIEF_MECHANIC', system: 'VRMS' }] }), null)).toBe('Chief mechanic in VRMS');
  });

  it('joins two roles held in the same system', () => {
    const p = person({
      roles: [
        { role: 'CHIEF_MECHANIC', system: 'VRMS' },
        { role: 'MECHANIC', system: 'VRMS' },
      ],
    });
    expect(roleLine(p, catalog)).toBe('Chief Mechanic and Mechanic in VRMS');
  });

  it('uses a placeholder when the first system is only known through otherSystems', () => {
    expect(roleLine(person({ roles: [], otherSystems: ['BMS'] }), catalog)).toBe('A role in BMS');
  });
});

describe('orList', () => {
  it('reads like a sentence', () => {
    expect(orList([])).toBe('');
    expect(orList(['VRMS'])).toBe('VRMS');
    expect(orList(['VMMS', 'BMS'])).toBe('VMMS or BMS');
    expect(orList(['VRMS', 'VMMS', 'BMS'])).toBe('VRMS, VMMS or BMS');
  });
});

describe('temporary access', () => {
  it('uses the latest end of a system\'s temporary roles', () => {
    const p = person({
      roles: [
        { role: 'MECHANIC', system: 'VRMS', temporaryUntil: '2026-11-24T08:00:00.000Z' },
        { role: 'CHIEF_MECHANIC', system: 'VRMS', temporaryUntil: '2026-11-25T08:00:00.000Z' },
        { role: 'OPERATIONS', system: 'BMS', temporaryUntil: '2026-11-30T08:00:00.000Z' },
      ],
    });
    expect(temporaryUntilIn(p, 'VRMS')).toBe('2026-11-25T08:00:00.000Z');
  });

  it('is null when no role of that system is temporary', () => {
    expect(temporaryUntilIn(person(), 'VRMS')).toBeNull();
  });

  it('writes the end in Manila time', () => {
    expect(untilLabel('2026-11-23T17:32:00.000Z')).toBe('Until 2026-11-24 01:32');
  });
});

describe('the Overview access card (AC-10)', () => {
  it('lists a row per system the person is in, and the systems they have no access to', () => {
    const p = person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }] });
    const { rows, noAccess } = accessSummary(p, catalog);
    expect(rows).toEqual([{ system: 'VRMS', roles: ['Mechanic'], temporaryUntil: null }]);
    expect(noAccess).toEqual(['VMMS', 'BMS']);
  });

  it('carries the temporary end into its row', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS', temporaryUntil: '2026-11-24T08:00:00.000Z' }] });
    expect(accessSummary(p, catalog).rows[0].temporaryUntil).toBe('2026-11-24T08:00:00.000Z');
  });

  it('has no rows and all three systems for a person with no role', () => {
    const { rows, noAccess } = accessSummary(person({ roles: [], otherSystems: [] }), catalog);
    expect(rows).toEqual([]);
    expect(noAccess).toEqual(['VRMS', 'VMMS', 'BMS']);
  });
});

describe('the system an action sends (AC-16)', () => {
  it('is the first system the person is in and the viewer admins', () => {
    expect(actionSystem(person(), vrmsAndVmms)).toBe('VRMS');
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'VMMS' }, { role: 'OPERATIONS', system: 'BMS' }] });
    expect(actionSystem(p, vrmsAndVmms)).toBe('VMMS');
  });

  it('skips systems the viewer does not admin', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS' }, { role: 'MECHANIC', system: 'VMMS' }] });
    expect(actionSystem(p, me({ adminOf: ['VMMS'] }))).toBe('VMMS');
  });

  it('is the first system the person is in for a suite admin', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS' }] });
    expect(actionSystem(p, suite)).toBe('BMS');
  });

  it('is null for a person with no role', () => {
    expect(actionSystem(person({ roles: [], otherSystems: [] }), suite)).toBeNull();
  });

  it('is null when the person is only in systems the viewer does not admin', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS' }] });
    expect(actionSystem(p, vrmsOnly)).toBeNull();
  });
});

describe('relative times', () => {
  const now = new Date('2026-11-23T12:00:00.000Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  it('reads just now, minutes, hours, yesterday and days', () => {
    expect(relativeTime(ago(20_000), now)).toBe('just now');
    expect(relativeTime(ago(minute), now)).toBe('1 minute ago');
    expect(relativeTime(ago(5 * minute), now)).toBe('5 minutes ago');
    expect(relativeTime(ago(hour), now)).toBe('1 hour ago');
    expect(relativeTime(ago(3 * hour), now)).toBe('3 hours ago');
    expect(relativeTime(ago(day), now)).toBe('yesterday');
    expect(relativeTime(ago(4 * day), now)).toBe('4 days ago');
  });

  it('switches to the date after a week', () => {
    expect(relativeTime(ago(7 * day), now)).toBe('on 2026-11-16');
  });
});

describe('a row\'s sub line (AC-4)', () => {
  const now = new Date('2026-11-23T12:00:00.000Z').getTime();
  const ctx = { sort: 'name' as const, system: null, me: vrmsAndVmms, catalog, now };

  it('shows the roles in the viewer\'s systems, each label once, when sorted by name', () => {
    const p = person({
      roles: [
        { role: 'CHIEF_MECHANIC', system: 'VRMS' },
        { role: 'OPERATIONS', system: 'VMMS' },
        { role: 'OPERATIONS', system: 'BMS' },
      ],
    });
    expect(subLine(p, ctx)).toBe('Chief Mechanic, Operations');
  });

  it('collapses the same role label held in two systems', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'VMMS' }, { role: 'OPERATIONS', system: 'BMS' }] });
    expect(subLine(p, { ...ctx, me: suite })).toBe('Operations');
  });

  it('shows the role in the picked system only', () => {
    expect(subLine(person(), { ...ctx, system: 'VMMS' })).toBe('Operations');
  });

  it('shows when they last signed in, or Never, when sorted by last sign in', () => {
    expect(subLine(person({ lastSignedInAt: new Date(now - 3 * 3_600_000).toISOString() }), { ...ctx, sort: 'lastSignedIn' })).toBe(
      'Signed in 3 hours ago',
    );
    expect(subLine(person({ lastSignedInAt: null }), { ...ctx, sort: 'lastSignedIn' })).toBe('Never signed in');
  });

  it('shows the date the account was made when sorted by newest', () => {
    expect(subLine(person(), { ...ctx, sort: 'newest' })).toBe('Added 2026-11-14');
  });

  it('says so when the person has no role in the viewer\'s systems', () => {
    const p = person({ roles: [{ role: 'OPERATIONS', system: 'BMS' }] });
    expect(subLine(p, ctx)).toBe('No role in your systems');
  });

  it('says there is no access for a person with no role anywhere', () => {
    expect(subLine(person({ roles: [], otherSystems: [] }), ctx)).toBe('No access to any system');
  });
});

describe('the Sign in card (AC-11)', () => {
  const now = new Date('2026-11-23T12:00:00.000Z').getTime();

  it('shows the four rows for an active person', () => {
    const rows = signInFacts(detail({ sessionCount: 2, failedSignIns30d: 3 }), now);
    expect(rows).toEqual([
      { label: 'Password', value: 'Set', tone: 'ok' },
      { label: 'Email', value: 'Verified', tone: 'ok' },
      { label: 'Signed in devices', value: '2', tone: 'ok' },
      { label: 'Wrong passwords, last 30 days', value: '3', tone: 'bad' },
    ]);
  });

  it('says None for no devices and calls zero wrong passwords fine', () => {
    const rows = signInFacts(detail(), now);
    expect(rows[2]).toEqual({ label: 'Signed in devices', value: 'None', tone: 'ok' });
    expect(rows[3].tone).toBe('ok');
  });

  it('shows the password as Locked for a locked person', () => {
    expect(signInFacts(detail({ isLocked: true }), now)[0]).toEqual({ label: 'Password', value: 'Locked', tone: 'bad' });
  });

  it('shows Not verified for an unverified email on an active person', () => {
    expect(signInFacts(detail({ emailVerified: false }), now)[1]).toEqual({ label: 'Email', value: 'Not verified', tone: 'note' });
  });

  it('shows the setup rows for a pending person, with the code end', () => {
    const rows = signInFacts(
      detail({ passwordSet: false, emailVerified: false, setupCodeExpiresAt: '2026-11-26T10:32:00.000Z' }),
      now,
    );
    expect(rows).toEqual([
      { label: 'Password', value: 'Not set yet', tone: 'note' },
      { label: 'Email', value: 'Not verified', tone: 'note' },
      { label: 'Setup code', value: 'Ends 2026-11-26 18:32', tone: 'note' },
    ]);
  });

  it('shows an expired setup code as Expired', () => {
    const rows = signInFacts(detail({ passwordSet: false, setupCodeExpiresAt: '2026-11-22T10:00:00.000Z' }), now);
    expect(rows.at(-1)).toEqual({ label: 'Setup code', value: 'Expired', tone: 'bad' });
  });

  it('shows no setup code row when none exists', () => {
    const rows = signInFacts(detail({ passwordSet: false, setupCodeExpiresAt: null }), now);
    expect(rows.map((r) => r.label)).toEqual(['Password', 'Email']);
  });

  it('is Pending only for an active, unlocked person with no password yet', () => {
    expect(isPending({ isActive: true, isLocked: false, passwordSet: false })).toBe(true);
    expect(isPending({ isActive: true, isLocked: true, passwordSet: false })).toBe(false);
    expect(isPending({ isActive: false, isLocked: false, passwordSet: false })).toBe(false);
    expect(isPending({ isActive: true, isLocked: false, passwordSet: true })).toBe(false);
  });
});

describe('the Access tab rows (AC-12)', () => {
  const held = (rows: ReturnType<typeof accessRows>, system: string) => rows.find((r) => r.system === system)!;

  it('lets a two system admin change roles they admin and shows others read only', () => {
    const rows = accessRows(detail(), vrmsAndVmms, catalog);
    expect(rows.map((r) => r.system)).toEqual(['VRMS', 'VMMS', 'BMS']);
    expect(held(rows, 'VRMS')).toMatchObject({ kind: 'held', action: 'change', roles: ['Chief Mechanic'], roleCodes: ['CHIEF_MECHANIC'] });
    expect(held(rows, 'VMMS')).toMatchObject({ kind: 'held', action: 'change' });
    expect(held(rows, 'BMS')).toEqual({ kind: 'readonly', system: 'BMS', roles: ['Operations'] });
  });

  it('offers Give access for a system the viewer admins and the person is not in', () => {
    const p = detail({ roles: [{ role: 'MECHANIC', system: 'VRMS' }] });
    const rows = accessRows(p, vrmsAndVmms, catalog);
    expect(held(rows, 'VMMS')).toEqual({ kind: 'missing', system: 'VMMS', canGive: true });
  });

  it('shows a system admin only their own systems plus the systems the person is in', () => {
    const p = detail({ roles: [{ role: 'MECHANIC', system: 'VRMS' }, { role: 'OPERATIONS', system: 'BMS' }] });
    expect(accessRows(p, vrmsOnly, catalog).map((r) => r.system)).toEqual(['VRMS', 'BMS']);
  });

  it('shows all three systems to a suite admin, with Give access on a person with no role', () => {
    const rows = accessRows(detail({ roles: [], otherSystems: [] }), suite, catalog);
    expect(rows).toEqual([
      { kind: 'missing', system: 'VRMS', canGive: true },
      { kind: 'missing', system: 'VMMS', canGive: true },
      { kind: 'missing', system: 'BMS', canGive: true },
    ]);
  });

  it('shows a temporary role without Change role, carrying its end', () => {
    const p = detail({ roles: [{ role: 'OPERATIONS', system: 'BMS', temporaryUntil: '2026-11-24T08:00:00.000Z' }] });
    expect(held(accessRows(p, suite, catalog), 'BMS')).toMatchObject({
      kind: 'held',
      action: 'temporary',
      temporaryUntil: '2026-11-24T08:00:00.000Z',
    });
  });

  it('hides Change role on your own page', () => {
    const rows = accessRows(detail({ id: 'me' }), vrmsAndVmms, catalog);
    expect(held(rows, 'VRMS')).toMatchObject({ kind: 'held', action: 'none' });
  });

  it('hides Change role and Give access on a suite admin', () => {
    const p = detail({ suiteAdmin: true, roles: [{ role: 'MECHANIC', system: 'VRMS' }] });
    const rows = accessRows(p, suite, catalog);
    expect(held(rows, 'VRMS')).toMatchObject({ kind: 'held', action: 'none' });
    expect(held(rows, 'VMMS')).toEqual({ kind: 'missing', system: 'VMMS', canGive: false });
  });

  it('does not offer Give access on your own page', () => {
    const p = detail({ id: 'me', roles: [{ role: 'ADMIN', system: 'VRMS' }] });
    expect(held(accessRows(p, vrmsAndVmms, catalog), 'VMMS')).toEqual({ kind: 'missing', system: 'VMMS', canGive: false });
  });
});

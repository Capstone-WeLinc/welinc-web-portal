import { describe, expect, it, vi } from 'vitest';
import type { AdminMe } from '@/lib/admin';
import type { CatalogSystem } from '@/lib/adminApi';
import {
  addSystem,
  filterCount,
  filterSystems,
  NO_PICKS,
  parsePicks,
  picksToParams,
  roleTicked,
  rowPill,
  rowState,
  samePicks,
  STATUS_CHIPS,
  toggleRole,
  toggleStatus,
  toggleSystem,
  type FilterPicks,
} from './filterRules';

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));

// covers: suite spec 0019 AC-21 (the People filter's rules), AC-21a (the address values) and
// AC-21b (counts of filters). The rules are pure, so they are tested without the popover.

const role = (code: string, name: string) => ({ code, name }) as CatalogSystem['roles'][number];

const catalog: CatalogSystem[] = [
  { code: 'VRMS', name: 'Repair', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('CHIEF_MECHANIC', 'Chief Mechanic'), role('MECHANIC', 'Mechanic')] },
  { code: 'VMMS', name: 'Maintenance', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('OPERATIONS', 'Operations'), role('MECHANIC', 'Mechanic')] },
  { code: 'BMS', name: 'Bookings', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('DRIVER', 'Driver')] },
];

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'u1', name: 'Admin', email: 'admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const ALL: ('VRMS' | 'VMMS' | 'BMS')[] = ['VRMS', 'VMMS', 'BMS'];

describe('the status chips', () => {
  it('come in the board order, with Pending meaning setup pending', () => {
    expect(STATUS_CHIPS.map((c) => c.label)).toEqual(['Needs attention', 'Locked', 'Pending', 'Active', 'Inactive']);
    expect(STATUS_CHIPS.find((c) => c.label === 'Pending')?.value).toBe('SETUP_PENDING');
  });

  it('toggle on and off, always kept in chip order', () => {
    let picks = toggleStatus(NO_PICKS, 'INACTIVE');
    picks = toggleStatus(picks, 'LOCKED');
    expect(picks.status).toEqual(['LOCKED', 'INACTIVE']);
    expect(toggleStatus(picks, 'LOCKED').status).toEqual(['INACTIVE']);
  });
});

describe('which systems the popover offers', () => {
  it('gives a suite admin all three in VRMS, VMMS, BMS order', () => {
    expect(filterSystems(me({ suiteAdmin: true }), null)).toEqual(ALL);
  });

  it('gives a system admin only the systems they administer', () => {
    expect(filterSystems(me({ adminOf: ['BMS', 'VRMS'] }), null)).toEqual(['VRMS', 'BMS']);
  });

  it('narrows to the ?system scope, and to nothing when the viewer cannot see it', () => {
    expect(filterSystems(me({ suiteAdmin: true }), 'VMMS')).toEqual(['VMMS']);
    expect(filterSystems(me({ adminOf: ['VRMS'] }), 'VMMS')).toEqual([]);
  });
});

describe('reading the address', () => {
  it('reads status and access picks', () => {
    const { picks, rolesPending } = parsePicks({ status: 'LOCKED,INACTIVE', access: 'VRMS,VMMS:MECHANIC,BMS:DRIVER' }, ALL, catalog);
    expect(rolesPending).toBe(false);
    expect(picks.status).toEqual(['LOCKED', 'INACTIVE']);
    expect(picks.access).toEqual({ VRMS: 'all', VMMS: ['MECHANIC'], BMS: ['DRIVER'] });
  });

  it('drops status values that are not chips', () => {
    expect(parsePicks({ status: 'LOCKED,BOGUS', access: null }, ALL, catalog).picks.status).toEqual(['LOCKED']);
  });

  it('drops access items for a system that is not offered, an unknown role, or extra parts', () => {
    const { picks } = parsePicks({ status: null, access: 'VRMS:GONE,BMS,VMMS:MECHANIC:EXTRA,NOPE' }, ['VRMS', 'VMMS'], catalog);
    expect(picks.access).toEqual({});
  });

  it('keeps a whole system over its roles when the address names both', () => {
    const { picks } = parsePicks({ status: null, access: 'VMMS:MECHANIC,VMMS' }, ALL, catalog);
    expect(picks.access.VMMS).toBe('all');
  });

  it('collapses duplicates and puts roles in catalog order', () => {
    const { picks } = parsePicks({ status: null, access: 'VMMS:MECHANIC,VMMS:ADMIN,VMMS:MECHANIC' }, ALL, catalog);
    expect(picks.access.VMMS).toEqual(['ADMIN', 'MECHANIC']);
  });

  it('turns every role of a system back into the whole system', () => {
    const { picks } = parsePicks({ status: null, access: 'BMS:ADMIN,BMS:DRIVER' }, ALL, catalog);
    expect(picks.access.BMS).toBe('all');
  });

  it('says roles are pending, and skips them, while the catalog has not arrived', () => {
    const { picks, rolesPending } = parsePicks({ status: null, access: 'VRMS,VMMS:MECHANIC' }, ALL, null);
    expect(rolesPending).toBe(true);
    expect(picks.access).toEqual({ VRMS: 'all' });
  });

  it('is not pending for a whole system alone, even with no catalog', () => {
    expect(parsePicks({ status: null, access: 'VRMS' }, ALL, null).rolesPending).toBe(false);
  });

  it('reads an empty address as no picks', () => {
    expect(parsePicks({ status: null, access: null }, ALL, catalog).picks).toEqual(NO_PICKS);
  });
});

describe('writing the address', () => {
  it('writes nothing for no picks', () => {
    expect(picksToParams(NO_PICKS)).toEqual({ status: null, access: null });
  });

  it('writes access in VRMS, VMMS, BMS order whatever order it was picked in', () => {
    const picks: FilterPicks = { status: ['LOCKED'], access: { BMS: ['DRIVER'], VRMS: 'all', VMMS: ['ADMIN', 'MECHANIC'] } };
    expect(picksToParams(picks)).toEqual({ status: 'LOCKED', access: 'VRMS,VMMS:ADMIN,VMMS:MECHANIC,BMS:DRIVER' });
  });

  it('round trips with the reader', () => {
    const raw = { status: 'ATTENTION,ACTIVE_GROUP', access: 'VRMS,VMMS:OPERATIONS,BMS:DRIVER' };
    const { picks } = parsePicks(raw, ALL, catalog);
    expect(picksToParams(picks)).toEqual(raw);
  });

  it('compares picks by what they write', () => {
    const a: FilterPicks = { status: [], access: { VMMS: ['ADMIN'] } };
    const b: FilterPicks = { status: [], access: { VMMS: ['ADMIN'] } };
    expect(samePicks(a, b)).toBe(true);
    expect(samePicks(a, toggleStatus(b, 'LOCKED'))).toBe(false);
  });
});

describe('the filter count', () => {
  it('counts each status chip and each system that is on, never roles on their own', () => {
    expect(filterCount(NO_PICKS)).toBe(0);
    const picks: FilterPicks = { status: ['LOCKED', 'INACTIVE'], access: { VRMS: 'all', VMMS: ['ADMIN', 'MECHANIC'], BMS: ['DRIVER'] } };
    expect(filterCount(picks)).toBe(5);
  });
});

describe('the system row and its roles', () => {
  it('reads a row as off, all or some', () => {
    expect(rowState(NO_PICKS, 'VRMS')).toBe('off');
    expect(rowState({ status: [], access: { VRMS: 'all' } }, 'VRMS')).toBe('all');
    expect(rowState({ status: [], access: { VRMS: ['ADMIN'] } }, 'VRMS')).toBe('some');
  });

  it('turns a row on as the whole system, and off again from whole or some', () => {
    const on = toggleSystem(NO_PICKS, 'VMMS');
    expect(on.access.VMMS).toBe('all');
    expect(toggleSystem(on, 'VMMS').access).toEqual({});
    expect(toggleSystem({ status: [], access: { VMMS: ['ADMIN'] } }, 'VMMS').access).toEqual({});
  });

  it('narrows the whole system to one role when a role is ticked, showing it as the only one', () => {
    const picks = toggleRole({ status: [], access: { VMMS: 'all' } }, 'VMMS', 'MECHANIC', catalog);
    expect(picks.access.VMMS).toEqual(['MECHANIC']);
    expect(roleTicked(picks, 'VMMS', 'MECHANIC')).toBe(true);
    expect(roleTicked(picks, 'VMMS', 'ADMIN')).toBe(false);
  });

  it('does not tick roles for a whole system (the chips show unticked while the box picks everyone)', () => {
    expect(roleTicked({ status: [], access: { VMMS: 'all' } }, 'VMMS', 'MECHANIC')).toBe(false);
  });

  it('keeps ticked roles in catalog order', () => {
    let picks = toggleRole(NO_PICKS, 'VMMS', 'MECHANIC', catalog);
    picks = toggleRole(picks, 'VMMS', 'ADMIN', catalog);
    expect(picks.access.VMMS).toEqual(['ADMIN', 'MECHANIC']);
  });

  it('turns back into the whole system on the last missing role', () => {
    let picks = toggleRole(NO_PICKS, 'BMS', 'ADMIN', catalog);
    picks = toggleRole(picks, 'BMS', 'DRIVER', catalog);
    expect(picks.access.BMS).toBe('all');
  });

  it('turns the system off when the last ticked role is unticked', () => {
    const one = toggleRole(NO_PICKS, 'BMS', 'DRIVER', catalog);
    expect(toggleRole(one, 'BMS', 'DRIVER', catalog).access).toEqual({});
  });

  it('leaves other systems alone', () => {
    const start: FilterPicks = { status: ['LOCKED'], access: { VRMS: 'all' } };
    const picks = toggleRole(start, 'VMMS', 'ADMIN', catalog);
    expect(picks.access.VRMS).toBe('all');
    expect(picks.status).toEqual(['LOCKED']);
  });
});

describe('the row pill', () => {
  it('says Everyone for a whole system', () => {
    expect(rowPill({ status: [], access: { VRMS: 'all' } }, 'VRMS', catalog, 82)).toBe('Everyone');
  });

  it('names the role when there is one, and counts roles when there are more', () => {
    expect(rowPill({ status: [], access: { VMMS: ['MECHANIC'] } }, 'VMMS', catalog, 88)).toBe('Mechanic');
    expect(rowPill({ status: [], access: { VMMS: ['ADMIN', 'MECHANIC'] } }, 'VMMS', catalog, 88)).toBe('2 roles');
  });

  it('falls back to the role code when the catalog does not list it', () => {
    expect(rowPill({ status: [], access: { VMMS: ['MECHANIC'] } }, 'VMMS', null, 88)).toBe('MECHANIC');
  });

  it('shows the system count when off, and a dash while the counts load or failed', () => {
    expect(rowPill(NO_PICKS, 'BMS', catalog, 48)).toBe('48');
    expect(rowPill(NO_PICKS, 'BMS', catalog, 0)).toBe('0');
    expect(rowPill(NO_PICKS, 'BMS', catalog, null)).toBe('–');
  });
});

describe('Add user preselects a system', () => {
  it('takes the ?system scope first', () => {
    expect(addSystem('VMMS', { status: [], access: { VRMS: 'all' } })).toBe('VMMS');
  });

  it('takes the one whole system when access is exactly that', () => {
    expect(addSystem(null, { status: [], access: { VRMS: 'all' } })).toBe('VRMS');
  });

  it('takes none for two systems, for one system with roles, or for no picks', () => {
    expect(addSystem(null, { status: [], access: { VRMS: 'all', BMS: 'all' } })).toBeNull();
    expect(addSystem(null, { status: [], access: { VRMS: ['ADMIN'] } })).toBeNull();
    expect(addSystem(null, NO_PICKS)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMe } from '@/lib/admin';
import { fetchFacets, type CatalogSystem, type PeopleFacets } from '@/lib/adminApi';
import { PeopleFilter } from './PeopleFilter';
import { NO_PICKS, type FilterPicks } from './filterRules';

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/adminApi', async (original) => ({ ...(await original<typeof import('@/lib/adminApi')>()), fetchFacets: vi.fn() }));

// Radix popovers measure with these; jsdom has no layout
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// covers: suite spec 0019 AC-21 (the popover, the draft, Show) and AC-21b (counts, the dash)

const facets = vi.mocked(fetchFacets);

const role = (code: string, name: string) => ({ code, name }) as CatalogSystem['roles'][number];
const catalog: CatalogSystem[] = [
  { code: 'VRMS', name: 'Repair', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('MECHANIC', 'Mechanic')] },
  { code: 'VMMS', name: 'Maintenance', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('MECHANIC', 'Mechanic')] },
  { code: 'BMS', name: 'Bookings', maxRolesPerUser: 1, roles: [role('ADMIN', 'Admin'), role('DRIVER', 'Driver')] },
];

const ANSWER: PeopleFacets = {
  total: 146,
  status: { ATTENTION: 0, LOCKED: 2, SETUP_PENDING: 1, ACTIVE_GROUP: 142, INACTIVE: 1 },
  systems: [
    { system: 'VRMS', count: 82, roles: [{ code: 'ADMIN', count: 6 }, { code: 'MECHANIC', count: 76 }] },
    { system: 'VMMS', count: 88, roles: [{ code: 'ADMIN', count: 6 }, { code: 'MECHANIC', count: 82 }] },
    { system: 'BMS', count: 48, roles: [{ code: 'ADMIN', count: 5 }, { code: 'DRIVER', count: 43 }] },
  ],
};

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'u1', name: 'Admin', email: 'a@welinc.com', picture: null },
  suiteAdmin: true,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

function renderFilter(over: Partial<Parameters<typeof PeopleFilter>[0]> = {}) {
  const onApply = vi.fn();
  render(<PeopleFilter me={me()} catalog={catalog} scope={null} q="" applied={NO_PICKS} onApply={onApply} {...over} />);
  return onApply;
}

async function openFilter() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^Filter/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Filters' });
  return { user, dialog };
}

beforeEach(() => {
  facets.mockReset();
  facets.mockResolvedValue(ANSWER);
});

afterEach(() => cleanup());

describe('the Filter button', () => {
  it('shows a plain label with nothing applied, and the applied count when there is some', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    cleanup();
    const applied: FilterPicks = { status: ['LOCKED'], access: { VRMS: 'all' } };
    renderFilter({ applied });
    expect(screen.getByRole('button', { name: 'Filter, 2 on' })).toBeInTheDocument();
  });

  it('asks for no counts until it is opened', () => {
    renderFilter();
    expect(facets).not.toHaveBeenCalled();
  });
});

describe('the popover', () => {
  it('lists the five status chips and a row per system a suite admin sees, each with its count', async () => {
    renderFilter();
    const { dialog } = await openFilter();
    expect(await within(dialog).findByRole('checkbox', { name: /^Locked\s*2/ }, { timeout: 2000 })).toBeInTheDocument();
    for (const name of [/^Needs attention/, /^Pending\s*1/, /^Active\s*142/, /^Inactive\s*1/]) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: /^VRMS\s*Repair\s*82/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^VMMS\s*Maintenance\s*88/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^BMS\s*Bookings\s*48/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Show 146 people' })).toBeInTheDocument();
  });

  it('shows only the systems the viewer administers', async () => {
    renderFilter({ me: me({ suiteAdmin: false, adminOf: ['VRMS'] }) });
    const { dialog } = await openFilter();
    expect(await within(dialog).findByRole('button', { name: /^VRMS/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^VMMS/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^BMS/ })).not.toBeInTheDocument();
  });

  it('shows only the ?system row, and sends that scope with the counts call', async () => {
    renderFilter({ scope: 'VMMS' });
    const { dialog } = await openFilter();
    expect(await within(dialog).findByRole('button', { name: /^VMMS/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^VRMS/ })).not.toBeInTheDocument();
    await waitFor(() => expect(facets).toHaveBeenCalled());
    expect(facets.mock.calls[0][0]).toMatchObject({ system: 'VMMS' });
  });

  it('sends the applied search, not text being typed, with the counts call', async () => {
    renderFilter({ q: 'maria' });
    await openFilter();
    await waitFor(() => expect(facets).toHaveBeenCalled());
    expect(facets.mock.calls[0][0]).toMatchObject({ q: 'maria' });
  });

  it('folds one system open at a time, with its roles', async () => {
    renderFilter();
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('button', { name: /^VMMS\s*Maintenance/ }));
    expect(within(dialog).getByRole('group', { name: 'VMMS roles' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: /^BMS\s*Bookings/ }));
    expect(within(dialog).getByRole('group', { name: 'BMS roles' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: /^VMMS\s*Maintenance/ })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('the draft', () => {
  it('counts the picks in the footer and changes nothing until Show', async () => {
    const onApply = renderFilter();
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('checkbox', { name: /^Locked/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'All of VRMS' }));
    expect(within(dialog).getByText('2 filters on')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the draft on Show and closes', async () => {
    const onApply = renderFilter();
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('checkbox', { name: /^Locked/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'All of VMMS' }));
    await user.click(within(dialog).getByRole('button', { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith({ status: ['LOCKED'], access: { VMMS: 'all' } });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument());
  });

  it('does not apply again when Show is pressed with nothing changed', async () => {
    const onApply = renderFilter({ applied: { status: ['LOCKED'], access: {} } });
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('button', { name: /^Show/ }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('throws the draft away on Esc, and the next opening starts from what is applied', async () => {
    const onApply = renderFilter();
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('checkbox', { name: /^Locked/ }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument());
    expect(onApply).not.toHaveBeenCalled();
    const again = await openFilter();
    expect(await within(again.dialog).findByText('No filters')).toBeInTheDocument();
  });

  it('sends the draft to the counts call, with the whole system and the role picks as the address writes them', async () => {
    renderFilter();
    const { user, dialog } = await openFilter();
    await user.click(await within(dialog).findByRole('checkbox', { name: 'All of VRMS' }));
    await user.click(within(dialog).getByRole('button', { name: /^BMS\s*Bookings/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /^Driver/ }));
    await waitFor(() => expect(facets.mock.calls.at(-1)?.[0]).toMatchObject({ access: 'VRMS,BMS:DRIVER' }), { timeout: 2000 });
  });

  it('says No one matches, instead of a number, when the draft matches nobody', async () => {
    facets.mockResolvedValue({ ...ANSWER, total: 0 });
    renderFilter();
    const { dialog } = await openFilter();
    expect(await within(dialog).findByRole('button', { name: 'No one matches' })).toBeInTheDocument();
  });
});

describe('when the counts are not there', () => {
  it('shows dashes while they load, and keeps Show working when they fail', async () => {
    facets.mockRejectedValue(new Error('down'));
    const onApply = renderFilter();
    const { user, dialog } = await openFilter();
    expect(within(dialog).getByRole('button', { name: 'Show – people' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'All of BMS' }));
    await user.click(within(dialog).getByRole('button', { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith({ status: [], access: { BMS: 'all' } });
  });
});

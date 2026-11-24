import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AdminMe } from '@/lib/admin';
import type { ManagedPerson, PeopleCounts, PeopleGroup, PeoplePage } from '@/lib/adminApi';
import { PeopleListPane } from './PeopleListPane';

const api = vi.hoisted(() => ({ listPeople: vi.fn(), fetchSystems: vi.fn() }));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0017 AC-3 (title, search, filter, count, sort), AC-4 (sort and sub line),
// AC-5 (groups, counts, Load more, no match and empty states), AC-6 (code chips), AC-1 (selection)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Felicidad Roxas', email: 'multi.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: ['VRMS', 'VMMS'],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const person = (id: string, name: string, over: Partial<ManagedPerson> = {}): ManagedPerson => ({
  id,
  name,
  email: `${id}@welinc.com`,
  emailVerified: true,
  passwordSet: true,
  contact: null,
  profilePicture: null,
  isActive: true,
  isLocked: false,
  lockedAt: null,
  createdAt: '2026-11-14T07:15:00.000Z',
  updatedAt: '2026-11-14T07:15:00.000Z',
  roles: [{ role: 'MECHANIC', system: 'VRMS' }],
  otherSystems: [],
  lastSignedInAt: null,
  ...over,
});

type Data = Partial<Record<PeopleGroup, ManagedPerson[]>>;

/** The server's answer per group: the first page has `counts`, a cursor gives the rest. */
function serve(data: Data, counts: PeopleCounts, pageSize = 25) {
  api.listPeople.mockImplementation(async (params: { group: PeopleGroup; cursor?: string }): Promise<PeoplePage> => {
    const all = data[params.group] ?? [];
    const from = params.cursor ? Number(params.cursor) : 0;
    const items = all.slice(from, from + pageSize);
    const next = from + pageSize < all.length ? String(from + pageSize) : null;
    return { items, next, ...(params.cursor ? {} : { counts }) };
  });
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.search}</output>;
}

function renderPane(viewer: AdminMe = me(), start = '/admin/people', onSelect = vi.fn(), selectedId?: string, onAdd = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[start]}>
      <PeopleListPane me={viewer} selectedId={selectedId} reloadKey={0} onSelect={onSelect} onAdd={onAdd} />
      <Where />
    </MemoryRouter>,
  );
  return { onSelect, onAdd };
}

const lastCall = (group: PeopleGroup) =>
  api.listPeople.mock.calls.map(([p]) => p as Record<string, unknown>).filter((p) => p.group === group).at(-1)!;

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSystems.mockResolvedValue([
    {
      code: 'VRMS',
      name: 'VRMS',
      maxRolesPerUser: 1,
      roles: [{ code: 'MECHANIC', name: 'Mechanic', description: '', isSystemAdmin: false }],
    },
    {
      code: 'VMMS',
      name: 'VMMS',
      maxRolesPerUser: 1,
      roles: [{ code: 'OPERATIONS', name: 'Operations', description: '', isSystemAdmin: false }],
    },
  ]);
});

describe('the groups (AC-5)', () => {
  it('shows Needs attention, Active and Inactive in order, each with its count, and the total', async () => {
    serve(
      { attention: [person('a1', 'Alberto Santiago', { isLocked: true })], active: [person('b1', 'Bong Rivera')], inactive: [person('c1', 'Nonoy Evangelista', { isActive: false })] },
      { attention: 1, active: 1, inactive: 1 },
    );
    renderPane();
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Needs attention1', 'Active1', 'Inactive1']);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('people')).toBeInTheDocument();
  });

  it('hides a group with no one in it', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    await screen.findByText('Bong Rivera');
    expect(screen.queryByRole('heading', { name: /Needs attention/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Inactive/ })).not.toBeInTheDocument();
    expect(screen.getByText('person')).toBeInTheDocument();
  });

  it('asks 25 a page for every group', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    await screen.findByText('Bong Rivera');
    for (const group of ['attention', 'active', 'inactive'] as const) {
      expect(lastCall(group)).toMatchObject({ group, limit: 25, sort: 'name', system: null });
    }
  });

  it('loads more in one group only, appends the rows and drops the button on the last page', async () => {
    const many = Array.from({ length: 30 }, (_, i) => person(`p${i}`, `Person ${String(i).padStart(2, '0')}`));
    serve({ active: many, attention: [person('a1', 'Alberto Santiago', { isLocked: true })] }, { attention: 1, active: 30, inactive: 0 });
    renderPane();
    await screen.findByText('Person 00');
    expect(screen.queryByText('Person 25')).not.toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Load more' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(await screen.findByText('Person 29')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(lastCall('active')).toMatchObject({ cursor: '25' });
    expect(api.listPeople.mock.calls.filter(([p]) => (p as { group: string; cursor?: string }).group === 'attention' && (p as { cursor?: string }).cursor)).toHaveLength(0);
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('says so with a toast when Load more fails, and keeps the rows', async () => {
    const many = Array.from({ length: 30 }, (_, i) => person(`p${i}`, `Person ${String(i).padStart(2, '0')}`));
    serve({ active: many }, { attention: 0, active: 30, inactive: 0 });
    renderPane();
    await screen.findByText('Person 00');
    api.listPeople.mockRejectedValueOnce(new Error('boom'));
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await vi.waitFor(() => expect(notify.notifyError).toHaveBeenCalledWith("We couldn't load more people."));
    expect(screen.getByText('Person 00')).toBeInTheDocument();
  });

  it('shows an error with a retry when the list cannot load', async () => {
    api.listPeople.mockRejectedValue(new Error('down'));
    renderPane();
    expect(await screen.findByText("We couldn't load people.")).toBeInTheDocument();
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(await screen.findByText('Bong Rivera')).toBeInTheDocument();
  });
});

describe('rows (AC-4, AC-6, AC-1)', () => {
  it('shows the sub line, a chip per system, and filled versus outlined by what the viewer admins', async () => {
    const p = person('b1', 'Corazon Villareal', {
      roles: [
        { role: 'MECHANIC', system: 'VRMS' },
        { role: 'OPERATIONS', system: 'VMMS' },
        { role: 'OPERATIONS', system: 'BMS' },
      ],
    });
    serve({ active: [p] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    const row = (await screen.findByText('Corazon Villareal')).closest('button')!;
    expect(within(row).getByText('Mechanic, Operations')).toBeInTheDocument();
    expect(within(row).getByText('BMS')).toBeInTheDocument();
    expect(within(row).getByText('VRMS')).toBeInTheDocument();
    expect(within(row).getByText('BMS').className).not.toBe(within(row).getByText('VRMS').className);
  });

  it('selects a person on click and marks the selected row', async () => {
    serve({ active: [person('b1', 'Bong Rivera'), person('b2', 'Carl Santos')] }, { attention: 0, active: 2, inactive: 0 });
    const { onSelect } = renderPane(me(), '/admin/people', vi.fn(), 'b2');
    await userEvent.click((await screen.findByText('Bong Rivera')).closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('b1');
    expect(screen.getByText('Carl Santos').closest('button')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Bong Rivera').closest('button')).not.toHaveAttribute('aria-current');
  });

  it('does not fetch a selected person who is not in the loaded pages', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane(me(), '/admin/people', vi.fn(), 'not-loaded');
    await screen.findByText('Bong Rivera');
    expect(screen.getByText('Bong Rivera').closest('button')).not.toHaveAttribute('aria-current');
    expect(api.listPeople.mock.calls.every(([p]) => !('id' in (p as object)))).toBe(true);
  });
});

describe('the system filter (AC-3)', () => {
  it('shows All, VRMS and VMMS to a two system admin and asks for the picked system', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    const group = await screen.findByRole('group', { name: 'System' });
    expect(within(group).getAllByRole('button').map((r) => r.textContent)).toEqual(['All', 'VRMS', 'VMMS']);
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(group).getByRole('button', { name: 'VMMS' }));
    expect(within(group).getByRole('button', { name: 'VMMS' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('where')).toHaveTextContent('system=VMMS');
    await vi.waitFor(() => expect(lastCall('active')).toMatchObject({ system: 'VMMS' }));
  });

  it('shows no filter to an admin of one system', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane(me({ adminOf: ['VRMS'] }));
    await screen.findByText('Bong Rivera');
    expect(screen.queryByRole('group', { name: 'System' })).not.toBeInTheDocument();
  });

  it('shows all four choices to a suite admin', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane(me({ suiteAdmin: true, adminOf: [] }));
    const group = await screen.findByRole('group', { name: 'System' });
    expect(within(group).getAllByRole('button').map((r) => r.textContent)).toEqual(['All', 'VRMS', 'VMMS', 'BMS']);
  });

  it('falls back to All for a system the viewer cannot pick, and to Name for an unknown sort', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane(me(), '/admin/people?system=BMS&sort=bogus');
    await screen.findByText('Bong Rivera');
    expect(lastCall('active')).toMatchObject({ system: null, sort: 'name' });
    expect(screen.getByRole('button', { name: /Sort:/ })).toHaveTextContent('Name, A to Z');
  });
});

describe('sorting (AC-4)', () => {
  it('lists the three sorts, puts the choice in the address and changes the sub line', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    await screen.findByText('Bong Rivera');
    await userEvent.click(screen.getByRole('button', { name: /Sort:/ }));
    expect((await screen.findAllByRole('menuitemradio')).map((i) => i.textContent)).toEqual(['Name, A to Z', 'Last signed in', 'Newest first']);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Last signed in' }));
    expect(screen.getByTestId('where')).toHaveTextContent('sort=lastSignedIn');
    await vi.waitFor(() => expect(lastCall('active')).toMatchObject({ sort: 'lastSignedIn' }));
    expect(await screen.findByText('Never signed in')).toBeInTheDocument();
  });

  it('shows the account date when sorted by newest, and leaves Name out of the address', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane(me(), '/admin/people?sort=newest');
    expect(await screen.findByText('Added 2026-11-14')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Sort:/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Name, A to Z' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('sort=');
  });
});

describe('search, no match and empty (AC-3, AC-5)', () => {
  it('searches after a short pause and puts the text in the address', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    renderPane();
    await screen.findByText('Bong Rivera');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search people' }), 'Bong');
    await vi.waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('q=Bong'));
    await vi.waitFor(() => expect(lastCall('active')).toMatchObject({ q: 'Bong' }));
  });

  it('shows the no match state with the filters as removable chips and Clear all', async () => {
    serve({}, { attention: 0, active: 0, inactive: 0 });
    renderPane(me(), '/admin/people?q=zzz&system=VMMS');
    expect(await screen.findByText('No one matches “zzz”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove “zzz”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove VMMS' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await vi.waitFor(() => expect(screen.getByTestId('where')).toBeEmptyDOMElement());
  });

  it('names the system when only a system filter leaves no one', async () => {
    serve({}, { attention: 0, active: 0, inactive: 0 });
    renderPane(me(), '/admin/people?system=VMMS');
    expect(await screen.findByText('No one in VMMS')).toBeInTheDocument();
  });

  it('shows the empty state with Add person when nothing is searched or filtered', async () => {
    serve({}, { attention: 0, active: 0, inactive: 0 });
    const { onAdd } = renderPane();
    expect(await screen.findByText('No one has access yet.')).toBeInTheDocument();
    const adds = screen.getAllByRole('button', { name: 'Add person' });
    await userEvent.click(adds.at(-1)!);
    expect(onAdd).toHaveBeenCalledWith(null);
  });

  it('opens Add person in place with the picked system, without leaving the page', async () => {
    serve({ active: [person('b1', 'Bong Rivera')] }, { attention: 0, active: 1, inactive: 0 });
    const { onAdd } = renderPane(me(), '/admin/people?system=VMMS', vi.fn(), 'b1');
    await screen.findByText('Bong Rivera');
    await userEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(onAdd).toHaveBeenCalledWith('VMMS');
  });
});

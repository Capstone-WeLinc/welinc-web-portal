import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AdminMe } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import { RolesPage } from './RolesPage';

const api = vi.hoisted(() => ({
  fetchRoles: vi.fn(),
  saveMatrix: vi.fn(),
  listPeople: vi.fn(),
  roleHistory: vi.fn(),
  addRoleMembers: vi.fn(),
}));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notify: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0018, child 0001 AC-1 (routes, redirects, missing role), AC-2 (list, switch,
// search, headings), AC-3 (header), AC-4 (groups fold, switches, locks, Not saved), AC-6 (read only),
// AC-7 to AC-12 (multi role draft, change list, review RC, conflicts, Reset to defaults, stored drafts),
// AC-5 (Find a permission), AC-13 (People tab), AC-14 (Add people), AC-15 (History), AC-16 (the menu)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Leonora Castillo', email: 'suite.admin@welinc.com', picture: null },
  suiteAdmin: true,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const role = (code: string, name: string, over: Partial<RoleSummary> = {}): RoleSummary => ({
  code,
  name,
  description: `${name} work`,
  builtIn: true,
  isSystemAdmin: false,
  copiedFrom: null,
  peopleCount: 0,
  lastChanged: null,
  ...over,
});

function vrms(over: Partial<RolesData> = {}): RolesData {
  return {
    system: 'VRMS',
    supportsCustomRoles: true,
    canEdit: true,
    version: 3,
    roles: [
      role('ADMIN', 'Admin', { isSystemAdmin: true, peopleCount: 6 }),
      role('CHIEF_MECHANIC', 'Chief Mechanic', {
        peopleCount: 8,
        lastChanged: { at: '2026-11-17T06:09:57.980Z', byName: 'Leonora Castillo' },
      }),
      role('MECHANIC', 'Mechanic', { peopleCount: 1 }),
    ],
    groups: [
      {
        name: 'Tickets',
        permissions: [
          { key: 'ticket.view', label: 'See tickets assigned to you', description: 'Open your tickets.', lockedRoles: [], defaultRoles: [] },
          { key: 'ticket.costs.view', label: 'See costs', description: 'Read parts and labor costs.', lockedRoles: [], defaultRoles: [] },
        ],
      },
      {
        name: 'Admin',
        permissions: [
          { key: 'team.manage', label: 'Manage the team', description: 'Add and remove people.', lockedRoles: ['ADMIN'], defaultRoles: ['ADMIN'] },
        ],
      },
    ],
    cells: { ADMIN: ['ticket.view', 'ticket.costs.view', 'team.manage'], CHIEF_MECHANIC: ['ticket.view'], MECHANIC: ['ticket.view'] },
    ...over,
  };
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string, viewer: AdminMe = me()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/:view" element={<RolesPage me={viewer} />} />
        <Route path="/admin/roles/:system" element={<RolesPage me={viewer} />} />
        <Route path="/admin/roles/:system/:role" element={<RolesPage me={viewer} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.listPeople.mockResolvedValue({ items: [], next: null });
  api.roleHistory.mockResolvedValue({ items: [], next: null });
  api.fetchRoles.mockImplementation(async (system: string) => vrms({ system: system as RolesData['system'] }));
});

describe('RolesPage routes (AC-1)', () => {
  it('opens the first role of the first system from /admin/roles, replacing the address', async () => {
    renderAt('/admin/roles');
    expect(await screen.findByRole('heading', { level: 2, name: 'Admin' })).toBeInTheDocument();
    expect(where()).toBe('/admin/roles/VRMS/ADMIN');
    expect(api.fetchRoles).toHaveBeenCalledWith('VRMS');
  });

  it('starts from a system admin’s own system, and takes a lower case system in the address', async () => {
    renderAt('/admin/roles/bms', me({ suiteAdmin: false, adminOf: ['BMS'] }));
    await screen.findByRole('heading', { level: 2, name: 'Admin' });
    expect(where()).toBe('/admin/roles/BMS/ADMIN');
  });

  it('honours ?system= from the sidebar link', async () => {
    renderAt('/admin/roles?system=VMMS');
    await screen.findByRole('heading', { level: 2, name: 'Admin' });
    expect(where()).toBe('/admin/roles/VMMS/ADMIN');
  });

  it('says a role that is not live does not exist, with a way back', async () => {
    renderAt('/admin/roles/VRMS/C_GONE');
    expect(await screen.findByRole('alert')).toHaveTextContent("This role doesn't exist or was deleted.");
    expect(screen.getByRole('link', { name: 'VRMS roles' })).toHaveAttribute('href', '/admin/roles/VRMS/ADMIN');
  });

  it('replaces the address when a role or a system is picked', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/ADMIN');
    await user.click(await screen.findByRole('button', { name: /^Mechanic\s?1 person/ }));
    expect(where()).toBe('/admin/roles/VRMS/MECHANIC');
    await user.click(screen.getByRole('button', { name: 'BMS' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/roles/BMS');
  });
});

describe('RoleList (AC-2)', () => {
  it('shows the count, the headings and the people in words, with the open role marked', async () => {
    renderAt('/admin/roles/VRMS/CHIEF_MECHANIC');
    const list = await screen.findByRole('region', { name: 'Role list' });
    expect(within(list).getByText('3 roles')).toBeInTheDocument();
    expect(within(list).getByRole('heading', { name: 'Built in' })).toBeInTheDocument();
    expect(within(list).getByText('No custom roles yet')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /^Chief Mechanic\s?8 people/ })).toHaveAttribute('aria-current', 'true');
    expect(within(list).getByRole('button', { name: /^Mechanic\s?1 person/ })).not.toHaveAttribute('aria-current');
  });

  it('hides the switch for an admin of one system and the Custom heading without permissions', async () => {
    api.fetchRoles.mockResolvedValue(vrms({ system: 'BMS', supportsCustomRoles: false }));
    renderAt('/admin/roles/BMS/ADMIN', me({ suiteAdmin: false, adminOf: ['BMS'] }));
    const list = await screen.findByRole('region', { name: 'Role list' });
    await within(list).findByText('3 roles');
    expect(within(list).queryByRole('group', { name: 'System' })).toBeNull();
    expect(within(list).queryByRole('heading', { name: 'Custom' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Permissions/ })).toBeNull();
    expect(screen.getByText(/BMS sets what each role can do in its own app/)).toBeInTheDocument();
  });

  it('filters by name or description and offers Clear when nothing matches', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/ADMIN');
    const search = await screen.findByRole('searchbox', { name: 'Find a role' });
    await user.type(search, 'chief');
    const list = screen.getByRole('region', { name: 'Role list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(within(list).getByRole('status')).toHaveTextContent('No role matches “zzz”');
    await user.click(within(list).getByRole('button', { name: 'Clear' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('RoleDetail (AC-3, AC-4, AC-6)', () => {
  it('shows the header facts: built in chip, people, permissions out of the total, last change', async () => {
    renderAt('/admin/roles/VRMS/CHIEF_MECHANIC');
    await screen.findByRole('heading', { level: 2, name: 'Chief Mechanic' });
    expect(screen.getAllByText('Built in')).toHaveLength(2); // the list heading and the header chip
    expect(screen.getByText('Comes with VRMS. You can change its permissions, not delete it.')).toBeInTheDocument();
    const permissionsFact = screen.getByText('Permissions', { selector: 'dt' }).parentElement;
    expect(permissionsFact).toHaveTextContent('1 of 3');
    expect(screen.getByText(/by Leonora Castillo/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Permissions\s?1\/3$/ })).toBeInTheDocument();
  });

  it('opens the first group, folds the rest with a preview, and opens them all', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/ADMIN');
    const tickets = await screen.findByRole('button', { name: /^Tickets\s?, 2 of 2 allowed/ });
    expect(tickets).toHaveAttribute('aria-expanded', 'true');
    const admin = screen.getByRole('button', { name: /^Admin\s?, 1 of 1 allowed\s?Manage the team/ });
    expect(admin).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Open all' }));
    expect(admin).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close all' })).toBeInTheDocument();
  });

  it('shows a locked cell as Always on instead of a switch', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/ADMIN');
    await user.click(await screen.findByRole('button', { name: 'Open all' }));
    expect(screen.getByText('Always on')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Manage the team' })).toBeNull();
  });

  it('marks a flipped switch Not saved, counts it on the row and in the save bar, and Undo clears it', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    const costs = await screen.findByRole('switch', { name: 'See costs' });
    await user.click(costs);
    expect(costs).toBeChecked();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(screen.getByLabelText('1 unsaved change')).toBeInTheDocument();
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
    expect(screen.getByText('Mechanic · affects 1 person')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(costs).not.toBeChecked();
    expect(screen.queryByText('Not saved')).toBeNull();
  });

  it('keeps the draft while another role is open', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    await user.click(screen.getByRole('button', { name: /^Chief Mechanic\s?8 people/ }));
    await screen.findByRole('heading', { level: 2, name: 'Chief Mechanic' });
    expect(screen.getByLabelText('1 unsaved change')).toBeInTheDocument();
  });

  it('reads On and Off with no switches and no save bar for a system admin', async () => {
    api.fetchRoles.mockResolvedValue(vrms({ canEdit: false }));
    renderAt('/admin/roles/VRMS/MECHANIC', me({ suiteAdmin: false, adminOf: ['VRMS'] }));
    await screen.findByRole('heading', { level: 2, name: 'Mechanic' });
    expect(screen.queryByRole('switch')).toBeNull();
    const row = (label: string) => screen.getByText(label).closest('li') as HTMLElement;
    expect(within(row('See tickets assigned to you')).getByText('On')).toBeInTheDocument();
    expect(within(row('See costs')).getByText('Off')).toBeInTheDocument();
    expect(screen.queryByText(/unsaved/)).toBeNull();
  });
});

const conflict = (code: string) => Object.assign(new Error(code), { response: { data: { code } } });

describe('saving (AC-7 to AC-11)', () => {
  it('collects changes in two roles, groups the change list by role, and saves them in one review with a note', async () => {
    const user = userEvent.setup();
    api.listPeople.mockImplementation(async ({ role: code }: { role: string }) => ({
      items: code === 'CHIEF_MECHANIC' ? [{ name: 'Ramon Villanueva' }, { name: 'Alfredo Bautista' }, { name: 'Danilo Santos' }] : [{ name: 'Joel Manalo' }],
      next: null,
    }));
    api.saveMatrix.mockResolvedValue({});
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See tickets assigned to you' })); // takes away
    await user.click(screen.getByRole('button', { name: /^Chief Mechanic\s?8 people/ }));
    await user.click(await screen.findByRole('switch', { name: 'See costs' })); // adds
    expect(screen.getByText('2 unsaved changes in 2 roles')).toBeInTheDocument();
    expect(screen.getByText('Chief Mechanic and Mechanic · affects 9 people')).toBeInTheDocument();
    expect(screen.getAllByLabelText('1 unsaved change')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /2 unsaved changes in 2 roles/ }));
    expect(await screen.findByRole('heading', { name: 'Changes to 2 roles' })).toBeInTheDocument();
    expect(await screen.findByText('Chief Mechanic: Ramon, Alfredo and 6 more get this the next time they open VRMS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo See costs' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save 2 changes?' });
    expect(within(dialog).getByRole('region', { name: 'Chief Mechanic' })).toHaveTextContent('Ramon, Alfredo and 6 more');
    const note = within(dialog).getByRole('textbox', { name: /Note for the activity log/ });
    const save = within(dialog).getByRole('button', { name: 'Save 2 changes' });
    expect(save).toBeDisabled();
    await user.type(note, 'Costs move to the chief');
    expect(save).toBeEnabled();
    api.fetchRoles.mockResolvedValue(vrms({ version: 4 }));
    await user.click(save);
    expect(api.saveMatrix).toHaveBeenCalledWith('VRMS', {
      version: 3,
      changes: [
        { role: 'CHIEF_MECHANIC', key: 'ticket.costs.view', allowed: true },
        { role: 'MECHANIC', key: 'ticket.view', allowed: false },
      ],
      note: 'Costs move to the chief',
    });
    await vi.waitFor(() => expect(notify.notifySuccess).toHaveBeenCalledWith('Saved 2 changes to VRMS roles.'));
    await vi.waitFor(() => expect(screen.queryByText(/unsaved/)).toBeNull());
    expect(localStorage.getItem('welinc:draft:me:roles:VRMS')).toBeNull();
  });

  it('folds an optional note when nothing is taken away', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save 1 change?' });
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Save 1 change' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Add a note for the activity log' }));
    expect(within(dialog).getByRole('textbox', { name: 'Note for the activity log' })).toBeInTheDocument();
  });

  it('on MATRIX_STALE closes the review, reads again and keeps only entries that still apply', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    api.saveMatrix.mockRejectedValue(conflict('MATRIX_STALE'));
    // Someone else turned See costs on for Mechanic meanwhile
    api.fetchRoles.mockResolvedValue(vrms({ version: 4, cells: { ...vrms().cells, MECHANIC: ['ticket.view', 'ticket.costs.view'] } }));
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save 1 change' }));
    expect(await screen.findByRole('switch', { name: 'See costs' })).toBeChecked();
    expect(notify.notify).toHaveBeenCalledWith(
      'Someone saved VRMS roles while you were editing. Your changes that still apply are kept. Check them and save again.',
      'warning',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(() => expect(screen.queryByText(/unsaved/)).toBeNull());
  });

  it('on UNKNOWN_ROLE drops the deleted role’s entries and names it', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    api.saveMatrix.mockRejectedValue(conflict('UNKNOWN_ROLE'));
    api.fetchRoles.mockResolvedValue(vrms({ roles: vrms().roles.filter((r) => r.code !== 'MECHANIC') }));
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save 1 change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("This role doesn't exist or was deleted.");
    expect(notify.notifyError).toHaveBeenCalledWith('Mechanic was deleted, so its changes were removed from your draft.');
    await vi.waitFor(() => expect(screen.queryByText(/unsaved/)).toBeNull());
  });

  it('keeps the review open with the error on a network failure', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    api.saveMatrix.mockRejectedValue(new Error('Network Error'));
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save 1 change' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't save the changes.");
    expect(within(dialog).getByRole('button', { name: 'Save 1 change' })).toBeEnabled();
  });

  it('Reset to defaults stages the differences, then says it is already on the defaults', async () => {
    const user = userEvent.setup();
    const groups = vrms().groups.map((g) => ({
      ...g,
      permissions: g.permissions.map((p) => (p.key === 'ticket.costs.view' ? { ...p, defaultRoles: ['MECHANIC'] } : p)),
    }));
    api.fetchRoles.mockResolvedValue(vrms({ groups }));
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('button', { name: 'More role actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));
    expect(screen.getByRole('switch', { name: 'See costs' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'See tickets assigned to you' })).not.toBeChecked();
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More role actions' }));
    expect(await screen.findByRole('menuitem', { name: /Reset to defaults\s?Already on the defaults/ })).toHaveAttribute('data-disabled');
  });

  it('has no role actions for a system admin', async () => {
    api.fetchRoles.mockResolvedValue(vrms({ canEdit: false }));
    renderAt('/admin/roles/VRMS/MECHANIC', me({ suiteAdmin: false, adminOf: ['VRMS'] }));
    await screen.findByRole('heading', { level: 2, name: 'Mechanic' });
    expect(screen.queryByRole('button', { name: 'More role actions' })).toBeNull();
  });
});

describe('stored drafts (AC-12)', () => {
  const store = (changes: { key: string; from: boolean; to: boolean }[], savedAt = Date.now()) =>
    localStorage.setItem('welinc:draft:me:roles:VRMS', JSON.stringify({ savedAt, changes }));

  it('writes the draft to storage as it changes', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    expect(JSON.parse(localStorage.getItem('welinc:draft:me:roles:VRMS') ?? '{}').changes).toEqual([
      { key: 'MECHANIC|ticket.costs.view', from: false, to: true },
    ]);
  });

  it('brings a kept draft back with Kept from [time]', async () => {
    store([{ key: 'MECHANIC|ticket.costs.view', from: false, to: true }]);
    renderAt('/admin/roles/VRMS/MECHANIC');
    expect(await screen.findByText(/^Kept from \d\d:\d\d$/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'See costs' })).toBeChecked();
  });

  it('clears a kept draft whose from no longer matches the server', async () => {
    store([{ key: 'MECHANIC|ticket.view', from: false, to: true }]); // the server has it on
    renderAt('/admin/roles/VRMS/MECHANIC');
    await screen.findByRole('switch', { name: 'See costs' });
    await vi.waitFor(() =>
      expect(notify.notify).toHaveBeenCalledWith('Your saved draft for VRMS roles was out of date, so it was cleared.', 'info', {}),
    );
    expect(screen.queryByText(/unsaved/)).toBeNull();
  });

  it('drops kept entries for a deleted role with its toast, keeping the rest', async () => {
    store([
      { key: 'C_GONE|ticket.view', from: false, to: true },
      { key: 'MECHANIC|ticket.costs.view', from: false, to: true },
    ]);
    renderAt('/admin/roles/VRMS/MECHANIC');
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument();
    expect(notify.notify).toHaveBeenCalledWith('1 change to a role that was deleted was removed from your draft.', 'warning');
  });

  it('keeps each system’s draft apart and says so on leaving', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('switch', { name: 'See costs' }));
    await user.click(screen.getByRole('button', { name: 'BMS' }));
    expect(notify.notify).toHaveBeenCalledWith('Your 1 change to Mechanic are kept for when you come back', 'info');
    await screen.findByTestId('where');
    expect(localStorage.getItem('welinc:draft:me:roles:VRMS')).not.toBeNull();
    expect(localStorage.getItem('welinc:draft:me:roles:BMS')).toBeNull();
  });
});

const holder = (id: string, name: string, roles: { system: 'VRMS'; role: string; createdAt?: string; temporaryUntil?: string | null }[]) => ({
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  roles,
  otherSystems: [],
});

describe('Find a permission (AC-5)', () => {
  it('keeps matching rows across groups, opens them, and offers Clear on no match', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    const filter = await screen.findByRole('searchbox', { name: 'Find a permission' });
    await user.type(filter, 'add and');
    // After the 300ms wait only Admin's matching row is left, and its group is open
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'See costs' })).toBeNull());
    expect(screen.getByRole('button', { name: /^Admin/, expanded: true })).toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, 'payroll');
    expect(await screen.findByText('No permission matches “payroll”', {}, { timeout: 2000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    // The folds come back as they were: Tickets open, Admin closed
    expect(await screen.findByRole('switch', { name: 'See costs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Admin/, expanded: false })).toBeInTheDocument();
  });
});

describe('People and History tabs (AC-13, AC-15)', () => {
  it('lists the holders with Since and Until, each opening the person', async () => {
    const user = userEvent.setup();
    api.listPeople.mockResolvedValue({
      items: [
        holder('ramon', 'Ramon Dela Cruz', [{ system: 'VRMS', role: 'MECHANIC', createdAt: '2026-03-02T00:00:00.000Z' }]),
        holder('alfredo', 'Alfredo Santos', [
          { system: 'VRMS', role: 'MECHANIC', createdAt: '2026-04-02T00:00:00.000Z', temporaryUntil: '2026-12-01T00:00:00.000Z' },
        ]),
      ],
      next: null,
    });
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('tab', { name: /People/ }));
    const list = await screen.findByRole('list', { name: 'People with Mechanic' });
    expect(within(list).getByRole('link', { name: /Ramon Dela Cruz/ })).toHaveAttribute('href', '/admin/people/ramon');
    expect(within(list).getAllByText(/Since/)).toHaveLength(2);
    expect(within(list).getByText(/Until/)).toBeInTheDocument();
    expect(api.listPeople).toHaveBeenCalledWith(expect.objectContaining({ system: 'VRMS', role: 'MECHANIC', sort: 'name', limit: 25 }));
  });

  it('says when no one has the role yet', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('tab', { name: /People/ }));
    expect(await screen.findByText('No one has this role yet')).toBeInTheDocument();
  });

  it('shows only People for a system without permissions', async () => {
    api.fetchRoles.mockResolvedValue(vrms({ system: 'BMS', supportsCustomRoles: false }));
    renderAt('/admin/roles/BMS/ADMIN', me({ suiteAdmin: false, adminOf: ['BMS'] }));
    expect(await screen.findByRole('tab', { name: /People/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /History/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Add people' })).toBeInTheDocument();
  });

  it('lists the history in words with the note', async () => {
    const user = userEvent.setup();
    api.roleHistory.mockResolvedValue({
      items: [
        { id: 'h1', at: '2026-11-20T03:00:00.000Z', actorName: 'Leonora Castillo', kind: 'PERMISSION', label: 'See costs', before: true, after: false, note: 'Costs moved to clerks' },
        { id: 'h2', at: '2026-11-19T03:00:00.000Z', actorName: 'System', kind: 'PERMISSION', label: 'See tickets assigned to you', before: null, after: true },
      ],
      next: null,
    });
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('tab', { name: 'History' }));
    const list = await screen.findByRole('list', { name: 'History of Mechanic' });
    expect(within(list).getByText(/removed “See costs”/)).toBeInTheDocument();
    expect(within(list).getByText('“Costs moved to clerks”')).toBeInTheDocument();
    expect(within(list).getByText(/added “See tickets assigned to you”/)).toBeInTheDocument();
    expect(api.roleHistory).toHaveBeenCalledWith('VRMS', 'MECHANIC', undefined);
  });

  it('keeps the open tab when another role is picked', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: /Admin/ }));
    expect(await screen.findByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Add people (AC-14)', () => {
  it('searches candidates on the server, shows the move, and moves the picked people', async () => {
    const user = userEvent.setup();
    api.listPeople.mockImplementation(async (params: { excludeRole?: string }) =>
      params.excludeRole
        ? {
            items: [
              holder('ramon', 'Ramon Dela Cruz', [{ system: 'VRMS', role: 'MECHANIC' }]),
              holder('tess', 'Tess Ramos', [{ system: 'VRMS', role: 'MECHANIC', temporaryUntil: '2026-12-01T00:00:00.000Z' }]),
            ],
            next: null,
          }
        : { items: [], next: null },
    );
    api.addRoleMembers.mockResolvedValue({ moved: 1, skipped: 0 });
    renderAt('/admin/roles/VRMS/CHIEF_MECHANIC');
    await user.click(await screen.findByRole('tab', { name: /People/ }));
    await user.click(await screen.findByRole('button', { name: 'Add people' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add people to Chief Mechanic' });
    expect(api.listPeople).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'VRMS', excludeRole: 'CHIEF_MECHANIC', assignable: true, sort: 'name', limit: 25 }),
    );
    expect(within(dialog).getByRole('checkbox', { name: /Tess Ramos/ })).toBeDisabled();
    expect(within(dialog).getByText(/temporary, can't be moved/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: /Ramon Dela Cruz/ }));
    expect(within(dialog).getByText('Chief Mechanic', { selector: 'span' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 person' }));
    expect(api.addRoleMembers).toHaveBeenCalledWith('VRMS', 'CHIEF_MECHANIC', ['ramon']);
    expect(notify.notifySuccess).toHaveBeenCalledWith('1 person now has Chief Mechanic.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the server’s refusal inline and moves nobody', async () => {
    const user = userEvent.setup();
    api.listPeople.mockImplementation(async (params: { excludeRole?: string }) =>
      params.excludeRole ? { items: [holder('ana', 'Ana Reyes', [{ system: 'VRMS', role: 'ADMIN' }])], next: null } : { items: [], next: null },
    );
    api.addRoleMembers.mockRejectedValue({
      response: { status: 409, data: { code: 'LAST_ADMIN', message: 'Ana Reyes is the last active admin of VRMS. Make someone else admin first.' } },
    });
    renderAt('/admin/roles/VRMS/MECHANIC');
    await user.click(await screen.findByRole('tab', { name: /People/ }));
    await user.click(await screen.findByRole('button', { name: 'Add people' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ana Reyes/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 person' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ana Reyes is the last active admin of VRMS.');
    expect(notify.notifySuccess).not.toHaveBeenCalled();
  });
});

describe('the spreadsheet menu (AC-16)', () => {
  it('offers Download as spreadsheet in the list pane', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/MECHANIC', me({ suiteAdmin: false, adminOf: ['VRMS'] }));
    await user.click(await screen.findByRole('button', { name: 'More options' }));
    expect(await screen.findByRole('menuitem', { name: 'Download as spreadsheet' })).toBeInTheDocument();
  });
});

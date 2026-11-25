import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AdminMe } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import { RolesPage } from './RolesPage';

const api = vi.hoisted(() => ({ fetchRoles: vi.fn(), saveMatrix: vi.fn() }));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notify: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0018, child 0001 AC-1 (routes, redirects, missing role), AC-2 (list, switch,
// search, headings), AC-3 (header), AC-4 (groups fold, switches, locks, Not saved), AC-6 (read only)

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
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByText(/by Leonora Castillo/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Permissions\s?1\/3$/ })).toBeInTheDocument();
  });

  it('opens the first group, folds the rest with a preview, and opens them all', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roles/VRMS/ADMIN');
    const tickets = await screen.findByRole('button', { name: /^Tickets\s?2\/2/ });
    expect(tickets).toHaveAttribute('aria-expanded', 'true');
    const admin = screen.getByRole('button', { name: /^Admin\s?1\/1\s?Manage the team/ });
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

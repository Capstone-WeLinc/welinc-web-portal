import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CreatedRole, RoleSummary, RolesData } from '@/lib/adminApi';
import { DeleteRoleDialog, RoleFieldDialog, RoleFormDialog } from './CustomRoleDialogs';

const api = vi.hoisted(() => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  listPeople: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));

// covers: suite spec 0018, child 0002 AC-20 (New role: Start from, copied note, power warning),
// AC-21 (Duplicate), AC-22 (name rules and server refusals), AC-24 (Rename, Edit description),
// AC-25 (Delete: blocked, up to ten holders, the server's count, grace line)

const role = (code: string, name: string, over: Partial<RoleSummary> = {}): RoleSummary => ({
  code,
  name,
  description: '',
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
  version: 3,
  roles: [
    role('ADMIN', 'Admin', { isSystemAdmin: true }),
    role('MECHANIC', 'Mechanic'),
    role('C_TIRE', 'Tire', { builtIn: false, description: 'Wheels', copiedFrom: { code: 'MECHANIC', name: 'Mechanic' } }),
  ],
  groups: [],
  cells: { ADMIN: ['team.manage', 'settings.manage', 'ticket.view'], MECHANIC: ['ticket.view'], C_TIRE: ['ticket.view'] },
} as unknown as RolesData;

const refusal = (status: number, body: Record<string, unknown>) => ({ response: { status, data: body } });
const created = (code: string, name: string): CreatedRole => ({
  role: role(code, name, { builtIn: false }),
  cells: ['ticket.view'],
  version: 4,
});

beforeEach(() => vi.resetAllMocks());

function renderForm(start: Parameters<typeof RoleFormDialog>[0]['start'], draft: Record<string, boolean> = {}) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(<RoleFormDialog start={start} data={data} draft={draft} onClose={onClose} onCreated={onCreated} />);
  return { onCreated, onClose };
}

describe('New role and Duplicate', () => {
  it('starts from the role on screen and lists live roles, custom ones marked', async () => {
    renderForm({ kind: 'new', from: 'MECHANIC' });
    const select = await screen.findByLabelText('Start from');
    expect(select).toHaveValue('MECHANIC');
    expect(screen.getByRole('option', { name: 'Tire (custom)' })).toBeInTheDocument();
    expect(screen.getByText("Its permissions are copied. You can change them after.")).toBeInTheDocument();
  });

  it('prefills a duplicate with a fixed Start from and the given name', async () => {
    renderForm({ kind: 'duplicate', from: 'MECHANIC', name: 'Copy of Mechanic' });
    expect(await screen.findByText('Duplicate Mechanic')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Copy of Mechanic');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('creates with the trimmed name and the chosen source, then hands the result back', async () => {
    const user = userEvent.setup();
    api.createRole.mockResolvedValue(created('C_BRAKES', 'Brakes'));
    const { onCreated } = renderForm({ kind: 'new', from: 'MECHANIC' });
    await user.type(await screen.findByLabelText('Name'), '  Brakes ');
    await user.selectOptions(screen.getByLabelText('Start from'), 'C_TIRE');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(api.createRole).toHaveBeenCalledWith('VRMS', { name: 'Brakes', from: 'C_TIRE' }));
    expect(onCreated).toHaveBeenCalledWith(created('C_BRAKES', 'Brakes'), 'Tire');
  });

  it('refuses a short name, a symbols only name and a taken name without calling the server', async () => {
    const user = userEvent.setup();
    renderForm({ kind: 'new', from: 'MECHANIC' });
    const name = await screen.findByLabelText('Name');
    const submit = screen.getByRole('button', { name: 'Create role' });
    await user.type(name, 'A');
    await user.click(submit);
    expect(await screen.findByText('Name needs 2 to 40 characters.')).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, '!!');
    await user.click(submit);
    expect(await screen.findByText('Use letters or numbers in the name.')).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, 'mechanic');
    await user.click(submit);
    expect(await screen.findByText("There's already a role called mechanic in VRMS.")).toBeInTheDocument();
    expect(api.createRole).not.toHaveBeenCalled();
  });

  it('refuses a description over 200 characters', async () => {
    const user = userEvent.setup();
    renderForm({ kind: 'new', from: 'MECHANIC' });
    await user.type(await screen.findByLabelText('Name'), 'Brakes');
    await user.click(screen.getByLabelText(/Description/));
    await user.paste('x'.repeat(201));
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText('Description can have at most 200 characters.')).toBeInTheDocument();
    expect(api.createRole).not.toHaveBeenCalled();
  });

  it("shows the server's refusals where they belong", async () => {
    const user = userEvent.setup();
    renderForm({ kind: 'new', from: 'MECHANIC' });
    const name = await screen.findByLabelText('Name');
    await user.type(name, 'Brakes');

    api.createRole.mockRejectedValueOnce(refusal(409, { code: 'ROLE_NAME_TAKEN' }));
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText("There's already a role called Brakes in VRMS.")).toBeInTheDocument();

    api.createRole.mockRejectedValueOnce(refusal(409, { code: 'CUSTOM_ROLE_LIMIT' }));
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'VRMS has 20 custom roles, the most it can have. Delete one to make another.',
    );

    api.createRole.mockRejectedValueOnce(refusal(400, { code: 'UNKNOWN_ROLE' }));
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mechanic was deleted. Pick another role to start from.');
  });

  it("says unsaved changes aren't copied only when the source has a draft", async () => {
    renderForm({ kind: 'new', from: 'MECHANIC' }, { 'MECHANIC|ticket.view': false });
    expect(await screen.findByText("Unsaved changes on Mechanic aren't copied.")).toBeInTheDocument();
  });

  it('warns about team and settings power from the source, and follows the name typed', async () => {
    const user = userEvent.setup();
    renderForm({ kind: 'new', from: 'ADMIN' });
    await user.type(await screen.findByLabelText('Name'), 'Foreman');
    expect(
      screen.getByText('Foreman will be able to manage the team and change settings in VRMS.'),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Start from'), 'MECHANIC');
    expect(screen.queryByText(/will be able to manage the team/)).toBeNull();
  });
});

describe('Rename and Edit description', () => {
  const tire = data.roles[2];

  function renderField(kind: 'name' | 'description') {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<RoleFieldDialog kind={kind} data={data} role={tire} onClose={onClose} onSaved={onSaved} />);
    return { onSaved, onClose };
  }

  it('saves a new name with only the name in the update', async () => {
    const user = userEvent.setup();
    api.updateRole.mockResolvedValue({ ...tire, name: 'Tyre' });
    const { onSaved } = renderField('name');
    const input = await screen.findByLabelText('Name');
    await user.clear(input);
    await user.type(input, ' Tyre ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateRole).toHaveBeenCalledWith('VRMS', 'C_TIRE', { name: 'Tyre' }));
    expect(onSaved).toHaveBeenCalledWith({ ...tire, name: 'Tyre' }, 'name');
  });

  it('closes without a write when nothing changed, so no empty event is recorded', async () => {
    const user = userEvent.setup();
    const { onClose } = renderField('name');
    await screen.findByLabelText('Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClose).toHaveBeenCalled();
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('refuses a name another live role has, but allows keeping its own', async () => {
    const user = userEvent.setup();
    renderField('name');
    const input = await screen.findByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'mechanic');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("There's already a role called mechanic in VRMS.")).toBeInTheDocument();
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('saves a description alone and counts its length', async () => {
    const user = userEvent.setup();
    api.updateRole.mockResolvedValue({ ...tire, description: 'Wheels and tyres' });
    renderField('description');
    const box = await screen.findByLabelText('Description');
    expect(screen.getByText('6/200')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'Wheels and tyres');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith('VRMS', 'C_TIRE', { description: 'Wheels and tyres' }),
    );
  });
});

describe('Delete role', () => {
  const held = (n: number, over: Partial<RoleSummary> = {}) => role('C_TIRE', 'Tire', { builtIn: false, peopleCount: n, ...over });
  const people = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));

  function renderDelete(r: RoleSummary) {
    const props = { onClose: vi.fn(), onDeleted: vi.fn(), onShowPeople: vi.fn() };
    render(
      <MemoryRouter>
        <DeleteRoleDialog open data={data} role={r} {...props} />
      </MemoryRouter>,
    );
    return props;
  }

  it('asks once when no one holds it, and deletes', async () => {
    const user = userEvent.setup();
    api.deleteRole.mockResolvedValue({ version: 9 });
    const { onDeleted } = renderDelete(held(0));
    expect(await screen.findByText('Delete Tire?')).toBeInTheDocument();
    expect(screen.getByText('No one has it. Its history stays on record.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(9));
    expect(api.listPeople).not.toHaveBeenCalled();
  });

  it('adds the grace line only when someone waiting for deletion still holds it', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <DeleteRoleDialog open data={data} role={held(0, { graceCount: 1 })} onClose={vi.fn()} onDeleted={vi.fn()} onShowPeople={vi.fn()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/1 person waiting for deletion keeps it/)).toBeInTheDocument();
    unmount();
    renderDelete(held(0));
    await screen.findByText('Delete Tire?');
    expect(screen.queryByText(/waiting for deletion/)).toBeNull();
  });

  it('blocks while people hold it: names them, disables Delete role, links to their Access tab', async () => {
    api.listPeople.mockResolvedValue({ items: people(2) });
    renderDelete(held(2));
    expect(await screen.findByText('2 people still have Tire')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete role' })).toBeDisabled();
    const links = await screen.findAllByRole('link', { name: /Change role/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/admin/people/p0?tab=access');
    expect(api.listPeople).toHaveBeenCalledWith({ system: 'VRMS', role: 'C_TIRE', limit: 10, sort: 'name' });
    expect(api.deleteRole).not.toHaveBeenCalled();
  });

  it('says "and [k] more" past ten, and that link goes to the People tab', async () => {
    const user = userEvent.setup();
    api.listPeople.mockResolvedValue({ items: people(10) });
    const { onShowPeople } = renderDelete(held(11));
    await user.click(await screen.findByRole('button', { name: 'and 1 more' }));
    expect(onShowPeople).toHaveBeenCalled();
  });

  it("turns into the blocked dialog with the server's count when someone got the role meanwhile", async () => {
    const user = userEvent.setup();
    api.deleteRole.mockRejectedValue(refusal(409, { code: 'ROLE_IN_USE', details: { count: 3 } }));
    api.listPeople.mockResolvedValue({ items: people(3) });
    const { onDeleted } = renderDelete(held(0));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('3 people still have Tire')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('keeps the dialog and shows the error on any other failure', async () => {
    const user = userEvent.setup();
    api.deleteRole.mockRejectedValue(refusal(500, {}));
    renderDelete(held(0));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't delete Tire. Try again.");
    expect(screen.getByText('Delete Tire?')).toBeInTheDocument();
  });
});

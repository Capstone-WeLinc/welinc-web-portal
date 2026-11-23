import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMe } from '@/lib/admin';
import { ReauthCancelled, type CatalogSystem } from '@/lib/adminApi';
import { AddPersonDialog, type AddStart } from './AddPersonDialog';

const api = vi.hoisted(() => ({ createPerson: vi.fn(), listPeople: vi.fn(), lookupPeople: vi.fn() }));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0017 AC-14 (Add person at step 1, Give access at step 2, the read back, the
// request and the toast, Already in), AC-18 (the person opens afterwards)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Felicidad Roxas', email: 'multi.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: ['VRMS', 'VMMS'],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const catalog: CatalogSystem[] = [
  {
    code: 'VRMS',
    name: 'Vehicle Repair Management System',
    maxRolesPerUser: 1,
    roles: [
      { code: 'CHIEF_MECHANIC', name: 'Chief Mechanic', description: 'Assigns work', isSystemAdmin: false },
      { code: 'MECHANIC', name: 'Mechanic', description: 'Works tickets', isSystemAdmin: false },
    ],
  },
  {
    code: 'VMMS',
    name: 'Vehicle Maintenance Management System',
    maxRolesPerUser: 1,
    roles: [{ code: 'OPERATIONS', name: 'Operations', description: 'Runs planning', isSystemAdmin: false }],
  },
];

const giveAccess: AddStart = {
  who: { kind: 'existing', id: 'p1', name: 'Alfredo Bautista', email: 'vrms.chief2@welinc.com', systems: ['VRMS'] },
  system: 'VMMS',
};

function renderDialog(start: AddStart, viewer: AdminMe = me()) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(<AddPersonDialog start={start} me={viewer} catalog={catalog} onClose={onClose} onAdded={onAdded} />);
  return { onClose, onAdded };
}

const dialog = () => screen.getByRole('dialog');
const next = () => userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }));

beforeEach(() => {
  vi.clearAllMocks();
  api.createPerson.mockResolvedValue({ id: 'p1', name: 'Alfredo Bautista', setupEmailSent: true });
  api.lookupPeople.mockResolvedValue([]);
  api.listPeople.mockResolvedValue({ items: [], next: null });
});

describe('Give access (AC-14)', () => {
  it('opens on step 2 with the person and system set, and no way back to step 1', () => {
    renderDialog(giveAccess);
    expect(within(dialog()).getByText('2. Access')).toHaveAttribute('class', expect.stringContaining('font-semibold'));
    expect(within(dialog()).getByRole('radio', { name: /Vehicle Maintenance/ })).toBeChecked();
    expect(within(dialog()).getByText('Role in VMMS')).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '← Back' }).className).toContain('invisible');
  });

  it('blocks a system the person is already in', () => {
    renderDialog(giveAccess);
    const vrms = within(dialog()).getByRole('radio', { name: /Vehicle Repair/ });
    expect(vrms).toBeDisabled();
    expect(within(dialog()).getByText('Already in VRMS')).toBeInTheDocument();
  });

  it('asks for a role before moving on', async () => {
    renderDialog(giveAccess);
    await next();
    expect(within(dialog()).getByText('Pick a role.')).toBeInTheDocument();
    expect(within(dialog()).queryByText(/gets Operations/)).not.toBeInTheDocument();
  });

  it('reads the choice back, sends attachExisting with the role, toasts and opens the person', async () => {
    api.createPerson.mockResolvedValue({ id: 'p1', name: 'Alfredo Bautista', setupEmailSent: true });
    const { onAdded } = renderDialog(giveAccess);
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Operations/ }));
    await next();
    expect(within(dialog()).getByText('Alfredo Bautista gets Operations in VMMS.')).toBeInTheDocument();
    expect(within(dialog()).getByText('Their name and password stay as they are.')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Give access' }));
    expect(api.createPerson).toHaveBeenCalledWith({
      system: 'VMMS',
      name: 'Alfredo Bautista',
      email: 'vrms.chief2@welinc.com',
      roleAssignments: [{ role: 'OPERATIONS', system: 'VMMS' }],
      attachExisting: true,
    });
    expect(notify.notifySuccess).toHaveBeenCalledWith('Alfredo Bautista now has Operations in VMMS.');
    expect(onAdded).toHaveBeenCalledWith('p1');
  });

  it('stays quiet and open when the password dialog is cancelled', async () => {
    api.createPerson.mockRejectedValue(new ReauthCancelled());
    const { onAdded } = renderDialog(giveAccess);
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Operations/ }));
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Give access' }));
    await vi.waitFor(() => expect(within(dialog()).getByRole('button', { name: 'Give access' })).toBeEnabled());
    expect(notify.notifySuccess).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server\'s message when the request fails', async () => {
    api.createPerson.mockRejectedValue({ response: { status: 400, data: { message: 'Pick a smaller role.' } } });
    renderDialog(giveAccess);
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Operations/ }));
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Give access' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Pick a smaller role.');
  });
});

describe('Add person (AC-14)', () => {
  it('starts at step 1 and asks for a name and a real looking email', async () => {
    renderDialog({});
    expect(within(dialog()).getByText('1. Who')).toHaveAttribute('class', expect.stringContaining('font-semibold'));
    await next();
    expect(within(dialog()).getByText('Enter their full name.')).toBeInTheDocument();
    expect(within(dialog()).getByText('Enter an email like name@example.com.')).toBeInTheDocument();
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Lorna Galang');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'not an email');
    await next();
    expect(within(dialog()).queryByText('Enter their full name.')).not.toBeInTheDocument();
    expect(within(dialog()).getByText('Enter an email like name@example.com.')).toBeInTheDocument();
  });

  it('offers existing accounts found by the lookup and switches to Give access for the one picked', async () => {
    api.lookupPeople.mockResolvedValue([{ id: 'p9', name: 'Ramon Garcia', email: 'vmms.chief@welinc.com', systems: ['VMMS'] }]);
    renderDialog({});
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'vmms.chief');
    const match = await within(dialog()).findByRole('button', { name: /Ramon Garcia/ });
    expect(api.lookupPeople).toHaveBeenLastCalledWith('VRMS', 'vmms.chief');
    await userEvent.click(match);
    expect(within(dialog()).getByText('vmms.chief@welinc.com')).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Someone else' })).toBeInTheDocument();
    await next();
    expect(within(dialog()).getByText('Already in VMMS')).toBeInTheDocument();
  });

  it('sends a new person with no attachExisting, and says the invite went out', async () => {
    api.createPerson.mockResolvedValue({ id: 'n1', name: 'Lorna Galang', setupEmailSent: true });
    const { onAdded } = renderDialog({}, me({ adminOf: ['VRMS'] }));
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Lorna Galang');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'lorna.galang@welinc.com');
    await next();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Mechanic Works tickets|Works tickets/ }));
    await next();
    expect(within(dialog()).getByText('Lorna Galang gets Mechanic in VRMS.')).toBeInTheDocument();
    expect(within(dialog()).getByText('We email them a setup code so they set their own password.')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send invite' }));
    expect(api.createPerson).toHaveBeenCalledWith({
      system: 'VRMS',
      name: 'Lorna Galang',
      email: 'lorna.galang@welinc.com',
      roleAssignments: [{ role: 'MECHANIC', system: 'VRMS' }],
    });
    expect(notify.notifySuccess).toHaveBeenCalledWith('Lorna Galang was added. They got an email to set their password.');
    expect(onAdded).toHaveBeenCalledWith('n1');
  });

  it('warns when the setup email did not go out', async () => {
    api.createPerson.mockResolvedValue({ id: 'n1', name: 'Lorna Galang', setupEmailSent: false });
    renderDialog({}, me({ adminOf: ['VRMS'] }));
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Lorna Galang');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'lorna.galang@welinc.com');
    await next();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Works tickets/ }));
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send invite' }));
    expect(notify.notifySuccess).toHaveBeenCalledWith(
      "Lorna Galang was added, but the setup email didn't go out. Send a setup code from their page.",
    );
  });

  it('turns an ACCOUNT_EXISTS answer into Give access for that account', async () => {
    api.createPerson.mockRejectedValue({
      response: { status: 409, data: { code: 'ACCOUNT_EXISTS', id: 'p7', name: 'Efren Lacson', systems: ['VMMS'] } },
    });
    renderDialog({}, me({ adminOf: ['VRMS'] }));
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Efren');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'efren.lacson@welinc.com');
    await next();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Works tickets/ }));
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send invite' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      'efren.lacson@welinc.com already has a WeLinc account (Efren Lacson). Send again to give that account access.',
    );
    expect(within(dialog()).getByRole('button', { name: 'Give access' })).toBeInTheDocument();
  });

  it('says Already in the system and opens that person when a plain 409 comes back', async () => {
    api.createPerson.mockRejectedValue({ response: { status: 409, data: {} } });
    api.listPeople.mockResolvedValue({ items: [{ id: 'p5', email: 'LORNA.GALANG@welinc.com' }], next: null });
    const { onAdded } = renderDialog({}, me({ adminOf: ['VRMS'] }));
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Lorna Galang');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'lorna.galang@welinc.com');
    await next();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Works tickets/ }));
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send invite' }));
    expect(await within(dialog()).findByText(/Already in VRMS/)).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Open person' }));
    expect(onAdded).toHaveBeenCalledWith('p5');
  });

  it('goes back a step without losing what was typed', async () => {
    renderDialog({}, me({ adminOf: ['VRMS'] }));
    await userEvent.type(within(dialog()).getByLabelText('Full name'), 'Lorna Galang');
    await userEvent.type(within(dialog()).getByLabelText('Work email'), 'lorna.galang@welinc.com');
    await next();
    await userEvent.click(within(dialog()).getByRole('button', { name: '← Back' }));
    expect(within(dialog()).getByLabelText('Full name')).toHaveValue('Lorna Galang');
    expect(within(dialog()).getByLabelText('Work email')).toHaveValue('lorna.galang@welinc.com');
  });

  it('closes on Cancel', async () => {
    const { onClose } = renderDialog({});
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

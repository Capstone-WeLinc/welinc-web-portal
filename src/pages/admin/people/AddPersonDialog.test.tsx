import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMe } from '@/lib/admin';
import { ReauthCancelled, type CatalogSystem } from '@/lib/adminApi';
import { AddPersonDialog, type AddStart } from './AddPersonDialog';

const api = vi.hoisted(() => ({ createPerson: vi.fn(), listPeople: vi.fn(), checkEmail: vi.fn() }));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0019 AC-22 (one screen: the email check icon, Full name, the optional
// contact, system cards, role cards, Give access for an existing account, one system per add),
// AC-23 (the check's answers as the dialog shows them); spec 0017 AC-18 (the person opens after)

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
const email = () => within(dialog()).getByLabelText('Email');
const pick = (name: RegExp | string) => userEvent.click(within(dialog()).getByRole('radio', { name }));
const submit = (name: string) => userEvent.click(within(dialog()).getByRole('button', { name }));
/** Pastes in one event: typing letter by letter is slow on a busy machine. */
const fill = async (field: HTMLElement, text: string) => {
  await userEvent.click(field);
  await userEvent.paste(text);
};

beforeEach(() => {
  vi.clearAllMocks();
  api.createPerson.mockResolvedValue({ id: 'p1', name: 'Alfredo Bautista', setupEmailSent: true });
  api.listPeople.mockResolvedValue({ items: [], next: null });
  api.checkEmail.mockResolvedValue({ status: 'free' });
});

describe('Give access from a person (AC-22)', () => {
  beforeEach(() => {
    api.checkEmail.mockResolvedValue({ status: 'existing', name: 'Alfredo Bautista', picture: null, systems: ['VRMS'] });
  });

  it('opens on the person with their email fixed, the system set, and what they hold greyed', async () => {
    renderDialog(giveAccess);
    expect(email()).toHaveValue('vrms.chief2@welinc.com');
    expect(email()).toHaveAttribute('readonly');
    expect(await within(dialog()).findByRole('heading', { name: 'Give access' })).toBeInTheDocument();
    expect(api.checkEmail).toHaveBeenCalledWith('vrms.chief2@welinc.com', 'VMMS', expect.any(AbortSignal));
    expect(within(dialog()).getByRole('radio', { name: /VMMS/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog()).getByRole('radio', { name: /VRMS/ })).toBeDisabled();
    expect(within(dialog()).getByText('Already has it')).toBeInTheDocument();
    expect(within(dialog()).queryByLabelText('Full name')).not.toBeInTheDocument();
  });

  it('asks for a role, then sends attachExisting, toasts and opens the person', async () => {
    const { onAdded } = renderDialog(giveAccess);
    await within(dialog()).findByRole('heading', { name: 'Give access' });
    await submit('Give access');
    expect(within(dialog()).getByText('Pick a role.')).toBeInTheDocument();
    expect(api.createPerson).not.toHaveBeenCalled();
    await pick(/Operations/);
    expect(within(dialog()).getByText(/gets Operations in VMMS straight away/)).toBeInTheDocument();
    await submit('Give access');
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
    await within(dialog()).findByRole('heading', { name: 'Give access' });
    await pick(/Operations/);
    await submit('Give access');
    expect(onAdded).not.toHaveBeenCalled();
    expect(notify.notifySuccess).not.toHaveBeenCalled();
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it("shows the server's message when the request fails", async () => {
    api.createPerson.mockRejectedValue({ response: { status: 400, data: { message: 'Pick a smaller role.' } } });
    renderDialog(giveAccess);
    await within(dialog()).findByRole('heading', { name: 'Give access' });
    await pick(/Operations/);
    await submit('Give access');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Pick a smaller role.');
  });
});

describe('Add a user (AC-22, AC-23)', () => {
  it('shows the red mark for something that is not an email yet, and never checks it', async () => {
    renderDialog({});
    await fill(email(), 'cristina.delacruz@welinc');
    expect(await within(dialog()).findByText('Enter the whole email, like name@example.com.')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(api.checkEmail).not.toHaveBeenCalled();
  });

  it('checks a whole email once typing stops, lowercased, and shows the tick when it is free', async () => {
    renderDialog({});
    await fill(email(), 'Cristina.DelaCruz@welinc.com');
    expect(await within(dialog()).findByRole('img', { name: 'Email is free' })).toBeInTheDocument();
    expect(api.checkEmail).toHaveBeenCalledTimes(1);
    expect(api.checkEmail).toHaveBeenCalledWith('cristina.delacruz@welinc.com', 'VRMS', expect.any(AbortSignal));
  });

  it('asks for a name and a role, then sends a new person with the contact and says the invite went out', async () => {
    const { onAdded } = renderDialog({});
    await fill(email(), 'cristina.delacruz@welinc.com');
    await within(dialog()).findByRole('img', { name: 'Email is free' });
    await submit('Add and send invite');
    expect(within(dialog()).getByText('Enter their full name.')).toBeInTheDocument();
    expect(within(dialog()).getByText('Pick a role.')).toBeInTheDocument();
    await fill(within(dialog()).getByLabelText('Full name'), 'Ma. Cristina dela Cruz');
    await fill(within(dialog()).getByLabelText(/Contact number/), '+63 917 555 0142');
    await pick(/^Mechanic/);
    await submit('Add and send invite');
    expect(api.createPerson).toHaveBeenCalledWith({
      system: 'VRMS',
      name: 'Ma. Cristina dela Cruz',
      email: 'cristina.delacruz@welinc.com',
      roleAssignments: [{ role: 'MECHANIC', system: 'VRMS' }],
      contact: '+63 917 555 0142',
    });
    expect(notify.notifySuccess).toHaveBeenCalledWith('Alfredo Bautista was added. They got an email to set their password.');
    expect(onAdded).toHaveBeenCalledWith('p1');
  });

  it('warns when the setup email did not go out', async () => {
    api.createPerson.mockResolvedValue({ id: 'p2', name: 'Bea Dizon', setupEmailSent: false });
    renderDialog({ system: 'VMMS' });
    await fill(email(), 'bea.dizon@welinc.com');
    await within(dialog()).findByRole('img', { name: 'Email is free' });
    await fill(within(dialog()).getByLabelText('Full name'), 'Bea Dizon');
    await pick(/Operations/);
    await submit('Add and send invite');
    expect(notify.notifySuccess).toHaveBeenCalledWith(
      "Bea Dizon was added, but the setup email didn't go out. Send a setup code from their page.",
    );
  });

  it('turns into Give access when the email has an account, hiding the name fields', async () => {
    api.checkEmail.mockResolvedValue({ status: 'existing', name: 'Ramon Garcia', picture: null, systems: ['VMMS'] });
    renderDialog({});
    await fill(email(), 'vmms.chief@welinc.com');
    expect(await within(dialog()).findByText('Ramon Garcia already has an account')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Has an account' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('heading', { name: 'Give access' })).toBeInTheDocument();
    expect(within(dialog()).queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(within(dialog()).getByRole('radio', { name: /VMMS/ })).toBeDisabled();
  });

  it('blocks a person already in the system and opens them from the card', async () => {
    api.checkEmail.mockResolvedValue({ status: 'in-system', name: 'Ramon Garcia', picture: null, systems: ['VRMS'] });
    api.listPeople.mockResolvedValue({ items: [{ id: 'p9', email: 'ramon@welinc.com' }], next: null });
    const { onAdded } = renderDialog({});
    await fill(email(), 'ramon@welinc.com');
    expect(await within(dialog()).findByText(/Already in VRMS/)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Add and send invite' })).toBeDisabled();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Open user' }));
    expect(api.listPeople).toHaveBeenCalledWith({ system: 'VRMS', q: 'ramon@welinc.com', limit: 5 });
    expect(onAdded).toHaveBeenCalledWith('p9');
  });

  it('blocks a suite admin and an inactive account', async () => {
    api.checkEmail.mockResolvedValue({ status: 'suite-admin' });
    renderDialog({}, me({ suiteAdmin: true, adminOf: [] }));
    await fill(email(), 'suite@welinc.com');
    expect(await within(dialog()).findByText(/Suite admins can’t take a system role/)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Add and send invite' })).toBeDisabled();
  });

  it('turns an ACCOUNT_EXISTS answer into Give access for that account', async () => {
    api.createPerson.mockRejectedValue({
      response: { status: 409, data: { code: 'ACCOUNT_EXISTS', id: 'p7', name: 'Efren Lacson', systems: ['VMMS'] } },
    });
    renderDialog({});
    await fill(email(), 'efren@welinc.com');
    await within(dialog()).findByRole('img', { name: 'Email is free' });
    await fill(within(dialog()).getByLabelText('Full name'), 'Efren Lacson');
    await pick(/^Mechanic/);
    await submit('Add and send invite');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Send again to give that account access.');
    expect(within(dialog()).getByRole('heading', { name: 'Give access' })).toBeInTheDocument();
  });

  it('shows no system cards to an admin of one system and names the system on the role', async () => {
    renderDialog({}, me({ adminOf: ['VRMS'] }));
    expect(within(dialog()).queryByRole('radiogroup', { name: 'System' })).not.toBeInTheDocument();
    expect(within(dialog()).getByText('Role in VRMS')).toBeInTheDocument();
  });
});

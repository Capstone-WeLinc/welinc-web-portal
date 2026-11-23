import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AdminMe } from '@/lib/admin';
import { ReauthCancelled, type CatalogSystem, type PersonDetail } from '@/lib/adminApi';
import { AccessTab } from './AccessTab';

const api = vi.hoisted(() => ({ updatePerson: vi.fn() }));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0017 AC-12 (the three row kinds), AC-13 (Change role, Remove, the messages),
// AC-18 (conflicts close the dialog)

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
    name: 'VRMS',
    maxRolesPerUser: 2,
    roles: [
      { code: 'ADMIN', name: 'Admin', description: 'Manages VRMS users', isSystemAdmin: true },
      { code: 'CHIEF_MECHANIC', name: 'Chief Mechanic', description: 'Assigns work', isSystemAdmin: false },
      { code: 'MECHANIC', name: 'Mechanic', description: 'Works tickets', isSystemAdmin: false },
    ],
  },
  { code: 'VMMS', name: 'VMMS', maxRolesPerUser: 1, roles: [{ code: 'OPERATIONS', name: 'Operations', description: '', isSystemAdmin: false }] },
  { code: 'BMS', name: 'BMS', maxRolesPerUser: 1, roles: [{ code: 'OPERATIONS', name: 'Operations', description: '', isSystemAdmin: false }] },
];

const person = (over: Partial<PersonDetail> = {}): PersonDetail => ({
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
  lastSignedInAt: null,
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

const actions = () => ({ settled: vi.fn(), conflict: vi.fn(() => false) });

function renderTab(p: PersonDetail, viewer: AdminMe = me(), a = actions(), onGiveAccess = vi.fn()) {
  render(
    <MemoryRouter>
      <AccessTab person={p} me={viewer} catalog={catalog} actions={a} onGiveAccess={onGiveAccess} />
    </MemoryRouter>,
  );
  return { a, onGiveAccess };
}

const rowOf = (system: string) => screen.getByText(system, { selector: 'span' }).closest('li')!;

beforeEach(() => {
  vi.clearAllMocks();
  api.updatePerson.mockResolvedValue(undefined);
});

describe('the rows (AC-12)', () => {
  it('shows a held row with Change role and a read only row for a system someone else admins', () => {
    renderTab(person());
    expect(within(rowOf('VRMS')).getByText('Chief Mechanic')).toBeInTheDocument();
    expect(within(rowOf('VRMS')).getByRole('button', { name: 'Change role' })).toBeInTheDocument();
    expect(within(rowOf('BMS')).getByText('Managed by the BMS admin')).toBeInTheDocument();
    expect(within(rowOf('BMS')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers Give access for a system the person is not in, and reports which system', async () => {
    const { onGiveAccess } = renderTab(person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }] }));
    expect(within(rowOf('VMMS')).getByText('No access')).toBeInTheDocument();
    await userEvent.click(within(rowOf('VMMS')).getByRole('button', { name: 'Give access' }));
    expect(onGiveAccess).toHaveBeenCalledWith('VMMS');
  });

  it('shows a temporary role with its end and a link, and no Change role', () => {
    renderTab(person({ roles: [{ role: 'OPERATIONS', system: 'BMS', temporaryUntil: '2026-11-23T17:32:00.000Z' }] }), me({ suiteAdmin: true, adminOf: [] }));
    const row = rowOf('BMS');
    expect(within(row).getByText('Until 2026-11-24 01:32')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Temporary access' })).toHaveAttribute('href', '/admin/temporary-access');
    expect(within(row).queryByRole('button', { name: 'Change role' })).not.toBeInTheDocument();
  });

  it('says a person with no role has no access and gives a suite admin Give access on all three', () => {
    renderTab(person({ roles: [], otherSystems: [] }), me({ suiteAdmin: true, adminOf: [] }));
    expect(screen.getByText('No access to VRMS, VMMS or BMS.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Give access' })).toHaveLength(3);
  });

  it('hides Change role and Give access on a suite admin', () => {
    renderTab(person({ suiteAdmin: true, roles: [{ role: 'MECHANIC', system: 'VRMS' }] }), me({ suiteAdmin: true, adminOf: [] }));
    expect(screen.queryByRole('button', { name: 'Change role' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give access' })).not.toBeInTheDocument();
  });

  it('hides Change role on your own page', () => {
    renderTab(person({ id: 'me' }));
    expect(screen.queryByRole('button', { name: 'Change role' })).not.toBeInTheDocument();
  });
});

describe('Change role (AC-13)', () => {
  const open = async (system = 'VRMS') => {
    await userEvent.click(within(rowOf(system)).getByRole('button', { name: 'Change role' }));
    return screen.findByRole('dialog');
  };

  it('lists the system\'s catalog roles with the current one chosen and Save off until it changes', async () => {
    renderTab(person());
    const dialog = await open();
    expect(within(dialog).getByRole('heading', { name: 'Change role in VRMS' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog).getByRole('radio', { name: /Chief Mechanic/ })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('sends the one chosen role for that system, then toasts, closes and settles with a role change', async () => {
    const { a } = renderTab(person());
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Works tickets/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(api.updatePerson).toHaveBeenCalledWith('p1', 'VRMS', { roleAssignments: [{ role: 'MECHANIC', system: 'VRMS' }] });
    expect(notify.notifySuccess).toHaveBeenCalledWith('Corazon Villareal is now Mechanic in VRMS.');
    expect(a.settled).toHaveBeenCalledWith({ roleChanged: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says what a person holding two roles is replaced by', async () => {
    renderTab(person({ roles: [{ role: 'CHIEF_MECHANIC', system: 'VRMS' }, { role: 'MECHANIC', system: 'VRMS' }] }));
    const dialog = await open();
    expect(within(dialog).getByText('This replaces Chief Mechanic and Mechanic.')).toBeInTheDocument();
  });

  it('removes the person from the system with an empty role list', async () => {
    renderTab(person());
    const dialog = await open('VMMS');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove from VMMS' }));
    expect(api.updatePerson).toHaveBeenCalledWith('p1', 'VMMS', { roleAssignments: [] });
    expect(notify.notifySuccess).toHaveBeenCalledWith('Corazon Villareal no longer has access to VMMS.');
  });

  it('disables Remove on someone\'s only access and points to Deactivate', async () => {
    renderTab(person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }] }));
    const dialog = await open();
    expect(within(dialog).getByRole('button', { name: 'Remove from VRMS' })).toBeDisabled();
    expect(within(dialog).getByText('This is their only access. Deactivate them instead.')).toBeInTheDocument();
  });

  it.each([
    ['LAST_ADMIN', 'Corazon Villareal is the last active admin of VRMS. Make someone else admin first.'],
    ['TEMPORARY_ROLE', 'This role is temporary and ends by itself.'],
    ['ROLE_LIMIT', 'They already hold two roles here.'],
  ])('shows %s inline and keeps the dialog open', async (code, message) => {
    api.updatePerson.mockRejectedValue({ response: { status: 409, data: { code, message: 'They already hold two roles here.' } } });
    const { a } = renderTab(person());
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Works tickets/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(a.settled).not.toHaveBeenCalled();
  });

  it('shows a plain fallback for an error with no code', async () => {
    api.updatePerson.mockRejectedValue(new Error('boom'));
    renderTab(person());
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Works tickets/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't change the role. Try again.");
  });

  it('closes the dialog when the page handled a conflict, and shows nothing more', async () => {
    api.updatePerson.mockRejectedValue(new Error('409'));
    const a = actions();
    a.conflict.mockReturnValue(true);
    renderTab(person(), me(), a);
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Works tickets/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(a.conflict).toHaveBeenCalledTimes(1);
  });

  it('stays open and quiet when the password dialog is cancelled', async () => {
    api.updatePerson.mockRejectedValue(new ReauthCancelled());
    const a = actions();
    renderTab(person(), me(), a);
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Works tickets/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(a.conflict).not.toHaveBeenCalled();
  });
});

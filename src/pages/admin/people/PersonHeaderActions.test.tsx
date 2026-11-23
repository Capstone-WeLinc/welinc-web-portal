import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMe } from '@/lib/admin';
import type { PersonDetail } from '@/lib/adminApi';
import { PersonHeaderActions } from './PersonHeaderActions';

const api = vi.hoisted(() => ({
  deletePerson: vi.fn(),
  endPersonSessions: vi.fn(),
  restorePerson: vi.fn(),
  sendResetCode: vi.fn(),
  setPersonActive: vi.fn(),
  unlockPerson: vi.fn(),
  updatePerson: vi.fn(),
}));
const notify = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));
vi.mock('@/lib/adminApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/adminApi')>()), ...api }));
vi.mock('@/lib/notify', () => notify);

// covers: suite spec 0017 AC-8 (buttons by status, hidden and disabled menu items), AC-16 (the
// system an action sends), AC-17 (a deleted account), AC-18 (conflict handling)

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Felicidad Roxas', email: 'multi.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: ['VRMS', 'VMMS'],
  codeRequired: false,
  codePassed: true,
  ...over,
});

const person = (over: Partial<PersonDetail> = {}): PersonDetail => ({
  id: 'p1',
  name: 'Alberto Santiago',
  email: 'alberto.santiago30@welinc.com',
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
    { role: 'MECHANIC', system: 'VRMS' },
    { role: 'MECHANIC', system: 'VMMS' },
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

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'More account actions' }));
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent?.trim() ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue(undefined);
});

describe('buttons by status (AC-8)', () => {
  it('shows Edit details and the menu for an active person, with no status button', () => {
    render(<PersonHeaderActions person={person()} me={me()} actions={actions()} />);
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlock account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend invite' })).not.toBeInTheDocument();
  });

  it('shows Unlock account for a locked person and unlocks with the first system the viewer admins', async () => {
    const a = actions();
    render(<PersonHeaderActions person={person({ isLocked: true })} me={me()} actions={a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock account' }));
    expect(api.unlockPerson).toHaveBeenCalledWith('p1', 'VRMS');
    expect(notify.notifySuccess).toHaveBeenCalledWith('Alberto Santiago can sign in again.');
    expect(a.settled).toHaveBeenCalledTimes(1);
  });

  it('shows Resend invite for a pending person, and the menu says Send setup code', async () => {
    const a = actions();
    render(<PersonHeaderActions person={person({ passwordSet: false, emailVerified: false })} me={me()} actions={a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Resend invite' }));
    expect(api.sendResetCode).toHaveBeenCalledWith('p1', 'VRMS');
    expect(await openMenu()).toContain('Send setup code');
  });

  it('does not call a pending person pending when they are also locked', () => {
    render(<PersonHeaderActions person={person({ passwordSet: false, isLocked: true })} me={me()} actions={actions()} />);
    expect(screen.queryByRole('button', { name: 'Resend invite' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock account' })).toBeInTheDocument();
  });
});

describe('the more actions menu (AC-8)', () => {
  it('lists every action for an active person in someone else\'s systems', async () => {
    render(<PersonHeaderActions person={person()} me={me()} actions={actions()} />);
    expect(await openMenu()).toEqual(['Send reset code', 'End all sessions', 'Deactivate', 'Delete account']);
  });

  it('offers Reactivate for an inactive person and no code or session actions', async () => {
    render(<PersonHeaderActions person={person({ isActive: false })} me={me()} actions={actions()} />);
    expect(await openMenu()).toEqual(['Reactivate', 'Delete account']);
  });

  it('hides End all sessions, Deactivate and Delete on your own page', async () => {
    render(<PersonHeaderActions person={person({ id: 'me' })} me={me()} actions={actions()} />);
    expect(await openMenu()).toEqual(['Send reset code']);
  });

  it('hides Deactivate and Delete on a suite admin', async () => {
    render(<PersonHeaderActions person={person({ suiteAdmin: true })} me={me()} actions={actions()} />);
    expect(await openMenu()).toEqual(['Send reset code', 'End all sessions']);
  });

  it('disables Delete with "Shared with BMS" when a system admin shares the account with a system they do not admin', async () => {
    const shared = person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }, { role: 'OPERATIONS', system: 'BMS' }] });
    render(<PersonHeaderActions person={shared} me={me()} actions={actions()} />);
    await openMenu();
    const del = screen.getByRole('menuitem', { name: /Delete account/ });
    expect(del).toHaveAttribute('aria-disabled', 'true');
    expect(del).toHaveTextContent('Shared with BMS');
  });

  it('lets a suite admin delete an account shared across systems', async () => {
    const shared = person({ roles: [{ role: 'MECHANIC', system: 'VRMS' }, { role: 'OPERATIONS', system: 'BMS' }] });
    render(<PersonHeaderActions person={shared} me={me({ suiteAdmin: true, adminOf: [] })} actions={actions()} />);
    await openMenu();
    expect(screen.getByRole('menuitem', { name: /Delete account/ })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('a person with no role (AC-17)', () => {
  it('shows no Edit details and only Delete in the menu for a suite admin', async () => {
    const none = person({ roles: [], otherSystems: [] });
    render(<PersonHeaderActions person={none} me={me({ suiteAdmin: true, adminOf: [] })} actions={actions()} />);
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(await openMenu()).toEqual(['Delete account']);
  });

  it('says there are no actions on your own page when you hold no role', async () => {
    const none = person({ id: 'me', roles: [], otherSystems: [] });
    render(<PersonHeaderActions person={none} me={me({ suiteAdmin: true, adminOf: [] })} actions={actions()} />);
    expect(await openMenu()).toEqual(['No actions for this account']);
  });
});

describe('a deleted account (AC-17)', () => {
  const deleted = person({ deletedAt: '2026-11-23T10:00:00.000Z', restorableUntil: '2026-12-23T10:00:00.000Z' });

  it('shows only Restore to a suite admin, and restores with no system', async () => {
    const a = actions();
    render(<PersonHeaderActions person={deleted} me={me({ suiteAdmin: true, adminOf: [] })} actions={a} />);
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More account actions' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(api.restorePerson).toHaveBeenCalledWith('p1', null);
    expect(a.settled).toHaveBeenCalled();
  });

  it('shows a system admin nothing at all', () => {
    const { container } = render(<PersonHeaderActions person={deleted} me={me()} actions={actions()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('when an action fails (AC-18)', () => {
  it('shows the server\'s message when nothing changed under the viewer', async () => {
    api.unlockPerson.mockRejectedValue({ response: { data: { message: 'Not allowed.' } } });
    const a = actions();
    render(<PersonHeaderActions person={person({ isLocked: true })} me={me()} actions={a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock account' }));
    expect(a.conflict).toHaveBeenCalledTimes(1);
    expect(notify.notifyError).toHaveBeenCalledTimes(1);
    expect(a.settled).not.toHaveBeenCalled();
    expect(notify.notifySuccess).not.toHaveBeenCalled();
  });

  it('stays quiet when the page already handled the conflict', async () => {
    api.unlockPerson.mockRejectedValue(new Error('409'));
    const a = actions();
    a.conflict.mockReturnValue(true);
    render(<PersonHeaderActions person={person({ isLocked: true })} me={me()} actions={a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock account' }));
    expect(a.conflict).toHaveBeenCalledTimes(1);
    expect(notify.notifyError).not.toHaveBeenCalled();
  });
});

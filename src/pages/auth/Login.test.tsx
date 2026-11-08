import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import Login from './Login';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: { post: vi.fn(), get: vi.fn() },
}));

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const assign = vi.fn();
const REQUEST = 'r'.repeat(43);
const ANSWER = {
  user: { id: 'u1', name: 'Pedro', email: 'pedro@welinc.com' },
  system: 'VRMS',
  url: 'http://localhost:8001',
};

function renderLogin(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>,
  );
}

function httpError(status: number, data: Record<string, unknown> = {}) {
  const error = new AxiosError('failed');
  error.response = { status, data } as AxiosError['response'];
  return error;
}

async function submit(email: string, password = 'pw') {
  const user = userEvent.setup();
  await user.type(await screen.findByPlaceholderText(/you@welinc.com/), email);
  await user.type(screen.getByPlaceholderText('Enter password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
}

// covers: spec 0003 AC-11 (no token in the answer), AC-36 (the portal's login flow)
describe('Login', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    assign.mockReset();
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the form when there is no SSO session, then goes to the address the login names', async () => {
    get.mockRejectedValue(httpError(401, { code: 'SESSION_ENDED' }));
    post.mockResolvedValue({ data: ANSWER });
    renderLogin();

    await submit('pedro');

    expect(get).toHaveBeenCalledWith('/auth/sso');
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'pedro@welinc.com', password: 'pw' });
    expect(assign).toHaveBeenCalledWith('http://localhost:8001');
    expect(localStorage.length).toBe(0);
  });

  it('continues a login request after signing in', async () => {
    get.mockRejectedValue(httpError(401));
    post.mockResolvedValue({ data: ANSWER });
    renderLogin(`/login?request=${REQUEST}`);

    await submit('pedro@welinc.com');

    expect(assign).toHaveBeenCalledWith(
      `http://localhost:3000/auth/authorize/resume?request=${REQUEST}`,
    );
  });

  it('skips the form when the SSO session is live', async () => {
    get.mockResolvedValue({ data: ANSWER });
    renderLogin('/');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:8001'));
    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  });

  it('always shows the form after a logout or an idle cutoff, without asking /auth/sso', async () => {
    for (const reason of ['logout', 'idle']) {
      const view = renderLogin(`/login?reason=${reason}`);
      expect(await screen.findByRole('button', { name: 'Sign In' })).toBeTruthy();
      expect(screen.getByRole('status')).toBeTruthy();
      view.unmount();
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('shows an error code from an app with a Sign in again button', async () => {
    get.mockRejectedValue(httpError(401));
    renderLogin('/?error=NO_SYSTEM_ACCESS&system=VRMS');

    expect((await screen.findByRole('alert')).textContent).toContain('no access to VRMS');
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the lockout, attempts and no access messages', async () => {
    get.mockRejectedValue(httpError(401));
    for (const [data, text] of [
      [{ isLocked: true }, 'locked'],
      [{ remainingAttempts: 2 }, '2 attempts remaining'],
      [{ code: 'NO_SYSTEM_ACCESS' }, 'no assigned subsystem'],
    ] as const) {
      post.mockRejectedValueOnce(httpError(403, data));
      const view = renderLogin();
      await submit('pedro');
      expect((await screen.findByRole('alert')).textContent).toContain(text);
      view.unmount();
    }
    expect(assign).not.toHaveBeenCalled();
  });
});

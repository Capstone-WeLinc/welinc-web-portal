import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import Login from './Login';
import { api } from '../../lib/api';
import { ToastContext } from '../../context/toast';

vi.mock('../../lib/api', () => ({
  api: { post: vi.fn(), defaults: { headers: { common: {} as Record<string, string> } } },
}));

const showToast = vi.fn();
const post = vi.mocked(api.post);
const hrefSet = vi.fn();

function renderLogin(path = '/login') {
  return render(
    <ToastContext.Provider value={{ showToast }}>
      <MemoryRouter initialEntries={[path]}>
        <Login />
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

function httpError(status: number, data: Record<string, unknown>) {
  const error = new AxiosError('failed');
  error.response = { status, data } as AxiosError['response'];
  return error;
}

async function submit(email: string, password = 'pw') {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.type(screen.getByPlaceholderText(/you@welinc.com/), email);
  await user.type(screen.getByPlaceholderText('Enter password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      set href(v: string) {
        hrefSet(v);
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// covers: spec 0002 AC-7 (welinc-auth picks the system; the portal goes there)
describe('Login', () => {
  it('sends the typed email, adding @welinc.com to a bare username', async () => {
    post.mockRejectedValue(httpError(401, {}));
    renderLogin();

    await submit('  pedro ');

    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'pedro@welinc.com',
      password: 'pw',
    });
  });

  it('stores the session and redirects to the system auth chose, with the token', async () => {
    post.mockResolvedValue({
      data: {
        accessToken: 'tok.en.x',
        system: 'VMMS',
        user: { id: 'u1', email: 'a@welinc.com', roles: [] },
      },
    });
    renderLogin();

    await submit('a@welinc.com');
    await act(() => vi.advanceTimersByTimeAsync(900));

    expect(localStorage.getItem('welinc_token')).toBe('tok.en.x');
    expect(localStorage.getItem('welinc_system')).toBe('VMMS');
    expect(hrefSet).toHaveBeenCalledWith('http://localhost:8002/login?token=tok.en.x');
    expect(showToast).toHaveBeenCalledWith('Welcome back! Logging you in...', 'success');
  });

  it('refuses a system the portal does not know and stores nothing', async () => {
    post.mockResolvedValue({
      data: { accessToken: 't', system: 'HR', user: { id: 'u', email: '', roles: [] } },
    });
    renderLogin();

    await submit('a@welinc.com');

    expect(await screen.findByText(/Unable to open your workspace/)).toBeInTheDocument();
    expect(localStorage.getItem('welinc_token')).toBeNull();
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it.each([
    ['a locked account', 403, { isLocked: true }, /account is locked/],
    ['remaining attempts', 401, { remainingAttempts: 2 }, /2 attempts remaining/],
    ['bad credentials', 401, {}, /Invalid email or password/],
    ['no subsystem access', 403, { code: 'NO_SYSTEM_ACCESS' }, /no assigned subsystem access/],
    ['validation messages', 400, { message: ['a bad', 'b bad'] }, /a bad, b bad/],
  ])('shows the right message for %s', async (_n, status, data, text) => {
    post.mockRejectedValue(httpError(status, data));
    renderLogin();

    await submit('a@welinc.com');

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('says the server cannot be reached on a network failure', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    renderLogin();

    await submit('a@welinc.com');

    expect(await screen.findByText(/Unable to reach the authentication server/)).toBeInTheDocument();
  });

  it('clears any old session when the account has no system access', async () => {
    localStorage.setItem('welinc_token', 'old');
    post.mockRejectedValue(httpError(403, { code: 'NO_SYSTEM_ACCESS' }));
    renderLogin();

    await submit('a@welinc.com');
    await screen.findByText(/no assigned subsystem access/);

    expect(localStorage.getItem('welinc_token')).toBeNull();
  });

  it('shows Authenticating and disables the button while signing in', async () => {
    post.mockReturnValue(new Promise(() => {}));
    renderLogin();

    await submit('a@welinc.com');

    expect(await screen.findByRole('button', { name: 'Authenticating...' })).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('signs out and toasts on ?logout=true', async () => {
    localStorage.setItem('welinc_token', 'old');
    renderLogin('/login?logout=true');

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Successfully logged out.', 'success'),
    );
    expect(localStorage.getItem('welinc_token')).toBeNull();
  });

  it('signs out and toasts on ?inactivity=true', async () => {
    localStorage.setItem('welinc_token', 'old');
    renderLogin('/login?inactivity=true');

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Signed out due to inactivity.', 'info'),
    );
    expect(localStorage.getItem('welinc_token')).toBeNull();
  });
});

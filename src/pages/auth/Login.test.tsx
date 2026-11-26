import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { api } from '../../lib/api';
import type { LauncherAnswer } from '../../lib/auth';

vi.mock('../../lib/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: { post: vi.fn(), get: vi.fn() },
}));

// jsdom has no layout; input-otp (the code step) measures its field with these
if (!document.elementFromPoint) document.elementFromPoint = () => null;
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// covers: suite spec 0019 AC-13 (the sign in copy and form), AC-15 (an ended session is a toast,
// errors stay inline), and spec 0009 (an admin's code step replaces the form)

const post = vi.mocked(api.post);
const failure = (status: number, data: object = {}) => ({ isAxiosError: true, response: { status, data } });

const ANSWER = { user: { id: 'u1', name: 'Ana', email: 'ana@welinc.com', picture: null }, systems: [] } as unknown as LauncherAnswer;

function renderLogin(over: Partial<Parameters<typeof Login>[0]> = {}, path = '/login') {
  const onSignedIn = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Login onSignedIn={onSignedIn} {...over} />
    </MemoryRouter>,
  );
  return onSignedIn;
}

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByPlaceholderText('Enter password'), password);
  return user;
}

beforeEach(() => {
  post.mockReset();
});

afterEach(() => cleanup());

describe('the sign in form', () => {
  it('reads the copy AC-13 names, with a way to forgot password and no account help', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Enter your credentials to access the workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByText('No account? Ask your admin to add you.')).toBeInTheDocument();
  });

  it('posts the trimmed email and the password, then hands the answer on', async () => {
    post.mockResolvedValue({ data: ANSWER });
    const onSignedIn = renderLogin();
    const user = await fill('  ana@welinc.com ', 'secret-1');
    await user.click(screen.getByRole('button', { name: /^Sign in/ }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ANSWER));
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'ana@welinc.com', password: 'secret-1' });
  });

  it('adds @welinc.com to a bare username', async () => {
    post.mockResolvedValue({ data: ANSWER });
    renderLogin();
    const user = await fill('vrms.admin', 'x');
    await user.click(screen.getByRole('button', { name: /^Sign in/ }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ email: 'vrms.admin@welinc.com' });
  });

  it('shows the failure inline and keeps the form, so the person can try again', async () => {
    post.mockRejectedValue(failure(401));
    const onSignedIn = renderLogin();
    const user = await fill('ana@welinc.com', 'wrong');
    await user.click(screen.getByRole('button', { name: /^Sign in/ }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Sign in/ })).toBeEnabled();
  });

  it('says so plainly when the service cannot be reached', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    renderLogin();
    const user = await fill('ana@welinc.com', 'x');
    await user.click(screen.getByRole('button', { name: /^Sign in/ }));
    expect(
      await screen.findByText('Unable to reach the sign in service. Check your connection and try again.'),
    ).toBeInTheDocument();
  });

  it('turns to the code step, and drops the form, when an admin sign in asks for a code', async () => {
    post.mockResolvedValue({ data: { status: 'SIGN_IN_CODE_REQUIRED', challengeId: 'c1', email: 'admin@welinc.com' } });
    const onSignedIn = renderLogin();
    const user = await fill('admin@welinc.com', 'admin1234');
    await user.click(screen.getByRole('button', { name: /^Sign in/ }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Enter password')).not.toBeInTheDocument());
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});

describe('a message from the address or the portal', () => {
  it('shows an error notice inline with a way to sign in again', () => {
    renderLogin({ notice: { tone: 'error', message: 'Your session ended. Sign in again.' } });
    expect(screen.getByText('Your session ended. Sign in again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('keeps a sign out message off the page, since it is a toast over the form', () => {
    renderLogin({ notice: { tone: 'success', message: 'You signed out.' } });
    expect(screen.queryByText('Sign in again')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

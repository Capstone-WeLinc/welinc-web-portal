import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: { post: vi.fn(), get: vi.fn() },
}));

// jsdom has no layout; input-otp measures its field with these
if (!document.elementFromPoint) document.elementFromPoint = () => null;
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const post = vi.mocked(api.post);
const failure = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

// input-otp starts timers its unmount does not clear; clear the leftovers (see EmailCodeStep.test.tsx)
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const realSetTimeout = globalThis.setTimeout;

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: {} });
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const id: ReturnType<typeof setTimeout> = realSetTimeout(() => {
      pendingTimers.delete(id);
      if (typeof handler === 'function') handler(...args);
    }, ms);
    pendingTimers.add(id);
    return id;
  }) as typeof setTimeout);
});

afterEach(() => {
  cleanup();
  vi.mocked(globalThis.setTimeout).mockRestore();
  for (const id of pendingTimers) clearTimeout(id);
  pendingTimers.clear();
});

async function toCodeStep() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText(/^Work email/), ' Pedro@WeLinc.com ');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByRole('heading', { name: 'Check your email' });
  return { user, field: screen.getByLabelText(/^Reset code/) as HTMLInputElement };
}

describe('ForgotPassword', () => {
  it('never says whether the email has an account', async () => {
    await toCodeStep();
    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'pedro@welinc.com' });
    expect(screen.getByText(/has a WeLinc account, we sent/)).toBeTruthy();
    expect(screen.queryByText(/no account/i)).toBeNull();
  });

  it('checks the code on the sixth digit and moves to the new password', async () => {
    const { user, field } = await toCodeStep();
    await user.type(field, '123456');
    await screen.findByRole('heading', { name: 'Set a new password' });
    expect(post).toHaveBeenLastCalledWith('/auth/verify-otp', { email: 'pedro@welinc.com', otp: '123456' });
  });

  // covers: suite spec 0019 AC-14 (the strength box, Confirm new password, and step 4)
  it('ticks the four rules as they are met, says when the passwords match, then confirms', async () => {
    const { user, field } = await toCodeStep();
    await user.type(field, '123456');
    await screen.findByRole('heading', { name: 'Set a new password' });
    expect(screen.getByText('Not set yet')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'marikina');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('8 or more characters').textContent).toContain('done');
    expect(screen.getByText('A symbol, like ! or #').textContent).toContain('not yet');
    await user.type(screen.getByLabelText('New password'), '2026!M');
    expect(screen.getByText('Strong')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Confirm new password'), 'marikina2026!');
    expect(screen.getByText("Passwords don't match yet")).toBeInTheDocument();
    await user.type(screen.getByLabelText('Confirm new password'), 'M');
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(post).toHaveBeenLastCalledWith('/auth/reset-password', {
      email: 'pedro@welinc.com',
      otp: '123456',
      newPassword: 'marikina2026!M',
    });
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(screen.getByText(/signed you out on your other devices/)).toBeInTheDocument();
  });

  it('clears a wrong code and says so', async () => {
    const { user, field } = await toCodeStep();
    post.mockRejectedValueOnce(failure(400));
    await user.type(field, '000000');
    expect(await screen.findByText(/isn't right or has expired/)).toBeTruthy();
    await waitFor(() => expect(field.value).toBe(''));
  });

  it('holds Resend for a minute after a code is sent', async () => {
    await toCodeStep();
    // Board `R32Forgot2`: the wait shows as a clock, and the send button only once it ends
    expect(screen.getByText(/^[01]:\d\d$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a new code' })).toBeNull();
  });

  it('names the network limit', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(failure(429));
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/^Work email/), 'pedro@welinc.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/Too many tries from this network/)).toBeTruthy();
  });
});
